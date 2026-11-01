const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { bootstrap } = require('./github.cjs');
const { allowedPath, inspectChanges, readReview } = require('./policy.cjs');
const { loadState, nextTask, checkpoint, finish, run, dayInMadrid } = require('./local.cjs');

const ROOT = path.resolve(__dirname, '../..');
const backlog = [
  { id: 'sheets', priority: 1, dependsOn: [], acceptance: ['Compartir'], title: 'Fichas' },
  { id: 'stats', priority: 2, dependsOn: ['sheets'], acceptance: ['PG correctos'], title: 'Estadísticas' },
  { id: 'journeys', priority: 3, dependsOn: [], acceptance: ['Separar'], title: 'Viajes' },
  { id: 'errors', priority: 4, dependsOn: [], acceptance: ['Mostrar error'], title: 'Errores' },
];
const empty = () => ({ version: 1, paused: false, starts: [], tasks: {} });
const now = new Date('2026-11-01T10:00:00Z');
const fixture = (fn) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-local-'));
  try {
    fs.mkdirSync(path.join(root, '.github/agents'), { recursive: true });
    fs.writeFileSync(path.join(root, '.github/agents/backlog.json'), JSON.stringify(backlog));
    return fn(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

test('el workflow de GitHub solo administra issues sin modelos, secretos ni horarios', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/agent-cycle.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert(!/schedule:|secrets\.|codex-action|OPENAI_API_KEY|AGENTS_ENABLED|AGENTS_MODEL/.test(workflow));
  assert(!/contents: write|pull-requests: write/.test(workflow));
});

test('bootstrap conserva las seis issues existentes, incluso si ya están cerradas', async () => {
  const tasks = JSON.parse(fs.readFileSync(path.join(ROOT, '.github/agents/backlog.json')));
  const calls = [];
  const github = {
    rest: { issues: { listForRepo: 'list', createLabel: async () => {}, create: async (p) => calls.push(p) } },
    paginate: async () => tasks.map((t) => ({ body: `<!-- agent-task:${t.id} -->`, state: 'closed' })),
  };
  const context = { repo: { owner: 'a', repo: 'b' }, ref: 'refs/heads/main', payload: { repository: { default_branch: 'main' } } };
  const core = { summary: { addRaw: () => ({ write: async () => {} }) } };
  await bootstrap({ github, context, core }); assert.equal(calls.length, 0);
});

test('el selector prioriza y espera a que las dependencias estén fusionadas', () => {
  const state = empty();
  assert.equal(nextTask(state, backlog, now).task.id, 'sheets');
  finish(state, 'sheets', 'review', 'Pruebas aprobadas', now);
  assert.equal(nextTask(state, backlog, now).task.id, 'journeys');
  finish(state, 'journeys', 'blocked', 'Necesita decisión', now);
  assert.equal(nextTask(state, backlog, now).action, 'daily-limit');
  state.tasks.sheets.status = 'merged';
  assert.equal(nextTask(state, backlog, new Date('2026-11-02T10:00:00Z')).task.id, 'stats');
});

test('un apagado conserva rama y checkpoint y no reserva otra tarea', () => fixture((root) => {
  const first = run(['next'], root);
  run(['checkpoint', first.task.id, first.record.branch, 'Prueba de regresión pendiente'], root);
  // Una lectura nueva no reutiliza objetos en memoria: representa otra sesión.
  const resumed = run(['next'], root);
  assert.equal(resumed.action, 'resume');
  assert.equal(resumed.task.id, first.task.id);
  assert.equal(resumed.record.checkpoint, 'Prueba de regresión pendiente');
  assert.equal(loadState(path.join(root, '.agent-runtime')).starts.length, 1);
}));

test('pausa persiste entre sesiones y no pierde la tarea interrumpida', () => fixture((root) => {
  run(['next'], root); run(['pause'], root);
  assert.equal(run(['next'], root).action, 'paused');
  run(['resume'], root); assert.equal(run(['next'], root).action, 'resume');
}));

test('dos nuevas tareas al día usan la fecha de Madrid, no la del host', () => {
  assert.equal(dayInMadrid(new Date('2026-11-01T23:30:00Z')), '2026-11-02');
  const state = empty();
  nextTask(state, backlog, now); finish(state, 'sheets', 'blocked', 'X', now);
  nextTask(state, backlog, now); finish(state, 'journeys', 'blocked', 'Y', now);
  assert.equal(nextTask(state, backlog, now).action, 'daily-limit');
  assert.equal(nextTask(state, backlog, new Date('2026-11-01T23:30:00Z')).task.id, 'errors');
});

test('una reserva interrumpida se reanuda aun con el límite diario alcanzado', () => {
  const state = empty(); nextTask(state, backlog, now);
  state.starts.push({ day: '2026-11-01', id: 'otra' });
  assert.equal(nextTask(state, backlog, now).action, 'resume');
});

test('estado dañado se conserva y bloquea, sin reiniciar trabajo ni datos', () => fixture((root) => {
  run(['next'], root);
  const file = path.join(root, '.agent-runtime/local-state.json');
  fs.writeFileSync(file, '{malformed');
  assert.throws(() => run(['next'], root));
  assert.equal(fs.readFileSync(file, 'utf8'), '{malformed');
  fs.writeFileSync(file, JSON.stringify({ ...empty(), tasks: { x: { status: 'in-progress', attempts: 9 } } }));
  assert.throws(() => run(['next'], root), /Estado local inválido/);
}));

test('un bloqueo de escritura activo impide que otra operación modifique la cola', () => fixture((root) => {
  run(['next'], root);
  const file = path.join(root, '.agent-runtime/local-state.json');
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(path.join(root, '.agent-runtime/local-state.lock'), JSON.stringify({ pid: process.pid }));
  assert.throws(() => run(['pause'], root), /Otra operación/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
}));

test('recupera un lock de otro arranque aunque su PID se haya reutilizado', () => fixture((root) => {
  run(['next'], root);
  fs.writeFileSync(path.join(root, '.agent-runtime/local-state.lock'), JSON.stringify({ pid: process.pid, bootTime: 1 }));
  assert.equal(run(['next'], root).action, 'resume');
}));

test('recupera un lock vacío viejo sin borrar el checkpoint', () => fixture((root) => {
  run(['next'], root);
  const lock = path.join(root, '.agent-runtime/local-state.lock');
  fs.writeFileSync(lock, '');
  const old = new Date(Date.now() - 600_000); fs.utimesSync(lock, old, old);
  assert.equal(run(['next'], root).action, 'resume');
}));

test('un worktree usa la reserva del coordinador cuando se indica stateRoot', () => fixture((coordinator) => fixture((worktree) => {
  run(['next'], coordinator);
  const recovered = run(['next'], worktree, coordinator);
  assert.equal(recovered.action, 'resume');
  assert.equal(fs.existsSync(path.join(worktree, '.agent-runtime')), false);
  assert.equal(run(['status'], coordinator).starts.length, 1);
})));

test('no se da por fusionada una tarea solo porque su rama exista', () => fixture((root) => {
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '--quiet'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  fs.writeFileSync(path.join(root, 'README.md'), 'base'); git('add', 'README.md'); git('commit', '--quiet', '-m', 'base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const next = run(['next'], root); git('switch', '-c', next.record.branch);
  fs.writeFileSync(path.join(root, 'README.md'), 'cambio'); git('add', 'README.md'); git('commit', '--quiet', '-m', 'change');
  const sha = git('rev-parse', 'HEAD').toString().trim();
  run(['finish', next.task.id, 'review', 'Pruebas y revisión aprobadas'], root);
  assert.throws(() => run(['merged', next.task.id, sha], root));
  assert.equal(run(['status'], root).tasks.sheets.status, 'review');
  git('update-ref', 'refs/remotes/origin/main', sha);
  run(['merged', next.task.id, sha], root);
  assert.equal(run(['status'], root).tasks.sheets.status, 'merged');
}));

test('el alcance mantiene protegida la infraestructura local y de GitHub', () => {
  for (const file of ['.github/workflows/ci.yml', 'tools/agents/local.cjs', 'AGENTS.md', 'package.json', 'src/../tools/x.js', 'src/.hidden', 'src/AGENTS.md', 'docs/agents-workflow.md', 'docs/local-agent-runbook.md']) assert.equal(allowedPath(file), false, file);
  for (const file of ['src/app/example.ts', 'public/data/campaign.json', 'docs/manual.md', 'README.md']) assert.equal(allowedPath(file), true, file);
});

test('una revisión con hallazgos pendientes no puede aprobarse', () => fixture((root) => {
  const file = path.join(root, 'review.json');
  fs.writeFileSync(file, JSON.stringify({ verdict: 'approve', summary: 'X', findings: [{ file: 'src/a.ts', line: 1, message: 'Regresión' }] }));
  assert.throws(() => readReview(file), /hallazgos pendientes/);
}));

test('el exportador incluye archivos nuevos y rechaza cambios a instrucciones', () => fixture((root) => {
  const previous = process.cwd();
  try {
    process.chdir(root);
    const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
    git('init', '--quiet'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    fs.writeFileSync('README.md', 'base'); git('add', 'README.md'); git('commit', '--quiet', '-m', 'base');
    fs.mkdirSync('src'); fs.writeFileSync('src/new.ts', 'export const value = 1;\n');
    assert.deepEqual(inspectChanges().files, ['src/new.ts']);
    fs.writeFileSync('AGENTS.md', 'alterado'); git('add', 'AGENTS.md');
    assert.throws(() => inspectChanges(), /fuera de alcance/);
  } finally { process.chdir(previous); }
}));
