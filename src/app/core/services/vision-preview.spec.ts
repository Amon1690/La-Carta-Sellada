import { BoardVisionState, VisionProfile } from '../models/vision';
import { emptyBoardVision } from './vision-state';
import { previewSight, previewTokenVisible, PreviewToken } from './vision-preview';

describe('Geometría de la previsualización local', () => {
  const grid = 51.2;
  const source = { kind: 'director' as const, reference: 'Datos sintéticos de prueba, sin reglas de personajes' };
  const token = (id: string, x = 0): PreviewToken => ({ instanceId: id, x, y: 0, size: 1, hidden: false, conditions: [] });
  const profile = (rangeFeet: number | null): VisionProfile => ({ version: 1, senses: [{ sense: 'normal', rangeFeet, source }] });
  const state = (): BoardVisionState => ({ ...emptyBoardVision(), enabled: true,
    environment: { illumination: 'bright', timeOfDay: 'unknown', weather: 'clear', source },
    groups: [{ id: 'one', name: 'Uno', observerIds: ['A', 'B'] }, { id: 'two', name: 'Dos', observerIds: ['C'] }], activeGroupId: 'one' });
  it('une únicamente observadores elegidos y convierte pies con la escala existente del mapa', () => {
    const tokens = [token('A'), token('B', 500), token('C', 1000)];
    const profiles = new Map(tokens.map((t) => [t.instanceId, profile(10)]));
    const result = previewSight(state(), tokens, profiles, grid, 1536, 1024);
    expect(result.circles.map((c) => c.id)).toEqual(['A', 'B']);
    expect(result.circles[0].radius).toBeCloseTo(10 * .3048 / 1.5 * grid, 10);
    expect(previewTokenVisible(tokens[0], result.circles, [], grid)).toBeTrue();
    expect(previewTokenVisible(tokens[1], result.circles, [], grid)).toBeTrue();
    expect(previewTokenVisible(tokens[2], result.circles, [], grid)).toBeFalse();
  });
  it('el cambio de lista y el movimiento cambian la geometría sin explorar terreno por sí solos', () => {
    const value = state(), tokens = [token('A'), token('C', 1000)], profiles = new Map([['A', profile(10)], ['C', profile(20)]]);
    const fog = [{ x: 1100, y: 0, width: 20, height: 40 }];
    value.activeGroupId = 'two';
    const first = previewSight(value, tokens, profiles, grid, 1536, 1024);
    expect(first.circles.map((c) => c.id)).toEqual(['C']);
    tokens[1].x = 900; expect(previewSight(value, tokens, profiles, grid, 1536, 1024).circles[0].x).toBe(925.6);
    expect(fog).toEqual([{ x: 1100, y: 0, width: 20, height: 40 }]);
  });
  it('omite fichas ocultas y fichas cubiertas incluso parcialmente por exploración manual', () => {
    const t = token('A'), circles = [{ id: 'A', x: 25.6, y: 25.6, radius: 1000 }];
    expect(previewTokenVisible(t, circles, [{ x: 50, y: 50, width: 5, height: 5 }], grid)).toBeFalse();
    expect(previewTokenVisible({ ...t, hidden: true }, circles, [], grid)).toBeFalse();
    expect(previewTokenVisible(t, [{ ...circles[0], radius: 30 }], [], grid)).toBeFalse();
    expect(previewTokenVisible(t, circles, [{ x: 51.2, y: 0, width: 10, height: 10 }], grid)).toBeTrue();
  });
  it('considera la unión completa y rechaza huecos interiores aunque las cuatro esquinas estén cubiertas', () => {
    const target = { ...token('target'), size: 2 };
    expect(previewTokenVisible(target, [{ id: 'a', x: 0, y: 50, radius: 75 }, { id: 'b', x: 100, y: 50, radius: 75 }], [], 50)).toBeTrue();
    const corners = [[0, 0], [100, 0], [0, 100], [100, 100]].map(([x, y], i) => ({ id: String(i), x, y, radius: 30 }));
    expect(previewTokenVisible(target, corners, [], 50)).toBeFalse();
  });
  it('no inventa vista a partir de otros sentidos, condiciones sin confirmar ni ausencia de perfiles', () => {
    const value = state(), tokens = [token('A'), { ...token('B'), conditions: undefined }];
    const profiles = new Map<string, VisionProfile>([['A', { version: 1, senses: [{ sense: 'tremorsense', rangeFeet: 60, source }] }], ['B', profile(60)]]);
    const result = previewSight(value, tokens, profiles, grid, 1536, 1024);
    expect(result.circles).toEqual([]); expect(result.pending).toBeTrue();
  });
  it('mantiene desconocido el entorno no confirmado, la oscuridad y los efectos aún no resueltos', () => {
    const profiles = new Map([['A', profile(null)]]);
    for (const illumination of ['unknown', 'darkness'] as const) {
      const value = state(); value.environment.illumination = illumination;
      expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).circles).toEqual([]);
    }
    const value = state(); value.environment.weather = 'fog';
    expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).pending).toBeTrue();
    value.environment.weather = 'clear';
    value.effects = [{ id: 'x', name: 'Efecto de prueba', kind: 'blinded', source, scope: { kind: 'tokens', tokenIds: ['A'] }, duration: { kind: 'unknown' }, active: true }];
    expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).circles).toEqual([]);
  });
  it('respeta cero y cegado explícitos; una lista vacía no añade observadores por defecto', () => {
    const value = state();
    expect(previewSight(value, [token('A'), { ...token('B'), conditions: ['blinded'] }], new Map([['A', profile(0)], ['B', profile(null)]]), grid, 1536, 1024).circles).toEqual([]);
    value.activeGroupId = undefined;
    expect(previewSight(value, [token('A')], new Map([['A', profile(null)]]), grid, 1536, 1024).circles).toEqual([]);
  });
});
