import type { GameStatBlock } from '../models/campaign';
import type { Combatant, CombatRoll, CreatureSize, UnarmedEffect, UnarmedSaveAbility, UnarmedReview, UnarmedDecision, GrappleLink } from '../models/combat';
export type { CreatureSize, UnarmedEffect, UnarmedSaveAbility, UnarmedReview, UnarmedDecision, GrappleLink } from '../models/combat';
import { combatDistance } from './combat-rules';

const sizes: CreatureSize[] = ['tiny','small','medium','large','huge','gargantuan'];
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 300;
const effect = (value: unknown): value is UnarmedEffect => ['grapple','push','prone'].includes(value as string);
const size = (value: unknown): value is CreatureSize => sizes.includes(value as CreatureSize);
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
function reviewProblem(option: UnarmedEffect, review: UnarmedReview): string | undefined {
  if (!size(review.ownerSize) || !size(review.targetSize)) return 'Confirma las categorías de tamaño; la huella visual no distingue Pequeño de Mediano.';
  if (sizes.indexOf(review.targetSize) > sizes.indexOf(review.ownerSize) + 1) return 'El objetivo es más de una categoría mayor.';
  if (review.distance === undefined || !Number.isFinite(review.distance) || review.distance < 0 || review.distance > 1.50001) return 'Confirma un objetivo a 1,5 m o menos.';
  if (option === 'grapple' && review.freeHand !== true) return 'Confirma una mano libre para este agarre básico.';
  if (review.freeHand !== undefined && typeof review.freeHand !== 'boolean') return 'Confirmación de mano libre inválida.';
  return undefined;
}
/** STR/PB solo de una ficha confirmada por quien llama. No usa tamaño del token ni estadísticas por defecto. */
export function prepareUnarmedEffect(option: UnarmedEffect, stats: Pick<GameStatBlock, 'abilities' | 'proficiencyBonus'> | undefined,
  ownerId: string, targetId: string, review: UnarmedReview): UnarmedDecision {
  if (!effect(option) || !identifier(ownerId) || !identifier(targetId) || ownerId === targetId) throw new Error('Opción sin armas u objetivo inválidos.');
  const strength = stats?.abilities?.strength, proficiency = stats?.proficiencyBonus;
  if (!integer(strength) || strength < 1 || !integer(proficiency) || proficiency < 0) throw new Error('Faltan Fuerza y competencia confirmadas.');
  const problem = reviewProblem(option, review); if (problem) throw new Error(problem);
  const dc = 8 + Math.floor((strength - 10) / 2) + proficiency;
  if (dc < 1 || dc > 40) throw new Error('Revisa la CD del efecto básico sin armas.');
  return { rule: '2024-strength-basic', ownerId, targetId, effect: option, strength, proficiency, dc, range: 1.5, review: { ...review } as UnarmedDecision['review'] };
}
/** Guardados compatibles: una resolución solo es válida si conserva la elección y el mismo resultado. */
export function validUnarmedDecision(value: unknown): value is UnarmedDecision {
  if (!value || typeof value !== 'object') return false;
  const d = value as UnarmedDecision;
  if (d.rule !== '2024-strength-basic' || !identifier(d.ownerId) || !identifier(d.targetId) || d.ownerId === d.targetId || !effect(d.effect) || !integer(d.strength) || d.strength < 1 || !integer(d.proficiency) || d.proficiency < 0 || d.range !== 1.5 || !d.review || reviewProblem(d.effect,d.review) || d.dc !== 8 + Math.floor((d.strength-10)/2) + d.proficiency || d.dc < 1 || d.dc > 40) return false;
  if (d.save === undefined) return true;
  const save = d.save, roll = save?.roll;
  if (!save || !['strength','dexterity'].includes(save.ability) || typeof save.success !== 'boolean' || !roll || !integer(roll.bonus) || !integer(roll.total) || !integer(roll.natural) || !Array.isArray(roll.dice) || !roll.dice.length || roll.dice.length > 2 || !Array.from(roll.dice).every(n=>integer(n)&&n>=1&&n<=20) || (roll.advantage !== undefined && typeof roll.advantage !== 'boolean') || (roll.disadvantage !== undefined && typeof roll.disadvantage !== 'boolean')) return false;
  const advantage = !!roll.advantage, disadvantage = !!roll.disadvantage;
  if (roll.dice.length !== (advantage !== disadvantage ? 2 : 1)) return false;
  const natural = advantage === disadvantage ? roll.dice[0] : advantage ? Math.max(...roll.dice) : Math.min(...roll.dice);
  return roll.natural === natural && roll.total === natural + roll.bonus && save.success === (roll.total >= d.dc);
}
/** El objetivo elige FUE/ DES. No tira ataque contra CA ni dados de daño; nunca resuelve dos veces. */
export function resolveUnarmedSave(declaration: UnarmedDecision, ability: UnarmedSaveAbility, modifier: number | undefined,
  die: (sides: number) => number, facts: { restrained: boolean; advantage: boolean; disadvantage: boolean }): UnarmedDecision {
  if (!validUnarmedDecision(declaration) || declaration.save) throw new Error('La declaración no está pendiente de una salvación.');
  if (!['strength','dexterity'].includes(ability) || !integer(modifier) || !Number.isSafeInteger(modifier + 1) || !Number.isSafeInteger(modifier + 20) || !facts || [facts.restrained,facts.advantage,facts.disadvantage].some(f=>typeof f!=='boolean')) throw new Error('Confirma la salvación elegida, su bonificador y las condiciones.');
  const advantage = facts.advantage, disadvantage = facts.disadvantage || ability === 'dexterity' && facts.restrained;
  const read = () => { const value = die(20); if (!integer(value) || value < 1 || value > 20) throw new Error('Resultado de dado inválido.'); return value; };
  const dice = [read()]; if (advantage !== disadvantage) dice.push(read());
  const natural = advantage === disadvantage ? dice[0] : advantage ? Math.max(...dice) : Math.min(...dice);
  const roll: CombatRoll = { dice, natural, bonus: modifier, total: natural + modifier, advantage, disadvantage };
  return { ...structuredClone(declaration), save: { ability, roll, success: roll.total >= declaration.dc } };
}
/** Solo crea vínculo tras una salvación fallida de agarre; no aplica aún efectos al tablero. */
export function grappleFromDecision(decision: UnarmedDecision, id: string): GrappleLink | undefined {
  if (!validUnarmedDecision(decision) || !decision.save || decision.effect !== 'grapple' || !identifier(id)) throw new Error('Falta resolver un agarre válido.');
  return decision.save.success ? undefined : { id, ownerId: decision.ownerId, targetId: decision.targetId, range: decision.range, escapeDc: decision.dc };
}
export function validGrappleLink(value: unknown): value is GrappleLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as GrappleLink;
  return (link.ended === undefined || typeof link.ended === 'boolean') && identifier(link.id) && identifier(link.ownerId) && identifier(link.targetId) && link.ownerId !== link.targetId && Number.isFinite(link.range) && link.range > 0 && link.range <= 10000 && integer(link.escapeDc) && link.escapeDc >= 1 && link.escapeDc <= 40;
}
/** Un participante o condición desconocidos no borran un agarre guardado silenciosamente. */
export function grappleStatus(link: GrappleLink, roster: readonly Combatant[], grid = 51.2): 'active' | 'ended' | 'unknown' {
  if (!validGrappleLink(link) || !Number.isFinite(grid) || grid <= 0) return 'unknown';
  if (link.ended) return 'ended';
  const owners = roster.filter(a=>a.id===link.ownerId), targets = roster.filter(a=>a.id===link.targetId);
  if (owners.length !== 1 || targets.length !== 1) return 'unknown';
  const owner = owners[0], target = targets[0];
  const conditions = Array.isArray(owner.conditions) ? owner.conditions : undefined;
  const confirmedHp = typeof owner.hp === 'number' && Number.isFinite(owner.hp) && owner.hp >= 0;
  if (conditions?.includes('incapacitated') || confirmedHp && owner.hp === 0) return 'ended';
  if (![owner.x,owner.y,owner.size,target.x,target.y,target.size].every(Number.isFinite) || owner.size <= 0 || target.size <= 0) return 'unknown';
  if (combatDistance(owner,target,grid) > link.range + .00001) return 'ended';
  return conditions && confirmedHp ? 'active' : 'unknown';
}
export function grappleConsequences(actorId: string, attackTargetId: string | undefined, links: readonly GrappleLink[], roster: readonly Combatant[], grid = 51.2) {
  let speedZero = false, disadvantage = false, unknown = false;
  for (const link of links.filter(l=>l.targetId===actorId)) {
    const status = grappleStatus(link,roster,grid);
    if (status === 'unknown') unknown = true;
    if (status !== 'active') continue;
    speedZero = true;
    // Si hay varios agarres, atacar a uno no elimina la desventaja causada por otro.
    if (attackTargetId !== undefined && attackTargetId !== link.ownerId) disadvantage = true;
  }
  return { speedZero, disadvantage, unknown };
}
/** Sobrecoste de arrastrar UNA criatura agarrada; no deduce tamaños desde la huella del token. */
export function grappleCarryExtra(ownerSize: CreatureSize | undefined, targetSize: CreatureSize | undefined): 0 | 1 | undefined {
  if (targetSize === 'tiny') return 0;
  if (!size(ownerSize) || !size(targetSize)) return undefined;
  return sizes.indexOf(ownerSize) - sizes.indexOf(targetSize) >= 2 ? 0 : 1;
}

/** Guarda el fin confirmado y no lo revive al regresar el agarrador o cambiar sus condiciones. */
export function reconcileGrappleLinks(links: readonly GrappleLink[], roster: readonly Combatant[], grid = 51.2): GrappleLink[] {
  return links.map(link => grappleStatus(link,roster,grid) === 'ended' && !link.ended ? { ...link, ended: true } : { ...link });
}

/** Plantilla ortogonal del proyecto: un paso de1,5m con componente de alejamiento. La colisión se comprueba aparte. */
export function unarmedPushProblem(owner: Combatant, target: Combatant, to: { x: number; y: number } | undefined, grid = 51.2): string | undefined {
  if (!to || ![owner.x,owner.y,owner.size,target.x,target.y,target.size,to.x,to.y,grid].every(Number.isFinite) || owner.size <= 0 || target.size <= 0 || grid <= 0) return 'Confirma las posiciones y la huella antes de empujar.';
  const dx = (to.x-target.x)/grid, dy = (to.y-target.y)/grid;
  if (Math.abs(Math.abs(dx)+Math.abs(dy)-1) > .00001 || Math.abs(dx) > .00001 && Math.abs(dy) > .00001) return 'El empujón requiere un único paso horizontal o vertical.';
  if (to.x < 0 || to.y < 0 || to.x+target.size*grid > 30*grid+.00001 || to.y+target.size*grid > 20*grid+.00001) return 'El destino no cabe en el tablero.';
  const awayX = target.x-owner.x+(target.size-owner.size)*grid/2, awayY = target.y-owner.y+(target.size-owner.size)*grid/2;
  if (awayX*dx+awayY*dy <= .00001) return 'El destino debe alejar al objetivo de quien empuja.';
  return undefined;
}
