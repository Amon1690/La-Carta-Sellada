import type { CombatAction, Combatant } from '../models/combat';
import type { SightAssessment } from './vision-preview';
import { actionProblem, combatDistance } from './combat-rules';

/** Una compulsión que usa movimiento/acciones también puede provocar; un empujón externo no. */
export type OpportunityCause = 'speed' | 'action' | 'bonus-action' | 'reaction' | 'displacement' | 'teleport';
export interface OpportunityAttack { action: CombatAction; problem?: string; }
/** Información privada de dirección. Nunca se envía esta lista completa a un jugador. */
export interface OpportunityCandidate {
  reactorId: string; moverId: string; attacks: OpportunityAttack[]; doubts: string[];
}
export interface OpportunityContext {
  cause: OpportunityCause;
  disengaged: boolean;
  reactionUsed: ReadonlySet<string>;
  sight: (observerId: string, targetId: string) => SightAssessment | undefined;
  /** Ataque sin armas derivado de estadísticas confirmadas; no se fabrican atributos ausentes. */
  unarmed?: ReadonlyMap<string, CombatAction>;
  available?: (owner: Combatant, action: CombatAction) => number | undefined;
  grid?: number;
}

/** Detecta la salida antes del siguiente paso ortogonal, usando la vista personal del reactor. */
export function opportunityCandidates(mover: Combatant, to: { x: number; y: number }, roster: readonly Combatant[], context: OpportunityContext): OpportunityCandidate[] {
  const grid=context.grid??51.2;
  if (![mover.x,mover.y,to.x,to.y,grid].every(Number.isFinite)||grid<=0) throw new Error('Falta una posición o escala válida.');
  if (!['speed','action','bonus-action','reaction','displacement','teleport'].includes(context.cause)) throw new Error('Confirma la causa del desplazamiento.');
  if (context.cause==='displacement'||context.cause==='teleport') return [];
  const dx=Math.abs(to.x-mover.x)/grid,dy=Math.abs(to.y-mover.y)/grid;
  if (Math.abs(dx+dy-1)>.00001 || dx>.00001&&dy>.00001) throw new Error('Revisa el siguiente paso horizontal o vertical.');
  if(context.disengaged) return [];
  const after={...mover,...to},result: OpportunityCandidate[]=[],seen=new Set<string>();
  for(const owner of roster){
    if(owner.id===mover.id||seen.has(owner.id)||owner.hp<=0||owner.conditions?.includes('incapacitated')||context.reactionUsed.has(owner.id))continue;
    seen.add(owner.id);
    const beforeDistance=combatDistance(owner,mover,grid),afterDistance=combatDistance(owner,after,grid);
    const crosses=(reach:number)=>beforeDistance<=reach+.00001&&afterDistance>reach+.00001;
    const unarmed=context.unarmed?.get(owner.id)??owner.unarmed;
    const sources=[...owner.actions,...(unarmed?[unarmed]:[])];
    const attacks: OpportunityAttack[]=[],sourceIds=new Set<string>();
    for(const source of sources){
      if(sourceIds.has(source.source)||source.kind!=='melee'||source.resolution!=='attack'||source.area||!Number.isFinite(source.range)||source.range!<0||!crosses(source.range!))continue;
      sourceIds.add(source.source);
      // Una oportunidad es un solo ataque, independiente de la acción Atacar y sus ataques adicionales.
      const action={...structuredClone(source),targets:1,repeatTargets:false};
      let problem=owner.grappleUncertain ? 'Confirma el agarre del reactor antes de gastar su reacción.' : actionProblem(action);
      if(action.cost){const available=context.available?.(owner,action);if(available===undefined||!Number.isFinite(available))problem??='Confirma el recurso de este ataque.';else if(available<action.cost.amount)problem??='Recurso agotado.';}
      attacks.push({action,...(problem?{problem}:{})});
    }
    const unprepared=!attacks.length&&crosses(1.5)&&!unarmed;
    if(!attacks.length&&!unprepared)continue;
    const sight=context.sight(owner.id,mover.id);
    if(sight?.visible===false||sight?.lineOfEffect===false)continue;
    const doubts:string[]=[];
    if(owner.grappleUncertain)doubts.push('Confirma el agarre del reactor antes de reaccionar.');
    if(sight?.visible!==true)doubts.push('Confirma si el reactor ve personalmente a quien se mueve.');
    if(sight?.lineOfEffect!==true)doubts.push('Confirma que el ataque no está bloqueado por un obstáculo.');
    if(unprepared)doubts.push('Prepara un ataque cuerpo a cuerpo o sin armas con estadísticas confirmadas.');
    result.push({reactorId:owner.id,moverId:mover.id,attacks,doubts});
  }
  return result;
}
