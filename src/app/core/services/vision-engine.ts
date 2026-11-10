import type { BoardVisionState, SourcedSense, VisionEffect, VisionPoint, VisionProfile } from '../models/vision';
import type { PreviewToken, SightDisk } from './vision-preview';
import { effectDisks } from './vision-geometry';

export interface VisionSubject extends PreviewToken {
  /** Mismo identificador solo si dirección confirma contacto con la misma superficie. */
  surfaceId?: string;
  airborne?: boolean;
  moving?: boolean;
  subjectKind?: 'creature' | 'object';
}
export interface VisionEvaluation {
  visible: boolean | undefined;
  detected: boolean | undefined;
  lineOfEffect: boolean | undefined;
  perception: 'normal' | 'disadvantage' | 'automatic-failure' | 'unknown';
  reasons: string[];
}
const center = (t: PreviewToken, grid: number): VisionPoint => ({ x: t.x + t.size * grid / 2, y: t.y + t.size * grid / 2 });
const cross = (a: VisionPoint, b: VisionPoint, c: VisionPoint): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const between = (a: number, b: number, n: number): boolean => n >= Math.min(a, b) && n <= Math.max(a, b);
const on = (a: VisionPoint, b: VisionPoint, p: VisionPoint): boolean => cross(a, b, p) === 0 && between(a.x, b.x, p.x) && between(a.y, b.y, p.y);
/** Incluye contacto con extremos y solapamientos: no deja rendijas en uniones de paredes. */
export function segmentsIntersect(a: VisionPoint, b: VisionPoint, c: VisionPoint, d: VisionPoint): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
function crossesDisk(a: VisionPoint, b: VisionPoint, disk: SightDisk): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((disk.x - a.x) * dx + (disk.y - a.y) * dy) / length)) : 0;
  return Math.hypot(a.x + t * dx - disk.x, a.y + t * dy - disk.y) <= disk.radius;
}
function blocked(state: BoardVisionState, a: VisionPoint, b: VisionPoint, channel: 'blocksSight' | 'blocksEffect'): boolean {
  return (state.obstacles ?? []).some((o) => !(o.kind === 'door' && o.open) && o[channel] && segmentsIntersect(a, b, o.start, o.end));
}
export function activeVisionEffects(state: BoardVisionState): VisionEffect[] {
  return state.effects.filter((effect) => effect.active && (!('remaining' in effect.duration) || effect.duration.remaining > 0));
}
function affects(effect: VisionEffect, token: PreviewToken, tokens: readonly PreviewToken[], grid: number): boolean {
  return effect.scope.kind === 'tokens' ? effect.scope.tokenIds.includes(token.instanceId)
    : effectDisks(effect, tokens, grid).some((d) => Math.hypot(center(token, grid).x - d.x, center(token, grid).y - d.y) <= d.radius);
}
function union(values: (boolean | undefined)[]): boolean | undefined {
  return values.some((v) => v === true) ? true : values.some((v) => v === undefined) || !values.length ? undefined : false;
}

/** Motor 2D personal. No descubre paredes, condiciones, superficies ni luz a partir de nombres. */
export function evaluateVision(state: BoardVisionState, tokens: readonly VisionSubject[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, observerId: string, targetId: string, grid = 51.2
): VisionEvaluation {
  const unknown = (reason: string): VisionEvaluation => ({ visible: undefined, detected: undefined, lineOfEffect: undefined, perception: 'unknown', reasons: [reason] });
  const withContact = (id: string): VisionSubject | undefined => {
    const token = tokens.find((t) => t.instanceId === id);
    const contact = state.contacts?.find((c) => c.tokenId === id);
    return token ? { ...token, ...contact } : undefined;
  };
  const observer = withContact(observerId), target = withContact(targetId);
  if (!observer || !target || !Number.isFinite(grid) || grid <= 0) return unknown('Falta una instancia o una escala válida del tablero.');
  const a = center(observer, grid), b = center(target, grid), effects = activeVisionEffects(state);
  const distance = Math.hypot(b.x - a.x, b.y - a.y) / grid * 1.5 / .3048;
  const lineOfEffect = blocked(state, a, b, 'blocksEffect') ? false : state.obstacles === undefined ? undefined : true;
  const senses = [...(profiles.get(observerId)?.senses ?? []), ...effects.filter((e) => e.kind === 'sense' && affects(e, observer, tokens, grid))
    .flatMap((e) => e.grantedSense ? [e.grantedSense] : [])];
  const blinded = observer.conditions?.includes('blinded') || effects.some((e) => e.kind === 'blinded' && affects(e, observer, tokens, grid));
  const heavy = effects.filter((e) => e.kind === 'obscurement' && e.obscurement === 'heavy').flatMap((e) => effectDisks(e, tokens, grid));
  const magical = effects.filter((e) => e.kind === 'magical-darkness').flatMap((e) => effectDisks(e, tokens, grid));
  const lights = effects.filter((e) => e.kind === 'light').filter((e) => effectDisks(e, tokens, grid).some((d) =>
    Math.hypot(b.x - d.x, b.y - d.y) <= d.radius && !blocked(state, d, b, 'blocksSight') && ![...heavy, ...magical].some((h) => crossesDisk(d, b, h))));
  const ambient = state.environment.illumination;
  const illumination = ambient === 'bright' || lights.some((e) => e.illumination === 'bright') ? 'bright'
    : ambient === 'dim' || lights.length ? 'dim' : ambient;
  const illuminationUncertain = ambient === 'unknown' && !lights.some((e) => e.illumination === 'bright');
  const weather = state.environment.obscurement ?? (state.environment.weather === 'clear' ? 'none' : 'unknown');
  const lightObscurement = weather === 'light' || effects.some((e) => e.kind === 'obscurement' && e.obscurement === 'light' && affects(e, target, tokens, grid));
  type SenseResult = { visible: boolean | undefined; quality: 'normal' | 'disadvantage' | 'unknown' };
  const result = (sense: SourcedSense): SenseResult => {
    const no: SenseResult = { visible: false, quality: 'unknown' };
    if (sense.rangeFeet === 0 || (sense.rangeFeet !== null && distance > sense.rangeFeet)) return no;
    const blind = sense.sense === 'blindsight';
    if (blocked(state, a, b, blind ? 'blocksEffect' : 'blocksSight')) return no;
    if (!blind && (blinded || weather === 'heavy' || heavy.some((d) => crossesDisk(a, b, d)))) return no;
    if (!blind && sense.sense !== 'truesight' && magical.some((d) => crossesDisk(a, b, d))) return no;
    if (!blind && sense.sense !== 'truesight' && target.conditions?.includes('invisible')) return no;
    if (sense.sense === 'normal' && illumination === 'darkness') return no;
    if (state.obstacles === undefined || (!blind && (observer.conditions === undefined || target.conditions === undefined || weather === 'unknown')) ||
        (sense.sense === 'normal' && illumination === 'unknown')) return { visible: undefined, quality: 'unknown' };
    // Con oscuridad desconocida, darkvision garantiza vista pero no determina la penalización de Percepción.
    return { visible: true, quality: !blind && lightObscurement ? 'disadvantage'
      : sense.sense === 'normal' && illuminationUncertain ? 'unknown'
      : !blind && ((sense.sense === 'normal' && illumination === 'dim') ||
      (sense.sense === 'darkvision' && illumination === 'darkness')) ? 'disadvantage'
      : sense.sense === 'darkvision' && illumination === 'unknown' ? 'unknown' : 'normal' };
  };
  const sight = senses.filter((s) => s.sense !== 'tremorsense').map(result);
  if (!senses.some((s) => s.sense === 'normal')) {
    const possible = result({ sense: 'normal', rangeFeet: null, source: { kind: 'director', reference: 'Dato ausente, sin conceder alcance' } });
    sight.push({ ...possible, visible: possible.visible === false ? false : undefined, quality: 'unknown' });
  }
  const visible = union(sight.map((s) => s.visible));
  const vibration = senses.filter((s) => s.sense === 'tremorsense').map((s): boolean | undefined => {
    if (!s.rangeFeet || distance > s.rangeFeet || observer.airborne || target.airborne || (target.subjectKind === 'object' && target.moving === false)) return false;
    if (observer.airborne === undefined || target.airborne === undefined || !observer.surfaceId || !target.surfaceId ||
        (target.subjectKind !== 'creature' && target.moving !== true)) return undefined;
    return observer.surfaceId === target.surfaceId;
  });
  const detected = visible === true ? true : union([...(sight.length ? [visible] : []), ...vibration]);
  const perception = visible === false ? 'automatic-failure' : visible === undefined ? 'unknown'
    : sight.some((s) => s.visible === true && s.quality === 'normal') ? 'normal'
    : sight.some((s) => s.visible === true && s.quality === 'unknown') ? 'unknown' : 'disadvantage';
  const reasons = [visible === true ? 'Hay un sentido visual confirmado hasta el objetivo.' : visible === false ? 'Ningún sentido visual registrado permite ver el objetivo: la Percepción visual falla.' : 'Faltan luz, condiciones, alcance o geometría confirmados para decidir la vista.'];
  if (vibration.some((v) => v === true)) reasons.push('El sentido sísmico detecta la posición sobre la superficie compartida; no concede vista.');
  reasons.push(lineOfEffect === false ? 'Un obstáculo configurado corta la línea de efecto.' : lineOfEffect === undefined ? 'La geometría de obstáculos está sin confirmar.' : 'El segmento no cruza obstáculos configurados para línea de efecto.');
  return { visible, detected, lineOfEffect, perception, reasons };
}
