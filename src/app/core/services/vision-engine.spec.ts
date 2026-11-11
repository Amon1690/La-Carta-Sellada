import type { BoardVisionState, VisionEffect, VisionObstacle, VisionProfile, VisionSense } from '../models/vision';
import { emptyBoardVision, assertBoardVision } from './vision-state';
import { evaluateVision, segmentsIntersect, VisionSubject } from './vision-engine';
import { advanceVisionEffects, endVisionConcentration, endVisionEffect } from './vision-effects';

describe('Motor personal de visión con datos confirmados', () => {
  const source = { kind: 'director' as const, reference: 'Geometría y alcances sintéticos de prueba' };
  const grid = 50, feetToPixels = .3048 / 1.5 * grid;
  const token = (instanceId: string, x: number): VisionSubject => ({ instanceId, x: x - grid / 2, y: 0, size: 1, conditions: [], hidden: false });
  const tokens = (): VisionSubject[] => [token('a', 50), token('b', 250)];
  const state = (): BoardVisionState => ({ ...emptyBoardVision(), enabled: true, obstacles: [],
    environment: { illumination: 'bright', timeOfDay: 'day', weather: 'clear', source } });
  const profile = (...senses: [VisionSense, number | null][]): Map<string, VisionProfile> => new Map([['a', { version: 1,
    senses: senses.map(([sense, rangeFeet]) => ({ sense, rangeFeet, source })) }]]);
  const wall = (overrides: Partial<VisionObstacle> = {}): VisionObstacle => ({ id: 'wall', name: 'Pared de prueba', kind: 'wall',
    start: { x: 150, y: 0 }, end: { x: 150, y: 100 }, blocksSight: true, blocksEffect: true, source, ...overrides });
  const effect = (overrides: Partial<VisionEffect> = {}): VisionEffect => ({ id: 'effect', name: 'Efecto sintético', kind: 'blinded', source,
    scope: { kind: 'tokens', tokenIds: ['a'] }, duration: { kind: 'until-ended' }, active: true, ...overrides });
  const assess = (s = state(), t = tokens(), p = profile(['normal', 60])) => evaluateVision(s, t, p, 'a', 'b', grid);

  it('distingue dato desconocido, ausencia explícita y geometría sin confirmar', () => {
    expect(assess().visible).toBeTrue();
    const s = state(); s.environment.illumination = 'unknown';
    expect(assess(s).visible).toBeUndefined();
    expect(assess(s, tokens(), profile(['normal', 0])).visible).toBeFalse();
    expect(assess(state(), tokens(), profile()).visible).toBeUndefined();
    delete s.obstacles; expect(assess(s).lineOfEffect).toBeUndefined();
    expect(assess(s).visible).toBeUndefined();
  });
  it('no convierte la falta de vista normal en alcance cero tras agotar darkvision', () => {
    expect(assess(state(), tokens(), profile(['darkvision', 1])).visible).toBeUndefined();
    expect(assess(state(), tokens(), profile(['normal', 0], ['darkvision', 1])).visible).toBeFalse();
  });
  it('una pared y puerta cerrada bloquean; abrir la puerta restaura la vista sin alterar el original', () => {
    const s = state(); s.obstacles = [wall()];
    expect(assess(s)).toEqual(jasmine.objectContaining({ visible: false, lineOfEffect: false }));
    s.obstacles = [wall({ kind: 'door', open: false })]; expect(assess(s).visible).toBeFalse();
    const open = { ...s, obstacles: s.obstacles.map((o) => ({ ...o, open: true })) };
    expect(assess(open).visible).toBeTrue(); expect(assess(open).lineOfEffect).toBeTrue(); expect(s.obstacles[0].open).toBeFalse();
  });
  it('separa transparencia de línea de efecto y no permite a visión ciega atravesar cobertura total', () => {
    const s = state(); s.obstacles = [wall({ blocksSight: false })];
    expect(assess(s)).toEqual(jasmine.objectContaining({ visible: true, lineOfEffect: false }));
    expect(assess(s, tokens(), profile(['normal', 0], ['blindsight', 60])).visible).toBeFalse();
    s.obstacles = [wall({ blocksEffect: false })];
    expect(assess(s, tokens(), profile(['normal', 0], ['blindsight', 60])).visible).toBeTrue();
  });
  it('ventanas y puertas acristaladas dejan ver, pero solo abrir la puerta despeja la línea de efecto', () => {
    const s = state();
    for (const kind of ['window', 'door-window'] as const) {
      s.obstacles = [wall({ kind, blocksSight: false, ...(kind === 'door-window' ? { open: false } : {}) })];
      assertBoardVision(s, new Set(['a', 'b']));
      expect(assess(s)).toEqual(jasmine.objectContaining({ visible: true, lineOfEffect: false }));
    }
    s.obstacles![0].open = true;
    expect(assess(s)).toEqual(jasmine.objectContaining({ visible: true, lineOfEffect: true }));
  });
  it('prueba el trayecto luz→objetivo, aunque observador→objetivo esté despejado', () => {
    const s = state(); s.environment.illumination = 'darkness';
    s.effects = [effect({ kind: 'light', illumination: 'bright', scope: { kind: 'circle', x: 250, y: 225, radiusFeet: 30 } })];
    s.obstacles = [wall({ start: { x: 200, y: 125 }, end: { x: 300, y: 125 } })];
    expect(assess(s).visible).toBeFalse();
    s.obstacles = []; expect(assess(s).visible).toBeTrue();
    expect(assess(s).perception).toBe('normal');
    s.effects[0].illumination = 'dim'; expect(assess(s).perception).toBe('disadvantage');
    s.environment.illumination = 'unknown'; expect(assess(s).perception).toBe('unknown'); expect(assess(s).visible).toBeTrue();
    expect(assess(s, tokens(), profile(['normal', 0], ['darkvision', 60])).perception).toBe('normal');
    s.environment.illumination = 'darkness';
    s.effects[0].scope = { kind: 'circle', x: 250, y: 225, radiusFeet: 1 }; expect(assess(s).visible).toBeFalse();
  });
  it('compone sentidos por alcance y no toma un sentido lejano para mejorar otro cercano', () => {
    const s = state(); s.environment.illumination = 'darkness';
    expect(assess(s, tokens(), profile(['normal', 0], ['darkvision', 60], ['blindsight', 1])).perception).toBe('disadvantage');
    expect(assess(s, tokens(), profile(['normal', 0], ['darkvision', 60], ['blindsight', 60])).perception).toBe('normal');
    s.environment.illumination = 'unknown'; expect(assess(s, tokens(), profile(['normal', 0], ['darkvision', 60])).perception).toBe('unknown');
  });
  it('distingue la oscuridad mágica de niebla fuerte, cegado y línea de efecto', () => {
    const s = state(); s.effects = [effect({ kind: 'magical-darkness', scope: { kind: 'circle', x: 150, y: 25, radiusFeet: 3 } })];
    expect(assess(s, tokens(), profile(['normal', 0], ['darkvision', 60])).visible).toBeFalse();
    expect(assess(s, tokens(), profile(['normal', 0], ['truesight', 60])).visible).toBeTrue();
    expect(assess(s).lineOfEffect).toBeTrue();
    s.effects = [effect({ kind: 'obscurement', obscurement: 'heavy', scope: { kind: 'circle', x: 150, y: 25, radiusFeet: 3 } })];
    expect(assess(s, tokens(), profile(['normal', 0], ['truesight', 60])).visible).toBeFalse();
    s.effects = [effect()];
    expect(assess(s, tokens(), profile(['normal', 0], ['truesight', 60])).visible).toBeFalse();
    expect(assess(s, tokens(), profile(['normal', 0], ['blindsight', 60])).visible).toBeTrue();
  });
  it('no deduce intensidad de niebla ni aplica lluvia real; usa la declaración de juego', () => {
    const s = state(); s.environment.weather = 'fog';
    expect(assess(s).visible).toBeUndefined();
    s.environment.obscurement = 'light'; expect(assess(s).perception).toBe('disadvantage');
    s.environment.obscurement = 'heavy'; expect(assess(s).visible).toBeFalse();
    s.environment.obscurement = 'none'; s.environment.timeOfDay = 'night';
    expect(assess(s).visible).toBeTrue();
  });
  it('detecta vibraciones con contacto confirmado, sin otorgar vista ni línea de efecto', () => {
    const s = state(); s.obstacles = [wall()];
    const t: VisionSubject[] = tokens().map((v) => ({ ...v, surfaceId: 'suelo-A', airborne: false, moving: true }));
    const p = profile(['normal', 0], ['tremorsense', 60]);
    expect(assess(s, t, p)).toEqual(jasmine.objectContaining({ visible: false, detected: true, lineOfEffect: false }));
    t[1].airborne = true; expect(assess(s, t, p).detected).toBeFalse();
    t[1].airborne = false; t[1].surfaceId = 'suelo-B'; expect(assess(s, t, p).detected).toBeFalse();
    t[1].surfaceId = 'suelo-A'; t[1].moving = false; t[1].subjectKind = 'object'; expect(assess(s, t, p).detected).toBeFalse();
    t[1].subjectKind = 'creature'; expect(assess(s, t, p).detected).toBeTrue();
    expect(assess(s, tokens(), p).detected).toBeUndefined();
  });
  it('respeta el límite exacto del sentido y los extremos/solapes de paredes', () => {
    const t = [token('a', 50), token('b', 50 + 20 * feetToPixels)];
    expect(assess(state(), t, profile(['normal', 20])).visible).toBeTrue();
    t[1].x += .01; expect(assess(state(), t, profile(['normal', 20])).visible).toBeFalse();
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })).toBeTrue();
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 20, y: 0 })).toBeTrue();
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 20, y: 0 })).toBeFalse();
  });
  it('las condiciones sin confirmar no conceden vista y una capacidad prestada tiene ámbito', () => {
    const t = tokens(); t[0].conditions = undefined;
    expect(assess(state(), t).visible).toBeUndefined();
    const s = state(); s.effects = [effect({ kind: 'sense', grantedSense: { sense: 'blindsight', rangeFeet: 60, source } })];
    expect(assess(s, t, new Map()).visible).toBeTrue();
    s.effects[0].scope = { kind: 'tokens', tokenIds: ['b'] }; expect(assess(s, t, new Map()).visible).toBeUndefined();
  });
  it('valida geometría nueva y conserva estados antiguos sin inventar confirmaciones', () => {
    const s = state(); s.obstacles = [wall()];
    expect(() => assertBoardVision(s, new Set(['a', 'b']))).not.toThrow();
    delete s.obstacles; expect(() => assertBoardVision(s, new Set(['a', 'b']))).not.toThrow(); expect(s.obstacles).toBeUndefined();
    for (const obstacle of [wall({ start: { x: NaN, y: 0 } }), wall({ end: { x: 150, y: 0 } }), wall({ kind: 'door' }), wall({ open: false })]) {
      expect(() => assertBoardVision({ ...s, obstacles: [obstacle] }, new Set(['a', 'b']))).toThrow();
    }
  });
  it('expira mediante avance explícito, conserva concentración y no muta otro encuentro', () => {
    const s = state(); s.effects = [effect({ duration: { kind: 'minutes', remaining: 1 }, concentrationTokenId: 'a' }),
      effect({ id: 'other', duration: { kind: 'rounds', remaining: 2 }, concentrationTokenId: 'b' })];
    const original = structuredClone(s); let next = s;
    for (let i = 0; i < 10; i++) next = advanceVisionEffects(next, { kind: 'rounds', amount: 1 });
    expect(next.effects.every((e) => !e.active)).toBeTrue(); expect(s).toEqual(original);
    expect(assess(next).visible).toBeTrue(); expect(assess(s).visible).toBeFalse();
    const ended = endVisionConcentration(s, 'a'); expect(ended.effects.map((e) => e.active)).toEqual([false, true]);
    expect(endVisionEffect(s, 'other').effects.map((e) => e.active)).toEqual([true, false]);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next); expect(() => assertBoardVision(next, new Set(['a', 'b']))).not.toThrow();
    expect(() => advanceVisionEffects(s, { kind: 'minutes', amount: -1 })).toThrow();
    expect(() => advanceVisionEffects(s, { kind: 'rounds', amount: .5 })).toThrow();
  });
  it('avanza seis segundos por asalto y cruza medianoche sin usar el reloj real', () => {
    const s = state(); s.environment.gameTime = { day: 4, minuteOfDay: 1439, second: 54 };
    const next = advanceVisionEffects(s, { kind: 'rounds', amount: 1 });
    expect(next.environment.gameTime).toEqual({ day: 5, minuteOfDay: 0, second: 0 });
    expect(s.environment.gameTime).toEqual({ day: 4, minuteOfDay: 1439, second: 54 });
    expect(() => assertBoardVision(next, new Set(['a', 'b']))).not.toThrow();
    expect(advanceVisionEffects(s, { kind: 'minutes', amount: 0 })).toEqual(s);
  });
  it('usa contactos del encuentro y no los filtra hacia otro tablero con las mismas instancias', () => {
    const first = state(), second = state(), p = profile(['normal', 0], ['tremorsense', 60]);
    first.contacts = ['a', 'b'].map((tokenId) => ({ tokenId, surfaceId: 'suelo', airborne: false, subjectKind: 'creature', source }));
    expect(assess(first, tokens(), p).detected).toBeTrue(); expect(assess(first, tokens(), p).visible).toBeFalse();
    expect(assess(second, tokens(), p).detected).toBeUndefined();
    first.contacts[1].surfaceId = 'agua'; expect(assess(first, tokens(), p).detected).toBeFalse();
    expect(tokens().every((t) => t.surfaceId === undefined)).toBeTrue();
  });
});
