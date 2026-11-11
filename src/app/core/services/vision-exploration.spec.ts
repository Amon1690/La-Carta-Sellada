import { BoardVisionState, VisionProfile } from '../models/vision';
import { emptyBoardVision, assertBoardVision, withoutRemovedObservers } from './vision-state';
import { rememberExploration, explorationRects } from './vision-exploration';

describe('Memoria de terreno por personaje', () => {
  const grid = 51.2, source = { kind: 'director' as const, reference: 'Datos sintéticos de memoria' };
  const token = (id = 'A', x = 2 * grid) => ({ instanceId: id, actorId: `player:${id}`, x, y: 2 * grid, size: 1, hidden: false, conditions: [] });
  const profiles = new Map<string, VisionProfile>(['A', 'B'].map((id) => [id, { version: 1, senses: [{ sense: 'normal', rangeFeet: 60, source }] }]));
  const state = (): BoardVisionState => ({ ...emptyBoardVision(), enabled: true, obstacles: [],
    environment: { illumination: 'darkness', timeOfDay: 'night', weather: 'clear', source } });
  it('recuerda las pisadas y conserva las antiguas tras moverse sin iluminar terreno', () => {
    const first = rememberExploration(state(), [token()], profiles, []);
    expect(first.exploration).toEqual([{ tokenId: 'A', cells: [62] }]);
    const moved = rememberExploration(first, [token('A', 4 * grid)], profiles, []);
    expect(moved.exploration).toEqual([{ tokenId: 'A', cells: [62, 64] }]);
    expect(state().exploration).toBeUndefined(); expect(moved.environment.illumination).toBe('darkness');
  });
  it('solo recuerda casillas completamente vistas, conservando fog y paredes', () => {
    const value = state(); value.environment.illumination = 'bright';
    value.obstacles = [{ id: 'wall', name: 'Pared', kind: 'wall', start: { x: 3 * grid, y: 0 }, end: { x: 3 * grid, y: 1024 }, blocksSight: true, blocksEffect: true, source }];
    const fog = [{ x: grid, y: 2 * grid, width: grid, height: grid }];
    const result = rememberExploration(value, [token()], profiles, fog).exploration?.[0].cells ?? [];
    expect(result).not.toContain(63); expect(result).not.toContain(61); expect(result).not.toContain(599);
    expect(result.length).toBeGreaterThan(0);
  });
  it('una pared corta dentro de la pisada no revela la casilla aunque evite las diagonales', () => {
    const value = state(); value.obstacles = [{ id: 'wall', name: 'Pared corta', kind: 'wall', start: { x: 107.4, y: 120.4 }, end: { x: 112.4, y: 120.4 }, blocksSight: true, blocksEffect: true, source }];
    expect(rememberExploration(value, [token()], profiles, []).exploration).toBeUndefined();
  });
  it('no registra PNJs, ocultos, datos pendientes, ceguera ni una pisada bajo fog', () => {
    for (const t of [{ ...token(), actorId: 'npc:A' }, { ...token(), hidden: true }, { ...token(), conditions: ['blinded'] }]) {
      expect(rememberExploration(state(), [t], profiles, []).exploration).toBeUndefined();
    }
    expect(rememberExploration(state(), [token()], new Map(), []).exploration).toBeUndefined();
    expect(rememberExploration(state(), [token()], profiles, [{ x: 0, y: 0, width: 1536, height: 1024 }]).exploration).toBeUndefined();
  });
  it('mantiene memorias individuales y une solo observadores elegidos', () => {
    const value = rememberExploration(state(), [token(), token('B', 20 * grid)], profiles, []);
    expect(explorationRects(value, ['A'])).toEqual([{ x: 2 * grid, y: 2 * grid, width: grid, height: grid }]);
    expect(explorationRects(value, ['A', 'B']).length).toBe(2);
    expect(withoutRemovedObservers(value, new Set(['A'])).exploration?.map((m) => m.tokenId)).toEqual(['A']);
  });
  it('valida la extensión opcional sin alterar guardados antiguos ni aceptar referencias o casillas inválidas', () => {
    expect(() => assertBoardVision(state(), new Set(['A']))).not.toThrow();
    const value = { ...state(), exploration: [{ tokenId: 'A', cells: [0, 599] }] };
    expect(() => assertBoardVision(value, new Set(['A']))).not.toThrow();
    for (const cells of [[600], [-1], [1.5], [0, 0]]) expect(() => assertBoardVision({ ...value, exploration: [{ tokenId: 'A', cells }] }, new Set(['A']))).toThrow();
    expect(() => assertBoardVision(value, new Set(['B']))).toThrow();
    expect(() => assertBoardVision({ ...value, exploration: [...value.exploration, ...value.exploration] }, new Set(['A']))).toThrow();
  });
});
