import { NPC_PORTRAITS, GENERIC_MAP_PATHS } from '../shared/assets.mjs';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, rename, mkdir, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const scrypt = promisify(scryptCallback);
const roles = ['administrador', 'director', 'jugador'];
const clone = (value) => structuredClone(value);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const publicUser = ({ id, username, role, campaigns }) => ({ id, username, role, campaigns });
const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const unsafeKeys = (value) => object(value) && Object.entries(value).some(([key, item]) => ['__proto__', 'constructor', 'prototype'].includes(key) || unsafeKeys(item)) || Array.isArray(value) && value.some(unsafeKeys);
async function hash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${key.toString('hex')}`;
}
async function verify(password, encoded) {
  const [salt, stored] = encoded.split(':');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(key, Buffer.from(stored, 'hex'));
}
export async function createCartaServer({ root = process.cwd(), stateDir = resolve(root, '.local-server'), publicOrigin = '', now = Date.now } = {}) {
  const publicRoot = resolve(root, 'public');
  const buildRoot = resolve(root, 'dist/la-carta-sellada/browser');
  const catalog = JSON.parse(await readFile(resolve(publicRoot, 'data/campaigns.json'), 'utf8'));
  const campaignIds = new Set(catalog.map((item) => item.id));
  const filename = resolve(stateDir, 'access.json');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  let state;
  try { state = JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('No se puede leer el archivo de usuarios. Se conserva el original.');
    state = { version: 1, users: [], sheets: {}, imports: {} };
    for (const [username, password, role] of [['admin', 'admin', 'administrador'], ['Director', '1234', 'director'], ['Jugador', '1234', 'jugador']]) {
      state.users.push({ id: randomUUID(), username, passwordHash: await hash(password), role, campaigns: role === 'administrador' ? [] : [...campaignIds] });
    }
    await writeFile(filename, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
  }
  if (state.version !== 1 || !Array.isArray(state.users) || !object(state.sheets) || !object(state.imports) || !state.users.some((u) => u.role === 'administrador')) throw new Error('Formato de usuarios no admitido; no se modifica el original.');
  const sessions = new Map(), attempts = new Map();
  let queue = Promise.resolve();
  const transaction = (work) => {
    const result = queue.then(async () => {
      const next = clone(state), response = await work(next);
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(next), { mode: 0o600, flag: 'wx' });
      await rename(temporary, filename);
      state = next;
      return response;
    });
    queue = result.catch(() => {}); return result;
  };
  const sheetsFor = (id, snapshot = state) => snapshot.sheets[id] ?? { edited: {}, created: [], revision: 0 };
  const canCampaign = (user, id) => user.role !== 'administrador' && user.campaigns.includes(id) && campaignIds.has(id);
  const director = (user, id) => { if (user.role !== 'director' || !canCampaign(user, id)) fail(403, 'No tienes acceso a esta campaña.'); };
  const validateSheet = (sheet, id, snapshot) => {
    if (!object(sheet) || !validId(id) || sheet.id !== id || typeof sheet.name !== 'string' || !sheet.name.trim() || !Array.isArray(sheet.playerIds ?? []) || !(sheet.playerIds ?? []).every((pid) => snapshot.users.some((u) => u.id === pid && u.role === 'jugador'))) fail(400, 'Ficha o jugadores no válidos.');
    const texts = ['name', 'ancestry', 'className', 'subclass', 'background', 'hook', 'feat', 'speed', 'initiative'];
    const lists = ['saves', 'skills', 'attacks', 'features', 'spells', 'equipment'];
    if (texts.some((key) => typeof sheet[key] !== 'string' || sheet[key].length > 20000) || lists.some((key) => !Array.isArray(sheet[key]) || sheet[key].length > 1000 || sheet[key].some((v) => typeof v !== 'string' || v.length > 20000)) || ['level', 'armorClass', 'hitPoints', 'proficiencyBonus'].some((key) => !Number.isFinite(sheet[key]) || sheet[key] < 0) || !object(sheet.abilities) || ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].some((key) => !Number.isFinite(sheet.abilities[key]) || sheet.abilities[key] < 0 || sheet.abilities[key] > 30)) fail(400, 'La ficha tiene estadísticas o campos incompletos.');
    if (JSON.stringify(sheet).length > 250000) fail(413, 'La ficha es demasiado grande.');
  };
  async function campaignBase(id) {
    const entry = catalog.find((c) => c.id === id);
    if (!entry) fail(404, 'No se encuentra la campaña.');
    const path = resolve(publicRoot, entry.dataPath);
    if (!path.startsWith(`${publicRoot}${sep}`)) fail(500, 'Ruta de campaña no válida.');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  async function body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) fail(415, 'Envía datos JSON.');
    let chunks = [], length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 4 * 1024 * 1024) fail(413, 'Solicitud demasiado grande.'); chunks.push(chunk); }
    let data; try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, 'JSON no válido.'); }
    if (!object(data) || unsafeKeys(data)) fail(400, 'Datos no válidos.');
    return data;
  }
  function unlinkPlayer(snapshot, id) {
    for (const sheets of Object.values(snapshot.sheets)) {
      let changed = false;
      for (const sheet of [...Object.values(sheets.edited), ...sheets.created]) {
        if ((sheet.playerIds ?? []).includes(id)) { sheet.playerIds = sheet.playerIds.filter((pid) => pid !== id); changed = true; }
      }
      if (changed) sheets.revision++;
    }
  }
  function invalidate(id) { for (const [key, value] of sessions) if (value.userId === id) sessions.delete(key); }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try {
      const host = req.headers.host ?? '';
      const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
      if (!(publicOrigin ? host === new URL(publicOrigin).host : localHost)) fail(400, 'Servidor no reconocido.');
      const origin = publicOrigin || `http://${host}`;
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) fail(403, 'Origen no permitido.');
      const url = new URL(req.url, origin), path = decodeURIComponent(url.pathname);
      if (path.includes('\\') || path.includes('\0') || path.includes('//') || path.split('/').some((part) => /[. ]$/.test(part))) fail(400, 'Ruta no válida.');
      const cookie = /(?:^|;\s*)carta_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
      const session = cookie && sessions.get(cookie);
      if (session && (now() - session.last > 30 * 60 * 1000 || now() - session.created > 8 * 60 * 60 * 1000)) sessions.delete(cookie);
      const current = cookie && sessions.get(cookie);
      const user = current && state.users.find((u) => u.id === current.userId);
      if (current && user) current.last = now();
      const liveUser = (snapshot = state) => {
        const active = cookie && sessions.get(cookie);
        const latest = active && snapshot.users.find((u) => u.id === active.userId);
        if (!latest) fail(401, 'La sesión ha caducado. Inicia sesión de nuevo.');
        return latest;
      };
      const administrator = (snapshot) => { if (liveUser(snapshot).role !== 'administrador') fail(403, 'Solo el administrador puede gestionar usuarios.'); };
      const secure = origin.startsWith('https:') ? '; Secure' : '';
      const cookieHeader = (token, expires = false) => `carta_session=${token}; HttpOnly; SameSite=Strict; Path=/${expires ? '; Max-Age=0' : ''}${secure}`;
      if (path === '/api/session' && req.method === 'POST') {
        const input = await body(req);
        if (typeof input.username !== 'string' || typeof input.password !== 'string' || input.username.length > 80 || input.password.length > 256) fail(400, 'Credenciales no válidas.');
        const key = req.socket.remoteAddress ?? 'local';
        const limit = attempts.get(key);
        if (limit && now() - limit.start < 60 * 1000 && limit.count >= 10) fail(429, 'Demasiados intentos. Espera un minuto.');
        if (!limit || now() - limit.start >= 60 * 1000) attempts.set(key, { start: now(), count: 1 }); else limit.count++;
        const found = state.users.find((u) => u.username.toLocaleLowerCase('es') === input.username.trim().toLocaleLowerCase('es'));
        const correct = await verify(input.password, found?.passwordHash ?? state.users[0].passwordHash);
        if (!found || !correct || state.users.find((u) => u.id === found.id)?.passwordHash !== found.passwordHash) fail(401, 'Usuario o contraseña incorrectos.');
        if (cookie) sessions.delete(cookie);
        for (const [token, saved] of sessions) if (now() - saved.created > 8 * 60 * 60 * 1000) sessions.delete(token);
        if (sessions.size >= 500) fail(503, 'No hay sesiones disponibles.');
        attempts.delete(key);
        const token = randomBytes(32).toString('hex'); sessions.set(token, { userId: found.id, created: now(), last: now() });
        res.setHeader('Set-Cookie', cookieHeader(token)); return json(res, 200, publicUser(found));
      }
      if (path === '/api/session' && req.method === 'GET') return json(res, 200, user ? publicUser(user) : null);
      if (path === '/api/session' && req.method === 'DELETE') { if (cookie) sessions.delete(cookie); res.setHeader('Set-Cookie', cookieHeader('', true)); return json(res, 200, {}); }
      if (path.startsWith('/api/') && !user) fail(401, 'Inicia sesión para continuar.');
      if (path === '/api/users' || /^\/api\/users\/[^/]+$/.test(path)) {
        if (user.role !== 'administrador') fail(403, 'Solo el administrador puede gestionar usuarios.');
        if (req.method === 'GET' && path === '/api/users') return json(res, 200, state.users.map(publicUser));
        const id = path.split('/')[3];
        if (req.method === 'DELETE' && id) {
          await transaction((next) => {
            administrator(next);
            const victim = next.users.find((u) => u.id === id); if (!victim) fail(404, 'Usuario inexistente.');
            if (victim.role === 'administrador' && next.users.filter((u) => u.role === 'administrador').length === 1) fail(409, 'Debe quedar al menos un administrador.');
            next.users = next.users.filter((u) => u.id !== id);
            unlinkPlayer(next, id);
          }); invalidate(id); return json(res, 200, {});
        }
        if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
          const input = await body(req), username = typeof input.username === 'string' ? input.username.trim() : undefined;
          if (typeof username !== 'string' || !/^[\p{L}\p{N}_. -]{1,80}$/u.test(username) || !roles.includes(input.role) || !Array.isArray(input.campaigns) || !input.campaigns.every((cid) => campaignIds.has(cid)) || typeof input.password !== 'string' || input.password.length > 256 || (!id && !input.password)) fail(400, 'Revisa usuario, rol, campañas y contraseña.');
          const passwordHash = input.password ? await hash(input.password) : undefined;
          const saved = await transaction((next) => {
            administrator(next);
            const old = id && next.users.find((u) => u.id === id); if (id && !old) fail(404, 'Usuario inexistente.');
            if (next.users.some((u) => u.id !== id && u.username.toLocaleLowerCase('es') === username.toLocaleLowerCase('es'))) fail(409, 'El nombre de usuario ya existe.');
            if (old?.role === 'administrador' && input.role !== 'administrador' && next.users.filter((u) => u.role === 'administrador').length === 1) fail(409, 'Debe quedar al menos un administrador.');
            const entry = { id: id || randomUUID(), username, role: input.role, campaigns: input.role === 'administrador' ? [] : [...new Set(input.campaigns)], passwordHash: passwordHash ?? old.passwordHash };
            if (old?.role === 'jugador' && input.role !== 'jugador') unlinkPlayer(next, old.id);
            if (old) next.users[next.users.indexOf(old)] = entry; else next.users.push(entry);
            return publicUser(entry);
          }); if (id) invalidate(id); return json(res, id ? 200 : 201, saved);
        }
        fail(405, 'Operación no admitida.');
      }
      if ((path === '/api/campaigns' || path === '/data/campaigns.json') && req.method === 'GET') {
        if (!user) fail(401, 'Inicia sesión para continuar.');
        const visible = user.role === 'administrador' ? catalog : catalog.filter((c) => canCampaign(user, c.id));
        return json(res, 200, visible.map((c) => ({ ...c, dataPath: `/api/campaigns/${c.id}` })));
      }
      if (path === '/api/players' && req.method === 'GET') {
        if (user.role !== 'director') fail(403, 'Acceso no permitido.');
        return json(res, 200, state.users.filter((u) => u.role === 'jugador').map(({ id, username }) => ({ id, username })));
      }
      const match = /^\/api\/campaigns\/([a-zA-Z0-9_-]+)(?:\/(sheets|import))?$/.exec(path);
      if (match) {
        const [, id, operation] = match;
        if (!canCampaign(user, id)) fail(403, 'No tienes acceso a esta campaña.');
        if (req.method === 'GET' && !operation) {
          const base = await campaignBase(id), saved = clone(sheetsFor(id));
          if (user.role === 'jugador') {
            const owns = (sheet) => (sheet.playerIds ?? []).includes(user.id);
            const allowedIds = new Set([...Object.values(saved.edited), ...saved.created].filter(owns).map((s) => s.id));
            saved.edited = Object.fromEntries(Object.entries(saved.edited).filter(([, sheet]) => owns(sheet))); saved.created = saved.created.filter(owns);
            const safe = { id, name: base.name, system: base.system, startingLevel: base.startingLevel, partySize: base.partySize, premise: '', npcs: [], items: [], locations: [], scenes: [], encounters: [], playerCharacters: base.playerCharacters.filter((s) => allowedIds.has(s.id)), playerOptions: base.playerOptions.filter((s) => allowedIds.has(s.id)), antagonistOptions: [], rewards: [], mysteryHooks: [], sealedLetter: { school: [], arcanaDc: 0, religionDc: 0, traits: [], message: '' }, acts: [] };
            return json(res, 200, { ...safe, sheetOverrides: saved });
          }
          return json(res, 200, { ...base, sheetOverrides: saved, legacyImported: Boolean(state.imports.legacyPlayers) });
        }
        director(user, id);
        if (req.method === 'PUT' && operation === 'sheets' || req.method === 'POST' && operation === 'import') {
          const input = await body(req);
          if (!object(input.edited) || !Array.isArray(input.created)) fail(400, 'Colección de fichas no válida.');
          await transaction((next) => {
            director(liveUser(next), id);
            const old = sheetsFor(id, next);
            if (operation === 'import' && (next.imports.legacyPlayers || next.imports[id] || Object.keys(old.edited).length || old.created.length)) fail(409, 'La campaña ya tiene fichas guardadas. Se conservan los datos locales.');
            if (operation === 'sheets' && input.revision !== old.revision) fail(409, 'Otro director ha cambiado las fichas. Recarga antes de guardar.');
            const ids = new Set();
            for (const [sid, sheet] of [...Object.entries(input.edited), ...input.created.map((s) => [s.id, s])]) {
              validateSheet(sheet, sid, next); if (ids.has(sid)) fail(400, 'Ficha duplicada.'); ids.add(sid);
              for (const pid of sheet.playerIds ?? []) { const player = next.users.find((u) => u.id === pid); if (!player.campaigns.includes(id)) player.campaigns.push(id); }
            }
            next.sheets[id] = { edited: input.edited, created: input.created, revision: old.revision + 1 };
            if (operation === 'import') { next.imports[id] = { at: new Date(now()).toISOString() }; next.imports.legacyPlayers = id; }
          }); return json(res, 200, clone(sheetsFor(id)));
        }
        fail(405, 'Operación no admitida.');
      }
      if (path.startsWith('/api/')) fail(404, 'Operación inexistente.');
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'Operación no admitida.');
      if (/^\/data\//i.test(path)) {
        if (!user || user.role === 'administrador') fail(403, 'Acceso no permitido.');
        if (path !== '/data/rules.json') fail(403, 'Accede a las campañas desde la aplicación.');
        const rules = JSON.parse(await readFile(resolve(publicRoot, 'data/rules.json'), 'utf8'));
        if (user.role === 'jugador') rules.creatures = [];
        return json(res, 200, rules);
      }
      // Solo se sirven archivos compilados y recursos públicos; nunca el código del servidor ni su estado.
      const isAsset = /^\/assets\//i.test(path);
      if (isAsset && (!user || user.role === 'administrador')) fail(403, 'Inicia sesión para acceder.');
      if (!['.html', '.js', '.css', '.ico', '.woff2', ''].includes(extname(path).toLowerCase()) && (!user || user.role === 'administrador')) fail(403, 'Acceso no permitido.');
      if (isAsset) {
        const allowed = new Set();
        const add = (value) => { if (typeof value === 'string' && value.startsWith('assets/') && !value.includes('..')) allowed.add(`/${value}`.toLowerCase()); };
        const walk = (value) => { if (typeof value === 'string') add(value); else if (Array.isArray(value)) value.forEach(walk); else if (object(value)) Object.values(value).forEach(walk); };
        if (user.role === 'director') {
          GENERIC_MAP_PATHS.forEach(add);
          add('assets/maps/faerun-atlas-aidedd.jpg');
          if (/^\/assets\/(?:tokens|tokens-grid)\/generic\/[a-zA-Z0-9_-]+\.png$/i.test(path)) allowed.add(path.toLowerCase());
        }
        for (const campaign of catalog.filter((c) => canCampaign(user, c.id))) {
          add(campaign.coverImage);
          const saved = sheetsFor(campaign.id);
          let owned = [...Object.values(saved.edited), ...saved.created];
          if (user.role === 'jugador') owned = owned.filter((sheet) => (sheet.playerIds ?? []).includes(user.id));
          if (user.role === 'director') {
            const base = await campaignBase(campaign.id); walk(base);
            owned = [...base.playerCharacters, ...base.playerOptions, ...owned];
            for (const npc of base.npcs) { add(NPC_PORTRAITS[npc.id]?.src); add(`assets/tokens/npcs/${npc.id}.png`); add(`assets/tokens-grid/npcs/${npc.id}.png`); }
          }
          for (const sheet of owned) {
            add(sheet.tokenUrl); add(sheet.gridTokenUrl);
            add(`assets/tokens/players/${sheet.id}.png`); add(`assets/tokens-grid/players/${sheet.id}.png`);
          }
        }
        if (!allowed.has(path.toLowerCase())) fail(403, 'Este recurso no pertenece a tus campañas, fichas o reglas.');
      }
      const base = isAsset ? publicRoot : buildRoot;
      let file = resolve(base, `.${path}`);
      if (file !== base && !file.startsWith(`${base}${sep}`)) fail(403, 'Ruta no permitida.');
      try { if (!(await stat(file)).isFile()) throw Object.assign(new Error(), { code: 'ENOENT' }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; if (extname(path)) fail(404, 'Archivo inexistente.'); file = resolve(buildRoot, 'index.html'); }
      const canonical = await realpath(file);
      if (!canonical.startsWith(`${await realpath(base)}${sep}`)) fail(403, 'Ruta no permitida.');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
      if (!types[extname(file)]) fail(403, 'Archivo no permitido.');
      res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) { if (!res.headersSent) json(res, error.status ?? 500, { message: error.status ? error.message : 'No se pudo completar la operación. Los datos guardados se conservan.' }); else res.end(); }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  return server;
}
