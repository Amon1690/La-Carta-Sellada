import { CombatAction, Combatant } from '../models/combat';
import { OpportunityContext, opportunityCandidates } from './combat-opportunity';
const grid=51.2;
function weapon(source='sword',range=1.5): CombatAction {return{source,name:source,kind:'melee',resolution:'attack',bonus:4,halfOnSave:false,range,targets:1,repeatTargets:false,damage:[{dice:'1d8+2',type:'cortante'}],reviewed:true,resourceConfirmed:true,notes:''};}
function actor(id:string,x:number): Combatant{return{id,actorId:'player:'+id,name:id,x,y:0,size:1,hp:20,maxHp:20,armorClass:12,saves:{strength:0,dexterity:0,constitution:0,intelligence:0,wisdom:0,charisma:0},actions:[weapon()],reactions:[],resources:[],attacksPerTurn:2,notes:[],profile:{actions:[],reactions:[],resources:[]}};}
describe('Disparadores privados de oportunidad',()=>{
 let mover:Combatant,reactor:Combatant,context:OpportunityContext;
 beforeEach(()=>{mover=actor('mover',grid);reactor=actor('reactor',0);context={cause:'speed',disengaged:false,reactionUsed:new Set(),sight:()=>({visible:true,lineOfEffect:true,perception:'normal',reasons:[]})};});
 const detect=(m:Combatant,r:Combatant,c:OpportunityContext,to={x:2*grid,y:0})=>opportunityCandidates(m,to,[m,r],c);
 it('señala la salida antes del paso y no muta posiciones, acciones ni reacciones',()=>{
  const snapshot=JSON.stringify([mover,reactor]);const result=detect(mover,reactor,context);expect(result.length).toBe(1);expect(result[0].reactorId).toBe('reactor');expect(result[0].moverId).toBe('mover');expect(result[0].doubts).toEqual([]);expect(JSON.stringify([mover,reactor])).toBe(snapshot);expect(context.reactionUsed.size).toBe(0);
 });
 it('entrar o continuar dentro del alcance no provoca',()=>{
  mover.x=2*grid;expect(detect(mover,reactor,context,{x:grid,y:0})).toEqual([]);reactor.actions=[weapon('reach',4.5)];mover.x=2*grid;expect(detect(mover,reactor,context,{x:3*grid,y:0})).toEqual([]);
 });
 it('compara cada alcance de arma y mantiene un solo ataque sin modificar el perfil',()=>{
  reactor.actions=[{...weapon(),targets:3,repeatTargets:true},weapon('reach',3)];let candidates=detect(mover,reactor,context);expect(candidates[0].attacks.map(a=>a.action.source)).toEqual(['sword']);expect(candidates[0].attacks[0].action.targets).toBe(1);expect(reactor.actions[0].targets).toBe(3);
  mover.x=2*grid;candidates=detect(mover,reactor,context,{x:3*grid,y:0});expect(candidates[0].attacks.map(a=>a.action.source)).toEqual(['reach']);
 });
 it('respeta un alcance cero declarado sin sustituirlo por otro alcance',()=>{
  mover.x=0;reactor.actions=[weapon('touch',0)];const candidate=detect(mover,reactor,context,{x:grid,y:0})[0];expect(candidate.attacks[0].action.range).toBe(0);
 });
 it('usa la reacción disponible fuera del turno propio y excluye incapacitados o caídos',()=>{
  expect(detect(mover,reactor,context).length).toBe(1);context.reactionUsed=new Set(['reactor']);expect(detect(mover,reactor,context)).toEqual([]);context.reactionUsed=new Set();reactor.conditions=['incapacitated'];expect(detect(mover,reactor,context)).toEqual([]);reactor.conditions=[];reactor.hp=0;expect(detect(mover,reactor,context)).toEqual([]);
 });
 it('Destrabarse evita la oportunidad sin gastar otra reacción',()=>{context.disengaged=true;expect(detect(mover,reactor,context)).toEqual([]);expect(context.reactionUsed.size).toBe(0);});
 it('teletransportes y desplazamientos externos no provocan; usar acciones o movimiento sí',()=>{
  for(const cause of ['displacement','teleport'] as const)expect(detect(mover,reactor,{...context,cause},{x:10*grid,y:7*grid})).toEqual([]);
  for(const cause of ['speed','action','bonus-action','reaction'] as const)expect(detect(mover,reactor,{...context,cause}).length).toBe(1);
 });
 it('no sustituye la vista personal por la compartida y conserva las dudas explícitas',()=>{
  context.sight=()=>({visible:false,lineOfEffect:true,perception:'automatic-failure',reasons:[]});expect(detect(mover,reactor,context)).toEqual([]);
  context.sight=()=>undefined;const candidate=detect(mover,reactor,context)[0];expect(candidate.doubts.length).toBe(2);
  context.sight=()=>({visible:true,lineOfEffect:false,perception:'normal',reasons:[]});expect(detect(mover,reactor,context)).toEqual([]);
 });
 it('permite sentidos confirmados aunque el reactor tenga cegado, sin inferirlos',()=>{
  reactor.conditions=['blinded'];expect(detect(mover,reactor,context).length).toBe(1);context.sight=()=>undefined;expect(detect(mover,reactor,context)[0].doubts.length).toBe(2);
 });
 it('un cuerpo a cuerpo de conjuro no se convierte en oportunidad de arma',()=>{
  reactor.actions=[{...weapon('spell'),kind:'spell',attackType:'melee',spellLevel:0}];const candidate=detect(mover,reactor,context)[0];expect(candidate.attacks).toEqual([]);expect(candidate.doubts.join(' ')).toContain('Prepara');
 });
 it('acepta un ataque sin armas confirmado y no inventa estadísticas si falta la ficha',()=>{
  reactor.actions=[];expect(detect(mover,reactor,context)[0].doubts.join(' ')).toContain('estadísticas');context.unarmed=new Map([['reactor',weapon('unarmed')]]);const candidate=detect(mover,reactor,context)[0];expect(candidate.attacks[0].action.source).toBe('unarmed');expect(candidate.doubts).toEqual([]);
 });
 it('mantiene la revisión y el coste del ataque, sin consumir recursos al detectar',()=>{
  reactor.actions=[{...weapon(),cost:{resourceId:'power',amount:1}}];expect(detect(mover,reactor,context)[0].attacks[0].problem).toContain('Confirma');context.available=()=>0;expect(detect(mover,reactor,context)[0].attacks[0].problem).toContain('agotado');context.available=()=>2;expect(detect(mover,reactor,context)[0].attacks[0].problem).toBeUndefined();
 });
 it('respeta la petición de pasos ortogonales y rechaza causas no declaradas',()=>{
  expect(()=>detect(mover,reactor,context,{x:2*grid,y:grid})).toThrowError(/horizontal/);expect(()=>detect(mover,reactor,{...context,cause:'unknown' as any})).toThrowError(/causa/);
 });
 it('no aplica un veto por bando: la reacción sigue siendo una elección, incluso entre aliados',()=>{
  mover.side=reactor.side='party';expect(detect(mover,reactor,context).length).toBe(1);
 });
});
