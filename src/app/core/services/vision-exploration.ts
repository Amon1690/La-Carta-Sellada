import type { BoardVisionState, ExplorationArea, ExplorationMemory, VisionProfile } from '../models/vision';
import { segmentsIntersect } from './vision-engine';
import { PreviewFog, PreviewToken, personalSight } from './vision-preview';
import { isVisionDoor, obstacleShadows, visionCenter } from './vision-geometry';
import { assertExplorationArea, MAX_EXPLORATION_AREAS, MAX_EXPLORATION_BYTES } from './vision-state';
import { canOrientStep } from './token-orientation';

type ActorToken = PreviewToken & { actorId: string };
/** Solo terreno confirmado, nunca posiciones de PNJs ni fotografías de tokens. */
export function rememberExploration(state: BoardVisionState, tokens: readonly ActorToken[],
  profiles: ReadonlyMap<string, VisionProfile | undefined>, fog: readonly PreviewFog[], grid = 51.2,
  onLimit?: () => void): BoardVisionState {
  if (!state.enabled || state.obstacles === undefined) return state;
  const memories=new Map((state.exploration??[]).map(m=>[m.tokenId,{...m,areas:[...(m.areas??[])]}]));
  let count=[...memories.values()].reduce((n,m)=>n+m.areas.length,0);
  let bytes=new TextEncoder().encode(JSON.stringify([...memories.values()].flatMap(m=>m.areas))).length;
  let changed=false;
  for(const token of tokens.filter(t=>!t.hidden&&t.actorId.startsWith('player:'))){
    const memory=memories.get(token.instanceId)??{tokenId:token.instanceId,cells:[],areas:[]};
    const known=new Set(memory.areas.map(a=>JSON.stringify(a)));
    const sight=personalSight(state,tokens,profiles,token.instanceId,grid,1536,1024);
    const context={state,tokens,profiles,observerIds:[token.instanceId],circles:sight.circles,fog,grid};
    const circles=[...sight.circles];
    if(canOrientStep(token.instanceId,token.x,token.y,context)){
      const origin=visionCenter(token,grid);
      if(!state.obstacles.some(o=>o.blocksSight&&!(isVisionDoor(o)&&o.open)&&segmentsIntersect(origin,origin,o.start,o.end)))
        circles.push({id:token.instanceId,...origin,radius:token.size*grid/2,shadows:obstacleShadows(state.obstacles,origin,'blocksSight')});
    }
    for(const circle of circles){
      const disk=(d:{x:number;y:number;radius:number})=>({x:d.x,y:d.y,radius:d.radius});
      const area:ExplorationArea={...disk(circle),...(circle.clip?{clip:disk(circle.clip)}:{}),
        ...(circle.exclude?.length?{exclude:circle.exclude.map(disk)}:{}),
        ...(circle.shadows?.length?{shadows:circle.shadows.map(p=>p.map(v=>({x:v.x,y:v.y})))}:{}),
        ...(fog.length?{fog:fog.filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))}:{})};
      const key=JSON.stringify(area);if(known.has(key)||area.radius<=0)continue;
      const size=new TextEncoder().encode(key).length+1;
      if(count>=MAX_EXPLORATION_AREAS||bytes+size>MAX_EXPLORATION_BYTES){onLimit?.();continue;}
      try{assertExplorationArea(area);}catch{onLimit?.();continue;}
      memory.areas.push(area);known.add(key);count++;bytes+=size;changed=true;
    }
    if(memory.cells.length||memory.areas.length)memories.set(token.instanceId,memory);
  }
  return changed?{...state,exploration:[...memories.values()]}:state;
}

/** Conserva ambos historiales sin redibujar máscaras antiguas con el entorno actual. */
export function mergeExploration(first: readonly ExplorationMemory[], second: readonly ExplorationMemory[], ids: ReadonlySet<string>): ExplorationMemory[] {
  const memories=new Map<string,ExplorationMemory>();
  for(const memory of [...first,...second]){
    if(!ids.has(memory.tokenId))continue;
    const previous=memories.get(memory.tokenId),areas=new Map([...(previous?.areas??[]),...(memory.areas??[])].map(a=>[JSON.stringify(a),a]));
    memories.set(memory.tokenId,{tokenId:memory.tokenId,cells:[...new Set([...(previous?.cells??[]),...memory.cells])].sort((a,b)=>a-b),
      ...(areas.size?{areas:[...areas.values()]}:{})});
  }
  return [...memories.values()];
}

export function explorationAreas(state: BoardVisionState, observerIds: readonly string[]): ExplorationArea[] {
  if(!state.enabled)return [];
  return [...new Map((state.exploration??[]).filter(m=>observerIds.includes(m.tokenId)).flatMap(m=>m.areas??[]).map(a=>[JSON.stringify(a),a])).values()];
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
