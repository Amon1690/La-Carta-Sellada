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
    assert.equal((await f.request('/api/campaigns/one/sheets', { cookie, method: 'PUT', data: body })).status, 403);
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
