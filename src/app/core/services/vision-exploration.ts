import type { BoardVisionState, VisionProfile } from '../models/vision';
import { segmentsIntersect } from './vision-engine';
import { PreviewFog, PreviewToken, personalSight, previewTokenVisible } from './vision-preview';
import { canOrientStep } from './token-orientation';

type ActorToken = PreviewToken & { actorId: string };
/** Solo terreno confirmado, nunca posiciones de PNJs ni fotografías de tokens. */
export function rememberExploration(state: BoardVisionState, tokens: readonly ActorToken[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, fog: readonly PreviewFog[], grid = 51.2): BoardVisionState {
  if (!state.enabled || state.obstacles === undefined) return state;
  const memories = new Map((state.exploration ?? []).map((entry) => [entry.tokenId, new Set(entry.cells)]));
  let changed = false;
  for (const token of tokens.filter((t) => !t.hidden && t.actorId.startsWith('player:'))) {
    const cells = memories.get(token.instanceId) ?? new Set<number>();
    const sight = personalSight(state, tokens, profiles, token.instanceId, grid, 1536, 1024);
    const context = { state, tokens, profiles, observerIds: [token.instanceId], circles: sight.circles, fog, grid };
    const canRememberFootprint = canOrientStep(token.instanceId, token.x, token.y, context);
    for (let cell = 0; cell < 600; cell++) {
      if (cells.has(cell)) continue;
      const x = cell % 30 * grid, y = Math.floor(cell / 30) * grid;
      const tile: PreviewToken = { instanceId: '__exploration_cell__', x, y, size: 1, hidden: false, conditions: [] };
      // La memoria de visión solo acepta casillas completamente vistas: no
      // rellena rendijas ni casillas que crucen una pared con zonas desconocidas.
      let known = previewTokenVisible(tile, sight.circles, fog, grid);
      if (!known && canRememberFootprint && x + grid / 2 >= token.x && x + grid / 2 < token.x + token.size * grid &&
          y + grid / 2 >= token.y && y + grid / 2 < token.y + token.size * grid) {
        const covered = fog.some((r) => r.width > 0 && r.height > 0 && x < r.x + r.width && x + grid > r.x && y < r.y + r.height && y + grid > r.y);
        const e = 1e-6;
        const corners = [{ x: x + e, y: y + e }, { x: x + grid - e, y: y + e },
          { x: x + grid - e, y: y + grid - e }, { x: x + e, y: y + grid - e }];
        const inside = (p: { x: number; y: number }) => p.x >= x + e && p.x <= x + grid - e && p.y >= y + e && p.y <= y + grid - e;
        const cut = state.obstacles.some((o) => o.blocksSight && !o.open &&
          (inside(o.start) || inside(o.end) || corners.some((corner, i) => segmentsIntersect(corner, corners[(i + 1) % 4], o.start, o.end))));
        known = !covered && !cut;
      }
      if (known) { cells.add(cell); changed = true; }
    }
    if (cells.size) memories.set(token.instanceId, cells);
  }
  return changed ? { ...state, exploration: [...memories].map(([tokenId, cells]) => ({ tokenId, cells: [...cells].sort((a, b) => a - b) })) } : state;
}

/** Unión de memoria de los observadores elegidos, agrupada en bandas por fila. */
export function explorationRects(state: BoardVisionState, observerIds: readonly string[], grid = 51.2): PreviewFog[] {
  if (!state.enabled) return [];
  const cells = new Set((state.exploration ?? []).filter((entry) => observerIds.includes(entry.tokenId)).flatMap((entry) => entry.cells));
  const rects: PreviewFog[] = [];
  for (let row = 0; row < 20; row++) for (let column = 0; column < 30; column++) {
    if (!cells.has(row * 30 + column)) continue;
    const start = column;
    while (column + 1 < 30 && cells.has(row * 30 + column + 1)) column++;
    rects.push({ x: start * grid, y: row * grid, width: (column - start + 1) * grid, height: grid });
  }
  return rects;
}
