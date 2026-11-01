// GitHub administra la cola. El desarrollo y la revisión usan la app local.
const fs = require('node:fs');

const labels = {
  'agent:backlog': ['c5def5', 'Propuesta pendiente de priorizar'],
  'agent:ready': ['0e8a16', 'Autorizada para el siguiente ciclo local'],
  'agent:in-progress': ['fbca04', 'Trabajo local en curso'],
  'agent:review': ['5319e7', 'Preparada para decisión humana'],
  'agent:blocked': ['b60205', 'Necesita intervención antes de continuar'],
  'agent:proposal': ['d4c5f9', 'Hallazgo sin autorizar'],
};

async function bootstrap({ github, context, core }) {
  const repo = context.repo;
  if (context.ref !== `refs/heads/${context.payload.repository.default_branch}`) {
    throw new Error('Ejecuta la creación de la cola desde la rama predeterminada.');
  }
  for (const [name, [color, description]] of Object.entries(labels)) {
    try { await github.rest.issues.createLabel({ ...repo, name, color, description }); }
    catch (error) { if (error.status !== 422) throw error; }
  }
  const issues = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'all', per_page: 100 });
  const seen = new Set(issues.flatMap((issue) => issue.body?.match(/<!-- agent-task:([a-z][a-z0-9-]+) -->/)?.[1] ?? []));
  const backlog = JSON.parse(fs.readFileSync('.github/agents/backlog.json', 'utf8'));
  let created = 0;
  for (const task of backlog) {
    if (seen.has(task.id)) continue;
    const body = `<!-- agent-task:${task.id} -->\n\n${task.acceptance.map((c) => `- [ ] ${c}`).join('\n')}\n\nDependencias: ${task.dependsOn.join(', ') || 'ninguna'}.\nPrioridad: ${task.priority}.`;
    await github.rest.issues.create({ ...repo, title: task.title, body, labels: ['agent:ready'] });
    seen.add(task.id);
    created++;
  }
  await core.summary.addRaw(`Tareas nuevas: ${created}. Las tareas existentes se conservan. Los agentes trabajan desde la app local; este workflow no llama a modelos.`).write();
}

module.exports = { bootstrap };
