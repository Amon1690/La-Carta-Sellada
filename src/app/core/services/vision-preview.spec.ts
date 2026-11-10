import { BoardVisionState, VisionProfile } from '../models/vision';
import { emptyBoardVision } from './vision-state';
import { assessSight, previewSight, previewTokenVisible, PreviewToken } from './vision-preview';

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
  it('el entorno sin confirmar y todos los climas conservan el alcance; oscuridad sin sentidos ni luz no concede visión', () => {
    const profiles = new Map([['A', profile(null)]]);
    for (const weather of ['unknown', 'clear', 'fog', 'rain', 'snow', 'other'] as const) {
      const value = state(); value.environment.weather = weather; value.environment.illumination = 'unknown';
      expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).circles[0].radius).toBe(Math.hypot(1536, 1024));
    }
    const value = state(); value.environment.illumination = 'darkness';
    expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).circles).toEqual([]);
    value.effects = [{ id: 'x', name: 'Efecto de prueba', kind: 'blinded', source, scope: { kind: 'tokens', tokenIds: ['A'] }, duration: { kind: 'unknown' }, active: true }];
    expect(previewSight(value, [token('A')], profiles, grid, 1536, 1024).circles).toEqual([]);
  });
  it('la ceguera y los efectos tienen ámbito y no apagan a observadores ajenos', () => {
    const value = state(), tokens = [token('A'), token('B', 500)];
    value.effects = [{ id: 'blind', name: 'Ceguera', kind: 'blinded', source, scope: { kind: 'tokens', tokenIds: ['A'] }, active: true, duration: { kind: 'until-ended' } }];
    expect(previewSight(value, tokens, new Map([['A', profile(60)], ['B', profile(60)]]), grid, 1536, 1024).circles.map((circle) => circle.id)).toEqual(['B']);
    value.effects[0].duration = { kind: 'rounds', remaining: 0 };
    expect(previewSight(value, tokens, new Map([['A', profile(60)], ['B', profile(60)]]), grid, 1536, 1024).circles.length).toBe(2);
  });
  it('visión en la oscuridad habilita solo su alcance y cambia Percepción según la iluminación', () => {
    const value = state(), tokens = [token('A')], point = { x: 150, y: 25.6 };
    const profiles = new Map([['A', { ...profile(60), senses: [...profile(60).senses, { sense: 'darkvision' as const, rangeFeet: 15, source }] }]]);
    value.environment.illumination = 'dim';
    expect(assessSight(value, tokens, profiles, 'A', point).perception).toBe('normal');
    value.environment.illumination = 'darkness';
    expect(assessSight(value, tokens, profiles, 'A', point).perception).toBe('disadvantage');
    expect(assessSight(value, tokens, profiles, 'A', { x: 400, y: 25.6 }).visible).toBeFalse();
  });
  it('la penumbra y niebla ligera afectan Percepción sin reducir alcance y lluvia no inventa penalizaciones', () => {
    const value = state(), tokens = [token('A')], profiles = new Map([['A', profile(60)]]), point = { x: 100, y: 25.6 };
    value.environment.illumination = 'dim';
    expect(assessSight(value, tokens, profiles, 'A', point)).toEqual(jasmine.objectContaining({ visible: true, perception: 'disadvantage' }));
    value.environment.illumination = 'bright'; value.environment.weather = 'fog';
    expect(assessSight(value, tokens, profiles, 'A', point).perception).toBe('disadvantage');
    value.environment.weather = 'rain'; expect(assessSight(value, tokens, profiles, 'A', point).perception).toBe('normal');
  });
  it('una luz de otro token revela solo la intersección con el alcance y acompaña al portador', () => {
    const value = state(), tokens = [token('A'), token('B', 300)], profiles = new Map([['A', profile(60)]]);
    value.environment.illumination = 'darkness';
    value.effects = [{ id: 'lamp', name: 'Lámpara', kind: 'light', illumination: 'bright', anchorTokenId: 'B', source,
      scope: { kind: 'circle', x: 0, y: 0, radiusFeet: 10 }, active: true, duration: { kind: 'until-ended' } }];
    const first = previewSight(value, tokens, profiles, grid, 1536, 1024);
    expect(previewTokenVisible(tokens[1], first.circles, [], grid)).toBeTrue();
    expect(previewTokenVisible(tokens[0], first.circles, [], grid)).toBeFalse();
    tokens[1].x = 800;
    expect(assessSight(value, tokens, profiles, 'A', { x: 325.6, y: 25.6 }).visible).toBeFalse();
    expect(assessSight(value, tokens, profiles, 'A', { x: 825.6, y: 25.6 }).visible).toBeFalse();
  });
  it('excluye oscuridad mágica y zonas fuertemente oscurecidas del mapa y de fichas parcialmente cubiertas', () => {
    const value = state(), tokens = [token('A'), token('B', 100)], profiles = new Map([['A', profile(60)]]);
    value.effects = [{ id: 'dark', name: 'Oscuridad mágica', kind: 'magical-darkness', source,
      scope: { kind: 'circle', x: 125.6, y: 25.6, radiusFeet: 3 }, active: true, duration: { kind: 'until-ended' } }];
    expect(previewTokenVisible(tokens[1], previewSight(value, tokens, profiles, grid, 1536, 1024).circles, [], grid)).toBeFalse();
    profiles.set('A', { version: 1, senses: [{ sense: 'truesight', rangeFeet: 60, source }] });
    expect(previewTokenVisible(tokens[1], previewSight(value, tokens, profiles, grid, 1536, 1024).circles, [], grid)).toBeTrue();
    value.effects[0] = { ...value.effects[0], kind: 'obscurement', obscurement: 'heavy' };
    expect(previewTokenVisible(tokens[1], previewSight(value, tokens, profiles, grid, 1536, 1024).circles, [], grid)).toBeFalse();
  });
  it('respeta cero y cegado explícitos; una lista vacía no añade observadores por defecto', () => {
    const value = state();
    expect(previewSight(value, [token('A'), { ...token('B'), conditions: ['blinded'] }], new Map([['A', profile(0)], ['B', profile(null)]]), grid, 1536, 1024).circles).toEqual([]);
    value.activeGroupId = undefined;
    expect(previewSight(value, [token('A')], new Map([['A', profile(null)]]), grid, 1536, 1024).circles).toEqual([]);
  });
  it('un efecto con sentido registrado concede visión aunque la ficha todavía no tenga perfil', () => {
    const value = state(); value.groups[0].observerIds = ['A']; value.effects = [{ id: 'sense', name: 'Sentido concedido', kind: 'sense', source,
      scope: { kind: 'tokens', tokenIds: ['A'] }, grantedSense: { sense: 'blindsight', rangeFeet: 15, source },
      active: true, duration: { kind: 'until-ended' } }];
    const sight = previewSight(value, [{ ...token('A'), conditions: ['blinded'] }], new Map(), grid, 1536, 1024);
    expect(sight.pending).toBeFalse(); expect(sight.circles.length).toBe(1);
  });
  it('una nube fuerte bloquea la zona y lo que hay detrás, sin tapar otros lados ni el sentido ciego', () => {
    const value = state(), tokens = [token('A'), token('B', 300)], profiles = new Map([['A', profile(60)]]);
    value.effects = [{ id: 'heavy', name: 'Nube fuerte', kind: 'obscurement', obscurement: 'heavy', source,
      scope: { kind: 'circle', x: 175.6, y: 25.6, radiusFeet: 3 }, active: true, duration: { kind: 'until-ended' } }];
    const sight = previewSight(value, tokens, profiles, grid, 1536, 1024);
    expect(previewTokenVisible(tokens[1], sight.circles, [], grid)).toBeFalse();
    expect(assessSight(value, tokens, profiles, 'A', { x: 325.6, y: 25.6 }).visible).toBeFalse();
    expect(assessSight(value, tokens, profiles, 'A', { x: 25.6, y: 325.6 }).visible).toBeTrue();
    profiles.set('A', { version: 1, senses: [{ sense: 'blindsight', rangeFeet: 60, source }] });
    expect(assessSight(value, tokens, profiles, 'A', { x: 325.6, y: 25.6 }).visible).toBeTrue();
  });
  it('un efecto circular de radio cero no cubre al observador ni apaga su alcance', () => {
    const value = state(), tokens = [token('A')], profiles = new Map([['A', profile(60)]]);
    value.effects = [{ id: 'zero', name: 'Zona vacía', kind: 'magical-darkness', source,
      scope: { kind: 'circle', x: 25.6, y: 25.6, radiusFeet: 0 }, active: true, duration: { kind: 'until-ended' } }];
    expect(assessSight(value, tokens, profiles, 'A', { x: 125.6, y: 25.6 }).visible).toBeTrue();
  });
});
