export interface RulesCompendium {
  source: string;
  edition: string;
  spells: RuleSpell[];
  feats: RuleFeat[];
  skills: RuleSkill[];
  equipment: RuleEquipment[];
  classes: RuleClass[];
  creatures: RuleCreature[];
}

export interface RuleEntry {
  id: string;
  name: string;
  summary: string;
  description: string;
  tags: string[];
  sourcePage: number;
}

export interface RuleSpell extends RuleEntry {
  level: number;
  school: string;
  classes: string[];
  castingTime: string;
  range: string;
  components: string;
  duration: string;
}

export interface RuleFeat extends RuleEntry {
  category: string;
  requirements?: string;
  repeatable: boolean;
}

export interface RuleSkill extends RuleEntry {
  ability: string;
  uses: string[];
}

export interface RuleEquipment extends RuleEntry {
  category: string;
  cost: string;
  weight?: string;
  properties: string[];
}

export interface RuleClass {
  id: string;
  name: string;
  summary: string;
  primaryAbility: string;
  hitDie: string;
  sourcePage: number;
  features: RuleClassFeature[];
}

export interface RuleClassFeature {
  id: string;
  name: string;
  level: number;
  description: string;
  sourcePage: number;
}

export interface RuleCreature {
  id: string;
  name: string;
  type: string;
  armorClass: string;
  initiative: string;
  hitPoints: string;
  speed: string;
  abilityScores: RuleCreatureAbility[];
  skills?: string;
  resistances?: string;
  immunities?: string;
  equipment?: string;
  senses: string;
  languages: string;
  challenge: string;
  traits: string[];
  actions: string[];
  bonusActions: string[];
  reactions: string[];
  sourcePage: number;
}

export interface RuleCreatureAbility {
  label: string;
  score: string;
}

export interface RuleGenericNpc {
  id: string;
  name: string;
  category: string;
  role: string;
  lineage: string;
  summary: string;
  tags: string[];
  armorClass: number;
  hitPoints: number;
  speed: string;
  initiative: string;
  proficiencyBonus: number;
  challenge: string;
  abilities: RuleGenericAbilityScores;
  personality: string[];
  saves: string[];
  skills: string[];
  traits: string[];
  attacks: string[];
  spells: string[];
  equipment: string[];
}

export interface RuleGenericAbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}
