import type { CombatAction, Combatant } from '../models/combat';

export interface AreaPoint { x: number; y: number; }
export const AREA_GRID = 51.2;
export const METRES_PER_CELL = 1.5;
export function validArea(value: unknown): value is { radius: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const a = value as Record<string, unknown>;
  return Object.keys(a).length === 1 && typeof a['radius'] === 'number' && Number.isFinite(a['radius']) && a['radius'] > 0 && a['radius'] <= 10000;
}
export function validAreaPoint(value: unknown): value is AreaPoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as AreaPoint;
  return Object.keys(p).length === 2 && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1536 && p.y >= 0 && p.y <= 1024;
}
/** Solo una esfera con radio explícito en la descripción, nunca por el nombre. null desactiva la sugerencia. */
export function withCircularArea(action: CombatAction): CombatAction {
  if (action.area !== undefined) return action;
  const match = /\besfera\s+de\s+(\d+(?:[.,]\d+)?)\s*(m\b|metros?|pies|feet|ft\b)\s+de\s+radio/i.exec(action.notes);
  if (!match) return action;
  const radius = Number(match[1].replace(',', '.')) * (/pies|feet|ft/i.test(match[2]) ? 0.3 : 1);
  return validArea({ radius }) ? { ...action, area: { radius } } : action;
}
export const areaRadiusPixels = (radius: number, grid = AREA_GRID): number => radius / METRES_PER_CELL * grid;
export const tokenCentre = (t: Pick<Combatant, 'x' | 'y' | 'size'>, grid = AREA_GRID): AreaPoint => ({ x: t.x + t.size * grid / 2, y: t.y + t.size * grid / 2 });
export function originDistance(actor: Pick<Combatant, 'x' | 'y' | 'size'>, origin: AreaPoint, grid = AREA_GRID): number {
  const centre = tokenCentre(actor, grid);
  return Math.max(0, Math.max(Math.abs(origin.x-centre.x), Math.abs(origin.y-centre.y)) / grid - (actor.size-1)/2) * METRES_PER_CELL;
}
/** Intersección círculo/espacio ocupado; incluye fichas grandes, aliados y el propio lanzador. */
export function tokensInArea<T extends Pick<Combatant, 'x' | 'y' | 'size'>>(tokens: readonly T[], origin: AreaPoint, radius: number, grid = AREA_GRID): T[] {
  if (!validAreaPoint(origin) || !validArea({ radius }) || !Number.isFinite(grid) || grid <= 0) return [];
  const r = areaRadiusPixels(radius, grid);
  return tokens.filter(t => Math.hypot(Math.max(t.x-origin.x, 0, origin.x-t.x-t.size*grid), Math.max(t.y-origin.y, 0, origin.y-t.y-t.size*grid)) < r - 1e-7);
}

/** Decide si queda una porción del espacio dentro del círculo y fuera de sombras convexas. */
export function areaReachesToken(token: Pick<Combatant,'x'|'y'|'size'>, origin: AreaPoint, radius: number, shadows: readonly AreaPoint[][], grid=AREA_GRID): boolean {
  const r=areaRadiusPixels(radius,grid),left=Math.max(token.x,origin.x-r),right=Math.min(token.x+token.size*grid,origin.x+r),top=token.y,bottom=top+token.size*grid;
  if(right<=left)return false;
  const cuts=[left,right],add=(x:number)=>{if(x>left&&x<right)cuts.push(x);};
  const edges=shadows.flatMap(p=>p.map((a,i)=>[a,p[(i+1)%p.length]]));
  for(const[a,b]of edges){
    add(a.x);add(b.x);const dx=b.x-a.x,dy=b.y-a.y;
    if(dy)for(const y of[top,bottom]){const t=(y-a.y)/dy;if(t>=0&&t<=1)add(a.x+t*dx);}
    const px=a.x-origin.x,py=a.y-origin.y,aa=dx*dx+dy*dy,bb=2*(px*dx+py*dy),disc=bb*bb-4*aa*(px*px+py*py-r*r);
    if(aa&&disc>=0)for(const t of[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>=0&&t<=1)add(a.x+t*dx);
  }
  for(const y of[top,bottom]){const square=r*r-(y-origin.y)**2;if(square>=0){add(origin.x-Math.sqrt(square));add(origin.x+Math.sqrt(square));}}
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const[a,b]=edges[i],[c,d]=edges[j],dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,cross=dx*ey-dy*ex;if(!cross)continue;
    const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/cross,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/cross;if(t>=0&&t<=1&&u>=0&&u<=1)add(a.x+t*dx);
  }
  const xs=[...new Set(cuts)].sort((a,b)=>a-b);
  return xs.slice(1).some((end,i)=>{
    const x=(xs[i]+end)/2,square=r*r-(x-origin.x)**2;if(square<=0)return false;
    const dy=Math.sqrt(square);let intervals=[[Math.max(top,origin.y-dy),Math.min(bottom,origin.y+dy)]];
    for(const p of shadows){const ys=p.flatMap((a,i)=>{const b=p[(i+1)%p.length];return x<Math.min(a.x,b.x)||x>Math.max(a.x,b.x)?[]:a.x===b.x?[a.y,b.y]:[a.y+(x-a.x)/(b.x-a.x)*(b.y-a.y)];});if(ys.length<2)continue;
      const low=Math.min(...ys),high=Math.max(...ys);intervals=intervals.flatMap(([a,b])=>high<a||low>b?[[a,b]]:[[a,Math.min(b,low)],[Math.max(a,high),b]].filter(([a,b])=>b-a>1e-7));
    }
    return intervals.some(([a,b])=>b-a>1e-7);
  });
}
