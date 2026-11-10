import type { BoardVisionState, VisionEffect, VisionProfile, VisionSense } from '../models/vision';
import { effectDisks, visionCenter as center } from './vision-geometry';
import { activeVisionEffects, evaluateVision, segmentsIntersect } from './vision-engine';
export { effectDisks } from './vision-geometry';

export interface PreviewToken {
  instanceId: string; x: number; y: number; size: number; hidden: boolean;
  conditions?: readonly string[];
}
export interface PreviewFog { x: number; y: number; width: number; height: number; }
export interface SightDisk { x: number; y: number; radius: number; }
export type SightPolygon = { x: number; y: number }[];
export interface SightCircle extends SightDisk {
  id: string; clip?: SightDisk; exclude?: SightDisk[]; shadows?: SightPolygon[];
  sense?: VisionSense;
}
export interface SightAssessment {
  visible: boolean | undefined;
  perception: 'normal' | 'disadvantage' | 'automatic-failure' | 'unknown';
  reasons: string[];
}

const activeEffects = activeVisionEffects;
const contains = (disk: SightDisk, point: { x: number; y: number }): boolean => Math.hypot(point.x - disk.x, point.y - disk.y) <= disk.radius;
function shadow(disk: SightDisk, origin: { x: number; y: number }, extent: number): SightPolygon {
  const dx = disk.x - origin.x, dy = disk.y - origin.y, distance = Math.hypot(dx, dy);
  const ux = dx / distance, uy = dy / distance, tangent = Math.sqrt(distance ** 2 - disk.radius ** 2);
  const near = tangent ** 2 / distance, side = disk.radius * tangent / distance;
  const far = distance + extent, farSide = far * disk.radius / tangent;
  return [
    { x: origin.x + ux * near - uy * side, y: origin.y + uy * near + ux * side },
    { x: origin.x + ux * far - uy * farSide, y: origin.y + uy * far + ux * farSide },
    { x: origin.x + ux * far + uy * farSide, y: origin.y + uy * far - ux * farSide },
    { x: origin.x + ux * near + uy * side, y: origin.y + uy * near - ux * side },
  ];
}
function affects(effect: VisionEffect, token: PreviewToken, tokens: readonly PreviewToken[], grid: number): boolean {
  return effect.scope.kind === 'tokens' ? effect.scope.tokenIds.includes(token.instanceId) : effectDisks(effect, tokens, grid).some((disk) => contains(disk, center(token, grid)));
}

/** Solo rangos registrados: el clima es presentación; luz y sentidos se resuelven por observador. */
export function personalSight(state: BoardVisionState, tokens: readonly PreviewToken[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, observerId: string, grid: number, width: number, height: number
): { circles: SightCircle[]; pending: boolean } {
  const token = tokens.find((item) => item.instanceId === observerId), profile = profiles.get(observerId);
  if (!token || state.obstacles === undefined) return { circles: [], pending: true };
  const effects = activeEffects(state);
  const senses = [...(profile?.senses ?? []), ...effects.filter((effect) => effect.kind === 'sense' && affects(effect, token, tokens, grid))
    .flatMap((effect) => effect.grantedSense ? [effect.grantedSense] : [])];
  const blinded = token.conditions?.includes('blinded') || effects.some((effect) => effect.kind === 'blinded' && affects(effect, token, tokens, grid));
  const heavy = effects.filter((effect) => effect.kind === 'obscurement' && effect.obscurement === 'heavy').flatMap((effect) => effectDisks(effect, tokens, grid));
  const magical = effects.filter((effect) => effect.kind === 'magical-darkness').flatMap((effect) => effectDisks(effect, tokens, grid));
  const lights = effects.filter((effect) => effect.kind === 'light').flatMap((effect) => effectDisks(effect, tokens, grid));
  const circles: SightCircle[] = [];
  const weather = state.environment.obscurement ?? (state.environment.weather === 'clear' ? 'none' : 'unknown');
  const extent = Math.hypot(width, height) * 4;
  const insideWall = (origin: { x: number; y: number }, channel: 'blocksSight' | 'blocksEffect'): boolean =>
    (state.obstacles ?? []).some((o) => o[channel] && !(o.kind === 'door' && o.open) && segmentsIntersect(origin, origin, o.start, o.end));
  const wallShadows = (origin: { x: number; y: number }, channel: 'blocksSight' | 'blocksEffect'): SightPolygon[] =>
    (state.obstacles ?? []).filter((o) => o[channel] && !(o.kind === 'door' && o.open)).map((o) => {
      const far = (p: { x: number; y: number }) => {
        const d = Math.hypot(p.x - origin.x, p.y - origin.y);
        return { x: p.x + (p.x - origin.x) / (d || 1) * extent, y: p.y + (p.y - origin.y) / (d || 1) * extent };
      };
      return [o.start, o.end, far(o.end), far(o.start)];
    });
  for (const sense of senses) {
    if (sense.rangeFeet === 0 || sense.sense === 'tremorsense' || ((blinded || token.conditions === undefined) && sense.sense !== 'blindsight')) continue;
    const circle: SightCircle = { id: observerId, sense: sense.sense, ...center(token, grid), radius: sense.rangeFeet === null ? Math.hypot(width, height) : sense.rangeFeet * .3048 / 1.5 * grid };
    if (insideWall(circle, sense.sense === 'blindsight' ? 'blocksEffect' : 'blocksSight')) continue;
    circle.shadows = wallShadows(circle, sense.sense === 'blindsight' ? 'blocksEffect' : 'blocksSight');
    if (sense.sense === 'blindsight') { circles.push(circle); continue; }
    if (weather === 'unknown' || weather === 'heavy') continue;
    circle.exclude = sense.sense === 'truesight' ? heavy : [...heavy, ...magical];
    if (circle.exclude.some((disk) => contains(disk, circle))) continue;
    circle.shadows.push(...circle.exclude.filter((disk) => disk.radius > 0).map((disk) => shadow(disk, circle, extent)));
    if (sense.sense === 'normal' && ['darkness', 'unknown'].includes(state.environment.illumination)) {
      for (const light of lights) {
        if (insideWall(light, 'blocksSight') || [...heavy, ...magical].some((disk) => contains(disk, light))) continue;
        circles.push({ ...circle, clip: light, shadows: [...circle.shadows, ...wallShadows(light, 'blocksSight'),
          ...[...heavy, ...magical].map((disk) => shadow(disk, light, extent))] });
      }
    } else circles.push(circle);
  }
  return { circles, pending: !senses.some((sense) => sense.sense !== 'tremorsense') ||
    (token.conditions === undefined && !senses.some((sense) => sense.sense === 'blindsight' && (sense.rangeFeet ?? 0) > 0)) ||
    (weather === 'unknown' && !senses.some((sense) => sense.sense === 'blindsight' && (sense.rangeFeet ?? 0) > 0)) ||
    (state.environment.illumination === 'unknown' && !lights.length && !senses.some((sense) => !['normal', 'tremorsense'].includes(sense.sense) && (sense.rangeFeet ?? 0) > 0)) };
}

/** Unión de las vistas personales de la lista de observadores de dirección. */
export function previewSight(state: BoardVisionState, tokens: readonly PreviewToken[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, grid: number, width: number, height: number
): { circles: SightCircle[]; pending: boolean } {
  if (!state.enabled) return { circles: [], pending: true };
  const ids = state.groups.find((group) => group.id === state.activeGroupId)?.observerIds ?? [];
  const circles: SightCircle[] = [];
  let pending = false;
  for (const id of ids) {
    const sight = personalSight(state, tokens, profiles, id, grid, width, height);
    circles.push(...sight.circles.map((circle, index) => ({ ...circle, id: index ? `${id}:sight:${index}` : id }))); pending ||= sight.pending;
  }
  return { circles, pending };
}

/** Evaluación personal para tiradas: nunca usa la unión de observadores ni la niebla de exploración. */
export function assessSight(state: BoardVisionState, tokens: readonly PreviewToken[], profiles: ReadonlyMap<string, VisionProfile | undefined>,
  observerId: string, target: { x: number; y: number }, grid = 51.2, width = 1536, height = 1024): SightAssessment {
  const pointId = '__vision_point__';
  const point: PreviewToken = { instanceId: pointId, ...target, size: 0, hidden: false, conditions: [] };
  const result = evaluateVision(state, [...tokens, point], profiles, observerId, pointId, grid);
  return { ...result, reasons: result.perception === 'automatic-failure' ? ['El observador no ve esta zona: la Percepción visual falla.', ...result.reasons] : result.reasons };
}

/** Una ficha parcialmente cubierta se omite completa, también sus datos accesibles. */
export function previewTokenVisible(token: PreviewToken, circles: readonly SightCircle[], fog: readonly PreviewFog[], grid: number): boolean {
  if (token.hidden) return false;
  const right = token.x + token.size * grid, bottom = token.y + token.size * grid;
  if (fog.some((rect) => rect.width > 0 && rect.height > 0 && token.x < rect.x + rect.width &&
      right > rect.x && token.y < rect.y + rect.height && bottom > rect.y)) return false;
  const usable = token.conditions === undefined ? circles.filter((c) => c.sense === 'blindsight')
    : token.conditions.includes('invisible') ? circles.filter((c) => c.sense === 'blindsight' || c.sense === 'truesight') : circles;
  return rectangleInSightUnion(token.x, token.y, right, bottom, usable);
}

function rectangleInSightUnion(left: number, top: number, right: number, bottom: number, circles: readonly SightCircle[]): boolean {
  if (circles.some((c) => !c.clip && !c.exclude?.length && !c.shadows?.length && [[left, top], [right, top], [left, bottom], [right, bottom]]
    .every(([x, y]) => Math.hypot(x - c.x, y - c.y) <= c.radius))) return true;
  const relevant = circles.filter((c) => Math.hypot(Math.max(left - c.x, 0, c.x - right), Math.max(top - c.y, 0, c.y - bottom)) <= c.radius);
  const boundaries = relevant.flatMap((circle) => [circle, ...(circle.clip ? [circle.clip] : []), ...(circle.exclude ?? [])]);
  const cuts = [left, right];
  const add = (x: number): void => { if (x > left && x < right) cuts.push(x); };
  const segments = relevant.flatMap((circle) => circle.shadows ?? []).flatMap((polygon) => polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length]]));
  for (const [a, b] of segments) {
    add(a.x); add(b.x);
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dy) for (const y of [top, bottom]) { const t = (y - a.y) / dy; if (t >= 0 && t <= 1) add(a.x + t * dx); }
    for (const disk of boundaries) {
      const px = a.x - disk.x, py = a.y - disk.y, aa = dx ** 2 + dy ** 2, bb = 2 * (px * dx + py * dy);
      const discriminant = bb ** 2 - 4 * aa * (px ** 2 + py ** 2 - disk.radius ** 2);
      if (!aa || discriminant < 0) continue;
      for (const t of [(-bb - Math.sqrt(discriminant)) / (2 * aa), (-bb + Math.sqrt(discriminant)) / (2 * aa)]) if (t >= 0 && t <= 1) add(a.x + t * dx);
    }
  }
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const [a, b] = segments[i], [c, d] = segments[j];
    const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y, cross = dx * ey - dy * ex;
    if (!cross) continue;
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / cross, u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) add(a.x + t * dx);
  }
  for (const c of boundaries) {
    add(c.x - c.radius); add(c.x + c.radius);
    for (const y of [top, bottom]) {
      const squared = c.radius ** 2 - (y - c.y) ** 2;
      if (squared >= 0) { const dx = Math.sqrt(squared); add(c.x - dx); add(c.x + dx); }
    }
  }
  for (let i = 0; i < boundaries.length; i++) for (let j = i + 1; j < boundaries.length; j++) {
    const a = boundaries[i], b = boundaries[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (!d || d > a.radius + b.radius || d < Math.abs(a.radius - b.radius)) continue;
    const along = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
    const height = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2));
    const x = a.x + along * dx / d; add(x - height * dy / d); add(x + height * dy / d);
  }
  const ordered = [...new Set(cuts)].sort((a, b) => a - b);
  // La cobertura vertical solo cambia al cruzar una intersección de arcos/bordes.
  const samples = ordered.flatMap((x, index) => index ? [x, (x + ordered[index - 1]) / 2] : [x]);
  const tolerance = Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(top), Math.abs(right), Math.abs(bottom));
  return samples.every((x) => {
    const interval = (c: SightDisk): number[] | undefined => {
      const squared = c.radius ** 2 - (x - c.x) ** 2;
      if (squared < 0) return undefined;
      const dy = Math.sqrt(squared); return [c.y - dy, c.y + dy];
    };
    const intervals = relevant.flatMap((c) => {
      const own = interval(c); if (!own) return [];
      const clip = c.clip ? interval(c.clip) : own; if (!clip) return [];
      let pieces = [[Math.max(own[0], clip[0]), Math.min(own[1], clip[1])]].filter(([a, b]) => a <= b);
      for (const disk of c.exclude ?? []) {
        const cut = interval(disk); if (!cut) continue;
        pieces = pieces.flatMap(([a, b]) => cut[1] < a || cut[0] > b ? [[a, b]] : [[a, Math.min(b, cut[0])], [Math.max(a, cut[1]), b]].filter(([l, r]) => l < r));
      }
      for (const polygon of c.shadows ?? []) {
        const ys = polygon.flatMap((a, index) => {
          const b = polygon[(index + 1) % polygon.length];
          if (x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) return [];
          return a.x === b.x ? [a.y, b.y] : [a.y + (x - a.x) / (b.x - a.x) * (b.y - a.y)];
        });
        if (ys.length < 2) continue;
        const low = Math.min(...ys), high = Math.max(...ys);
        pieces = pieces.flatMap(([a, b]) => high < a || low > b ? [[a, b]] : [[a, Math.min(b, low)], [Math.max(a, high), b]].filter(([l, r]) => l < r));
      }
      return pieces;
    }).sort((a, b) => a[0] - b[0]);
    let covered = top;
    for (const [start, end] of intervals) {
      if (end < covered) continue;
      if (start > covered + tolerance) return false;
      covered = Math.max(covered, end); if (covered >= bottom - tolerance) return true;
    }
    return false;
  });
}
