import { GENERIC_NPCS } from '../data/generic-npcs';
import type { Combatant } from '../models/combat';
import { basicUnarmedStrike, deriveCombat } from './combat-rules';
import { attackSituation, normalAttackFacts } from './attack-situation';
import { movementPath } from './combat-movement';
import { validState, VttCombat } from './vtt-combat';
const grid=51.2, cells=Array.from({length:600},(_,i)=>i);
const stats=()=>({...structuredClone(GENERIC_NPCS[0]),features:[],abilities:{...GENERIC_NPCS[0].abilities,strength:16},proficiencyBonus:2,speed:'9 m'});
const facts={restrained:false,advantage:false,disadvantage:false};
const review=()=>({ownerSize:'medium' as const,targetSize:'medium' as const,freeHand:true});
function actor(id:string,x:number):Combatant{return {...deriveCombat(stats()),id,actorId:'player:'+id,name:id,x,y:0,size:1,hp:20,maxHp:20,armorClass:12,conditions:[],unarmed:basicUnarmedStrike(stats())};}
describe('Decisiones sin armas persistentes en motor privado',()=>{
 let roster:Combatant[],engine:VttCombat,saved:unknown,die:jasmine.Spy,saveFailure:boolean;
 const window=()=>engine.state().route!.window!.id;
 function make(includeEffects=true):VttCombat{const e=new VttCombat(()=>roster,()=> 'target',(hp)=>{if(saveFailure)throw new Error('No se pudo guardar');if(hp)roster=roster.map(actor=>actor.id===hp.id?{...actor,hp:hp.hp}:actor);saved=structuredClone(e.serialized());},()=>{},die,()=>({visible:true,lineOfEffect:true,perception:'normal',reasons:[]}),undefined,undefined,undefined,{
  path:(a,p)=>movementPath(a,roster,[],p,cells),move:(id,to)=>{const before=roster;roster=roster.map(a=>a.id===id?{...a,...to}:a);return()=>{roster=before;};},canStop:()=>true,unarmed:includeEffects?(decision,to)=>{const before=roster;roster=roster.map(actor=>actor.id!==decision.targetId?actor:decision.effect==='prone'?{...actor,conditions:[...(actor.conditions??[]),'prone']}:{...actor,...to!});return()=>{roster=before;};}:undefined,
 });return e;}
 beforeEach(()=>{roster=[actor('owner',0),actor('target',grid)];die=jasmine.createSpy().and.returnValue(10);saveFailure=false;engine=make();engine.start('target');engine.planMove([2]);expect(engine.continueMove()).toBe('window');});
 const declare=()=>engine.declareUnarmedOpportunity('owner','grapple',stats(),review(),window());
 it('declarar gasta una reacción, conserva acción/movimiento y no tira dados',()=>{
  declare();expect(engine.state().reactionUsed).toEqual(['owner']);expect(engine.state().route?.window?.handled).toEqual(['owner']);
  expect(engine.state().unarmed?.dc).toBe(13);expect(engine.state().movement?.spent).toBe(0);expect(engine.state().usedAttacks).toBe(0);expect(die).not.toHaveBeenCalled();expect(validState(engine.serialized())).toBeTrue();
  expect(()=>declare()).toThrow();expect(()=>engine.continueMove()).toThrow();expect(()=>engine.cancelMove()).toThrow();expect(()=>engine.turn('owner')).toThrow();
 });
 it('guarda elección y dado antes de efectos; restaurar nunca vuelve a tirar',()=>{
  roster[1].armorClass=undefined;declare();engine.rollUnarmedOpportunity('dexterity',3,facts);expect(engine.state().unarmed?.save?.ability).toBe('dexterity');expect(engine.state().unarmed?.save?.success).toBeTrue();
  const snapshot=structuredClone(saved);die.calls.reset();engine=make();engine.restore(snapshot);expect(engine.error()).toBe('');expect(engine.state().unarmed?.save?.roll.dice).toEqual([10]);expect(die).not.toHaveBeenCalled();
  expect(()=>engine.rollUnarmedOpportunity('strength',5,facts)).toThrow();expect(die).not.toHaveBeenCalled();expect(roster[1].hp).toBe(20);
 });
 it('cancelar es explícito y conserva la reacción y el gasto anterior',()=>{
  declare();engine.cancelUnarmedOpportunity();expect(engine.state().unarmed).toBeUndefined();expect(engine.state().reactionUsed).toEqual(['owner']);expect(engine.state().route?.window?.handled).toEqual(['owner']);
  expect(engine.continueMove()).toBe('complete');expect(engine.state().movement?.spent).toBe(1.5);expect(roster[1].x).toBe(grid*2);expect(engine.state().reactionUsed).toEqual(['owner']);
 });
 it('rechaza ventana vieja, tamaño/mano sin confirmar o estadísticas distintas antes de gastar',()=>{
  expect(()=>engine.declareUnarmedOpportunity('owner','grapple',stats(),review(),'old')).toThrow();
  expect(()=>engine.declareUnarmedOpportunity('owner','grapple',stats(),{...review(),freeHand:false},window())).toThrow();
  const changed=stats();changed.abilities.strength=18;expect(()=>engine.declareUnarmedOpportunity('owner','push',changed,review(),window())).toThrow();
  expect(engine.state().reactionUsed).toEqual([]);expect(engine.state().unarmed).toBeUndefined();expect(die).not.toHaveBeenCalled();
 });
 it('un actor sin estadísticas básicas o PG confirmados no obtiene una declaración',()=>{
  roster[0].unarmed=undefined;expect(()=>declare()).toThrow();roster[0].unarmed=basicUnarmedStrike(stats());
  roster[0].hp=NaN;expect(()=>declare()).toThrow();expect(engine.state().reactionUsed).toEqual([]);expect(die).not.toHaveBeenCalled();
 });
 it('cambios de posición o estado impiden tirar y siempre dejan cancelar sin reembolso',()=>{
  declare();roster[0].conditions=['incapacitated'];expect(()=>engine.rollUnarmedOpportunity('strength',0,facts)).toThrow();roster[0].conditions=[];
  roster[1].x=grid;roster[1].y=grid;expect(()=>engine.rollUnarmedOpportunity('strength',0,facts)).toThrow();expect(die).not.toHaveBeenCalled();
  engine.cancelUnarmedOpportunity();expect(engine.state().reactionUsed).toEqual(['owner']);
 });
 it('si el reactor cambia de posición y el destino sigue a su alcance no se tira la salvación',()=>{
  declare();roster[0].x=grid;expect(()=>engine.rollUnarmedOpportunity('strength',0,facts)).toThrow();expect(die).not.toHaveBeenCalled();
  expect(engine.state().unarmed?.save).toBeUndefined();expect(engine.state().reactionUsed).toEqual(['owner']);engine.cancelUnarmedOpportunity();expect(engine.state().unarmed).toBeUndefined();
 });
 it('los vínculos persisten al terminar e iniciar combate y solo reset los borra explícitamente',()=>{
  const state=structuredClone(engine.state()),active={id:'active',ownerId:'owner',targetId:'target',range:1.5,escapeDc:13},ended={...active,id:'ended',ended:true};
  engine.restore({...state,route:undefined,grapples:[active,ended]});engine.end();expect(engine.state().grapples).toEqual([active,ended]);
  engine.start('target');expect(engine.state().grapples).toEqual([active,ended]);expect(validState(engine.serialized())).toBeTrue();engine.reset();expect(engine.state().grapples).toBeUndefined();
 });
 it('no declara con posición o huella desconocidas de ninguno de los participantes',()=>{
  for(const index of [0,1])for(const key of ['x','y','size'] as const){
   const previous=roster[index][key];
   for(const value of [null,undefined,NaN,Infinity,'0',...(key==='size'?[0,-1]:[])]){roster[index][key]=value as unknown as number;expect(()=>declare()).toThrow();expect(engine.state().reactionUsed).toEqual([]);}
   roster[index][key]=previous;
  }
  expect(die).not.toHaveBeenCalled();expect(engine.state().unarmed).toBeUndefined();
 });
 it('geometría desconocida al revalidar no tira ni pierde la decisión guardada',()=>{
  declare();const decision=structuredClone(engine.state().unarmed);
  for(const index of [0,1])for(const key of ['x','y','size'] as const){
   const previous=roster[index][key];
   for(const value of [null,undefined,NaN,Infinity,'0',...(key==='size'?[0,-1]:[])]){roster[index][key]=value as unknown as number;expect(()=>engine.rollUnarmedOpportunity('strength',0,facts)).toThrow();expect(engine.state().unarmed).toEqual(decision);}
   roster[index][key]=previous;
  }
  expect(die).not.toHaveBeenCalled();expect(engine.state().reactionUsed).toEqual(['owner']);engine.cancelUnarmedOpportunity();expect(engine.state().unarmed).toBeUndefined();
 });
 it('la restricción conocida no puede omitirse al confirmar la salvación',()=>{
  declare();roster[1].conditions=['restrained'];expect(()=>engine.rollUnarmedOpportunity('dexterity',0,facts)).toThrow();expect(die).not.toHaveBeenCalled();
  engine.rollUnarmedOpportunity('dexterity',0,{...facts,restrained:true});expect(engine.state().unarmed?.save?.roll.dice).toEqual([10,10]);
 });
 it('aplicar un agarre fallado detiene la velocidad real y la liberación devuelve solo movimiento no gastado',()=>{
  declare();engine.rollUnarmedOpportunity('strength',0,facts);engine.finishUnarmedGrapple(true);const link=engine.state().grapples![0];
  expect(engine.state().unarmed).toBeUndefined();expect(engine.find('target')?.movement?.speed).toBe(0);expect(engine.movementStatus('target').remaining).toBe(0);
  expect(()=>engine.continueMove()).toThrow();expect(engine.state().movement?.spent).toBe(0);engine.releaseGrapple(link.id);
  expect(engine.state().grapples?.[0].ended).toBeTrue();expect(engine.continueMove()).toBe('complete');expect(engine.state().movement?.spent).toBe(1.5);expect(engine.state().reactionUsed).toEqual(['owner']);
 });
 it('una salvación superada no crea agarre ni repite dados al confirmar el efecto',()=>{
  declare();die.and.returnValue(20);engine.rollUnarmedOpportunity('dexterity',0,facts);const rolls=die.calls.count();
  expect(()=>engine.finishUnarmedGrapple(false)).toThrow();expect(engine.state().unarmed).toBeDefined();engine.finishUnarmedGrapple(true);
  expect(engine.state().grapples).toBeUndefined();expect(die.calls.count()).toBe(rolls);expect(engine.continueMove()).toBe('complete');
 });
 it('el motor proyecta la desventaja contra otros y permite atacar al agarrador con normalidad',()=>{
  declare();engine.rollUnarmedOpportunity('strength',0,facts);engine.finishUnarmedGrapple(true);engine.cancelMove();
  const target=engine.find('target')!,owner=engine.find('owner')!,other={...owner,id:'other'};const action=target.unarmed!,confirmed={...normalAttackFacts(),reviewed:true};
  expect(engine.canAttack('target')).toBeTrue();expect(attackSituation(target,owner,action,engine.combatants(),confirmed,engine.sight).context.disadvantage).toBeFalse();
  expect(attackSituation(target,other,action,[...engine.combatants(),other],confirmed,engine.sight).context.disadvantage).toBeTrue();expect(roster[1].movement?.speed).toBe(9);
 });
 it('el fin confirmado por desplazamiento o PG0 se guarda y no revive al volver o curarse',()=>{
  declare();engine.rollUnarmedOpportunity('strength',0,facts);engine.finishUnarmedGrapple(true);engine.cancelMove();const link=engine.state().grapples![0];
  roster[0].x=grid*4;engine.reconcileGrapples();expect(engine.state().grapples![0].ended).toBeTrue();roster[0].x=0;expect(engine.find('target')?.movement?.speed).toBe(9);
  engine.restore({...engine.state(),grapples:[{...link,ended:false}]});engine.reconcileGrapples({id:'owner',hp:0});expect(engine.state().grapples![0].ended).toBeTrue();roster[0].hp=20;expect(engine.find('target')?.movement?.speed).toBe(9);
 });
 it('aplicar daño real al agarrador guarda el fin antes de persistir y no lo revive al curarse',()=>{
  declare();engine.rollUnarmedOpportunity('strength',0,facts);engine.finishUnarmedGrapple(true);engine.cancelMove();
  roster[0].hp=1;roster[1].actions=[{...roster[1].unarmed!,damage:[{dice:'4',type:'contundente',critical:false}]}];
  engine.begin(roster[1].actions[0].source,['owner'],{advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true});engine.finish(true);
  expect(roster[0].hp).toBe(0);expect(engine.state().grapples![0].ended).toBeTrue();expect((saved as ReturnType<typeof engine.state>).grapples![0].ended).toBeTrue();
  roster[0].hp=20;expect(engine.find('target')?.movement?.speed).toBe(9);expect(roster[1].movement?.speed).toBe(9);
 });
 it('un agarre de origen desconocido se conserva y bloquea automatización hasta revisión explícita',()=>{
  const state=structuredClone(engine.state());engine.restore({...state,route:undefined,grapples:[{id:'unknown',ownerId:'missing',targetId:'target',range:1.5,escapeDc:13}]});
  expect(engine.find('target')?.grappleUncertain).toBeTrue();expect(engine.movementStatus('target').remaining).toBeUndefined();expect(engine.canAttack('target')).toBeFalse();
  expect(engine.state().grapples![0].ended).toBeUndefined();engine.releaseGrapple('unknown');expect(engine.find('target')?.grappleUncertain).toBeUndefined();expect(engine.canAttack('target')).toBeTrue();
 });
 it('un reactor con agarre desconocido resuelve la duda antes de gastar su reacción',()=>{
  const state=structuredClone(engine.state());engine.restore({...state,grapples:[{id:'unknown-owner',ownerId:'missing',targetId:'owner',range:1.5,escapeDc:13}]});
  const candidate=engine.routeOpportunities().find(c=>c.reactorId==='owner')!;expect(candidate.doubts.length).toBeGreaterThan(0);expect(candidate.attacks.find(a=>a.action.source==='rule:basic-unarmed-2024')?.problem).toBeDefined();
  expect(()=>engine.beginOpportunity('owner','rule:basic-unarmed-2024','target',{x:grid*2,y:0},'speed',{},window())).toThrow();expect(()=>declare()).toThrow();expect(engine.state().reactionUsed).toEqual([]);expect(die).not.toHaveBeenCalled();
  engine.releaseGrapple('unknown-owner');expect(engine.routeOpportunities().find(c=>c.reactorId==='owner')?.attacks.find(a=>a.action.source==='rule:basic-unarmed-2024')?.problem).toBeUndefined();
 });
 it('un agarre desconocido bloquea contraataques antes de gastar pero permite defensas sin ataque',()=>{
  engine.cancelMove();roster[0].actions=[roster[0].unarmed!];roster[1].actions=[roster[1].unarmed!];
  roster[0].reactions=[{source:'counter',name:'Respuesta de prueba',trigger:'hit',protectOthers:false,range:1.5,meleeOnly:true,effect:'counter',amount:0,dice:'',duration:'attack',actionSource:roster[0].actions[0].source,resourceConfirmed:true,reviewed:true},{source:'shield',name:'Defensa de prueba',trigger:'hit',protectOthers:false,range:1.5,meleeOnly:true,effect:'armor',amount:5,dice:'',duration:'attack',resourceConfirmed:true,reviewed:true}];
  engine.restore({...engine.state(),grapples:[{id:'unknown-owner',ownerId:'missing',targetId:'owner',range:1.5,escapeDc:13}]});
  engine.begin(roster[1].actions[0].source,['owner'],{advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true});const rolls=die.calls.count();
  expect(engine.reactions().find(c=>c.reaction.source==='counter')?.problem).toBeDefined();expect(()=>engine.useReaction('owner','counter')).toThrow();expect(engine.state().reactionUsed).toEqual([]);expect(die.calls.count()).toBe(rolls);
  expect(engine.reactions().find(c=>c.reaction.source==='shield')?.problem).toBeUndefined();engine.useReaction('owner','shield');expect(engine.state().reactionUsed).toEqual(['owner']);expect(engine.state().queue).toEqual([]);
 });
 it('alcanzar la capacidad de vínculos conserva la salvación y no genera un snapshot inválido',()=>{
  const history=Array.from({length:500},(_,i)=>({id:'history-'+i,ownerId:'old-owner',targetId:'old-target',range:1.5,escapeDc:13,ended:true}));
  engine.restore({...engine.state(),grapples:history});declare();engine.rollUnarmedOpportunity('strength',0,facts);const before=structuredClone(engine.serialized()),rolls=die.calls.count();
  expect(()=>engine.finishUnarmedGrapple(true)).toThrow();expect(engine.serialized()).toEqual(before);expect(die.calls.count()).toBe(rolls);expect(validState(engine.serialized())).toBeTrue();expect(engine.state().grapples?.length).toBe(500);
 });
 it('derribar cambia la condición y obliga a revisar el coste del recorrido sin anticipar movimiento',()=>{
  engine.declareUnarmedOpportunity('owner','prone',stats(),review(),window());engine.rollUnarmedOpportunity('dexterity',0,facts);engine.finishUnarmedOpportunity(true);
  expect(roster[1].conditions).toContain('prone');expect(engine.state().movement?.spent).toBe(0);expect(engine.state().route).toBeDefined();expect(()=>engine.continueMove()).toThrow();
  engine.cancelMove();engine.planMove([2]);expect(engine.continueMove()).toBe('complete');expect(engine.state().movement?.spent).toBe(3);expect(engine.state().reactionUsed).toEqual(['owner']);
 });
 it('empujar desplaza un paso sin gastar velocidad, repetir reacción o conservar una ruta de origen distinto',()=>{
  engine.declareUnarmedOpportunity('owner','push',stats(),review(),window());engine.rollUnarmedOpportunity('strength',0,facts);const rolls=die.calls.count();engine.finishUnarmedOpportunity(true,{x:grid*2,y:0});
  expect(roster[1].x).toBe(grid*2);expect(roster[1].hp).toBe(20);expect(engine.state().movement?.spent).toBe(0);expect(engine.state().route).toBeUndefined();expect(engine.state().reactionUsed).toEqual(['owner']);expect(die.calls.count()).toBe(rolls);
  const snapshot=structuredClone(saved);engine=make();engine.restore(snapshot);expect(()=>engine.finishUnarmedOpportunity(true,{x:grid*3,y:0})).toThrow();expect(roster[1].x).toBe(grid*2);expect(engine.state().movement?.spent).toBe(0);
 });
 it('rechaza dirección que no aleje, diagonal, salto o destino desconocido conservando la tirada',()=>{
  engine.declareUnarmedOpportunity('owner','push',stats(),review(),window());engine.rollUnarmedOpportunity('strength',0,facts);const snapshot=structuredClone(engine.serialized());
  for(const to of [undefined,{x:0,y:0},{x:grid,y:grid},{x:grid*2,y:grid},{x:grid*3,y:0},{x:NaN,y:0}])expect(()=>engine.finishUnarmedOpportunity(true,to)).toThrow();
  expect(engine.serialized()).toEqual(snapshot);expect(roster[1].x).toBe(grid);
 });
 it('una salvación superada de empujón no requiere destino ni aplicación de efectos',()=>{
  engine.declareUnarmedOpportunity('owner','push',stats(),review(),window());die.and.returnValue(20);engine.rollUnarmedOpportunity('strength',0,facts);engine.finishUnarmedOpportunity(true);
  expect(roster[1].x).toBe(grid);expect(engine.state().route).toBeDefined();expect(engine.state().unarmed).toBeUndefined();expect(engine.continueMove()).toBe('complete');expect(engine.state().movement?.spent).toBe(1.5);
 });
 it('guardar fallido revierte posición, decisión, ruta y vínculos sin repetir la salvación',()=>{
  engine.declareUnarmedOpportunity('owner','push',stats(),review(),window());engine.rollUnarmedOpportunity('strength',0,facts);const before=structuredClone(engine.serialized()),rolls=die.calls.count();saveFailure=true;
  expect(()=>engine.finishUnarmedOpportunity(true,{x:grid*2,y:0})).toThrow();expect(engine.serialized()).toEqual(before);expect(roster[1].x).toBe(grid);expect(die.calls.count()).toBe(rolls);
  saveFailure=false;engine.finishUnarmedOpportunity(true,{x:grid*2,y:0});expect(roster[1].x).toBe(grid*2);expect(die.calls.count()).toBe(rolls);
 });
 it('un adaptador antiguo conserva la decisión y pide confirmar efectos en vez de omitirlos',()=>{
  engine.declareUnarmedOpportunity('owner','prone',stats(),review(),window());engine.rollUnarmedOpportunity('strength',0,facts);const before=structuredClone(engine.serialized());engine=make(false);engine.restore(before);
  expect(()=>engine.finishUnarmedOpportunity(true)).toThrow();expect(engine.serialized()).toEqual(before);expect(roster[1].conditions).not.toContain('prone');
 });
 it('un estado contradictorio se conserva sin sobrescribir al restaurar',()=>{
  declare();const state=structuredClone(engine.state());
  for(const bad of [{...state,reactionUsed:[]},{...state,route:{...state.route!,window:{...state.route!.window!,handled:[]}}},{...state,unarmed:{...state.unarmed!,targetId:'other'}},{...state,unarmed:{...state.unarmed!,dc:1}}]){engine.restore(bad);expect(engine.error()).not.toBe('');expect(engine.serialized()).toEqual(bad);}
 });
 it('conserva vínculos terminados y rechaza duplicados o datos corruptos, compatible con estados antiguos',()=>{
  const state=structuredClone(engine.state()),link={id:'grapple',ownerId:'owner',targetId:'target',range:1.5,escapeDc:13,ended:true};
  engine.restore({...state,grapples:[link]});expect(engine.error()).toBe('');expect(engine.state().grapples).toEqual([link]);
  const invalid={...state,grapples:[link,{...link}]};engine.restore(invalid);expect(engine.serialized()).toEqual(invalid);expect(engine.error()).not.toBe('');
  engine.restore(state);expect(engine.error()).toBe('');expect(engine.state().unarmed).toBeUndefined();expect(engine.state().grapples).toBeUndefined();
 });
});
