import type { GameStatBlock } from '../models/campaign';
import type { Combatant, TurnAction, TurnMovement } from '../models/combat';
import type { VisionObstacle } from '../models/vision';
import { isVisionDoor } from './vision-geometry';

export interface MovementProfile { speed?: number; bonusDash: boolean; bonusDisengage: boolean; }
export interface MovementRoute { cell: number; path: number[]; cost: number; }
export const freshMovement = (): TurnMovement => ({ spent: 0, dashes: 0, disengaged: false });
export function movementProfile(stats: GameStatBlock | undefined): MovementProfile {
  // Solo la velocidad terrestre explícita. Otros modos y textos ambiguos requieren preparación posterior.
  const match = stats?.speed?.trim().match(/^(\d+(?:[.,]\d+)?)\s*m(?:etros)?\.?$/i);
  const speed = match ? Number(match[1].replace(',', '.')) : undefined;
  const build = (stats as GameStatBlock & { build?: { version: number; classId: string; level: number } } | undefined)?.build;
  const rogue = build?.version === 1 && build.classId === 'picaro' && build.level >= 2;
  const monk = build?.version === 1 && build.classId === 'monje' && build.level >= 2;
  return { speed: speed !== undefined && Number.isFinite(speed) && speed >= 0 && speed <= 10000 ? speed : undefined,
    bonusDash: rogue || monk, bonusDisengage: rogue || monk };
}
export function effectiveSpeed(actor: Combatant): number | undefined {
  return actor.conditions?.includes('restrained') ? 0 : actor.movement?.speed;
}
export function movementRemaining(actor: Combatant, turn: TurnMovement | undefined): number | undefined {
  const speed = effectiveSpeed(actor);
  return turn && speed !== undefined ? Math.max(0, speed * (1 + turn.dashes) - turn.spent) : undefined;
}
export const turnActionLabels: Record<TurnAction, string> = {
  dash: 'Correr · acción', disengage: 'Destrabarse · acción',
  'bonus-dash': 'Correr · acción adicional', 'bonus-disengage': 'Destrabarse · acción adicional', stand: 'Levantarse',
};

/** Rutas ortogonales solicitadas por el usuario: coste por paso y huella completa. */
export function movementRoutes(actor: Combatant, roster: Combatant[], obstacles: VisionObstacle[] | undefined,
  allowed: number[], budget: number, grid = 51.2): MovementRoute[] {
  if (obstacles === undefined || !Number.isFinite(budget) || budget <= 0) return [];
  const col = Math.round(actor.x / grid), row = Math.round(actor.y / grid);
  if (Math.abs(actor.x / grid - col) > .001 || Math.abs(actor.y / grid - row) > .001) return [];
  const start = row * 30 + col, permitted = new Set(allowed), distances = new Map([[start, 0]]), lengths = new Map([[start, 0]]), paths = new Map([[start, [] as number[]]]), visited = new Set<number>();
  const blockers = obstacles.filter(o => o.blocksMovement !== false && !(isVisionDoor(o) && o.open));
  const overlap = (x: number, y: number, other: Combatant) => x < other.x + other.size * grid - .001 && x + actor.size * grid > other.x + .001 && y < other.y + other.size * grid - .001 && y + actor.size * grid > other.y + .001;
  const allies = (other: Combatant) => actor.side !== undefined || other.side !== undefined
    ? actor.side !== undefined && actor.side !== 'neutral' && actor.side === other.side
    : actor.actorId.startsWith('player:') && other.actorId.startsWith('player:');
  const occupants = (cell: number) => roster.filter(t => t.id !== actor.id && overlap(cell % 30 * grid, Math.floor(cell / 30) * grid, t));
  while (visited.size < 600) {
    let current: number | undefined, best = Infinity, bestLength = Infinity;
    // Primero el coste reglamentario; a igualdad, el trazo geométrico más corto evita zigzags gratuitos.
    for (const [cell, cost] of distances) if (!visited.has(cell) && (cost < best || cost === best && lengths.get(cell)! < bestLength)) {
      current = cell; best = cost; bestLength = lengths.get(cell)!;
    }
    if (current === undefined) break;
    visited.add(current);
    const x = current % 30, y = Math.floor(current / 30);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      const nx = x + dx, ny = y + dy, cell = ny * 30 + nx;
      if (nx < 0 || ny < 0 || nx + actor.size > 30 || ny + actor.size > 20 || !permitted.has(cell) || visited.has(cell)) continue;
      const others = occupants(cell);
      // El tamaño visual no distingue Pequeño de Mediano: no se inventan excepciones por categorías.
      if (others.some(t => !allies(t) && !t.conditions?.includes('incapacitated') && t.size > .5)) continue;
      const from = { x: x * grid, y: y * grid }, to = { x: nx * grid, y: ny * grid };
      if (blockers.some(o => blocksStep(from, to, actor.size * grid, o))) continue;
      const cost = best + 1.5 * (1 + (actor.conditions?.includes('prone') ? 1 : 0) + (others.some(t => !allies(t) && t.size > .5) ? 1 : 0));
      const length = bestLength + Math.hypot(dx, dy), previousCost = distances.get(cell) ?? Infinity;
      if (cost > budget + .00001 || cost > previousCost || cost === previousCost && length >= lengths.get(cell)!) continue;
      distances.set(cell, cost); lengths.set(cell, length); paths.set(cell, [...paths.get(current)!, cell]);
    }
  }
  return [...distances].filter(([cell, cost]) => cell !== start && cost <= budget + .00001 && !occupants(cell).length)
    .map(([cell, cost]) => ({ cell, path: paths.get(cell)!, cost }));
}
interface Point { x: number; y: number; }
function cross(a: Point, b: Point, c: Point): number { return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
function blocksStep(from: Point, to: Point, size: number, obstacle: VisionObstacle): boolean {
  // Envolvente convexa de la huella barrida. El margen permite ir junto a una pared sin atravesarla.
  const e = .001, points = [from, to].flatMap(p => [{x:p.x+e,y:p.y+e},{x:p.x+size-e,y:p.y+e},{x:p.x+size-e,y:p.y+size-e},{x:p.x+e,y:p.y+size-e}]).sort((a,b)=>a.x-b.x||a.y-b.y);
  const half = (list: Point[]) => { const out: Point[] = []; for(const p of list){while(out.length>1&&cross(out.at(-2)!,out.at(-1)!,p)<=0)out.pop();out.push(p);}return out; };
  const lower=half(points),upper=half([...points].reverse());lower.pop();upper.pop();const hull=[...lower,...upper];
  let low=0,high=1;
  for(let i=0;i<hull.length;i++){
    const a=hull[i],b=hull[(i+1)%hull.length],c=cross(a,b,obstacle.start),d=cross(a,b,obstacle.end)-c;
    if(Math.abs(d)<1e-10){if(c<0)return false;continue;}
    const t=-c/d;if(d>0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;
  }
  return low<=high;
}
