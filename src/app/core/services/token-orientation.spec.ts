import { BoardVisionState, VisionProfile } from '../models/vision';
import { evaluateVision } from './vision-engine';
import { emptyBoardVision } from './vision-state';
import { PreviewToken } from './vision-preview';
import { TokenOrientation, canOrientStep, orientedTokenVisible } from './token-orientation';

describe('Orientación de tokens en oscuridad', () => {
  const grid = 51.2, source = { kind: 'director' as const, reference: 'Fixture sintética de orientación' };
  const token = (instanceId: string, x = 2 * grid, y = 2 * grid, size = 1): PreviewToken => ({ instanceId, x, y, size, hidden: false, conditions: [] });
  let context: TokenOrientation;
  beforeEach(() => {
    const state: BoardVisionState = { ...emptyBoardVision(), enabled: true, obstacles: [],
      environment: { illumination: 'darkness', timeOfDay: 'night', weather: 'clear' } };
    const profile: VisionProfile = { version: 1, senses: [{ sense: 'normal', rangeFeet: 60, source }] };
    context = { state, tokens: [token('A')], profiles: new Map([['A', profile]]), observerIds: ['A'], circles: [], fog: [], grid };
  });
  function add(t: PreviewToken): PreviewToken { context.tokens = [...context.tokens, t]; return t; }
  it('mantiene la posición propia sobre oscuridad y exploración, sin círculos ni luz', () => {
    context.fog = [{ x: 0, y: 0, width: 1536, height: 1024 }];
    expect(orientedTokenVisible(context.tokens[0], context)).toBeTrue();
    expect(context.circles).toEqual([]); expect(context.state.effects).toEqual([]);
    expect(evaluateVision(context.state, context.tokens, context.profiles, 'A', 'A', grid).visible).toBeFalse();
  });
  it('muestra las ocho casillas contiguas y omite las más lejanas', () => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = add(token(`${dx}:${dy}`, (2 + dx) * grid, (2 + dy) * grid));
      expect(orientedTokenVisible(t, context)).withContext(t.instanceId).toBeTrue();
    }
    expect(orientedTokenVisible(add(token('far', 4 * grid)), context)).toBeFalse();
  });
  it('no levanta ocultación, invisibilidad, condiciones pendientes ni niebla de otros tokens', () => {
    const b = add(token('B', 3 * grid));
    for (const change of [{ hidden: true }, { conditions: ['invisible'] }, { conditions: undefined }]) {
      const target = { ...b, ...change }; context.tokens = [context.tokens[0], target];
      expect(orientedTokenVisible(target, context)).toBeFalse();
    }
    context.tokens = [context.tokens[0], b]; context.fog = [{ x: b.x + 1, y: b.y + 1, width: 1, height: 1 }];
    expect(orientedTokenVisible(b, context)).toBeFalse();
  });
  it('paredes y puertas cerradas ocultan al vecino, abrir la puerta lo devuelve', () => {
    const b = add(token('B', 3 * grid));
    context.state.obstacles = [{ id: 'door', name: 'Puerta', kind: 'door', open: false,
      start: { x: 3 * grid, y: grid }, end: { x: 3 * grid, y: 4 * grid }, blocksSight: true, blocksEffect: true, source }];
    expect(orientedTokenVisible(b, context)).toBeFalse(); expect(canOrientStep('A', b.x, b.y, context)).toBeFalse();
    context.state.obstacles[0].open = true;
    expect(orientedTokenVisible(b, context)).toBeTrue(); expect(canOrientStep('A', b.x, b.y, context)).toBeTrue();
  });
  it('una ventana permite presentar al vecino pero impide atravesarla', () => {
    const b = add(token('B', 3 * grid));
    context.state.obstacles = [{ id: 'window', name: 'Ventana', kind: 'window',
      start: { x: 3 * grid, y: grid }, end: { x: 3 * grid, y: 4 * grid }, blocksSight: false, blocksEffect: true, source }];
    expect(orientedTokenVisible(b, context)).toBeTrue(); expect(canOrientStep('A', b.x, b.y, context)).toBeFalse();
  });
  it('no convierte ceguera, ocultación fuerte ni datos pendientes en visión contigua', () => {
    const b = add(token('B', 3 * grid));
    context.tokens = [{ ...context.tokens[0], conditions: ['blinded'] }, b]; expect(orientedTokenVisible(b, context)).toBeFalse();
    context.tokens = [token('A'), b]; context.state.environment.obscurement = 'heavy'; expect(orientedTokenVisible(b, context)).toBeFalse();
    context.state.environment.obscurement = 'none'; context.state.obstacles = undefined; expect(orientedTokenVisible(b, context)).toBeFalse();
  });
  it('la oscuridad mágica conserva la misma ayuda sin cambiar la evaluación real', () => {
    const b = add(token('B', 3 * grid)); context.state.environment.illumination = 'bright';
    context.state.effects = [{ id: 'dark', name: 'Oscuridad sintética', kind: 'magical-darkness', source,
      scope: { kind: 'circle', x: b.x, y: b.y, radiusFeet: 20 }, active: true, duration: { kind: 'until-ended' } }];
    expect(orientedTokenVisible(context.tokens[0], context)).toBeTrue(); expect(orientedTokenVisible(b, context)).toBeTrue();
    expect(evaluateVision(context.state, context.tokens, context.profiles, 'A', 'B', grid).visible).toBeFalse();
  });
  it('un paso está limitado a una casilla y a terreno explorado, incluso con tokens grandes', () => {
    context.tokens = [token('A', 2 * grid, 2 * grid, 2)];
    expect(canOrientStep('A', 3 * grid, 3 * grid, context)).toBeTrue();
    expect(canOrientStep('A', 4 * grid, 2 * grid, context)).toBeFalse();
    context.fog = [{ x: 4 * grid, y: 2 * grid, width: grid, height: grid }];
    expect(canOrientStep('A', 3 * grid, 2 * grid, context)).toBeFalse();
  });
  it('se comparte solo desde observadores elegidos y nunca desde uno oculto', () => {
    const b = add(token('B', 10 * grid)), c = add(token('C', 11 * grid));
    expect(orientedTokenVisible(c, context)).toBeFalse(); context.observerIds = ['B'];
    expect(orientedTokenVisible(c, context)).toBeFalse(); // Su perfil sigue sin confirmar.
    context.profiles = new Map([...context.profiles, ['B', context.profiles.get('A')]]);
    expect(orientedTokenVisible(c, context)).toBeTrue();
    context.tokens = [context.tokens[0], { ...b, hidden: true }, c]; expect(orientedTokenVisible(c, context)).toBeFalse();
  });
});
