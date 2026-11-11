import type { BoardVisionState, VisionProfile } from '../models/vision';
import { activeVisionEffects, evaluateVision } from './vision-engine';
import { effectDisks, visionCenter } from './vision-geometry';
import { PreviewFog, PreviewToken, SightCircle, previewTokenVisible } from './vision-preview';

export interface TokenOrientation {
  state: BoardVisionState;
  tokens: readonly PreviewToken[];
  profiles: ReadonlyMap<string, VisionProfile | undefined>;
  observerIds: readonly string[];
  circles: readonly SightCircle[];
  fog: readonly PreviewFog[];
  grid: number;
}

function explored(token: PreviewToken, context: TokenOrientation): boolean {
  return !context.fog.some((r) => r.width > 0 && r.height > 0 && token.x < r.x + r.width &&
    token.x + token.size * context.grid > r.x && token.y < r.y + r.height && token.y + token.size * context.grid > r.y);
}
function darkAt(token: PreviewToken, context: TokenOrientation): boolean {
  if (context.state.environment.illumination === 'darkness') return true;
  const point = visionCenter(token, context.grid);
  return activeVisionEffects(context.state).filter((effect) => effect.kind === 'magical-darkness')
    .some((effect) => effectDisks(effect, context.tokens, context.grid).some((d) => Math.hypot(point.x - d.x, point.y - d.y) <= d.radius));
}
function adjacent(a: PreviewToken, b: PreviewToken, grid: number): boolean {
  const first = (n: number) => Math.floor(n / grid + 1e-9);
  const last = (n: number, size: number) => Math.ceil(n / grid + size - 1e-9) - 1;
  return Math.max(first(a.x) - last(b.x, b.size), first(b.x) - last(a.x, a.size),
    first(a.y) - last(b.y, b.size), first(b.y) - last(a.y, a.size)) <= 1;
}

/** Ayuda de orientación del tablero: no cambia sentidos, Percepción ni tiradas. */
function darknessOnly(observer: PreviewToken, target: PreviewToken, context: TokenOrientation, movement = false): boolean {
  if (!context.state.enabled || context.state.obstacles === undefined || observer.hidden || target.hidden) return false;
  if (evaluateVision(context.state, context.tokens, context.profiles, observer.instanceId, target.instanceId, context.grid).visible !== false) return false;
  const lit: BoardVisionState = { ...context.state, environment: { ...context.state.environment, illumination: 'bright' },
    effects: context.state.effects.filter((effect) => effect.kind !== 'magical-darkness') };
  const result = evaluateVision(lit, context.tokens, context.profiles, observer.instanceId, target.instanceId, context.grid);
  return result.visible === true && (!movement || result.lineOfEffect === true);
}

export function orientedTokenVisible(token: PreviewToken, context: TokenOrientation): boolean {
  if (token.hidden) return false;
  if (previewTokenVisible(token, context.circles, context.fog, context.grid)) return true;
  if (!context.state.enabled) return false;
  // La posición propia es un ancla de interfaz, incluso sobre niebla. Nunca se
  // descubre el mapa, ni se levantan las ocultaciones explícitas de dirección.
  if (context.observerIds.includes(token.instanceId) && darkAt(token, context)) return true;
  if (!explored(token, context)) return false;
  return context.observerIds.some((id) => {
    const observer = context.tokens.find((item) => item.instanceId === id);
    return !!observer && adjacent(observer, token, context.grid) && darknessOnly(observer, token, context);
  });
}

/** Un paso, también diagonal, sin conceder alcance ni desplazar fichas ajenas. */
export function canOrientStep(observerId: string, x: number, y: number, context: TokenOrientation): boolean {
  const observer = context.tokens.find((token) => token.instanceId === observerId);
  if (!observer || observer.hidden || !context.observerIds.includes(observerId)) return false;
  const cell = (n: number) => Math.floor(n / context.grid + 1e-9);
  if (Math.max(Math.abs(cell(x) - cell(observer.x)), Math.abs(cell(y) - cell(observer.y))) > 1) return false;
  let instanceId = '__orientation_step__';
  while (context.tokens.some((token) => token.instanceId === instanceId)) instanceId += '_';
  const target: PreviewToken = { instanceId, x, y, size: observer.size, hidden: false, conditions: [] };
  return explored(target, context) && darknessOnly(observer, target, { ...context, tokens: [...context.tokens, target] }, true);
}
