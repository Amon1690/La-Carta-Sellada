import { BoardVisionState, VisionProfile } from '../models/vision';
import { assertBoardVision, assertVisionProfile, emptyBoardVision, withoutRemovedObservers } from './vision-state';

const source = { kind: 'director' as const, reference: 'Datos sintéticos de prueba, no regla inferida' };
const profile = (): VisionProfile => ({ version: 1, senses: [
  { sense: 'normal', rangeFeet: null, source }, { sense: 'darkvision', rangeFeet: 0, source },
] });
const state = (): BoardVisionState => ({ ...emptyBoardVision(), groups: [
  { id: 'first', name: 'Primera visión', observerIds: ['a', 'b'] },
  { id: 'second', name: 'Segunda visión', observerIds: ['c'] },
], activeGroupId: 'first', effects: [
  { id: 'dark', name: 'Efecto de prueba', kind: 'magical-darkness', source,
    scope: { kind: 'circle', x: 10, y: 20, radiusFeet: 15 }, duration: { kind: 'rounds', remaining: 3 }, active: true, concentrationTokenId: 'a' },
  { id: 'sense', name: 'Sentido de prueba', kind: 'sense', source, scope: { kind: 'tokens', tokenIds: ['a', 'b'] },
    duration: { kind: 'until-ended' }, active: true, grantedSense: { sense: 'blindsight', rangeFeet: 10, source } },
] });
const ids = new Set(['a', 'b', 'c']);

describe('Contrato de visión versionado', () => {
  it('conserva las cuatro clases de trazado y exige apertura solo en las dos clases de puerta', () => {
    const s = state();
    s.obstacles = (['wall', 'door', 'window', 'door-window'] as const).map((kind) => ({ id: kind, name: kind, kind,
      start: { x: 20, y: 10 }, end: { x: 30, y: 40 }, source, blocksSight: kind === 'wall' || kind === 'door', blocksEffect: true,
      ...(['door', 'door-window'].includes(kind) ? { open: false } : {}) }));
    const restored = JSON.parse(JSON.stringify(s)); expect(() => assertBoardVision(restored, ids)).not.toThrow(); expect(restored).toEqual(s);
    delete restored.obstacles[3].open; expect(() => assertBoardVision(restored, ids)).toThrow();
    restored.obstacles[3].open = false; restored.obstacles[2].open = false; expect(() => assertBoardVision(restored, ids)).toThrow();
  });
  it('valida contactos por instancia, retira solo el borrado y conserva los datos sin confirmar', () => {
    const s = state(); s.contacts = [{ tokenId: 'a', surfaceId: 'suelo', airborne: false, subjectKind: 'creature', source }, { tokenId: 'b', source }];
    expect(() => assertBoardVision(s, ids)).not.toThrow();
    expect(withoutRemovedObservers(s, new Set(['b', 'c'])).contacts).toEqual([{ tokenId: 'b', source }]);
    expect(s.contacts.length).toBe(2); expect(s.contacts[1].airborne).toBeUndefined();
    for (const contacts of [[{ tokenId: 'missing', source }], [s.contacts[0], s.contacts[0]], [{ tokenId: 'a', airborne: 'no', source }], [{ tokenId: 'a', source: undefined }]]) {
      expect(() => assertBoardVision({ ...s, contacts }, ids)).toThrow();
    }
  });
  it('empieza desactivado y con entorno desconocido, sin usar reloj ni clima reales', () => {
    const first = emptyBoardVision();
    expect(first.enabled).toBeFalse();
    expect(first.environment).toEqual({ illumination: 'unknown', timeOfDay: 'unknown', weather: 'unknown' });
    first.groups.push({ id: 'x', name: 'x', observerIds: [] });
    expect(emptyBoardVision().groups).toEqual([]);
  });
  it('distingue ausencia de dato de alcance cero explícito y exige su procedencia', () => {
    const p = profile(); expect(() => assertVisionProfile(p)).not.toThrow();
    expect(p.senses.find((s) => s.sense === 'darkvision')?.rangeFeet).toBe(0);
    expect(p.senses.find((s) => s.sense === 'truesight')).toBeUndefined();
    expect(() => assertVisionProfile({ ...p, senses: [{ sense: 'darkvision', rangeFeet: 60 }] })).toThrow();
  });
  it('rechaza versiones, sentidos duplicados, alcances no finitos y campos no admitidos', () => {
    for (const invalid of [
      { ...profile(), version: 2 }, { ...profile(), inferred: true },
      { ...profile(), senses: [profile().senses[0], profile().senses[0]] },
      ...[-1, NaN, Infinity, null].map((rangeFeet) => ({ version: 1, senses: [{ sense: 'darkvision', rangeFeet, source }] })),
    ]) expect(() => assertVisionProfile(invalid)).toThrow();
  });
  it('conserva dos listas explícitas sin incluir el observador excluido en la primera', () => {
    const s = state(); expect(() => assertBoardVision(s, ids)).not.toThrow();
    expect(s.groups[0].observerIds).toEqual(['a', 'b']); expect(s.groups[0].observerIds).not.toContain('c');
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('elimina referencias y concentración al borrar un token sin mutar el original', () => {
    const s = state(); const cleaned = withoutRemovedObservers(s, new Set(['b', 'c']));
    expect(cleaned.groups[0].observerIds).toEqual(['b']); expect(cleaned.groups[1].observerIds).toEqual(['c']);
    expect(cleaned.effects.map((e) => e.id)).toEqual(['sense']);
    expect(cleaned.effects[0].scope).toEqual({ kind: 'tokens', tokenIds: ['b'] });
    expect(s.groups[0].observerIds).toEqual(['a', 'b']); expect(s.effects.length).toBe(2);
    expect(() => assertBoardVision(cleaned, new Set(['b', 'c']))).not.toThrow();
  });
  it('rechaza referencias rotas, grupos duplicados y un grupo activo inexistente', () => {
    for (const invalid of [
      { ...state(), groups: [{ id: 'x', name: 'x', observerIds: ['missing'] }] },
      { ...state(), groups: [state().groups[0], state().groups[0]] },
      { ...state(), activeGroupId: 'missing' },
      { ...state(), effects: [{ ...state().effects[0], concentrationTokenId: 'missing' }] },
    ]) expect(() => assertBoardVision(invalid, ids)).toThrow();
  });
  it('una luz anclada se conserva al cargar y se retira al borrar su portador sin alterar otras referencias', () => {
    const value = state(); value.effects = [{ ...value.effects[0], id: 'lamp', kind: 'light', illumination: 'bright', concentrationTokenId: undefined, anchorTokenId: 'a' }];
    expect(() => assertBoardVision(value, ids)).not.toThrow();
    expect(withoutRemovedObservers(value, new Set(['b', 'c'])).effects).toEqual([]);
    value.effects[0].anchorTokenId = 'missing'; expect(() => assertBoardVision(value, ids)).toThrow();
  });
  it('valida el reloj de juego y una fuente para cualquier entorno conocido', () => {
    const s = state();
    s.environment = { illumination: 'dim', weather: 'fog', timeOfDay: 'night', gameTime: { day: 4, minuteOfDay: 120 }, source };
    expect(() => assertBoardVision(s, ids)).not.toThrow();
    expect(() => assertBoardVision({ ...s, environment: { ...s.environment, gameTime: { day: 4, minuteOfDay: 1440 } } }, ids)).toThrow();
    expect(() => assertBoardVision({ ...s, environment: { ...s.environment, source: undefined } }, ids)).toThrow();
  });
  it('rechaza geometría inválida, duraciones imposibles y efectos sin datos mecánicos', () => {
    const base = state().effects[0];
    for (const effect of [
      { ...base, scope: { kind: 'circle', x: 0, y: 0, radiusFeet: -1 } },
      { ...base, duration: { kind: 'rounds', remaining: 1.5 } },
      { ...base, scope: { kind: 'tokens', tokenIds: [] } },
      { ...base, kind: 'light' }, { ...base, kind: 'obscurement' },
      { ...base, illumination: 'bright' },
    ]) expect(() => assertBoardVision({ ...state(), effects: [effect] }, ids)).toThrow();
  });
});
