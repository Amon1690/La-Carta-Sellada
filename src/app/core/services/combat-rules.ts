import { CombatAction, CombatDamage, CombatProfile, CombatReaction, Combatant, SaveAbility } from '../models/combat';
import { GameStatBlock } from '../models/campaign';
import { RulesCompendium } from '../models/rules';

export const normalizeCombat = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const SAVE_LABELS: Record<SaveAbility, string> = { strength: 'FUE', dexterity: 'DES', constitution: 'CON', intelligence: 'INT', wisdom: 'SAB', charisma: 'CAR' };
export const emptyCombatProfile = (): CombatProfile => ({ actions: [], reactions: [], resources: [] });
export function diceParts(text: string): { count: number; sides: number; bonus: number } | undefined {
  const match = /^(\d{1,2})d(\d{1,3})([+-]\d{1,4})?$/i.exec(text.replace(/\s/g, ''));
  if (!match) return undefined;
  const count = +match[1], sides = +match[2], bonus = Number(match[3] ?? 0);
  return count >= 1 && count <= 40 && sides >= 2 && sides <= 100 && Math.abs(bonus) <= 1000 ? { count, sides, bonus } : undefined;
}
export function rollDice(text: string, die: (sides: number) => number, critical = false): { dice: number[]; bonus: number; total: number } {
  const parts = diceParts(text);
  if (!parts) throw new Error('Fórmula de dados incompleta o no admitida');
  const dice = Array.from({ length: parts.count * (critical ? 2 : 1) }, () => die(parts.sides));
  return { dice, bonus: parts.bonus, total: Math.max(0, dice.reduce((a, b) => a + b, parts.bonus)) };
}
export function combatDistance(a: Pick<Combatant, 'x' | 'y' | 'size'>, b: Pick<Combatant, 'x' | 'y' | 'size'>, grid = 51.2): number {
  const dx = Math.max(0, b.x - a.x - (a.size - 1) * grid, a.x - b.x - (b.size - 1) * grid);
  const dy = Math.max(0, b.y - a.y - (a.size - 1) * grid, a.y - b.y - (b.size - 1) * grid);
  return Math.max(dx, dy) / grid * 1.5;
}
export function actionProblem(action: CombatAction): string | undefined {
  if (!action || typeof action.source !== 'string' || typeof action.name !== 'string' || !['melee', 'ranged', 'spell'].includes(action.kind) || !['attack', 'save', 'automatic'].includes(action.resolution) || !Array.isArray(action.damage)) return 'Datos de ataque incompletos';
  if (!action.reviewed) return 'Revisa los datos y efectos de esta opción';
  if (!Number.isFinite(action.range) || action.range! < 0 || action.range! > 10000) return 'Falta un alcance válido en metros';
  if (action.longRange !== undefined && (!Number.isFinite(action.longRange) || action.longRange < action.range!)) return 'El alcance largo no puede ser inferior al normal';
  if (!Number.isInteger(action.targets) || action.targets < 1 || action.targets > 20) return 'Indica entre 1 y 20 objetivos o impactos';
  if (action.resolution === 'attack' && !Number.isFinite(action.bonus)) return 'Falta el bonificador de ataque';
  if (action.resolution === 'save' && (!action.saveAbility || !Number.isInteger(action.dc) || action.dc! < 1 || action.dc! > 40)) return 'Falta la salvación y su CD';
  if ((!action.damage.length && !action.effectOnly) || action.damage.some((part) => !part || !diceParts(part.dice) || typeof part.type !== 'string' || !part.type.trim())) return 'Falta una fórmula y tipo para cada daño, o confirma que solo aplica un efecto';
  if (!action.resourceConfirmed) return 'Confirma el recurso necesario';
  if (action.kind === 'spell' && (!Number.isInteger(action.spellLevel) || action.spellLevel! < 0 || action.spellLevel! > 9)) return 'Confirma el nivel del conjuro';
  if (action.kind === 'spell' && action.spellLevel! > 0 && !action.cost) return 'Este conjuro necesita una reserva de espacios o usos';
  if (action.cost && (!action.cost.resourceId || !Number.isInteger(action.cost.amount) || action.cost.amount < 1)) return 'Coste de recurso inválido';
  return undefined;
}
export function reactionProblem(reaction: CombatReaction): string | undefined {
  if (!reaction || typeof reaction.source !== 'string' || typeof reaction.name !== 'string' || !['hit', 'damage', 'miss', 'spell'].includes(reaction.trigger) || !['armor', 'reduce', 'half', 'disadvantage', 'cancel', 'redirect', 'counter', 'manual'].includes(reaction.effect)) return 'Datos de reacción incompletos';
  if (!reaction.reviewed || !reaction.resourceConfirmed) return 'Configura el efecto y los recursos de esta reacción';
  if (!Number.isFinite(reaction.range) || reaction.range < 0 || !Number.isFinite(reaction.amount) || reaction.amount < 0) return 'Alcance o efecto de reacción inválido';
  if (reaction.dice && !diceParts(reaction.dice)) return 'Dados de reacción inválidos';
  if (reaction.effect === 'counter' && !reaction.actionSource) return 'Elige el ataque de respuesta';
  if ((reaction.saveAbility && (!(reaction.saveAbility in SAVE_LABELS) || !Number.isInteger(reaction.dc) || reaction.dc! < 1 || reaction.dc! > 40)) || (!reaction.saveAbility && reaction.dc !== undefined && reaction.dc !== null)) return 'Indica la salvación y una CD entera entre 1 y 40, o deja ambas vacías';
  if ((normalizeCombat(reaction.name) === 'escudo' || (reaction.spellLevel ?? 0) > 0) && !reaction.cost) return 'Este conjuro de reacción necesita una reserva de espacios o usos';
  if (reaction.cost && (!reaction.cost.resourceId || !Number.isInteger(reaction.cost.amount) || reaction.cost.amount < 1)) return 'Coste de reacción inválido';
  return undefined;
}
const aliases: Record<string, string> = { escupo: 'escudo', 'descarga ignea': 'descarga de fuego', 'rayo de fuego': 'descarga de fuego', 'producir llama': 'crear llama', 'misil magico': 'proyectil magico' };
const canonical = (s: string): string => aliases[normalizeCombat(s)] ?? normalizeCombat(s);
const metres = (s: string): number | undefined => {
  const m = /(\d+(?:[.,]\d+)?)\s*(metros?|m\b|pies|feet|ft\b)/i.exec(s);
  return m ? Number(m[1].replace(',', '.')) * (/pies|feet|ft/i.test(m[2]) ? 0.3 : 1) : undefined;
};
function legacyDamage(source: string): CombatDamage[] {
  const matches = [...source.matchAll(/\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(?:de\s+)?([a-záéíóúñ]+)/gi)];
  return matches.map((match) => ({ dice: match[1].replace(/\s/g, ''), type: match[2] }));
}
export function deriveCombat(stats: GameStatBlock | undefined, rules?: RulesCompendium): Pick<Combatant, 'actions' | 'reactions' | 'resources' | 'notes' | 'attacksPerTurn' | 'saves' | 'profile'> {
  const profile = stats?.combat ?? emptyCombatProfile();
  const saves = Object.fromEntries(Object.entries(SAVE_LABELS).map(([ability, label]) => {
    const explicit = stats?.saves.find((s) => normalizeCombat(s).startsWith(normalizeCombat(label)))?.match(/[+-]\s*\d+/);
    return [ability, explicit ? Number(explicit[0].replace(/\s/g, '')) : Math.floor(((stats?.abilities[ability as SaveAbility] ?? 10) - 10) / 2)];
  })) as Combatant['saves'];
  const actions: CombatAction[] = [], reactions: CombatReaction[] = [];
  const notes = [...(stats?.features ?? []), ...(stats?.equipment ?? []).map((s) => `Equipo: ${s}`)];
  for (const source of stats?.attacks ?? []) {
    if (/ataque m[úu]ltiple|ataque furtivo|ataque adicional/i.test(source)) { notes.push(source); continue; }
    const name = source.split('.')[0];
    const melee = /cuerpo a cuerpo/i.test(source), ranged = /distancia/i.test(source), spell = /conjuro/i.test(source);
    const bonus = source.match(/:\s*([+-]\s*\d+)/)?.[1];
    const base: CombatAction = { source, name, kind: spell ? 'spell' : ranged && !melee ? 'ranged' : 'melee', resolution: 'attack',
      bonus: bonus ? Number(bonus.replace(/\s/g, '')) : undefined, range: metres(source) ?? (melee && !ranged ? 1.5 : undefined),
      targets: 1, repeatTargets: false, halfOnSave: false, damage: legacyDamage(source),
      resourceConfirmed: !spell, reviewed: false, manualEffects: /salvaci[oó]n|\bsi\b|apresad|derribad|paralizad|incapacitad|cegad|escapar/i.test(source), notes: source };
    const definition = rules?.spells.find((s) => canonical(s.name) === canonical(name));
    if (definition) { base.range ??= metres(definition.range); base.spellLevel = definition.level; }
    const saved = profile.actions.find((a) => a.source === source);
    actions.push(saved ?? base);
  }
  for (const source of stats?.spells ?? []) {
    for (const part of source.replace(/^[^:]*:\s*/, '').replace(/\.$/, '').split(/[,;]/)) {
      const name = part.trim(); if (!name) continue;
      const spell = rules?.spells.find((s) => canonical(s.name) === canonical(name));
      if (canonical(name) === 'escudo') {
        const text = `Escudo — ${source}`;
        reactions.push(profile.reactions.find((r) => r.source === text) ?? { source: text, name: 'Escudo', trigger: 'hit', protectOthers: false,
          range: 0, meleeOnly: false, effect: 'armor', amount: 5, dice: '', duration: 'next-turn', resourceConfirmed: false, reviewed: false, spellLevel: 1 });
      } else if (spell && /reacci[oó]n/i.test(spell.castingTime)) {
        reactions.push(profile.reactions.find((r) => r.source === `${name} — ${source}`) ?? { ...unknownReaction(`${name} — ${source}`, name), spellLevel: spell.level,
          ...(canonical(name) === 'contrahechizo' ? { trigger: 'spell' as const, range: metres(spell.range) ?? 0 } : {}) });
      } else if (!actions.some((a) => canonical(a.name) === canonical(name))) {
        const text = `${name} — ${source}`;
        const action: CombatAction = { source: text, name, kind: 'spell', resolution: /salvaci[oó]n/i.test(spell?.description ?? '') ? 'save' : 'attack',
          range: spell ? metres(spell.range) : undefined, targets: 1, repeatTargets: false, halfOnSave: false, damage: [],
          resourceConfirmed: spell?.level === 0, reviewed: false, spellLevel: spell?.level, notes: spell ? `${source}\n${spell.description}` : `${source}\nComprueba el efecto y el alcance del conjuro.` };
        actions.push(profile.actions.find((a) => a.source === text) ?? action);
      }
    }
  }
  for (const source of stats?.features ?? []) {
    if (!/reacci[oó]n|parada|esquiva asombrosa|desviar ataques|palabras cortantes|r[eé]plica/i.test(source)) continue;
    const name = source.split('.')[0];
    const reaction = unknownReaction(source, name);
    if (/parada/i.test(name) && /\+2.*CA/i.test(source)) Object.assign(reaction, { effect: 'armor', amount: 2, meleeOnly: true, resourceConfirmed: true });
    if (/esquiva asombrosa/i.test(name)) Object.assign(reaction, { effect: 'half', resourceConfirmed: true });
    reactions.push(profile.reactions.find((r) => r.source === source) ?? reaction);
  }
  for (const resource of profile.resources) {
    if (!Number.isInteger(resource.maximum) || resource.maximum < 1 || resource.maximum > 999) throw new Error('Recurso de ficha inválido');
  }
  for (const item of stats?.equipment ?? []) {
    const description = rules?.equipment.find((e) => normalizeCombat(e.name) === normalizeCombat(item))?.description ?? item;
    if (!/reacci[oó]n/i.test(description)) continue;
    const source = `Objeto: ${item}. ${description}`;
    reactions.push(profile.reactions.find((r) => r.source === source) ?? unknownReaction(source, item));
  }
  const multiple = (stats?.attacks ?? []).find((s) => /ataque m[úu]ltiple/i.test(s));
  const count = multiple?.match(/(dos|tres|cuatro|\d) ataques/i)?.[1];
  const inferred = count === 'dos' ? 2 : count === 'tres' ? 3 : count === 'cuatro' ? 4 : Number(count ?? 1);
  return { actions, reactions, resources: profile.resources, notes, attacksPerTurn: profile.attacksPerTurn ?? inferred, saves, profile };
}
function unknownReaction(source: string, name: string): CombatReaction {
  return { source, name, trigger: 'hit', protectOthers: false, range: 0, meleeOnly: false,
    effect: 'manual', amount: 0, dice: '', duration: 'attack', resourceConfirmed: false, reviewed: false };
}
