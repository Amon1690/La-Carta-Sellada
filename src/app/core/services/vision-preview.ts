import type { BoardVisionState, VisionProfile } from '../models/vision';

export interface PreviewToken {
  instanceId: string; x: number; y: number; size: number; hidden: boolean;
  conditions?: readonly string[];
}
export interface PreviewFog { x: number; y: number; width: number; height: number; }
export interface SightCircle { id: string; x: number; y: number; radius: number; }

/** Previsualización geométrica conservadora. Los efectos y otros sentidos se resuelven en la siguiente fase. */
export function previewSight(state: BoardVisionState, tokens: readonly PreviewToken[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, grid: number, width: number, height: number
): { circles: SightCircle[]; pending: boolean } {
  if (!state.enabled) return { circles: [], pending: true };
  if (!['bright', 'dim'].includes(state.environment.illumination) || state.environment.weather !== 'clear' ||
      state.effects.some((effect) => effect.active)) return { circles: [], pending: true };
  const ids = state.groups.find((group) => group.id === state.activeGroupId)?.observerIds ?? [];
  const circles: SightCircle[] = [];
  let pending = false;
  for (const id of ids) {
    const token = tokens.find((item) => item.instanceId === id);
    const sight = profiles.get(id)?.senses.find((sense) => sense.sense === 'normal');
    if (!token || !sight || !token.conditions) { pending = true; continue; }
    if (token.conditions.includes('blinded') || sight.rangeFeet === 0) continue;
    // La escala existente del tablero es 1,5 m/casilla; 1 pie equivale a 0,3048 m.
    const radius = sight.rangeFeet === null ? Math.hypot(width, height) : sight.rangeFeet * 0.3048 / 1.5 * grid;
    circles.push({ id, x: token.x + token.size * grid / 2, y: token.y + token.size * grid / 2, radius });
  }
  return { circles, pending };
}

/** Una ficha parcialmente cubierta se omite completa, también sus datos accesibles. */
export function previewTokenVisible(token: PreviewToken, circles: readonly SightCircle[], fog: readonly PreviewFog[], grid: number): boolean {
  if (token.hidden) return false;
  const right = token.x + token.size * grid, bottom = token.y + token.size * grid;
  if (fog.some((rect) => rect.width > 0 && rect.height > 0 && token.x < rect.x + rect.width &&
      right > rect.x && token.y < rect.y + rect.height && bottom > rect.y)) return false;
  return rectangleInSightUnion(token.x, token.y, right, bottom, circles);
}

function rectangleInSightUnion(left: number, top: number, right: number, bottom: number, circles: readonly SightCircle[]): boolean {
  if (circles.some((c) => [[left, top], [right, top], [left, bottom], [right, bottom]]
    .every(([x, y]) => Math.hypot(x - c.x, y - c.y) <= c.radius))) return true;
  const relevant = circles.filter((c) => Math.hypot(Math.max(left - c.x, 0, c.x - right), Math.max(top - c.y, 0, c.y - bottom)) <= c.radius);
  const cuts = [left, right];
  const add = (x: number): void => { if (x > left && x < right) cuts.push(x); };
  for (const c of relevant) {
    add(c.x - c.radius); add(c.x + c.radius);
    for (const y of [top, bottom]) {
      const squared = c.radius ** 2 - (y - c.y) ** 2;
      if (squared >= 0) { const dx = Math.sqrt(squared); add(c.x - dx); add(c.x + dx); }
    }
  }
  for (let i = 0; i < relevant.length; i++) for (let j = i + 1; j < relevant.length; j++) {
    const a = relevant[i], b = relevant[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
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
    const intervals = relevant.flatMap((c) => {
      const squared = c.radius ** 2 - (x - c.x) ** 2;
      if (squared < 0) return [];
      const dy = Math.sqrt(squared); return [[c.y - dy, c.y + dy]];
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
