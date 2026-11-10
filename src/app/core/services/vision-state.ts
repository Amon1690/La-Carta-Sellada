import type { BoardVisionState, VisionProfile } from '../models/vision';

type Data = Record<string, unknown>;
const fail = (): never => { throw new Error('Datos de visión no válidos o versión no admitida.'); };
const record = (v: unknown, keys: string[]): Data => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some((k) => !keys.includes(k))) return fail();
  return v as Data;
};
const text = (v: unknown, max = 500): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const numeric = (v: unknown, max = 100000): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const choice = (v: unknown, choices: string[]): boolean => typeof v === 'string' && choices.includes(v);
const list = (v: unknown, max = 1000): unknown[] => Array.isArray(v) && v.length <= max ? v : fail();
function source(v: unknown): void {
  const s = record(v, ['kind', 'reference']);
  if (!choice(s['kind'], ['rule', 'director']) || !text(s['reference'], 2000)) fail();
}
function sense(v: unknown): string {
  const s = record(v, ['sense', 'rangeFeet', 'source']);
  if (!choice(s['sense'], ['normal', 'darkvision', 'blindsight', 'tremorsense', 'truesight']) ||
      !(numeric(s['rangeFeet']) || (s['sense'] === 'normal' && s['rangeFeet'] === null))) fail();
  source(s['source']);
  return s['sense'] as string;
}
export function assertVisionProfile(v: unknown): asserts v is VisionProfile {
  const p = record(v, ['version', 'senses']);
  if (p['version'] !== 1) fail();
  const senses = list(p['senses'], 5).map(sense);
  if (new Set(senses).size !== senses.length) fail();
}
function references(v: unknown, tokenIds: ReadonlySet<string>, max = 1000): string[] {
  const ids = list(v, max);
  if (ids.some((id) => !text(id) || !tokenIds.has(id)) || new Set(ids).size !== ids.length) fail();
  return ids as string[];
}
export function assertBoardVision(v: unknown, tokenIds: ReadonlySet<string>): asserts v is BoardVisionState {
  const b = record(v, ['version', 'enabled', 'environment', 'groups', 'activeGroupId', 'effects', 'obstacles', 'contacts']);
  if (b['version'] !== 1 || typeof b['enabled'] !== 'boolean') fail();
  const env = record(b['environment'], ['illumination', 'timeOfDay', 'weather', 'gameTime', 'source', 'obscurement']);
  if (!choice(env['illumination'], ['unknown', 'bright', 'dim', 'darkness']) ||
      !choice(env['timeOfDay'], ['unknown', 'dawn', 'day', 'dusk', 'night']) ||
      !choice(env['weather'], ['unknown', 'clear', 'rain', 'snow', 'fog', 'other'])) fail();
  if (env['gameTime'] !== undefined) {
    const time = record(env['gameTime'], ['day', 'minuteOfDay', 'second']);
    if (!numeric(time['day'], 1000000) || !Number.isInteger(time['day']) ||
        !numeric(time['minuteOfDay'], 1439) || !Number.isInteger(time['minuteOfDay']) ||
        (time['second'] !== undefined && (!numeric(time['second'], 59) || !Number.isInteger(time['second'])))) fail();
  }
  if (env['source'] !== undefined) source(env['source']);
  if (env['obscurement'] !== undefined && !choice(env['obscurement'], ['unknown', 'none', 'light', 'heavy'])) fail();
  if ((env['illumination'] !== 'unknown' || env['timeOfDay'] !== 'unknown' ||
       env['weather'] !== 'unknown' || env['gameTime'] !== undefined ||
       (env['obscurement'] !== undefined && env['obscurement'] !== 'unknown')) && env['source'] === undefined) fail();
  if (b['obstacles'] !== undefined) {
    const obstacleIds = new Set<string>();
    for (const item of list(b['obstacles'], 1000)) {
      const obstacle = record(item, ['id', 'name', 'kind', 'start', 'end', 'source', 'blocksSight', 'blocksEffect', 'open']);
      if (!text(obstacle['id']) || !text(obstacle['name']) || obstacleIds.has(obstacle['id']) ||
          !choice(obstacle['kind'], ['wall', 'door']) || typeof obstacle['blocksSight'] !== 'boolean' || typeof obstacle['blocksEffect'] !== 'boolean') fail();
      obstacleIds.add(obstacle['id'] as string); source(obstacle['source']);
      const start = record(obstacle['start'], ['x', 'y']), end = record(obstacle['end'], ['x', 'y']);
      if (![start['x'], start['y'], end['x'], end['y']].every((n) => numeric(n)) ||
          (start['x'] === end['x'] && start['y'] === end['y'])) fail();
      if (obstacle['kind'] === 'door' ? typeof obstacle['open'] !== 'boolean' : obstacle['open'] !== undefined) fail();
    }
  }
  const groupIds = new Set<string>();
  if (b['contacts'] !== undefined) {
    const contactIds = new Set<string>();
    for (const item of list(b['contacts'], 1000)) {
      const contact = record(item, ['tokenId', 'surfaceId', 'airborne', 'moving', 'subjectKind', 'source']);
      if (!text(contact['tokenId']) || !tokenIds.has(contact['tokenId']) || contactIds.has(contact['tokenId'])) fail();
      contactIds.add(contact['tokenId'] as string); source(contact['source']);
      if (contact['surfaceId'] !== undefined && !text(contact['surfaceId'])) fail();
      for (const key of ['airborne', 'moving']) if (contact[key] !== undefined && typeof contact[key] !== 'boolean') fail();
      if (contact['subjectKind'] !== undefined && !choice(contact['subjectKind'], ['creature', 'object'])) fail();
    }
  }
  for (const item of list(b['groups'], 100)) {
    const group = record(item, ['id', 'name', 'observerIds']);
    if (!text(group['id']) || !text(group['name']) || groupIds.has(group['id'])) fail();
    groupIds.add(group['id'] as string); references(group['observerIds'], tokenIds);
  }
  if (b['activeGroupId'] !== undefined && (!text(b['activeGroupId']) || !groupIds.has(b['activeGroupId']))) fail();
  const effectIds = new Set<string>();
  for (const item of list(b['effects'], 1000)) {
    const effect = record(item, ['id', 'name', 'kind', 'source', 'scope', 'duration', 'active', 'concentrationTokenId', 'anchorTokenId', 'illumination', 'obscurement', 'grantedSense']);
    if (!text(effect['id']) || !text(effect['name']) || effectIds.has(effect['id']) || typeof effect['active'] !== 'boolean' ||
        !choice(effect['kind'], ['light', 'magical-darkness', 'obscurement', 'blinded', 'sense'])) fail();
    effectIds.add(effect['id'] as string); source(effect['source']);
    const scope = record(effect['scope'], ['kind', 'tokenIds', 'x', 'y', 'radiusFeet']);
    if (scope['kind'] === 'tokens') {
      if (!references(scope['tokenIds'], tokenIds).length || ['x', 'y', 'radiusFeet'].some((k) => scope[k] !== undefined)) fail();
    } else if (scope['kind'] !== 'circle' || scope['tokenIds'] !== undefined || !numeric(scope['x']) || !numeric(scope['y']) || !numeric(scope['radiusFeet'])) fail();
    const duration = record(effect['duration'], ['kind', 'remaining']);
    if (choice(duration['kind'], ['rounds', 'minutes'])) {
      if (!numeric(duration['remaining'], 1000000) || (duration['kind'] === 'rounds' && !Number.isInteger(duration['remaining']))) fail();
    } else if (!choice(duration['kind'], ['unknown', 'until-ended']) || duration['remaining'] !== undefined) fail();
    if (effect['concentrationTokenId'] !== undefined && (!text(effect['concentrationTokenId']) || !tokenIds.has(effect['concentrationTokenId']))) fail();
    if (effect['anchorTokenId'] !== undefined && (effect['kind'] !== 'light' || scope['kind'] !== 'circle' || !text(effect['anchorTokenId']) || !tokenIds.has(effect['anchorTokenId']))) fail();
    if (effect['kind'] === 'light' ? !choice(effect['illumination'], ['bright', 'dim']) : effect['illumination'] !== undefined) fail();
    if (effect['kind'] === 'obscurement' ? !choice(effect['obscurement'], ['light', 'heavy']) : effect['obscurement'] !== undefined) fail();
    if (effect['kind'] === 'sense') sense(effect['grantedSense']);
    else if (effect['grantedSense'] !== undefined) fail();
  }
}
export function emptyBoardVision(): BoardVisionState {
  return { version: 1, enabled: false,
    environment: { illumination: 'unknown', timeOfDay: 'unknown', weather: 'unknown' }, groups: [], effects: [] };
}
/** Limpieza solo tras borrar tokens conocidos; no normaliza una importación inválida. */
export function withoutRemovedObservers(state: BoardVisionState, ids: ReadonlySet<string>): BoardVisionState {
  return { ...state,
    ...(state.contacts === undefined ? {} : { contacts: state.contacts.filter((c) => ids.has(c.tokenId)) }),
    groups: state.groups.map((g) => ({ ...g, observerIds: g.observerIds.filter((id) => ids.has(id)) })),
    effects: state.effects.filter((e) => (!e.concentrationTokenId || ids.has(e.concentrationTokenId)) && (!e.anchorTokenId || ids.has(e.anchorTokenId))).flatMap((e) => {
      if (e.scope.kind === 'circle') return [e];
      const tokenIds = e.scope.tokenIds.filter((id) => ids.has(id));
      return tokenIds.length ? [{ ...e, scope: { ...e.scope, tokenIds } }] : [];
    }),
  };
}
