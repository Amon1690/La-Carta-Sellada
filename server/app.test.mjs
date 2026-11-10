import { request as httpRequest } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createCartaServer } from './app.mjs';

const sheet = (id = 'hero', playerIds = []) => ({ id, name: 'Héroe', playerIds, ancestry: 'Humano', className: 'Guerrero', subclass: '', background: '', hook: '', feat: '', level: 5, armorClass: 15, hitPoints: 30, speed: '9 m', initiative: '+1', proficiencyBonus: 3, abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 }, saves: [], skills: [], attacks: [], features: [], spells: [], equipment: [] });
async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'carta-access-'));
  await mkdir(resolve(root, 'public/data'), { recursive: true });
  await mkdir(resolve(root, 'dist/la-carta-sellada/browser'), { recursive: true });
  await writeFile(resolve(root, 'dist/la-carta-sellada/browser/index.html'), '<html>Login</html>');
  for (const where of ['public', 'dist/la-carta-sellada/browser']) { await mkdir(resolve(root, where, 'assets/maps'), { recursive: true }); await writeFile(resolve(root, where, 'assets/maps/test.png'), 'imagen de prueba'); }
  await writeFile(resolve(root, 'public/data/campaigns.json'), JSON.stringify(['one', 'two'].map((id) => ({ id, name: id, dataPath: `data/${id}.json` }))));
  const campaign = { id: 'one', name: 'Uno', playerCharacters: [], playerOptions: [sheet()], npcs: [{ id: 'secret-npc' }], acts: ['Secreto de dirección'], sealedLetter: { message: 'Secreto' } };
  for (const id of ['one', 'two']) {
    await writeFile(resolve(root, `public/data/${id}.json`), JSON.stringify({ ...campaign, id, mapUrl: `assets/maps/private-${id}.png` }));
    for (const where of ['public', 'dist/la-carta-sellada/browser']) await writeFile(resolve(root, where, `assets/maps/private-${id}.png`), 'mapa privado');
  }
  await writeFile(resolve(root, 'public/data/rules.json'), JSON.stringify({ spells: [], creatures: [{ id: 'dragon' }] }));
  let clock = Date.now();
  const server = await createCartaServer({ root, now: () => clock });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise((done) => server.close(done)));
  async function request(path, { method = 'GET', data, cookie = '', origin = base, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: { cookie, origin, ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'manual' });
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text; }
    return { status: response.status, value, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  async function login(username, password) { const r = await request('/api/session', { method: 'POST', data: { username, password } }); assert.equal(r.status, 200); return r.cookie; }
  return { root, base, request, login, advance: (ms) => { clock += ms; } };
}

const encounterImage = (value = 0) => {
  const png = Buffer.alloc(25); Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
  png.writeUInt32BE(1536, 16); png.writeUInt32BE(1024, 20); png[24] = value;
  return `data:image/png;base64,${png.toString('base64')}`;
};
async function encounterFixture(t) {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const player = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'jugador');
  const other = (await f.request('/api/users', { cookie: admin, method: 'POST', data: { username: 'Ana', password: '1234', role: 'jugador', campaigns: ['one'] } })).value;
  const own = sheet('hero', [player.id]), foreign = sheet('other', [other.id]);
  await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: { edited: { hero: own }, created: [foreign], revision: 0 } });
  const cookie = await f.login('Jugador', '1234');
  const snapshot = { title: 'Encuentro compartido', sheetRevision: 1, views: [
    { instanceId: 'hero-instance', actorId: 'hero', image: encounterImage(), pending: false },
    { instanceId: 'other-instance', actorId: 'other', image: encounterImage(1), pending: true },
  ] };
  const url = '/api/campaigns/one/encounters/encounter:ambush:run1';
  assert.equal((await f.request(url, { cookie: director, method: 'PUT', data: snapshot })).status, 200);
  return { ...f, admin, director, player, other, own, foreign, cookie, snapshot, url };
}

async function liveEncounterFixture(t) {
  const f = await encounterFixture(t);
  const tokens = f.snapshot.views.map((view, i) => ({ instanceId: view.instanceId, actorId: `player:${view.actorId}`, name: `Visible ${i}`, image: '', x: i * 51.2 + 51.2, y: 51.2,
    size: 1, hp: 30, maxHp: 30, initiative: 10 - i, conditions: [], side: i ? 'enemy' : 'party', hidden: false }));
  const controls = (token) => ({ position: { x: token.x, y: token.y, size: 1 }, canMove: true, canAttack: true, cells: [31, 32, 33],
    targets: [{ id: 'other-instance', name: 'Objetivo visible', x: 102.4, y: 51.2, size: 1 }], attacks: [{ source: 'sword', name: 'Espada preparada', targetIds: ['other-instance'] }] });
  const liveSnapshot = { ...f.snapshot, revision: 1, weather: 'rain', state: { tokens, fogRects: [], layers: { grid: false, fog: true, tokens: true, labels: true }, zoom: .65,
    activeTurnId: 'hero-instance', combat: { started: true, turnId: 'hero-instance' } }, views: f.snapshot.views.map((view, i) => ({ ...view, pending: false, controls: controls(tokens[i]) })) };
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: liveSnapshot })).status, 200);
  await f.request(f.url, { cookie: f.director });
  return { ...f, liveSnapshot, revision: 2, action: (data, cookie = f.cookie) => f.request(`${f.url}/actions`, { cookie, method: 'POST', data }) };
}

test('registro del jugador: solo relato del observador y audiencia original, sin registro privado ni eventos ajenos', async (t) => {
  const f = await liveEncounterFixture(t);
  const messages = [
    { observerId: 'hero-instance', audience: [f.player.id], text: 'El bandido ataca a Valian y le hace 14 de daño.' },
    { observerId: 'other-instance', audience: [f.player.id], text: 'Suceso solo de otro personaje' },
  ];
  const combat = { ...f.liveSnapshot.state.combat, log: ['Espada venenosa +8, CA 20, Escudo, recurso secreto'], narrative: [
    { id: 'visible', messages }, { id: 'foreign-owner', messages: [{ observerId: 'hero-instance', audience: [f.other.id], text: 'Historia de dueño anterior' }] },
  ] };
  const next = { ...f.liveSnapshot, revision: 2, state: { ...f.liveSnapshot.state, combat } };
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: next })).status, 200);
  const result = await f.request(`${f.url}?observer=hero-instance&after=3`, { cookie: f.cookie });
  assert.equal(result.status, 200); assert.equal(result.value.unchanged, true);
  assert.deepEqual(result.value.combatLog, [{ id: 'visible', text: messages[0].text }]);
  assert.equal(JSON.stringify(result.value).includes('Espada venenosa'), false);
  assert.equal(result.value.state, undefined);
  const changed = { ...f.own, playerIds: [f.other.id] };
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: f.director, method: 'PUT', data: { edited: { hero: changed }, created: [f.foreign], revision: 1 } })).status, 200);
  const otherCookie = await f.login('Ana', '1234');
  const reassigned = await f.request(`${f.url}?observer=hero-instance`, { cookie: otherCookie });
  // La audiencia publicada sigue siendo la original: no se concede acceso por reasignar una ficha.
  assert.equal(reassigned.status, 404);
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).status, 404);
});

test('acciones de jugador: sesión, propiedad, turno, casillas visibles e idempotencia se comprueban en servidor', async (t) => {
  const f = await liveEncounterFixture(t);
  const move = { id: 'move-1', revision: 2, observerId: 'hero-instance', type: 'move', cell: 32 };
  assert.equal((await f.action(move, '')).status, 401);
  assert.equal((await f.action({ ...move, observerId: 'other-instance' })).status, 403);
  assert.equal((await f.action({ ...move, cell: 500 })).status, 400);
  assert.equal((await f.action({ ...move, hp: 999 })).status, 400);
  assert.equal((await f.action(move)).status, 200);
  assert.equal((await f.action(move)).status, 200);
  assert.equal((await f.action({ ...move, id: 'move-2' })).status, 409);
  const director = (await f.request(f.url, { cookie: f.director })).value;
  assert.equal(director.revision, 3); assert.equal(director.pendingCommand.id, move.id); assert.ok(director.state.tokens);
  const player = (await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).value;
  assert.equal(player.actionPending, true); assert.equal(player.controls.canMove, false);
  for (const key of ['state', 'pendingCommand', 'receipts', 'audience', 'tokens', 'combat']) assert.equal(player[key], undefined);
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: { ...f.liveSnapshot, revision: 3 } })).status, 409);
  const updated = structuredClone(f.liveSnapshot); updated.revision = 3; updated.state.tokens[0].x = 102.4; updated.views[0].controls.position.x = 102.4;
  updated.ack = { id: move.id, status: 'applied', message: 'Token movido.' };
  const writes = await Promise.all([f.request(f.url, { cookie: f.director, method: 'PUT', data: updated }), f.request(f.url, { cookie: f.director, method: 'PUT', data: updated })]);
  assert.deepEqual(writes.map((item) => item.status).sort(), [200, 409]);
  assert.equal((await f.action(move)).value.receipt.message, 'Token movido.');
  const latest = (await f.request(f.url, { cookie: f.director })).value;
  assert.equal(latest.revision, 4); assert.equal(latest.pendingCommand, undefined); assert.equal(latest.state.tokens[0].x, 102.4);
  const unchanged = (await f.request(`${f.url}?observer=hero-instance&after=4`, { cookie: f.cookie })).value;
  assert.equal(unchanged.unchanged, true); assert.equal(unchanged.image, undefined);
  assert.equal((await f.action({ id: 'attack-1', revision: 4, observerId: 'hero-instance', type: 'attack', source: 'sword', targetId: 'other-instance' })).status, 200);
  await f.request('/api/campaigns/one/sheets', { cookie: f.director, method: 'PUT', data: { edited: { hero: { ...f.own, hitPoints: 45 } }, created: [f.foreign], revision: 1 } });
  assert.equal((await f.action(move)).value.receipt.message, 'Token movido.');
});

test('acciones de jugador: no admite objetivos falsificados, actuar fuera de turno ni sin director conectado', async (t) => {
  const f = await liveEncounterFixture(t);
  const attack = { id: 'attack-1', revision: 2, observerId: 'hero-instance', type: 'attack', source: 'sword', targetId: 'other-instance' };
  assert.equal((await f.action({ ...attack, targetId: 'hidden-enemy' })).status, 400);
  assert.equal((await f.action({ ...attack, source: 'unprepared' })).status, 400);
  const otherTurn = structuredClone(f.liveSnapshot); otherTurn.revision = 2; otherTurn.state.activeTurnId = otherTurn.state.combat.turnId = 'other-instance';
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: otherTurn })).status, 200);
  assert.equal((await f.action({ ...attack, revision: 3 })).status, 403);
  f.advance(11000);
  assert.equal((await f.action({ ...attack, revision: 3 })).status, 409);
  const oldView = (await f.request(`${f.url}?observer=hero-instance&after=3`, { cookie: f.cookie })).value;
  assert.equal(oldView.directorOnline, false); assert.equal(oldView.controls.canMove, false);
  assert.equal((await f.request(`${f.url}?revision=2`, { cookie: f.director, method: 'DELETE' })).status, 409);
});

test('acciones de jugador: caducidad, cambios de fichas y partidas independientes conservan el estado sin ejecutar', async (t) => {
  const f = await liveEncounterFixture(t);
  const move = { id: 'expiring-move', revision: 2, observerId: 'hero-instance', type: 'move', cell: 32 };
  await f.action(move); f.advance(16000);
  const view = (await f.request(`${f.url}?observer=hero-instance&receipt=${move.id}`, { cookie: f.cookie })).value;
  assert.equal(view.receipt.status, 'rejected'); assert.equal(view.actionPending, false);
  const state = (await f.request(f.url, { cookie: f.director })).value;
  assert.equal(state.state.tokens[0].x, 51.2); assert.equal(state.pendingCommand, undefined);
  assert.equal((await f.action(move)).value.receipt.status, 'rejected');
  assert.equal((await f.request(`${f.url.replace('run1', 'run2')}/actions`, { cookie: f.cookie, method: 'POST', data: move })).status, 404);
  const data = { edited: { hero: { ...f.own, hitPoints: 45 } }, created: [f.foreign], revision: 1 };
  await f.request('/api/campaigns/one/sheets', { cookie: f.director, method: 'PUT', data });
  assert.equal((await f.action({ ...move, id: 'after-edit', revision: state.revision })).status, 409);
  const offline = (await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).value;
  assert.equal(offline.controls.canMove, false);
  const disk = JSON.parse(await readFile(resolve(f.root, '.local-server/access.json')));
  assert.equal(disk.sheets.one.edited.hero.hitPoints, 45); assert.equal(disk.encounters.one['encounter:ambush:run1'].state.tokens[0].x, 51.2);
});
test('recompartir un encuentro usa una revisión nueva y no reutiliza imágenes o cachés de la publicación anterior', async (t) => {
  const f = await liveEncounterFixture(t);
  await f.request(f.url, { cookie: f.director, method: 'DELETE' });
  const absent = (await f.request(f.url, { cookie: f.director })).value;
  assert.equal(absent.shared, false); assert.ok(absent.revision > 2);
  const replacement = structuredClone(f.liveSnapshot); replacement.revision = absent.revision; replacement.views[0].image = encounterImage(7);
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: replacement })).status, 200);
  const director = (await f.request(`${f.url}?after=2`, { cookie: f.director })).value;
  assert.equal(director.changed, true); assert.ok(director.revision > absent.revision);
  const player = (await f.request(`${f.url}?observer=hero-instance&after=2`, { cookie: f.cookie })).value;
  assert.equal(player.image, encounterImage(7)); assert.notEqual(player.unchanged, true);
});
test('las vistas amplias de 1536x1024 admiten PNG mayores de3MB y conservan los límites de formato y dimensiones', async (t) => {
  const f = await encounterFixture(t);
  const png = Buffer.alloc(2_600_000); Buffer.from('89504e470d0a1a0a', 'hex').copy(png); png.writeUInt32BE(1536, 16); png.writeUInt32BE(1024, 20);
  const snapshot = { ...f.snapshot, views: [{ ...f.snapshot.views[0], image: `data:image/png;base64,${png.toString('base64')}` }] };
  assert.ok(snapshot.views[0].image.length > 3_000_000);
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: snapshot })).status, 200);
  png.writeUInt32BE(9999, 16); snapshot.views[0].image = `data:image/png;base64,${png.toString('base64')}`;
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: snapshot })).status, 400);
});

test('encuentros: entrega solo vistas de personajes propios y conserva campañas e instancias separadas', async (t) => {
  const f = await encounterFixture(t);
  const list = await f.request('/api/campaigns/one/encounters', { cookie: f.cookie });
  assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'no-store');
  assert.deepEqual(list.value[0].characters, [{ instanceId: 'hero-instance', name: 'Héroe' }]);
  assert.ok(!JSON.stringify(list.value).includes('other-instance'));
  const view = await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie });
  assert.equal(view.status, 200); assert.equal(view.value.image, encounterImage());
  for (const field of ['tokens', 'combat', 'mapUrl', 'vision', 'views', 'audience']) assert.equal(view.value[field], undefined);
  assert.equal((await f.request(`${f.url}?observer=other-instance`, { cookie: f.cookie })).status, 404);
  assert.equal((await f.request(f.url, { cookie: f.cookie })).status, 404);
  assert.equal((await f.request(f.url)).status, 401);
  for (const method of ['PUT', 'DELETE']) assert.equal((await f.request(f.url, { cookie: f.cookie, method, data: f.snapshot })).status, 403);
  assert.equal((await f.request('/assets/maps/private-one.png', { cookie: f.cookie })).status, 403);
  assert.deepEqual((await f.request('/api/campaigns/two/encounters', { cookie: f.cookie })).value, []);
  assert.equal((await f.request(f.url.replace('run1', 'run2'), { cookie: f.cookie })).status, 404);
  assert.equal((await f.request(f.url.replace('run1', 'run2'), { cookie: f.director, method: 'PUT', data: { ...f.snapshot, title: 'Otra partida' } })).status, 200);
  await f.request(f.url, { cookie: f.director, method: 'DELETE' });
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).status, 404);
  assert.equal((await f.request('/api/campaigns/one/encounters', { cookie: f.cookie })).value[0].title, 'Otra partida');
  const disk = JSON.parse(await readFile(resolve(f.root, '.local-server/access.json')));
  assert.equal(disk.version, 1); assert.equal(Object.keys(disk.encounters.one).length, 1);
  assert.equal(disk.sheets.one.edited.hero.name, 'Héroe');
});

test('encuentros: una reasignación no revela vistas antiguas y cambiar la visión invalida la imagen', async (t) => {
  const f = await encounterFixture(t);
  const save = (own, revision) => f.request('/api/campaigns/one/sheets', { cookie: f.director, method: 'PUT', data: { edited: { hero: own }, created: [f.foreign], revision } });
  const changed = { ...f.own, vision: { version: 1, senses: [] } };
  assert.equal((await save(changed, 1)).status, 200);
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).status, 409);
  assert.equal((await save({ ...changed, playerIds: [f.other.id] }, 2)).status, 200);
  assert.deepEqual((await f.request('/api/campaigns/one/encounters', { cookie: f.cookie })).value, []);
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).status, 404);
  const otherCookie = await f.login('Ana', '1234');
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: otherCookie })).status, 404);
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: { ...f.snapshot, sheetRevision: 3 } })).status, 200);
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: otherCookie })).status, 200);
});

test('encuentros: valida imágenes, personajes y revisión sin sobrescribir una publicación válida', async (t) => {
  const f = await encounterFixture(t);
  for (const image of ['assets/maps/private-one.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YQ==']) {
    const data = { ...f.snapshot, views: [{ ...f.snapshot.views[0], image }] };
    assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data })).status, 400);
  }
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: { ...f.snapshot, sheetRevision: 0 } })).status, 409);
  const views = [{ ...f.snapshot.views[0], actorId: 'unknown' }];
  assert.equal((await f.request(f.url, { cookie: f.director, method: 'PUT', data: { ...f.snapshot, views } })).status, 400);
  assert.equal((await f.request(`${f.url}?observer=hero-instance`, { cookie: f.cookie })).value.image, encounterImage());
  // Estado nuevo opcional: un reinicio conserva vistas y fichas sin migrar el guardado local.
  const restarted = await createCartaServer({ root: f.root });
  await new Promise((done) => restarted.listen(0, '127.0.0.1', done));
  t.after(() => new Promise((done) => restarted.close(done)));
  const base = `http://127.0.0.1:${restarted.address().port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Jugador', password: '1234' }) });
  const response = await fetch(`${base}/api/campaigns/one/encounters`, { headers: { cookie: login.headers.get('set-cookie').split(';')[0] } });
  assert.equal((await response.json()).length, 1);
});

test('crea los tres usuarios, usa hashes y no devuelve contraseñas', async (t) => {
  const f = await fixture(t);
  for (const [name, password, role] of [['admin', 'admin', 'administrador'], ['Director', '1234', 'director'], ['Jugador', '1234', 'jugador']]) {
    const cookie = await f.login(name, password); const current = await f.request('/api/session', { cookie });
    assert.equal(current.value.role, role); assert.equal(current.value.password, undefined); assert.equal(current.value.passwordHash, undefined);
  }
  const disk = JSON.parse(await readFile(resolve(f.root, '.local-server/access.json')));
  assert.ok(disk.users.every((u) => !('password' in u) && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(u.passwordHash)));
});
test('deniega APIs, JSON de campaña y estado del servidor sin sesión', async (t) => {
  const f = await fixture(t);
  for (const path of ['/api/users', '/api/campaigns', '/api/campaigns/one', '/api/players']) assert.equal((await f.request(path)).status, 401);
  for (const path of ['/data/one.json', '/data/rules.json', '/assets/map.png', '/.local-server/access.json', '/server/app.mjs', '/data%2fone.json', '/%2Fassets/maps/test.png', '/assets%20/maps/test.png']) assert.ok([400,401,403,404].includes((await f.request(path)).status));
  assert.equal((await f.request('/login')).status, 200);
  assert.equal((await f.request('/')).status, 200);
  for (const path of ['/ASSETS/maps/test.png', '/Assets/maps/test.png', '/assets/maps/test.png']) assert.equal((await f.request(path)).status, 403);
});
test('CRUD exige administrador, nombres únicos sin distinción de mayúsculas y último administrador', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const users = (await f.request('/api/users', { cookie: admin })).value;
  assert.equal((await f.request('/api/users', { cookie: director })).status, 403);
  const create = (data) => f.request('/api/users', { method: 'POST', cookie: admin, data });
  const input = { username: 'Ana', password: '1234', role: 'jugador', campaigns: ['one'] };
  const created = await create(input); assert.equal(created.status, 201);
  assert.equal((await create({ ...input, username: 'ANA' })).status, 409);
  assert.equal((await create({ ...input, username: 'Otro', role: 'dios' })).status, 400);
  assert.equal((await create({ ...input, username: 'Otro', campaigns: ['missing'] })).status, 400);
  const administrator = users.find((u) => u.role === 'administrador');
  assert.equal((await f.request(`/api/users/${administrator.id}`, { method: 'DELETE', cookie: admin })).status, 409);
  assert.equal((await f.request(`/api/users/${administrator.id}`, { method: 'PUT', cookie: admin, data: { ...administrator, password: '', role: 'jugador' } })).status, 409);
  assert.equal((await f.request(`/api/users/${created.value.id}`, { method: 'DELETE', cookie: admin })).status, 200);
  assert.equal((await f.request('/api/users', { cookie: admin })).value.some((u) => u.username === 'Ana'), false);
});
test('filtra campañas, bloquea cambiar IDs y revoca la sesión al editar permisos', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), old = await f.login('Director', '1234');
  const director = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'director');
  assert.equal((await f.request(`/api/users/${director.id}`, { method: 'PUT', cookie: admin, data: { ...director, campaigns: ['one'], password: '' } })).status, 200);
  assert.equal((await f.request('/api/session', { cookie: old })).value, null);
  const cookie = await f.login('Director', '1234');
  assert.deepEqual((await f.request('/api/campaigns', { cookie })).value.map((c) => c.id), ['one']);
  assert.equal((await f.request('/api/campaigns/two', { cookie })).status, 403);
  assert.equal((await f.request('/data/one.json', { cookie })).status, 403);
});
test('asignar varios jugadores concede campaña de forma atómica y oculta fichas ajenas y secretos', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const player = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'jugador');
  await f.request(`/api/users/${player.id}`, { cookie: admin, method: 'PUT', data: { ...player, password: '', campaigns: [] } });
  const another = (await f.request('/api/users', { cookie: admin, method: 'POST', data: { username: 'Otro', role: 'jugador', campaigns: [], password: '1234' } })).value;
  const body = { edited: { hero: sheet('hero', [player.id, another.id]) }, created: [sheet('custom-hidden')], revision: 0 };
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: body })).status, 200);
  const players = (await f.request('/api/players', { cookie: director })).value;
  assert.ok(players.every((p) => Object.keys(p).sort().join(',') === 'id,username'));
  for (const name of ['Jugador', 'Otro']) {
    const cookie = await f.login(name, '1234');
    assert.deepEqual((await f.request('/api/campaigns', { cookie })).value.map((c) => c.id), ['one']);
    const campaign = (await f.request('/api/campaigns/one', { cookie })).value;
    assert.deepEqual(campaign.playerOptions.map((s) => s.id), ['hero']); assert.deepEqual(campaign.sheetOverrides.created, []);
    assert.deepEqual(campaign.npcs, []); assert.deepEqual(campaign.acts, []); assert.equal(campaign.sealedLetter.message, '');
    assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { ...body, revision: 1 } })).status, 403);
    assert.equal((await f.request('/api/users', { cookie })).status, 403);
    assert.deepEqual((await f.request('/data/rules.json', { cookie })).value.creatures, []);
  }
});
test('rechaza fichas inválidas y conflictos sin modificar datos ni asignaciones', async (t) => {
  const f = await fixture(t), director = await f.login('Director', '1234');
  const write = (data) => f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data });
  const data = { edited: {}, created: [sheet('custom-one')], revision: 0 };
  assert.equal((await write(data)).status, 200);
  assert.equal((await write({ ...data, created: [sheet('custom-lost')] })).status, 409);
  assert.equal((await write({ ...data, revision: 1, created: [{ id: 'broken', name: 'No' }] })).status, 400);
  assert.equal((await write({ ...data, revision: 1, created: [sheet('custom-one', ['missing'])] })).status, 400);
  assert.deepEqual((await f.request('/api/campaigns/one', { cookie: director })).value.sheetOverrides.created.map((s) => s.id), ['custom-one']);
  assert.deepEqual((await f.request('/api/campaigns/two', { cookie: director })).value.sheetOverrides.created, []);
});
test('protege origen, cookie HttpOnly, cierre y caducidad de sesión', async (t) => {
  const f = await fixture(t);
  const login = await f.request('/api/session', { method: 'POST', data: { username: 'Director', password: '1234' } });
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await f.request('/api/session', { method: 'DELETE', cookie: login.cookie, origin: 'https://otro.example' })).status, 403);
  assert.equal((await f.request('/api/session', { cookie: login.cookie })).value.username, 'Director');
  f.advance(31 * 60 * 1000); assert.equal((await f.request('/api/session', { cookie: login.cookie })).value, null);
  const cookie = await f.login('Director', '1234');
  assert.equal((await f.request('/api/session', { method: 'DELETE', cookie })).status, 200);
  assert.equal((await f.request('/api/campaigns', { cookie })).status, 401);
});
test('migración conserva entrada y no se duplica ni reemplaza fichas de otra campaña', async (t) => {
  const f = await fixture(t), cookie = await f.login('Director', '1234');
  const data = { edited: { hero: sheet('hero') }, created: [sheet('custom-legacy')] }, original = JSON.stringify(data);
  assert.equal((await f.request('/api/campaigns/one/import', { cookie, method: 'POST', data })).status, 200);
  assert.equal(JSON.stringify(data), original);
  assert.equal((await f.request('/api/campaigns/one/import', { cookie, method: 'POST', data })).status, 409);
  assert.equal((await f.request('/api/campaigns/two/import', { cookie, method: 'POST', data })).status, 409);
});
test('fallo de escritura conserva usuarios guardados y el servidor sigue atendiendo', async (t) => {
  const f = await fixture(t), cookie = await f.login('admin', 'admin');
  const path = resolve(f.root, '.local-server/access.json');
  const original = await readFile(path, 'utf8');
  await rename(path, `${path}.backup`); await mkdir(path);
  assert.equal((await f.request('/api/users', { method: 'POST', cookie, data: { username: 'NoPersistido', role: 'jugador', campaigns: [], password: '1234' } })).status, 500);
  assert.equal((await f.request('/api/users', { cookie })).value.some((u) => u.username === 'NoPersistido'), false);
  assert.equal(await readFile(`${path}.backup`, 'utf8'), original);
});
test('credenciales inválidas no distinguen usuario y limitan intentos sin comprar servicios', async (t) => {
  const f = await fixture(t);
  for (let n = 0; n < 10; n++) assert.equal((await f.request('/api/session', { method: 'POST', data: { username: 'nadie', password: 'incorrecta' } })).status, 401);
  assert.equal((await f.request('/api/session', { method: 'POST', data: { username: 'nadie', password: 'incorrecta' } })).status, 429);
  f.advance(61000); assert.ok(await f.login('admin', 'admin'));
});

test('una petición retenida de un administrador revocado no crea usuarios al terminar su cuerpo', async (t) => {
  const f = await fixture(t), first = await f.login('admin', 'admin');
  const users = (await f.request('/api/users', { cookie: first })).value;
  const administrator = users.find((u) => u.username === 'admin');
  await f.request('/api/users', { cookie: first, method: 'POST', data: { username: 'Respaldo', password: '1234', role: 'administrador', campaigns: [] } });
  const second = await f.login('Respaldo', '1234');
  let finish;
  const result = new Promise((done, reject) => {
    const pending = httpRequest(`${f.base}/api/users`, { method: 'POST', headers: { cookie: first, origin: f.base, 'Content-Type': 'application/json' } }, (res) => { res.resume(); res.on('end', () => done(res.statusCode)); });
    pending.on('error', reject);
    pending.write('{"username":"Intruso","password":"1234","role":"administrador","campaigns":[]');
    finish = () => pending.end('}');
  });
  assert.equal((await f.request(`/api/users/${administrator.id}`, { method: 'PUT', cookie: second, data: { ...administrator, role: 'jugador', password: '' } })).status, 200);
  finish(); assert.ok([401,403].includes(await result));
  assert.equal((await f.request('/api/users', { cookie: second })).value.some((u) => u.username === 'Intruso'), false);
});

test('cambiar rol de un jugador retira asociaciones y bloquea sobrescrituras con revisión antigua', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const player = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'jugador');
  const data = { edited: { hero: sheet('hero', [player.id]) }, created: [], revision: 0 };
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data })).status, 200);
  assert.equal((await f.request(`/api/users/${player.id}`, { cookie: admin, method: 'PUT', data: { ...player, password: '', role: 'director' } })).status, 200);
  const after = (await f.request('/api/campaigns/one', { cookie: director })).value.sheetOverrides;
  assert.deepEqual(after.edited.hero.playerIds, []); assert.equal(after.revision, 2);
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: { ...data, revision: 1 } })).status, 409);
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: after })).status, 200);
});
test('imágenes de campaña requieren asignación; variantes Windows no evitan la comprobación', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin');
  const users = (await f.request('/api/users', { cookie: admin })).value;
  for (const role of ['director', 'jugador']) {
    const user = users.find((u) => u.role === role);
    await f.request(`/api/users/${user.id}`, { cookie: admin, method: 'PUT', data: { ...user, campaigns: [], password: '' } });
    const cookie = await f.login(user.username, '1234');
    for (const path of ['/assets/maps/test.png', '/ASSETS/maps/test.png', '/%2Fassets/maps/test.png', '/assets%20/maps/test.png']) assert.ok([400,403].includes((await f.request(path, { cookie })).status));
  }
});

test('el director descarga recursos de su campaña pero no mapas privados de otra', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin');
  const user = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'director');
  await f.request(`/api/users/${user.id}`, { method: 'PUT', cookie: admin, data: { ...user, password: '', campaigns: ['one'] } });
  const cookie = await f.login('Director', '1234');
  assert.equal((await f.request('/assets/maps/private-one.png', { cookie })).status, 200);
  assert.equal((await f.request('/assets/maps/private-two.png', { cookie })).status, 403);
});

test('el jugador edita solo sus fichas, conserva las ajenas y recibe una respuesta filtrada', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const player = (await f.request('/api/users', { cookie: admin })).value.find((u) => u.role === 'jugador');
  const own = sheet('hero', [player.id]), hidden = sheet('custom-hidden');
  await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: { edited: { hero: own }, created: [hidden], revision: 0 } });
  const cookie = await f.login('Jugador', '1234');
  const edited = { ...own, name: 'Ficha editada por su jugador', hitPoints: 42 };
  const response = await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { edited: { hero: edited }, created: [], revision: 1 } });
  assert.equal(response.status, 200); assert.equal(response.value.edited.hero.hitPoints, 42); assert.deepEqual(response.value.created, []);
  const all = (await f.request('/api/campaigns/one', { cookie: director })).value.sheetOverrides;
  assert.deepEqual(all.created, [hidden]); assert.deepEqual(all.edited.hero.playerIds, [player.id]); assert.equal(all.edited.hero.name, edited.name);
  const attempts = [
    { edited: { hero: { ...edited, playerIds: [] } }, created: [] },
    { edited: { hero: { ...edited, playerIds: [player.id, player.id] } }, created: [] },
    { edited: { hero: { ...edited, tokenUrl: 'assets/maps/private-two.png' } }, created: [] },
    { edited: {}, created: [{ ...hidden, playerIds: [player.id] }] },
    { edited: {}, created: [sheet('custom-new', [player.id])] },
  ];
  for (const attempt of attempts) assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { ...attempt, revision: 2 } })).status, 403);
  assert.equal((await f.request('/assets/maps/private-two.png', { cookie })).status, 403);
  assert.deepEqual((await f.request('/api/campaigns/one', { cookie: director })).value.sheetOverrides, all);
  assert.equal((await f.request('/api/campaigns/one/import', { cookie, method: 'POST', data: { edited: {}, created: [] } })).status, 403);
});
test('un jugador no modifica fichas de otra campaña y el director conserva el control de las asociaciones', async (t) => {
  const f = await fixture(t), admin = await f.login('admin', 'admin'), director = await f.login('Director', '1234');
  const users = (await f.request('/api/users', { cookie: admin })).value, player = users.find((u) => u.role === 'jugador');
  const other = (await f.request('/api/users', { cookie: admin, method: 'POST', data: { username: 'Segundo', role: 'jugador', campaigns: ['one'], password: '1234' } })).value;
  await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: { edited: { hero: sheet('hero', [player.id]) }, created: [sheet('custom-shared', [player.id, other.id])], revision: 0 } });
  const cookie = await f.login('Jugador', '1234');
  assert.equal((await f.request('/api/campaigns/two/sheets', { cookie, method: 'PUT', data: { edited: { hero: sheet('hero', [player.id]) }, created: [], revision: 0 } })).status, 403);
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { edited: { hero: sheet('hero', [player.id, other.id]) }, created: [], revision: 1 } })).status, 403);
  const shared = { ...sheet('custom-shared'), name: 'Compartida editada' };
  delete shared.playerIds;
  const save = await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { edited: {}, created: [shared], revision: 1 } });
  assert.equal(save.status, 200); assert.deepEqual(save.value.created[0].playerIds, [player.id, other.id]);
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { edited: {}, created: [shared], revision: 1 } })).status, 409);
  const snapshot = (await f.request('/api/campaigns/one', { cookie: director })).value.sheetOverrides;
  snapshot.edited.hero.playerIds = [other.id];
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie: director, method: 'PUT', data: snapshot })).status, 200);
  assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: { edited: { hero: sheet('hero') }, created: [], revision: 3 } })).status, 403);
});
