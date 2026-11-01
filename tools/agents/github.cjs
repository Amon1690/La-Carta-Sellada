const fs = require('node:fs');
const { inspectChanges, readReview } = require('./policy.cjs');

const labels = {
  'agent:backlog': ['c5def5', 'Propuesta pendiente de priorizar'],
  'agent:ready': ['0e8a16', 'Autorizada para el siguiente ciclo'],
  'agent:in-progress': ['fbca04', 'Reservada por una ejecución'],
  'agent:review': ['5319e7', 'PR preparada para decisión humana'],
  'agent:blocked': ['b60205', 'Necesita intervención antes de continuar'],
  'agent:proposal': ['d4c5f9', 'Hallazgo de auditoría, sin autorizar'],
};
const marker = (id) => `<!-- agent-task:${id} -->`;
const has = (issue, label) => issue.labels.some((entry) => (entry.name ?? entry) === label);
const attempts = (comments) => comments.filter((c) => c.user?.login === 'github-actions[bot]' && /<!-- agent-attempt:\d+ -->/.test(c.body ?? '')).length;
const taskId = (issue) => issue.body?.match(/<!-- agent-task:([a-z][a-z0-9-]{2,60}) -->/)?.[1];
const clip = (text, size = 12000) => String(text ?? '').slice(0, size);

function apiContext(github, context) {
  const repo = context.repo;
  const allIssues = () => github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'all', per_page: 100 });
  const comments = (issue_number) => github.paginate(github.rest.issues.listComments, { ...repo, issue_number, per_page: 100 });
  const comment = (issue_number, body) => github.rest.issues.createComment({ ...repo, issue_number, body });
  const add = (issue_number, label) => github.rest.issues.addLabels({ ...repo, issue_number, labels: [label] });
  const remove = async (issue_number, name) => {
    try { await github.rest.issues.removeLabel({ ...repo, issue_number, name }); }
    catch (error) { if (error.status !== 404) throw error; }
  };
  return { repo, allIssues, comments, comment, add, remove };
}

async function plan({ github, context, core }) {
  const a = apiContext(github, context);
  const mode = process.env.AGENT_MODE || 'work';
  if (context.ref !== `refs/heads/${context.payload.repository.default_branch}`) throw new Error('Ejecuta el workflow desde la rama predeterminada.');
  if (mode !== 'bootstrap' && process.env.AGENTS_ENABLED !== 'true') {
    await core.summary.addRaw('Agentes pausados: configura AGENTS_ENABLED=true para activarlos.').write();
    return;
  }
  if (mode !== 'bootstrap' && (process.env.HAS_OPENAI_KEY !== 'true' || !process.env.AGENTS_MODEL)) {
    throw new Error('Falta OPENAI_API_KEY o la variable AGENTS_MODEL. No se ha iniciado ningún agente.');
  }
  for (const [name, [color, description]] of Object.entries(labels)) {
    try { await github.rest.issues.createLabel({ ...a.repo, name, color, description }); }
    catch (error) { if (error.status !== 422) throw error; }
  }
  const issues = (await a.allIssues()).filter((issue) => !issue.pull_request);
  const backlog = JSON.parse(fs.readFileSync('.github/agents/backlog.json', 'utf8'));
  if (mode === 'bootstrap') {
    for (const task of backlog) {
      if (issues.some((i) => i.body?.includes(marker(task.id)))) continue;
      const body = `${marker(task.id)}\n\n${task.acceptance.map((c) => `- [ ] ${c}`).join('\n')}\n\nDependencias: ${task.dependsOn.join(', ') || 'ninguna'}.\nPrioridad: ${task.priority}.`;
      await github.rest.issues.create({ ...a.repo, title: task.title, body, labels: ['agent:ready'] });
    }
    await core.summary.addRaw('Cola inicial creada sin duplicados. Las dependencias se comprueban antes de reservar.').write();
    return;
  }
  const pulls = await github.paginate(github.rest.pulls.list, { ...a.repo, state: 'open', per_page: 100 });
  // Recupera reservas interrumpidas solo si GitHub confirma que su ejecución terminó.
  for (const issue of issues.filter((i) => has(i, 'agent:in-progress'))) {
    const history = await a.comments(issue.number);
    const lease = history.filter((c) => c.user?.login === 'github-actions[bot]').map((c) => c.body?.match(/<!-- agent-attempt:(\d+) -->/)).filter(Boolean).at(-1);
    if (!lease) {
      await a.add(issue.number, 'agent:blocked');
      await a.remove(issue.number, 'agent:in-progress');
      await a.comment(issue.number, 'Reserva sin identificador de ejecución. Se bloquea para recuperación manual.');
      continue;
    }
    const { data: run } = await github.rest.actions.getWorkflowRun({ ...a.repo, run_id: Number(lease[1]) });
    if (run.status !== 'completed') continue;
    const taskPr = pulls.find((p) => p.body?.includes(`<!-- agent-issue:${issue.number} -->`));
    const label = taskPr ? 'agent:review' : attempts(history) >= 2 ? 'agent:blocked' : 'agent:ready';
    await a.add(issue.number, label);
    await a.remove(issue.number, 'agent:in-progress');
    issue.labels = issue.labels.filter((l) => (l.name ?? l) !== 'agent:in-progress');
    issue.labels.push({ name: label });
    await a.comment(issue.number, `Reserva recuperada de una ejecución terminada. Estado: ${label}.`);
  }
  fs.mkdirSync('.agent-runtime', { recursive: true });
  if (mode === 'audit') {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, { ...a.repo, workflow_id: 'agent-cycle.yml', created: `>=${since}`, per_page: 100 });
    // Un auditor por semana, incluso si alguien dispara manualmente varias ejecuciones.
    if (runs.filter((r) => r.display_title === 'Agentes · audit').length > 1 || Number(process.env.GITHUB_RUN_ATTEMPT ?? 1) > 1) {
      await core.summary.addRaw('Auditoría semanal ya ejecutada.').write(); return;
    }
    fs.writeFileSync('.agent-runtime/issues.json', JSON.stringify(issues.map((i) => ({ id: taskId(i), title: i.title, state: i.state, body: clip(i.body, 4000) })), null, 2));
    core.setOutput('mode', 'audit'); core.setOutput('base', context.sha);
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, { ...a.repo, workflow_id: 'agent-cycle.yml', created: `>=${today}T00:00:00Z`, per_page: 100 });
  if (runs.filter((r) => r.display_title === 'Agentes · work').length > 4 || Number(process.env.GITHUB_RUN_ATTEMPT ?? 1) > 1) {
    await core.summary.addRaw('Límite diario alcanzado o reejecución bloqueada. Usa un ciclo nuevo, máximo cuatro al día UTC.').write(); return;
  }
  if (pulls.filter((p) => p.head.ref.startsWith('codex/agent-')).length >= 3) {
    await core.summary.addRaw('Hay tres PRs de agentes abiertas. Revisa las pendientes antes de iniciar más trabajo.').write(); return;
  }
  const closedIds = new Set();
  for (const issue of issues.filter((i) => i.state === 'closed' && taskId(i))) {
    const linked = await github.paginate(github.rest.pulls.list, { ...a.repo, state: 'closed', head: `${a.repo.owner}:codex/agent-${issue.number}`, per_page: 100 });
    if (linked.some((p) => p.merged_at)) closedIds.add(taskId(issue));
  }
  const ready = issues.filter((i) => i.state === 'open' && has(i, 'agent:ready') && !['agent:in-progress', 'agent:review', 'agent:blocked'].some((label) => has(i, label)))
    .sort((x, y) => (backlog.find((t) => t.id === taskId(x))?.priority ?? 100) - (backlog.find((t) => t.id === taskId(y))?.priority ?? 100) || x.number - y.number);
  for (const issue of ready) {
    const definition = backlog.find((t) => t.id === taskId(issue));
    if (definition?.dependsOn.some((id) => !closedIds.has(id))) continue;
    const branch = `codex/agent-${issue.number}`;
    if (pulls.some((p) => p.head.ref === branch)) continue;
    const history = await a.comments(issue.number);
    if (attempts(history) >= 2) { await a.add(issue.number, 'agent:blocked'); await a.remove(issue.number, 'agent:ready'); continue; }
    let orphan;
    try { orphan = await github.rest.git.getRef({ ...a.repo, ref: `heads/${branch}` }); }
    catch (error) { if (error.status !== 404) throw error; }
    if (orphan) {
      await a.add(issue.number, 'agent:blocked'); await a.remove(issue.number, 'agent:ready');
      await a.comment(issue.number, `Existe la rama ${branch} sin una PR abierta. Recupera su propuesta manualmente antes de reactivar; no se gastará otro intento.`);
      continue;
    }
    // Solo tareas creadas por colaboradores o por este workflow (bootstrap/auditoría).
    if (issue.user.login !== 'github-actions[bot]') {
      const { data } = await github.rest.repos.getCollaboratorPermissionLevel({ ...a.repo, username: issue.user.login });
      if (!['admin', 'maintain', 'write'].includes(data.permission)) continue;
    }
    await a.comment(issue.number, `<!-- agent-attempt:${context.runId} -->\nIntento ${attempts(history) + 1}/2. [Ejecución](${context.serverUrl}/${a.repo.owner}/${a.repo.repo}/actions/runs/${context.runId}).`);
    // Añadir antes de quitar conserva al menos un estado si falla una petición.
    await a.add(issue.number, 'agent:in-progress'); await a.remove(issue.number, 'agent:ready');
    const previousAttempts = history.filter((c) => c.user?.login === 'github-actions[bot]' && c.body?.includes('<!-- agent-result -->')).slice(-2).map((c) => clip(c.body, 6000));
    fs.writeFileSync('.agent-runtime/task.json', JSON.stringify({ number: issue.number, title: issue.title, body: clip(issue.body), previousAttempts, branch, base: context.sha }, null, 2));
    for (const [key, value] of Object.entries({ mode: 'work', issue: issue.number, branch, base: context.sha })) core.setOutput(key, String(value));
    await core.summary.addRaw(`Reservada tarea #${issue.number}: ${issue.title}`).write();
    return;
  }
  await core.summary.addRaw('No hay tareas autorizadas con dependencias satisfechas. Sin consumo de API.').write();
}

async function publish({ github, context, core }) {
  const a = apiContext(github, context);
  const task = JSON.parse(fs.readFileSync('.agent-runtime/task.json', 'utf8'));
  const review = readReview('.agent-runtime/review.json');
  if (review.verdict !== 'approve') throw new Error('La revisión independiente solicita cambios.');
  if (task.base !== process.env.BASE_SHA || task.branch !== process.env.TASK_BRANCH || task.number !== Number(process.env.TASK_ISSUE)) throw new Error('La identidad de la tarea no coincide con la reserva.');
  const defaultBranch = context.payload.repository.default_branch;
  const { data: current } = await github.rest.git.getRef({ ...a.repo, ref: `heads/${defaultBranch}` });
  if (current.object.sha !== task.base) throw new Error('La rama base ha cambiado. Se requiere un ciclo nuevo sobre la base actual.');
  const { files } = inspectChanges();
  const { data: parent } = await github.rest.git.getCommit({ ...a.repo, commit_sha: task.base });
  const tree = [];
  for (const file of files) {
    if (!fs.existsSync(file)) tree.push({ path: file, mode: '100644', type: 'blob', sha: null });
    else {
      const { data: blob } = await github.rest.git.createBlob({ ...a.repo, encoding: 'base64', content: fs.readFileSync(file).toString('base64') });
      tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
    }
  }
  const { data: createdTree } = await github.rest.git.createTree({ ...a.repo, base_tree: parent.tree.sha, tree });
  const { data: commit } = await github.rest.git.createCommit({ ...a.repo, message: `fix: ${task.title} (#${task.number})`, tree: createdTree.sha, parents: [task.base] });
  // No sobrescribe una rama: si una publicación anterior se interrumpió, requiere revisión humana.
  await github.rest.git.createRef({ ...a.repo, ref: `refs/heads/${task.branch}`, sha: commit.sha });
  const summary = fs.existsSync('.agent-runtime/developer.md') ? clip(fs.readFileSync('.agent-runtime/developer.md', 'utf8')) : '';
  const body = `<!-- agent-issue:${task.number} -->\nCloses #${task.number}\n\n${summary}\n\n### Validación independiente\n\nCompilación, pruebas de herramientas, datos y Angular aprobadas en una ejecución separada.\n\n${clip(review.summary)}\n\n[Evidencia de ejecución](${context.serverUrl}/${a.repo.owner}/${a.repo.repo}/actions/runs/${context.runId}).\n\nPR en borrador: la integración requiere decisión humana.`;
  const { data: pr } = await github.rest.pulls.create({ ...a.repo, base: defaultBranch, head: task.branch, title: task.title, body, draft: true });
  for (const name of ['Verificación', 'Revisión de agentes']) {
    await github.rest.checks.create({ ...a.repo, name, head_sha: commit.sha, status: 'completed', conclusion: 'success', output: { title: name, summary: `Validado sobre ${task.base}. Evidencia: ${context.serverUrl}/${a.repo.owner}/${a.repo.repo}/actions/runs/${context.runId}` } });
  }
  await a.add(pr.number, 'agent:review');
  core.setOutput('pr', pr.html_url);
  await core.summary.addRaw(`PR preparada: ${pr.html_url}`).write();
}

async function finalize({ github, context, core }) {
  const a = apiContext(github, context);
  const issue = Number(process.env.TASK_ISSUE);
  if (!Number.isInteger(issue) || issue < 1) return;
  const pulls = await github.paginate(github.rest.pulls.list, { ...a.repo, state: 'all', head: `${a.repo.owner}:codex/agent-${issue}`, per_page: 100 });
  const pr = pulls.find((p) => p.state === 'open' && p.body?.includes(`<!-- agent-issue:${issue} -->`));
  const history = await a.comments(issue);
  // Un fallo se hace visible. El segundo intento requiere una nueva ejecución;
  // nunca se vuelve a invocar al modelo en bucle dentro del mismo trabajo.
  const label = pr ? 'agent:review' : attempts(history) >= 2 ? 'agent:blocked' : 'agent:ready';
  await a.add(issue, label); await a.remove(issue, 'agent:in-progress');
  const results = clip(process.env.JOB_RESULTS, 2000);
  const message = pr ? `PR en borrador: ${pr.html_url}. Estado de los trabajos: ${results}` : `El ciclo no produjo una PR aprobada. Estado: ${label}. Resultados: ${results}. Consulta los logs y los artefactos de esta ejecución.`;
  let feedback = '';
  if (fs.existsSync('.agent-runtime/review.json')) {
    const review = readReview('.agent-runtime/review.json');
    feedback = `\n\nRevisión: ${clip(review.summary, 3000)}\n${review.findings.map((f) => `- ${f.file}:${f.line}: ${clip(f.message, 1000)}`).join('\n')}`;
  }
  await a.comment(issue, `<!-- agent-result -->\n${message}${feedback}\n\n${context.serverUrl}/${a.repo.owner}/${a.repo.repo}/actions/runs/${context.runId}`);
  await core.summary.addRaw(message).write();
}

async function publishAudit({ github, context, core }) {
  const a = apiContext(github, context);
  const audit = JSON.parse(fs.readFileSync('.agent-runtime/audit.json', 'utf8'));
  if (!Array.isArray(audit.proposals) || audit.proposals.length > 3 || typeof audit.summary !== 'string') throw new Error('Auditoría inválida.');
  const existing = await a.allIssues();
  const seenIds = new Set(existing.map(taskId).filter(Boolean));
  const seenTitles = new Set(existing.map((i) => i.title.toLocaleLowerCase()));
  let created = 0;
  for (const p of audit.proposals) {
    if (!/^[a-z][a-z0-9-]{2,60}$/.test(p.id) || typeof p.title !== 'string' || typeof p.evidence !== 'string' || !Array.isArray(p.acceptance) || !p.acceptance.length || p.acceptance.some((c) => typeof c !== 'string')) throw new Error('Propuesta inválida.');
    if (seenIds.has(p.id) || seenTitles.has(p.title.toLocaleLowerCase())) continue;
    await github.rest.issues.create({ ...a.repo, title: clip(p.title, 180), body: `${marker(p.id)}\n\n${clip(p.evidence, 5000)}\n\n${p.acceptance.map((c) => `- [ ] ${clip(c, 1000)}`).join('\n')}\n\nPropuesta de auditoría: requiere priorización humana y etiqueta agent:ready.`, labels: ['agent:proposal', 'agent:backlog'] });
    created++;
    seenIds.add(p.id); seenTitles.add(p.title.toLocaleLowerCase());
  }
  await core.summary.addRaw(`${clip(audit.summary)}\n\nPropuestas nuevas: ${created}. Ninguna autorizada automáticamente.`).write();
}

module.exports = { plan, publish, finalize, publishAudit, attempts, taskId };
