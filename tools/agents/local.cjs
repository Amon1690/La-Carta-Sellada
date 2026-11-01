// Estado durable de la automatización local. No invoca modelos ni servicios.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const dayInMadrid = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(date);
const states = new Set(['in-progress', 'review', 'blocked', 'merged']);

function loadState(directory) {
  const file = path.join(directory, 'local-state.json');
  if (!fs.existsSync(file)) return { version: 1, paused: false, starts: [], tasks: {} };
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== 1 || typeof state.paused !== 'boolean' || !Array.isArray(state.starts) ||
      !state.tasks || typeof state.tasks !== 'object' || Array.isArray(state.tasks) ||
      state.starts.some((s) => !s || typeof s.day !== 'string' || typeof s.id !== 'string') ||
      Object.values(state.tasks).some((t) => !t || !states.has(t.status) || !Number.isInteger(t.attempts) || t.attempts < 1 || t.attempts > 2)) {
    throw new Error('Estado local inválido. Conserva el archivo y recupéralo manualmente; no se reinicia la cola.');
  }
  return state;
}

function nextTask(state, backlog, now = new Date()) {
  if (state.paused) return { action: 'paused' };
  const active = Object.entries(state.tasks).filter(([, task]) => task.status === 'in-progress');
  if (active.length > 1) throw new Error('Hay más de una tarea activa. Revisa el estado antes de continuar.');
  if (active.length) {
    const [id, record] = active[0];
    const task = backlog.find((entry) => entry.id === id);
    if (!task) throw new Error(`La tarea activa ${id} ya no está en la cola.`);
    return { action: 'resume', task, record };
  }
  const day = dayInMadrid(now);
  if (state.starts.filter((start) => start.day === day).length >= 2) return { action: 'daily-limit' };
  if (Object.values(state.tasks).filter((task) => task.status === 'review').length >= 3) return { action: 'review-limit' };
  const task = [...backlog].sort((a, b) => a.priority - b.priority).find((entry) =>
    !state.tasks[entry.id] && entry.dependsOn.every((id) => state.tasks[id]?.status === 'merged')
  );
  if (!task) return { action: 'idle' };
  const record = { status: 'in-progress', attempts: 1, branch: `codex/local-${task.id}`, checkpoint: 'Reservada; pendiente de reproducir el problema.', updatedAt: now.toISOString() };
  state.tasks[task.id] = record;
  state.starts.push({ day, id: task.id });
  return { action: 'start', task, record };
}

function checkpoint(state, id, branch, note, now = new Date()) {
  const task = state.tasks[id];
  if (!task || task.status !== 'in-progress') throw new Error('La tarea no está en curso.');
  if (!/^codex\/local-[a-z0-9-]+$/.test(branch) || !note?.trim()) throw new Error('Indica una rama local válida y un checkpoint.');
  Object.assign(task, { branch, checkpoint: note.slice(0, 6000), updatedAt: now.toISOString() });
}

function finish(state, id, status, evidence, now = new Date()) {
  const task = state.tasks[id];
  if (!task || task.status !== 'in-progress' || !['review', 'blocked'].includes(status) || !evidence?.trim()) {
    throw new Error('La tarea debe estar en curso y terminar con evidencia en review o blocked.');
  }
  Object.assign(task, { status, evidence: evidence.slice(0, 6000), updatedAt: now.toISOString() });
}

function locked(directory, action) {
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, 'local-state.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    let previous;
    try { previous = JSON.parse(fs.readFileSync(lock, 'utf8')); }
    catch { if (age < 300_000) throw new Error('Otra operación está inicializando la reserva local. Espera antes de reintentar.'); }
    const bootTime = Date.now() - os.uptime() * 1000;
    const fromAnotherBoot = Number.isFinite(previous?.bootTime) && Math.abs(previous.bootTime - bootTime) > 10_000;
    // Los comandos de estado son breves; el lock no representa al desarrollador.
    if (age < 300_000 && !fromAnotherBoot) {
      if (!Number.isInteger(previous?.pid) || previous.pid < 1) throw new Error('Reserva local dañada; espera cinco minutos para recuperarla.');
      try { process.kill(previous.pid, 0); throw new Error('Otra operación local está actualizando la cola.'); }
      catch (alive) {
        if (alive.code !== 'ESRCH') throw alive;
      }
    }
    fs.unlinkSync(lock);
    fd = fs.openSync(lock, 'wx');
  }
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, bootTime: Date.now() - os.uptime() * 1000 })); return action(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function saveState(directory, state) {
  const temporary = path.join(directory, 'local-state.json.tmp');
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
  fs.renameSync(temporary, path.join(directory, 'local-state.json'));
}

function run(args, root = ROOT, stateRoot = process.env.CARTA_AGENT_STATE_ROOT ?? root) {
  const [command = 'status', id, value, note] = args;
  const directory = path.join(path.resolve(stateRoot), '.agent-runtime');
  if (command === 'status') return loadState(directory);
  return locked(directory, () => {
    const state = loadState(directory);
    let result;
    if (command === 'next') {
      const backlog = JSON.parse(fs.readFileSync(path.join(root, '.github/agents/backlog.json'), 'utf8'));
      result = nextTask(state, backlog);
      if (result.task) fs.writeFileSync(path.join(directory, 'task.json'), JSON.stringify(result, null, 2));
    } else if (command === 'checkpoint') checkpoint(state, id, value, note);
    else if (command === 'finish') finish(state, id, value, note);
    else if (command === 'pause' || command === 'resume') state.paused = command === 'pause';
    else if (command === 'merged') {
      const task = state.tasks[id];
      if (!task || task.status !== 'review' || !/^[a-f0-9]{40}$/.test(value ?? '')) throw new Error('Indica una tarea en revisión y el SHA completo de su commit final.');
      const head = execFileSync('git', ['rev-parse', '--verify', task.branch], { cwd: root, encoding: 'utf8' }).trim();
      if (head !== value) throw new Error('El commit debe coincidir con la rama de la tarea.');
      execFileSync('git', ['merge-base', '--is-ancestor', value, 'origin/main'], { cwd: root, stdio: 'pipe' });
      Object.assign(task, { status: 'merged', mergedCommit: value, updatedAt: new Date().toISOString() });
    } else throw new Error('Comando desconocido: status, next, checkpoint, finish, pause, resume o merged.');
    saveState(directory, state);
    return result ?? state;
  });
}

if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { loadState, nextTask, checkpoint, finish, run, dayInMadrid };
