import { BoardVisionState, VisionProfile } from '../models/vision';
import { emptyBoardVision, assertBoardVision, withoutRemovedObservers, MAX_EXPLORATION_AREAS } from './vision-state';
import { rememberExploration, explorationAreas, explorationRects, mergeExploration } from './vision-exploration';

describe('Memoria de terreno por personaje', () => {
  const grid=51.2,source={kind:'director' as const,reference:'Datos sintéticos de memoria'};
  const token=(id='A',x=2*grid)=>({instanceId:id,actorId:`player:${id}`,x,y:2*grid,size:1,hidden:false,conditions:[]});
  const profiles=new Map<string,VisionProfile>(['A','B'].map(id=>[id,{version:1,senses:[{sense:'normal',rangeFeet:60,source}]}]));
  const state=():BoardVisionState=>({...emptyBoardVision(),enabled:true,obstacles:[],environment:{illumination:'darkness',timeOfDay:'night',weather:'clear',source}});
  it('recuerda pisadas redondas y conserva las antiguas al moverse sin iluminar terreno',()=>{
    const first=rememberExploration(state(),[token()],profiles,[]),moved=rememberExploration(first,[token('A',4*grid)],profiles,[]);
    expect(first.exploration![0].cells).toEqual([]);expect(first.exploration![0].areas).toEqual([{x:128,y:128,radius:25.6}]);
    expect(moved.exploration![0].areas?.map(a=>a.x)).toEqual([128,230.4]);expect(state().exploration).toBeUndefined();
    expect(rememberExploration(moved,[token('A',4*grid)],profiles,[])).toBe(moved);
  });
  it('un foco lejano fuera del alcance no impide recordar la pisada en oscuridad',()=>{
    const value=state();value.effects=[{id:'far',name:'Foco lejano',kind:'light',illumination:'bright',active:true,source,scope:{kind:'circle',x:1400,y:900,radiusFeet:5},duration:{kind:'until-ended'}}];
    const first=rememberExploration(value,[token()],profiles,[]),next=rememberExploration(first,[token('A',4*grid)],profiles,[]);
    const areas=next.exploration![0].areas!;
    expect(areas).toContain(jasmine.objectContaining({x:128,y:128,radius:25.6}));
    expect(areas).toContain(jasmine.objectContaining({x:230.4,y:128,radius:25.6}));
    expect(next.exploration![0].cells).toEqual([]);
  });
  it('conserva curvas, sombras y fog del instante visto sin reconstruirlos al cambiar el entorno',()=>{
    const value=state();value.environment.illumination='bright';
    value.obstacles=[{id:'wall',name:'Pared',kind:'wall',start:{x:3*grid,y:0},end:{x:3*grid,y:1024},blocksSight:true,blocksEffect:true,source}];
    const fog=[{x:grid,y:2*grid,width:grid,height:grid}];const result=rememberExploration(value,[token()],profiles,fog);
    const area=result.exploration![0].areas![0];expect(area.shadows![0][0]).toEqual({x:3*grid,y:0});expect(area.fog).toEqual(fog);
    expect(result.exploration![0].cells).toEqual([]);value.obstacles[0].start.x=900;fog[0].x=700;
    expect(area.shadows![0][0].x).toBe(3*grid);expect(area.fog![0].x).toBe(grid);
    expect(()=>assertBoardVision(JSON.parse(JSON.stringify(result)),new Set(['A']))).not.toThrow();
  });
  it('una pared corta dentro de la pisada recorta su sombra sin revelar la casilla completa',()=>{
    const value=state();value.obstacles=[{id:'wall',name:'Pared corta',kind:'wall',start:{x:107.4,y:120.4},end:{x:112.4,y:120.4},blocksSight:true,blocksEffect:true,source}];
    const memory=rememberExploration(value,[token()],profiles,[]).exploration![0];
    expect(memory.cells).toEqual([]);expect(memory.areas![0].shadows![0].slice(0,2)).toEqual([value.obstacles[0].start,value.obstacles[0].end]);
  });
  it('no registra PNJs, ocultos, datos pendientes, ceguera ni una pisada bajo fog',()=>{
    for(const t of [{...token(),actorId:'npc:A'},{...token(),hidden:true},{...token(),conditions:['blinded']}])expect(rememberExploration(state(),[t],profiles,[]).exploration).toBeUndefined();
    expect(rememberExploration(state(),[token()],new Map(),[]).exploration).toBeUndefined();
    expect(rememberExploration(state(),[token()],profiles,[{x:0,y:0,width:1536,height:1024}]).exploration).toBeUndefined();
  });
  it('une solo los observadores elegidos y conserva las casillas del historial anterior',()=>{
    const legacy={...state(),exploration:[{tokenId:'A',cells:[62]}]};const value=rememberExploration(legacy,[token(),token('B',20*grid)],profiles,[]);
    expect(explorationAreas(value,['A']).map(a=>a.x)).toEqual([128]);expect(explorationAreas(value,['A','B']).length).toBe(2);
    expect(explorationRects(value,['A'])).toEqual([{x:2*grid,y:2*grid,width:grid,height:grid}]);
    expect(withoutRemovedObservers(value,new Set(['A'])).exploration?.map(m=>m.tokenId)).toEqual(['A']);
    expect(mergeExploration(legacy.exploration,value.exploration!,new Set(['A']))[0].areas?.length).toBe(1);
  });
  it('valida máscaras nuevas y antiguas, rechazando coordenadas, recortes o referencias corruptas',()=>{
    expect(()=>assertBoardVision(state(),new Set(['A']))).not.toThrow();const value={...state(),exploration:[{tokenId:'A',cells:[0,599]}]};
    expect(()=>assertBoardVision(value,new Set(['A']))).not.toThrow();
    for(const cells of [[600],[-1],[1.5],[0,0]])expect(()=>assertBoardVision({...value,exploration:[{tokenId:'A',cells}]},new Set(['A']))).toThrow();
    for(const area of [{x:1,y:2,radius:-1},{x:NaN,y:2,radius:3},{x:1,y:2,radius:3,shadows:[[{x:1,y:2}]]},{x:1,y:2,radius:3,clip:{x:1,y:2,radius:Infinity}},{x:1,y:2,radius:3,unknown:true}])expect(()=>assertBoardVision({...value,exploration:[{tokenId:'A',cells:[],areas:[area]}]},new Set(['A']))).toThrow();
    expect(()=>assertBoardVision(value,new Set(['B']))).toThrow();expect(()=>assertBoardVision({...value,exploration:[...value.exploration,...value.exploration]},new Set(['A']))).toThrow();
  });
  it('acepta sin truncar guardados antiguos con más de 2 MiB en casillas históricas',()=>{
    const cells=Array.from({length:600},(_,i)=>i),exploration=Array.from({length:1000},(_,i)=>({tokenId:'legacy-'+i,cells}));
    const value={...state(),exploration},ids=new Set(exploration.map(m=>m.tokenId));
    expect(new TextEncoder().encode(JSON.stringify(exploration)).length).toBeGreaterThan(2*1024*1024);
    expect(()=>assertBoardVision(value,ids)).not.toThrow();
    const result=rememberExploration(value,[token('legacy-0')],new Map([['legacy-0',profiles.get('A')]]),[]);
    expect(()=>assertBoardVision(result,ids)).not.toThrow();
    expect(result.exploration!.slice(0,1000).map(m=>m.cells)).toEqual(exploration.map(m=>m.cells));
    expect(result.exploration!.find(m=>m.tokenId==='legacy-0')!.areas!.length).toBe(1);
  });
  it('al alcanzar el límite conserva la memoria sin truncarla y permite avisar al director',()=>{
    const value={...state(),exploration:[{tokenId:'A',cells:[62],areas:Array.from({length:MAX_EXPLORATION_AREAS},()=>({x:1,y:1,radius:1}))}]};
    const notice=jasmine.createSpy('notice');expect(rememberExploration(value,[token()],profiles,[],grid,notice)).toBe(value);expect(notice).toHaveBeenCalled();expect(value.exploration[0].areas.length).toBe(MAX_EXPLORATION_AREAS);
  });
});
