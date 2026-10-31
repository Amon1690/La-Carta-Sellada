const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { allowedPath, inspectChanges, readReview } = require('./policy.cjs');
const { plan, publish, finalize, publishAudit, attempts } = require('./github.cjs');

function fixture({ issues = [], pulls = [], runs = [], comments = [], closedPulls = [] } = {}) {
  const calls = [];
  const outputs = {};
  const record = (name, value = {}) => async (params) => { calls.push([name, params]); return { data: value }; };
  const rest = {
    issues: {
      listForRepo: 'issues', listComments: 'comments', createLabel: record('label'),
      create: record('issue'), createComment: record('comment'),
      addLabels: record('add'), removeLabel: record('remove'),
    },
    pulls: { list: 'pulls' },
    actions: { listWorkflowRuns: 'runs', getWorkflowRun: record('run', { status: 'completed' }) },
    repos: { getCollaboratorPermissionLevel: record('permission', { permission: 'write' }) },
    git: { getRef: async (params) => {
      if (params.ref !== 'heads/main') throw Object.assign(new Error('not found'), { status: 404 });
      return { data: { object: { sha: 'changed-base' } } };
    } },
  };
  const github = { rest, paginate: async (method, params) => {
    if (method === 'issues') return issues;
    if (method === 'comments') return comments;
    if (method === 'runs') return runs;
    if (method === 'pulls') return params.state === 'closed' ? closedPulls : pulls;
    throw new Error(`API inesperada: ${method}`);
  } };
  const core = { setOutput: (key, value) => { outputs[key] = value; }, summary: { addRaw: (s) => { calls.push(['summary', s]); return { write: async () => {} }; } } };
  const context = { repo: { owner: 'owner', repo: 'repo' }, payload: { repository: { default_branch: 'main' } }, ref: 'refs/heads/main', sha: 'base', runId: 123, serverUrl: 'https://github.com' };
  return { github, context, core, calls, outputs };
}
function issue(number = 1, id = 'shared-character-sheets', labels = ['agent:ready']) {
  return { number, title: `Tarea ${number}`, body: `<!-- agent-task:${id} -->`, labels: labels.map((name) => ({ name })), state: 'open', user: { login: 'owner' } };
}
function environment(values, fn) {
  const previous = { ...process.env };
  Object.assign(process.env, { AGENT_MODE: 'work', AGENTS_ENABLED: 'true', AGENTS_MODEL: 'test-model', HAS_OPENAI_KEY: 'true', GITHUB_RUN_ATTEMPT: '1', ...values });
  return Promise.resolve().then(fn).finally(() => { for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); });
}
function runtime(fn) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-workflow-'));
  const previous = process.cwd();
  fs.mkdirSync(path.join(directory, '.github/agents'), { recursive: true });
  fs.copyFileSync(path.join(previous, '.github/agents/backlog.json'), path.join(directory, '.github/agents/backlog.json'));
  process.chdir(directory);
  return Promise.resolve().then(() => fn(directory)).finally(() => { process.chdir(previous); fs.rmSync(directory, { recursive: true, force: true }); });
}

test('el alcance impide modificar workflows, instrucciones, rutas ocultas y dependencias', () => {
  for (const file of ['.github/workflows/ci.yml', 'AGENTS.md', 'package.json', 'src/../tools/x.js', 'src/.hidden', 'src/AGENTS.md', 'docs/agents-workflow.md', 'src\\app.ts']) assert.equal(allowedPath(file), false, file);
  for (const file of ['src/app/example.ts', 'public/data/campaign.json', 'docs/manual.md', 'README.md']) assert.equal(allowedPath(file), true, file);
});

test('los intentos no pueden falsificarse con comentarios de otra persona', () => {
  assert.equal(attempts([{ user: { login: 'owner' }, body: '<!-- agent-attempt:1 -->' }, { user: { login: 'github-actions[bot]' }, body: '<!-- agent-attempt:2 -->' }]), 1);
});

test('pausa sin clave ni API y rechaza configuración incompleta al activar', () => environment({ AGENTS_ENABLED: 'false' }, async () => {
  const f = fixture(); await plan(f); assert.deepEqual(f.outputs, {}); assert.equal(f.calls.length, 1);
  process.env.AGENTS_ENABLED = 'true'; process.env.HAS_OPENAI_KEY = 'false';
  await assert.rejects(plan(f), /Falta OPENAI_API_KEY/);
}));

test('bootstrap es idempotente y no necesita una clave de API', () => runtime(() => environment({ AGENT_MODE: 'bootstrap', HAS_OPENAI_KEY: 'false' }, async () => {
  const backlog = JSON.parse(fs.readFileSync('.github/agents/backlog.json'));
  const f = fixture({ issues: backlog.map((task, i) => issue(i + 1, task.id)) });
  await plan(f); assert.equal(f.calls.filter(([name]) => name === 'issue').length, 0); assert.deepEqual(f.outputs, {});
})));

test('no reserva una tarea cuya dependencia se cerró sin una PR fusionada', () => runtime(() => environment({}, async () => {
  const closed = { ...issue(1), state: 'closed' };
  const f = fixture({ issues: [closed, issue(2, 'named-player-stats')] });
  await plan(f); assert.deepEqual(f.outputs, {});
})));

test('reserva dependencias satisfechas y conserva identidad de base y tarea', () => runtime(() => environment({}, async () => {
  const f = fixture({ issues: [{ ...issue(1), state: 'closed' }, issue(2, 'named-player-stats')], closedPulls: [{ merged_at: '2026-10-31' }] });
  await plan(f); assert.equal(f.outputs.issue, '2'); assert.equal(f.outputs.base, 'base');
  const task = JSON.parse(fs.readFileSync('.agent-runtime/task.json'));
  assert.equal(task.number, 2); assert.equal(task.branch, 'codex/agent-2');
  assert(f.calls.some(([name, p]) => name === 'comment' && p.body.includes('agent-attempt:123')));
})));

test('limita PRs abiertas y ejecuciones diarias antes de invocar al agente', () => runtime(() => environment({}, async () => {
  const f = fixture({ issues: [issue()], pulls: [1, 2, 3].map((i) => ({ head: { ref: `codex/agent-${i}` } })) });
  await plan(f); assert.deepEqual(f.outputs, {});
  const g = fixture({ issues: [issue()], runs: Array.from({ length: 5 }, () => ({ name: 'Mejora continua', display_title: 'Agentes · work' })) });
  await plan(g); assert.deepEqual(g.outputs, {});
})));

test('el segundo fallo bloquea la tarea y libera la reserva', () => environment({ TASK_ISSUE: '1', JOB_RESULTS: '{"verify":"failure"}' }, async () => {
  const f = fixture({ comments: [1, 2].map((n) => ({ user: { login: 'github-actions[bot]' }, body: `<!-- agent-attempt:${n} -->` })) });
  await finalize(f);
  assert(f.calls.some(([name, p]) => name === 'remove' && p.name === 'agent:in-progress'));
  assert(f.calls.some(([name, p]) => name === 'add' && p.labels.includes('agent:blocked')));
}));

test('bloquea una rama huérfana antes de gastar otro intento', () => runtime(() => environment({}, async () => {
  const f = fixture({ issues: [issue()] });
  f.github.rest.git.getRef = async () => ({ data: { object: { sha: 'orphan' } } });
  await plan(f);
  assert.deepEqual(f.outputs, {});
  assert(f.calls.some(([name, p]) => name === 'add' && p.labels.includes('agent:blocked')));
  assert(!f.calls.some(([name, p]) => name === 'comment' && p.body.includes('<!-- agent-attempt:')));
})));

test('el reintento recibe feedback previo y la reserva se escribe antes de cambiar etiquetas', () => runtime(() => environment({}, async () => {
  const f = fixture({ issues: [issue()], comments: [{ user: { login: 'github-actions[bot]' }, body: '<!-- agent-result -->\nCorregir regresión en src/a.ts:12' }] });
  await plan(f);
  const task = JSON.parse(fs.readFileSync('.agent-runtime/task.json'));
  assert.match(task.previousAttempts[0], /src\/a.ts:12/);
  const lease = f.calls.findIndex(([name, p]) => name === 'comment' && p.body.includes('agent-attempt'));
  const transition = f.calls.findIndex(([name]) => name === 'add');
  assert(lease >= 0 && lease < transition);
})));

test('una reserva interrumpida sin identificador queda bloqueada y visible', () => runtime(() => environment({}, async () => {
  const f = fixture({ issues: [issue(1, 'shared-character-sheets', ['agent:in-progress'])] });
  await plan(f);
  assert.deepEqual(f.outputs, {});
  assert(f.calls.some(([name, p]) => name === 'add' && p.labels.includes('agent:blocked')));
})));

test('limita también auditorías manuales y reejecuciones sin coste adicional', () => runtime(() => environment({ AGENT_MODE: 'audit' }, async () => {
  const f = fixture({ runs: [1, 2].map(() => ({ name: 'Mejora continua', display_title: 'Agentes · audit' })) });
  await plan(f); assert.deepEqual(f.outputs, {});
  process.env.AGENT_MODE = 'work'; process.env.GITHUB_RUN_ATTEMPT = '2';
  const g = fixture({ issues: [issue()] }); await plan(g); assert.deepEqual(g.outputs, {});
})));

test('una revisión rechazada o contradictoria no puede publicarse', () => runtime(async () => {
  fs.mkdirSync('.agent-runtime');
  fs.writeFileSync('.agent-runtime/review.json', JSON.stringify({ verdict: 'approve', summary: 'x', findings: [{ file: 'src/x.ts', line: 1, message: 'error' }] }));
  assert.throws(() => readReview('.agent-runtime/review.json'), /hallazgos/);
  fs.writeFileSync('.agent-runtime/task.json', JSON.stringify({ number: 1, branch: 'codex/agent-1', base: 'base' }));
  fs.writeFileSync('.agent-runtime/review.json', JSON.stringify({ verdict: 'changes_requested', summary: 'Fallo', findings: [] }));
  await assert.rejects(publish(fixture()), /solicita cambios/);
}));

test('impide publicar una propuesta validada sobre una base que ya cambió', () => runtime(() => environment({ TASK_ISSUE: '1', TASK_BRANCH: 'codex/agent-1', BASE_SHA: 'base' }, async () => {
  fs.mkdirSync('.agent-runtime');
  fs.writeFileSync('.agent-runtime/task.json', JSON.stringify({ number: 1, branch: 'codex/agent-1', base: 'base' }));
  fs.writeFileSync('.agent-runtime/review.json', JSON.stringify({ verdict: 'approve', summary: 'Correcto', findings: [] }));
  await assert.rejects(publish(fixture()), /rama base ha cambiado/);
})));

test('auditoría deduplica propuestas y nunca las autoriza', () => runtime(async () => {
  fs.mkdirSync('.agent-runtime');
  fs.writeFileSync('.agent-runtime/audit.json', JSON.stringify({ summary: 'Auditoría', proposals: [{ id: 'existing-bug', title: 'Existente', evidence: 'src/a.ts:1', acceptance: ['Corregir'] }, { id: 'new-bug', title: 'Nuevo', evidence: 'src/a.ts:2', acceptance: ['Corregir'] }, { id: 'new-bug', title: 'Nuevo repetido', evidence: 'src/a.ts:2', acceptance: ['Corregir'] }] }));
  const f = fixture({ issues: [issue(1, 'existing-bug')] });
  await publishAudit(f); const created = f.calls.filter(([name]) => name === 'issue');
  assert.equal(created.length, 1); assert.deepEqual(created[0][1].labels, ['agent:proposal', 'agent:backlog']);
}));

test('exporta archivos nuevos y rechaza cambios a infraestructura en un repositorio real', () => runtime(() => {
  const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
  git('init', '--quiet'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Workflow Test'); git('config', 'user.email', 'workflow@example.invalid');
  fs.writeFileSync('README.md', 'base\n'); git('add', 'README.md'); git('commit', '--quiet', '-m', 'base');
  fs.mkdirSync('src'); fs.writeFileSync('src/new.ts', 'export const value = 1;\n');
  const result = inspectChanges(); assert.deepEqual(result.files, ['src/new.ts']); assert.match(result.patch, /new file mode/);
  fs.writeFileSync('AGENTS.md', 'base'); git('add', 'AGENTS.md');
  assert.throws(() => inspectChanges(), /fuera de alcance/);
}));

test('publica exactamente el parche aprobado como PR borrador y registra checks del commit probado', () => runtime(() => environment({ TASK_ISSUE: '1', TASK_BRANCH: 'codex/agent-1', BASE_SHA: 'base' }, async () => {
  const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
  git('init', '--quiet'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Workflow Test'); git('config', 'user.email', 'workflow@example.invalid');
  fs.writeFileSync('README.md', 'antes\n'); git('add', 'README.md'); git('commit', '--quiet', '-m', 'base');
  fs.writeFileSync('README.md', 'después\n');
  fs.mkdirSync('.agent-runtime');
  fs.writeFileSync('.agent-runtime/task.json', JSON.stringify({ number: 1, title: 'Corregir README', branch: 'codex/agent-1', base: 'base' }));
  fs.writeFileSync('.agent-runtime/review.json', JSON.stringify({ verdict: 'approve', summary: 'Correcto', findings: [] }));
  const f = fixture();
  const captures = [];
  const respond = (name, data) => async (p) => { captures.push([name, p]); return { data }; };
  Object.assign(f.github.rest.git, {
    getRef: respond('ref', { object: { sha: 'base' } }), getCommit: respond('parent', { tree: { sha: 'parent-tree' } }),
    createBlob: respond('blob', { sha: 'blob' }), createTree: respond('tree', { sha: 'new-tree' }),
    createCommit: respond('commit', { sha: 'new-commit' }), createRef: respond('branch', {}),
  });
  f.github.rest.pulls.create = respond('pr', { number: 10, html_url: 'https://github.com/owner/repo/pull/10' });
  f.github.rest.checks = { create: respond('check', {}) };
  await publish(f);
  assert.equal(captures.find(([name]) => name === 'pr')[1].draft, true);
  assert.deepEqual(captures.find(([name]) => name === 'tree')[1].tree.map((e) => e.path), ['README.md']);
  assert.equal(Buffer.from(captures.find(([name]) => name === 'blob')[1].content, 'base64').toString(), 'después\n');
  assert.deepEqual(captures.filter(([name]) => name === 'check').map(([, p]) => p.head_sha), ['new-commit', 'new-commit']);
  assert.match(f.outputs.pr, /pull\/10$/);
})));
