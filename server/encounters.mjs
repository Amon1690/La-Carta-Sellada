// El estado completo es privado del director; cada vista de jugador es una proyección acotada.
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const text = (value, max = 500) => typeof value === 'string' && value.length > 0 && value.length <= max;
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function validControls(value) {
  return value && finite(value.position?.x, 0, 1536) && finite(value.position?.y, 0, 1024) && finite(value.position?.size, .1, 30) &&
    typeof value.canMove === 'boolean' && typeof value.canAttack === 'boolean' &&
    Array.isArray(value.cells) && value.cells.length <= 600 && value.cells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 600) &&
    Array.isArray(value.targets) && value.targets.length <= 500 && value.targets.every((target) => text(target.id, 300) && text(target.name) && finite(target.x, 0, 1536) && finite(target.y, 0, 1024) && finite(target.size, .1, 30)) &&
    Array.isArray(value.attacks) && value.attacks.length <= 200 && value.attacks.every((attack) => text(attack.source, 20000) && text(attack.name) &&
      Array.isArray(attack.targetIds) && attack.targetIds.length <= 500 && attack.targetIds.every((id) => value.targets.some((target) => target.id === id)));
}
export function validLiveState(value) {
  return value && Array.isArray(value.tokens) && value.tokens.length <= 500 && value.tokens.every((token) =>
    text(token.instanceId, 300) && text(token.actorId, 200) && text(token.name) && typeof token.image === 'string' &&
    finite(token.x, 0, 1536) && finite(token.y, 0, 1024) && finite(token.size, .1, 30) && finite(token.hp, 0, 1000000) && finite(token.maxHp, 0, 1000000) && typeof token.hidden === 'boolean') &&
    new Set(value.tokens.map((token) => token.instanceId)).size === value.tokens.length &&
    Array.isArray(value.fogRects) && value.fogRects.length <= 10000 && value.fogRects.every((fog) => [fog.x, fog.y, fog.width, fog.height].every((n) => finite(n, 0, 100000))) &&
    value.layers && ['grid', 'fog', 'tokens', 'labels'].every((key) => typeof value.layers[key] === 'boolean') && finite(value.zoom, .1, 10);
}
export function validateEncounter(input) {
  const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
  const views = input.views;
  if (!text(input.title, 500) || !Number.isInteger(input.sheetRevision) || !Array.isArray(views) || views.length > 30) return false;
  if (input.state !== undefined && (!validLiveState(input.state) || !Number.isInteger(input.revision) || input.revision < 0 || !['unknown', 'clear', 'rain', 'snow', 'fog', 'other'].includes(input.weather))) return false;
  const ids = new Set();
  return views.every((view) => {
    if (!view || !text(view.instanceId, 120) || !text(view.actorId, 120) || ids.has(view.instanceId) ||
        typeof view.pending !== 'boolean' || !text(view.image, 8_500_000) ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(view.image)) return false;
    ids.add(view.instanceId);
    if (input.state !== undefined && (!validControls(view.controls) || !input.state.tokens.some((token) => token.instanceId === view.instanceId && token.actorId === `player:${view.actorId}`))) return false;
    // Solo imágenes raster de las dimensiones del tablero; nunca SVG ni URLs a recursos originales.
    const png = Buffer.from(view.image.slice(22), 'base64');
    return png.length >= 24 && png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      png.readUInt32BE(16) === 1536 && png.readUInt32BE(20) === 1024;
  });
}

export function playerControls(board, view, online) {
  if (!view.controls || !board.state) return undefined;
  const controls = structuredClone(view.controls), token = board.state.tokens.find((token) => token.instanceId === view.instanceId);
  const combat = board.state.combat;
  const turn = online && !board.pendingCommand && combat?.started === true && combat.turnId === view.instanceId && board.state.activeTurnId === view.instanceId &&
    !combat.pending && token?.hp > 0 && !token.hidden && !token.conditions?.includes('incapacitated');
  controls.canMove &&= !!turn; controls.canAttack &&= !!turn;
  return controls;
}

export function authorizeCommand(input, board, user, sheets, online, now, sheetRevision = board.sheetRevision) {
  const allowed = ['id', 'revision', 'observerId', 'type', 'cell', 'source', 'targetId'];
  if (!input || Object.keys(input).some((key) => !allowed.includes(key)) || !text(input.id, 120) || !text(input.observerId, 300) || !['move', 'attack'].includes(input.type)) fail(400, 'Acción no válida.');
  const previous = board.receipts?.find((receipt) => receipt.id === input.id);
  if (previous) { if (previous.userId !== user.id) fail(409, 'Identificador de acción ya utilizado.'); return { receipt: { id: previous.id, status: previous.status, message: previous.message } }; }
  if (board.pendingCommand?.id === input.id && board.pendingCommand.userId === user.id) return { pending: true, id: input.id };
  if (board.sheetRevision !== sheetRevision) fail(409, 'Las fichas han cambiado. El director debe actualizar el encuentro.');
  if (!online) fail(409, 'El director debe mantener abierto este encuentro para resolver acciones.');
  if (!Number.isInteger(input.revision) || input.revision !== board.revision || board.pendingCommand) fail(409, 'El encuentro ha cambiado o hay una acción pendiente. Espera a la actualización.');
  const view = board.views.find((view) => view.instanceId === input.observerId), sheet = view && sheets.get(view.actorId);
  if (!view || !sheet || !view.audience.includes(user.id) || !sheet.playerIds?.includes(user.id)) fail(403, 'Solo puedes actuar con un personaje asignado.');
  if (JSON.stringify(view.vision) !== JSON.stringify(sheet.vision ?? null)) fail(409, 'El director debe actualizar la visión de este personaje.');
  const controls = playerControls(board, view, online);
  if (input.type === 'move' ? !controls?.canMove : !controls?.canAttack) fail(403, 'Solo puedes actuar con tu token durante su turno y sin decisiones pendientes.');
  if (input.type === 'move') {
    if (!Number.isInteger(input.cell) || !controls.cells.includes(input.cell) || input.source !== undefined || input.targetId !== undefined) fail(400, 'Elige una casilla visible permitida.');
  } else if (input.cell !== undefined || !controls.attacks.some((attack) => attack.source === input.source && attack.targetIds.includes(input.targetId))) fail(400, 'Elige un ataque preparado y un objetivo visible permitido.');
  return { command: { id: input.id, userId: user.id, observerId: input.observerId, type: input.type, expiresAt: now + 15000, sheetRevision: board.sheetRevision,
    ...(input.type === 'move' ? { cell: input.cell } : { source: input.source, targetId: input.targetId }) } };
}

export function encounterSheets(collection) {
  return new Map([...collection.created, ...Object.values(collection.edited)].map((sheet) => [sheet.id, sheet]));
}

/** Una imagen compartida también depende de los perfiles de sus contribuyentes. */
export function currentViewVision(board, view, sheets, sheetRevision) {
  const vision = board.state?.vision;
  const group = Array.isArray(vision?.groups) && vision.groups.find((item) => item && item.id === vision.activeGroupId && Array.isArray(item.observerIds) && item.observerIds.includes(view.instanceId));
  // Un PJ sin dueño puede aportar visión, aunque no reciba una imagen propia.
  // Sin su perfil publicado, cualquier edición de fichas exige regenerar el PNG.
  if (group && board.state.tokens.some((token) => !token.hidden && group.observerIds.includes(token.instanceId) &&
    token.actorId.startsWith('player:') && !board.views.some((item) => item.instanceId === token.instanceId)) &&
    sheetRevision !== board.sheetRevision) return false;
  const sources = board.views.filter((item) => item === view || (group && group.observerIds.includes(item.instanceId) &&
    board.state.tokens.some((token) => token.instanceId === item.instanceId && !token.hidden)));
  return sources.every((item) => sheets.has(item.actorId) && JSON.stringify(item.vision) === JSON.stringify(sheets.get(item.actorId)?.vision ?? null));
}

export function visibleEncounter(board, user, sheets) {
  const characters = board.views.flatMap((view) => {
    const sheet = sheets.get(view.actorId);
    if (!sheet || !(sheet.playerIds ?? []).includes(user.id) || !view.audience.includes(user.id)) return [];
    return [{ instanceId: view.instanceId, name: sheet.name }];
  });
  return characters.length ? { id: board.id, title: board.title, updatedAt: board.updatedAt, characters } : undefined;
}
// Solo relatos ya redactados para este personaje y para su dueño en el momento del suceso.
export function playerCombatLog(board, observerId, userId) {
  const events = board.state?.combat?.narrative;
  if (!Array.isArray(events)) return [];
  return events.slice(-200).flatMap((event) => {
    if (typeof event?.id !== 'string' || !Array.isArray(event.messages)) return [];
    const message = event.messages.find((item) => item?.observerId === observerId && Array.isArray(item.audience) && item.audience.includes(userId) && typeof item.text === 'string' && item.text.length <= 2000);
    return message ? [{ id: event.id, text: message.text }] : [];
  });
}
