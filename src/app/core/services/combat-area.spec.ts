import { CombatAction, Combatant } from '../models/combat';
import { areaReachesToken, areaRadiusPixels, originDistance, tokensInArea, validArea, withCircularArea } from './combat-area';
import { VttCombat, validState } from './vtt-combat';
const G=51.2;
const action = (): CombatAction => ({source:'explosion',name:'Explosión de prueba',kind:'spell',resolution:'save',range:9,targets:1,repeatTargets:false,halfOnSave:true,saveAbility:'dexterity',dc:12,spellLevel:1,area:{radius:3},damage:[{dice:'2d6',type:'fuego'}],cost:{resourceId:'slots',amount:1},resourceConfirmed:true,reviewed:true,notes:'Datos sintéticos.'});
const actor = (id:string,x:number,y=0,size=1): Combatant => ({id,actorId:id,name:id,x:x*G,y:y*G,size,hp:30,maxHp:30,armorClass:12,conditions:[],side:id==='caster'?'party':'neutral',saves:{strength:0,dexterity:0,constitution:0,intelligence:0,wisdom:0,charisma:0},actions:[],reactions:[],resources:[],attacksPerTurn:1,notes:[],profile:{actions:[],reactions:[],resources:[]}});
const context={advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true};
describe('Áreas circulares: geometría y combate',()=>{
 it('detecta espacio ocupado, diagonales y tokens grandes sin incluir tangencias exteriores',()=>{
   const ts=[actor('self',2,2),actor('adjacent',3,2),actor('diagonal',3,3),actor('large',3,1,2),actor('outside',4,2)];
   expect(tokensInArea(ts,{x:2.5*G,y:2.5*G},1.5).map(t=>t.id)).toEqual(['self','adjacent','diagonal','large']);
   expect(areaRadiusPixels(6)).toBe(4*G);
 });
 it('no inventa radio por nombre y solo sugiere una esfera explícita; conserva la elección manual',()=>{
   expect(withCircularArea({...action(),area:undefined,name:'Bola de fuego',notes:''}).area).toBeUndefined();
   expect(withCircularArea({...action(),area:undefined,notes:'una esfera de 6 m de radio centrada en ese punto'}).area).toEqual({radius:6});
   expect(withCircularArea({...action(),area:null,notes:'esfera de 6 m de radio'}).area).toBeNull();
   for(const radius of [0,-1,NaN,Infinity,10001])expect(validArea({radius})).toBeFalse();
 });
 function setup(tokens:Combatant[],wall?: (a:{x:number;y:number},b:{x:number;y:number})=>boolean|undefined){
   tokens[0].actions=[action()];tokens[0].resources=[{id:'slots',name:'Espacios',maximum:3,kind:'slot',level:1}];
   const die=jasmine.createSpy('die').and.callFake((s:number)=>s===20?1:6);
   const engine=new VttCombat(()=>tokens,()=>tokens[0].id,hp=>{if(hp)tokens.find(t=>t.id===hp.id)!.hp=hp.hp;},()=>{},die,undefined,undefined,undefined,wall);
   engine.start(tokens[0].id);return{engine,die};
 }
 it('mide alcance hasta el origen y permite víctimas más allá del alcance del lanzador',()=>{
   const ts=[actor('caster',0),actor('victim',8)];const{engine}=setup(ts);const origin={x:6.5*G,y:.5*G};
   expect(originDistance(ts[0],origin)).toBeCloseTo(9);expect(engine.areaTargets(action(),origin).map(t=>t.id)).toEqual(['victim']);
   engine.begin('explosion',['victim'],context,undefined,origin);engine.settleAutomatic();expect(ts[1].hp).toBe(18);expect(engine.state().resources['caster']['slots']).toBe(2);
 });
 it('incluye lanzador y aliados y no limita el área al campo de objetivos de un ataque individual',()=>{
   const ts=[actor('caster',1),...Array.from({length:24},(_,i)=>({...actor('ally'+i,1),side:'party' as const}))];const{engine}=setup(ts);const origin={x:1.5*G,y:.5*G};
   engine.begin('explosion',ts.map(t=>t.id),context,undefined,origin);engine.settleAutomatic();expect(ts.every(t=>t.hp===18)).toBeTrue();expect(engine.state().resources['caster']['slots']).toBe(2);
 });
 it('tira daño una sola vez, salvaciones separadas y conserva el daño al recargar antes de continuar',()=>{
   const ts=[actor('caster',0),actor('first',7),actor('second',8)];const{engine,die}=setup(ts);const origin={x:6.5*G,y:.5*G};
   engine.begin('explosion',['first','second'],context,undefined,origin);expect(die).not.toHaveBeenCalled();engine.finish(true);
   expect(engine.state().areaCast?.damage?.[0].rolled).toBe(12);engine.restore(structuredClone(engine.serialized()));engine.finish(true);engine.finish(true);
   expect(die.calls.allArgs().filter(a=>a[0]===6).length).toBe(2);expect(die.calls.allArgs().filter(a=>a[0]===20).length).toBe(2);expect(ts[1].hp).toBe(18);expect(ts[2].hp).toBe(18);expect(validState(engine.serialized())).toBeTrue();
 });
 it('rechaza un área fuera de alcance, una selección incompleta o una ficha inválida sin gastar',()=>{
   const ts=[actor('caster',0),actor('first',7),actor('second',8)];const{engine,die}=setup(ts);const origin={x:6.5*G,y:.5*G};
   expect(()=>engine.begin('explosion',['first'],context,undefined,{x:10.5*G,y:.5*G})).toThrowError(/fuera del alcance/);
   expect(()=>engine.begin('explosion',['first'],context,undefined,origin)).toThrowError(/tokens del área/);
   ts[2].armorClass=undefined;expect(()=>engine.begin('explosion',['first','second'],context,undefined,origin)).toThrowError(/fichas/);
   expect(engine.state().resources['caster']).toBeUndefined();expect(die).not.toHaveBeenCalled();
 });
 it('usa línea de efecto desde el origen y rechaza un origen detrás de una pared',()=>{
   const ts=[actor('caster',0),actor('first',7),actor('second',8)];const origin={x:6.5*G,y:.5*G};
   const{engine}=setup(ts,(a,b)=>a.x===origin.x?b.x<8*G:true);
   expect(engine.areaTargets(action(),origin).map(t=>t.id)).toEqual(['first']);engine.begin('explosion',['first'],context,undefined,origin);engine.settleAutomatic();expect(ts[2].hp).toBe(30);
   const{engine:blocked}=setup(ts,()=>false);expect(()=>blocked.begin('explosion',[],context,undefined,origin)).toThrowError(/obstáculo/);
 });
 it('conserva estados antiguos y rechaza radios o daño común inválidos',()=>{
   const{engine}=setup([actor('caster',0),actor('victim',8)]);const old=structuredClone(engine.serialized()) as any;delete old.areaCast;expect(validState(old)).toBeTrue();
   expect(validState({...old,areaCast:{origin:{x:NaN,y:0}}})).toBeFalse();expect(validState({...old,areaCast:{origin:{x:0,y:0},damage:[{type:'fuego',rolled:NaN,bonus:0,dice:[6]}]}})).toBeFalse();
 });

 it('incluye la porción libre de un token grande aunque el centro esté detrás de una pared',()=>{
   const token=actor('large',3,2,2),origin={x:128,y:128},radius=60/G*1.5;
   const wall=[{x:180,y:0},{x:180,y:300},{x:4000,y:5000},{x:4000,y:-5000}];
   expect(areaReachesToken(token,origin,radius,[wall])).toBeTrue();
   expect(areaReachesToken({...token,x:190},origin,radius,[wall])).toBeFalse();
 });
 it('encuentra una abertura estrecha y no confunde sombra completa con cobertura parcial',()=>{
   const token=actor('large',3,2,2),origin={x:128,y:128},radius=60/G*1.5;
   const above=[{x:150,y:0},{x:150,y:124},{x:4000,y:124},{x:4000,y:0}];
   const below=[{x:150,y:125},{x:150,y:1000},{x:4000,y:1000},{x:4000,y:125}];
   expect(areaReachesToken(token,origin,radius,[above,below])).toBeTrue();
   expect(areaReachesToken(token,origin,radius,[[{x:150,y:0},{x:150,y:1000},{x:4000,y:1000},{x:4000,y:0}]])).toBeFalse();
 });
 it('rechaza una respuesta de área antes de gastar y conserva el guardado del ataque principal',()=>{
   const ts=[actor('caster',0),actor('defender',1)],{engine,die}=setup(ts);die.and.callFake((s:number)=>s===20?15:6);
   ts[0].actions=[{...action(),source:'sword',kind:'melee',resolution:'attack',bonus:20,range:1.5,cost:undefined,spellLevel:undefined,area:null}];
   ts[1].actions=[action()];ts[1].reactions=[{source:'counter',name:'Respuesta',trigger:'hit',protectOthers:false,range:0,meleeOnly:false,effect:'counter',amount:0,dice:'',duration:'attack',actionSource:'explosion',resourceConfirmed:true,reviewed:true}];
   engine.begin('sword',['defender'],context);expect(engine.reactions().some(r=>r.owner.id==='defender')).toBeTrue();expect(()=>engine.useReaction('defender','counter')).toThrowError(/elegir un origen/);expect(engine.state().reactionUsed).toEqual([]);expect(engine.state().resources['defender']).toBeUndefined();expect(validState(engine.serialized())).toBeTrue();
 });
});
