import { CombatAction, Combatant, CombatCondition } from '../models/combat';
import { actionProblem, combatDistance } from './combat-rules';
import type { AttackContext } from './vtt-combat';
import type { SightAssessment } from './vision-preview';

export const CONDITION_LABELS: Record<CombatCondition, string> = {
  prone: 'Tumbado', blinded: 'Cegado', restrained: 'Restringido', poisoned: 'Envenenado', incapacitated: 'Incapacitado',
};
export interface AttackFacts {
  reviewed: boolean; attackerSeesTarget: boolean; targetSeesAttacker: boolean;
  nearbyThreat?: boolean; spellAttackType?: 'melee' | 'ranged';
  extraAdvantage: boolean; extraDisadvantage: boolean;
  armorAdjustment: number; damageFactor: number; canTarget: boolean;
  finalRoll?: 'normal' | 'advantage' | 'disadvantage'; manualEffects: boolean;
}
export const normalAttackFacts = (): AttackFacts => ({ reviewed: false, attackerSeesTarget: true, targetSeesAttacker: true,
  extraAdvantage: false, extraDisadvantage: false, armorAdjustment: 0, damageFactor: 1, canTarget: true, manualEffects: false });
export function quickAction(action: CombatAction): CombatAction {
  // El usuario elige una opción cuyos valores completos se muestran en el lateral.
  // Los costes, rangos o efectos dudosos siguen necesitando preparación.
  const simple = action.kind === 'melee' && !/distancia|arrojad/i.test(action.source) && !action.manualEffects && action.resourceConfirmed && !/carga|usos?|munici[oó]n|recurso/i.test(action.notes);
  return simple && !actionProblem({ ...action, reviewed: true }) ? { ...action, reviewed: true } : action;
}
export function attackSituation(actor: Combatant, target: Combatant, action: CombatAction, roster: Combatant[], facts: AttackFacts,
  sight?: (observerId: string, targetId: string) => SightAssessment | undefined): {
  context: AttackContext; reasons: string[]; doubts: string[]; blocked?: string; threatUnknown: boolean; spellTypeUnknown: boolean;
} {
  const reasons: string[] = [], doubts: string[] = [];
  let advantage = facts.extraAdvantage, disadvantage = facts.extraDisadvantage;
  const has = (who: Combatant, condition: CombatCondition) => who.conditions?.includes(condition) ?? false;
  const range = combatDistance(actor, target), roll = action.resolution === 'attack';
  const actorSight = sight?.(actor.id, target.id), targetSight = sight?.(target.id, actor.id);
  const actorSeesTarget = facts.attackerSeesTarget && actorSight?.visible !== false;
  const targetSeesActor = facts.targetSeesAttacker && targetSight?.visible !== false;
  if (actorSight?.perception === 'disadvantage') reasons.push('Visibilidad reducida: Percepción visual con desventaja; no penaliza el ataque por sí sola.');
  if ((actorSight && actorSight.visible === undefined) || (targetSight && targetSight.visible === undefined)) doubts.push('La visión de alguna ficha sigue sin confirmar; revisa la situación.');
  const type = action.kind === 'spell' ? action.attackType ?? facts.spellAttackType : action.kind;
  const spellTypeUnknown = roll && !type;
  const near = roster.filter((other) => other.id !== actor.id && (other.id !== target.id || targetSeesActor) && sight?.(other.id, actor.id)?.visible !== false && other.hp > 0 && !has(other, 'incapacitated') && (!has(other, 'blinded') || sight?.(other.id, actor.id)?.visible === true) && combatDistance(actor, other) <= 1.501);
  const threatUnknown = roll && type === 'ranged' && near.some((other) => !other.side || !actor.side || !other.conditions);
  if (!facts.reviewed) doubts.push('El mapa no indica visión, cobertura ni todos los efectos de las fichas.');
  if (!facts.reviewed && (!actor.conditions || !target.conditions)) doubts.push('No constan todas las condiciones activas de estas fichas.');
  if (spellTypeUnknown) doubts.push('¿El ataque del conjuro es cuerpo a cuerpo o a distancia?');
  if (threatUnknown && facts.nearbyThreat === undefined) doubts.push('¿Hay un enemigo a 1,5 m que pueda verte y actuar?');
  if (roll) {
    if (range > action.range! + .001) { disadvantage = true; reasons.push('Alcance largo: desventaja'); }
    for (const condition of ['prone', 'restrained', 'poisoned'] as const) if (has(actor, condition)) { disadvantage = true; reasons.push(`${CONDITION_LABELS[condition]}: desventaja`); }
    if ((has(actor, 'blinded') && !actorSight?.visible) || !actorSeesTarget) { disadvantage = true; reasons.push('No ves al objetivo: desventaja'); }
    if ((has(target, 'blinded') && !targetSight?.visible) || !targetSeesActor) { advantage = true; reasons.push('El objetivo no te ve: ventaja'); }
    if (has(target, 'restrained')) { advantage = true; reasons.push('Objetivo restringido: ventaja'); }
    if (has(target, 'prone')) { if (range <= 1.501) advantage = true; else disadvantage = true; reasons.push(`Objetivo tumbado: ${range <= 1.501 ? 'ventaja por proximidad' : 'desventaja por distancia'}`); }
    const knownThreat = near.some((other) => actor.side && other.side && actor.side !== 'neutral' && other.side !== 'neutral' && actor.side !== other.side);
    if (type === 'ranged' && (facts.nearbyThreat ?? knownThreat)) { disadvantage = true; reasons.push('Enemigo próximo que puede verte y actuar: desventaja'); }
    if (facts.extraAdvantage) reasons.push('Ventaja adicional confirmada');
    if (facts.extraDisadvantage) reasons.push('Desventaja adicional confirmada');
    if (facts.finalRoll) { advantage = facts.finalRoll === 'advantage'; disadvantage = facts.finalRoll === 'disadvantage'; reasons.push('Tirada final resuelta explícitamente por un rasgo especial'); }
  } else { advantage = false; disadvantage = false; }
  return { context: { advantage, disadvantage, armorAdjustment: facts.armorAdjustment, damageFactor: facts.damageFactor, confirmed: facts.reviewed, rangeResolved: true }, reasons, doubts,
    blocked: has(actor, 'incapacitated') ? 'El atacante está incapacitado' : !facts.canTarget ? 'Sin línea de efecto u objetivo no permitido' : undefined, threatUnknown, spellTypeUnknown };
}
