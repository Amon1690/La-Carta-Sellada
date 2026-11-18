import { Combatant } from '../models/combat';
import { VisionObstacle } from '../models/vision';
import { movementProfile, movementRoutes } from './combat-movement';
import { VttCombat, validState } from './vtt-combat';
const grid=51.2;
function hero(id='a',x=0): Combatant {
 return {id,actorId:'player:'+id,name:id,x,y:0,size:1,hp:20,maxHp:20,armorClass:12,saves:{strength:0,dexterity:0,constitution:0,intelligence:0,wisdom:0,charisma:0},actions:[],reactions:[],resources:[],attacksPerTurn:2,notes:[],profile:{actions:[],reactions:[],resources:[]},movement:{speed:9,bonusDash:true,bonusDisengage:true}};
}
function wall(kind: VisionObstacle['kind']='wall',open=false): VisionObstacle{return{id:'w',name:'Obstáculo',kind,start:{x:grid,y:0},end:{x:grid,y:1024},blocksSight:kind==='wall',blocksEffect:true,open:kind==='door'||kind==='door-window'?open:undefined,source:{kind:'director',reference:'Prueba'}};}
describe('Movimiento por turno y rutas',()=>{
 let actor: Combatant, engine: VttCombat, active: string, saved: unknown;
 beforeEach(()=>{actor=hero();active=actor.id;engine=new VttCombat(()=>[actor],()=>active,()=>{saved=structuredClone(engine.serialized());},()=>{});engine.start(active);});
 it('gasta el recorrido, conserva el movimiento al restaurar y renueva solo al cambiar de turno',()=>{
  engine.spendMovement('a',3);expect(engine.movementStatus('a').remaining).toBe(6);
  engine.restore(saved);expect(engine.movementStatus('a').remaining).toBe(6);engine.turn('a');expect(engine.movementStatus('a').remaining).toBe(6);
  engine.spendMovement('a',6);expect(()=>engine.spendMovement('a',1.5)).toThrow();expect(engine.canAttack('a')).toBeTrue();
  engine.turn('a',true);expect(engine.movementStatus('a').remaining).toBe(9);
 });
 it('Correr con acción y adicional suma dos velocidades, una vez por recurso',()=>{
  engine.spendMovement('a',3);engine.takeTurnAction('a','dash');expect(engine.movementStatus('a').remaining).toBe(15);expect(engine.canAttack('a')).toBeFalse();
  engine.takeTurnAction('a','bonus-dash');expect(engine.movementStatus('a').remaining).toBe(24);expect(()=>engine.takeTurnAction('a','bonus-dash')).toThrow();expect(validState(engine.serialized())).toBeTrue();
 });
 it('Correr adicional conserva el ataque, sin conceder dos acciones adicionales',()=>{
  engine.takeTurnAction('a','bonus-dash');expect(engine.canAttack('a')).toBeTrue();expect(engine.canTurnAction('a','bonus-disengage')).toBeFalse();
  engine.state.update(s=>({...s,usedAttacks:1,movement:{...s.movement!,action:'attack'}}));expect(engine.canTurnAction('a','dash')).toBeFalse();expect(engine.canAttack('a')).toBeTrue();
 });
 it('Destrabarse no suma distancia y usa la acción correspondiente',()=>{
  engine.takeTurnAction('a','bonus-disengage');expect(engine.movementStatus('a').remaining).toBe(9);expect(engine.state().movement?.disengaged).toBeTrue();
  expect(engine.canAttack('a')).toBeTrue();engine.turn('a',true);expect(engine.state().movement?.disengaged).toBeFalse();
 });
 it('los turnos antiguos no reciben movimiento retroactivo y los datos inválidos se conservan',()=>{
  const old={...engine.state()};delete old.movement;engine.restore(old);expect(engine.movementStatus('a').remaining).toBeUndefined();expect(()=>engine.spendMovement('a',1.5)).toThrow();
  engine.turn('a',true);expect(engine.movementStatus('a').remaining).toBe(9);
  const bad={...engine.state(),movement:{spent:-1,dashes:0,disengaged:false}};engine.restore(bad);expect(engine.serialized()).toEqual(bad);expect(engine.busy()).toBeTrue();
 });
 it('restringido tiene velocidad cero; incapacitado conserva movimiento pero no acciones',()=>{
  actor.conditions=['restrained'];expect(engine.movementStatus('a').remaining).toBe(0);expect(engine.canTurnAction('a','dash')).toBeFalse();
  actor.conditions=['incapacitated'];expect(engine.movementStatus('a').remaining).toBe(9);engine.spendMovement('a',1.5);expect(engine.canTurnAction('a','dash')).toBeFalse();expect(engine.canAttack('a')).toBeFalse();
 });
 it('levantarse gasta media velocidad y exige movimiento suficiente',()=>{
  actor.conditions=['prone'];engine.takeTurnAction('a','stand');actor.conditions=[];expect(engine.movementStatus('a').remaining).toBe(4.5);expect(engine.canAttack('a')).toBeTrue();
  engine.spendMovement('a',3);actor.conditions=['prone'];expect(engine.canTurnAction('a','stand')).toBeFalse();
 });
 it('no inventa velocidad ni rasgos por el nombre del personaje',()=>{
  expect(movementProfile(undefined).speed).toBeUndefined();expect(movementProfile({speed:'9 m, volar 18 m'} as any).speed).toBeUndefined();
  expect(movementProfile({speed:'7,5 m',build:{version:1,classId:'picaro',level:2}} as any)).toEqual({speed:7.5,bonusDash:true,bonusDisengage:true});
  expect(movementProfile({speed:'9 m',build:{version:1,classId:'picaro',level:1}} as any).bonusDash).toBeFalse();
 });
 it('un destino diagonal exige dos pasos ortogonales y arrastrarse aumenta el coste',()=>{
  const routes=movementRoutes(actor,[actor],[],[1,31,32],4.5);expect(routes.find(r=>r.cell===31)?.path).toEqual([1,31]);expect(routes.find(r=>r.cell===31)?.cost).toBe(3);expect(routes.find(r=>r.cell===32)?.cost).toBe(4.5);
  actor.conditions=['prone'];expect(movementRoutes(actor,[actor],[],[1,2],3).map(r=>r.cell)).toEqual([1]);
 });
 it('prefiere rutas rectas horizontales y verticales cuando tienen el mismo coste que un zigzag',()=>{
  const centered={...actor,x:10*grid,y:10*grid},allowed=Array.from({length:600},(_,i)=>i),routes=movementRoutes(centered,[centered],[],allowed,9),start=310;
  for(const step of [-1,1,-30,30])for(const count of [2,3,6]){
    const route=routes.find(r=>r.cell===start+step*count)!;expect(route.path).withContext('dirección '+step+', pasos '+count).toEqual(Array.from({length:count},(_,i)=>start+step*(i+1)));expect(route.cost).toBe(count*1.5);
  }
 });
 it('solo admite cuatro pasos vecinos y nunca añade segmentos diagonales',()=>{
  const centered={...actor,x:10*grid,y:10*grid},allowed=Array.from({length:600},(_,i)=>i),routes=movementRoutes(centered,[centered],[],allowed,1.5);
  expect(routes.map(r=>r.cell).sort((a,b)=>a-b)).toEqual([280,309,311,340]);
  const diagonal=movementRoutes(centered,[centered],[],allowed,6).find(r=>r.cell===372)!;expect(diagonal.path.length).toBe(4);expect(diagonal.cost).toBe(6);
  let previous=310;for(const cell of diagonal.path){expect(Math.abs(cell%30-previous%30)+Math.abs(Math.floor(cell/30)-Math.floor(previous/30))).toBe(1);previous=cell;}
 });
 it('rodea un obstáculo cuando la línea recta está bloqueada y permite pasillos rectos',()=>{
  const centered={...actor,x:10*grid,y:10*grid},allowed=Array.from({length:600},(_,i)=>i),obstacle={...wall(),start:{x:11*grid,y:10*grid},end:{x:11*grid,y:11*grid}};
  const route=movementRoutes(centered,[centered],[obstacle],allowed,9).find(r=>r.cell===312)!;expect(route.cost).toBeGreaterThan(3);expect(route.path.some(cell=>Math.floor(cell/30)!==10)).toBeTrue();
  expect(movementRoutes(centered,[centered],[],[311,312],3)).toEqual([{cell:311,path:[311],cost:1.5},{cell:312,path:[311,312],cost:3}]);
 });
 it('prioriza gastar menos movimiento aunque el trazado geométrico sea más largo',()=>{
  const centered={...actor,x:10*grid,y:10*grid,side:'party' as const},others=[11,12,13].map(x=>({...hero('b'+x,x*grid),y:10*grid,actorId:'generic:b'+x,side:'enemy' as const,conditions:['incapacitated' as const]}));
  const route=movementRoutes(centered,[centered,...others],[],Array.from({length:600},(_,i)=>i),9).find(r=>r.cell===314)!;
  expect(route.cost).toBe(9);expect(route.path.length).toBe(6);for(const cell of [311,312,313])expect(route.path).not.toContain(cell);
 });
 it('paredes, ventanas y puertas cerradas bloquean toda la huella; las abiertas permiten pasar',()=>{
  for(const kind of ['wall','window','door','door-window'] as const)expect(movementRoutes(actor,[actor],[wall(kind)],[1],9)).toEqual([]);
  expect(movementRoutes(actor,[actor],[wall('door',true)],[1],9).map(r=>r.cell)).toEqual([1]);
  expect(movementRoutes(actor,[actor],undefined,[1],9)).toEqual([]);
 });
 it('permite atravesar aliados sin detenerse en ellos y bloquea enemigos',()=>{
  const other=hero('b',grid);expect(movementRoutes(actor,[actor,other],[],[1,2],3)).toEqual([{cell:2,path:[1,2],cost:3}]);
  other.actorId='generic:b';expect(movementRoutes(actor,[actor,other],[],[1,2],9)).toEqual([]);
  other.conditions=['incapacitated'];expect(movementRoutes(actor,[actor,other],[],[1,2],4.5)).toEqual([{cell:2,path:[1,2],cost:4.5}]);
 });
 it('un bando enemigo explícito prevalece aunque ambos sean personajes de jugador',()=>{
  const other=hero('b',grid);actor.side='party';other.side='enemy';expect(movementRoutes(actor,[actor,other],[],[1,2],9)).toEqual([]);
 });
 it('no publica el movimiento gastado por otra criatura en la vista de este personaje',()=>{
  engine.spendMovement('a',3);const other=hero('b');engine=new VttCombat(()=>[actor,other],()=>active,()=>{},()=>{});engine.start('a');engine.spendMovement('a',3);
  expect(engine.movementStatus('b').spent).toBe(0);expect(engine.movementStatus('b').remaining).toBe(0);expect(engine.movementStatus('b').options).toEqual([]);
 });
 it('rodea la esquina con dos pasos ortogonales sin atravesar la pared',()=>{
  const w=wall();w.end.y=grid;expect(movementRoutes(actor,[actor],[w],[1,30,31],3).find(r=>r.cell===31)).toEqual({cell:31,path:[30,31],cost:3});
 });
 it('marca todas las casillas libres que caben en el presupuesto ortogonal',()=>{
  const centered={...actor,x:2*grid,y:5*grid},allowed=Array.from({length:600},(_,i)=>i),routes=movementRoutes(centered,[centered],[],allowed,9);
  const expected=allowed.filter(c=>c!==152&&Math.abs(c%30-2)+Math.abs(Math.floor(c/30)-5)<=6).sort((a,b)=>a-b);
  expect(routes.map(r=>r.cell).sort((a,b)=>a-b)).toEqual(expected);expect(routes.find(r=>r.cell===157)?.cost).toBe(7.5);
  expect(movementRoutes(centered,[centered],[],allowed,18).find(r=>r.cell===188)?.cost).toBe(10.5);
 });
});
