import type { CombatProfile } from './combat';

export interface Campaign {
  id: string;
  name: string;
  system: string;
  startingLevel: number;
  partySize: string;
  premise: string;
  npcs: CampaignNpc[];
  items: CampaignItem[];
  locations: CampaignLocation[];
  scenes: CampaignScene[];
  encounters: CampaignEncounter[];
  playerCharacters: CampaignPlayerCharacter[];
  playerOptions: PlayerOption[];
  antagonistOptions: CampaignOption[];
  rewards: string[];
  mysteryHooks: string[];
  sealedLetter: SealedLetter;
  acts: CampaignAct[];
}

export interface CampaignIndexEntry {
  id: string;
  name: string;
  system: string;
  premise: string;
  status: string;
  currentAct: string;
  startingLevel: number;
  partySize: string;
  dataPath: string;
  coverImage: string;
  coverPosition: string;
  coverSize: string;
}

export interface CampaignEntry {
  id: string;
  name: string;
  summary: string;
  tags: string[];
}

export interface CampaignNpc extends CampaignEntry {
  role: string;
  faction: string;
  motivation: string;
  age?: string;
  ancestry?: string;
  description?: string;
  personality?: string[];
  knowledge?: string[];
  reactions?: string[];
  secret?: string;
  statBlock?: GameStatBlock;
}

export interface CampaignPlayerCharacter extends CampaignEntry {
  ancestry: string;
  className: string;
  subclass: string;
  background: string;
  affiliation: string;
  tokenUrl: string;
  gridTokenUrl: string;
}

export interface CampaignItem extends CampaignEntry {
  kind: string;
  magic?: string;
  properties: string[];
}

export interface CampaignLocation extends CampaignEntry {
  region: string;
  mapUrl: string;
  purpose: string;
  details: string[];
}

export interface CampaignScene extends CampaignEntry {
  act: string;
  order: number;
  mapUrl: string;
  objective: string;
  checks: AbilityCheck[];
  clues: string[];
  readAloud?: string;
  outcomes?: string[];
  gmNotes?: string[];
}

export interface CampaignEncounter extends CampaignEntry {
  act: string;
  location: string;
  mapUrl: string;
  difficulty: string;
  objective: string;
  combatants: string[];
  scaling: string[];
  terrain: string[];
  tactics: string[];
  developments: string[];
}

export interface AbilityCheck {
  skill: string;
  dc: number;
  result: string;
}

export interface PlayerOption extends GameStatBlock {
  id: string;
  showToken?: boolean;
  name: string;
  tags?: string[];
  ancestry: string;
  className: string;
  subclass: string;
  background: string;
  hook: string;
  level: number;
  feat: string;
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface GameStatBlock {
  combat?: CombatProfile;
  armorClass: number;
  hitPoints: number;
  speed: string;
  initiative: string;
  proficiencyBonus: number;
  abilities: AbilityScores;
  saves: string[];
  skills: string[];
  attacks: string[];
  features: string[];
  spells: string[];
  equipment: string[];
  challenge?: string;
}

export interface CampaignOption {
  id: string;
  name: string;
  summary: string;
}

export interface SealedLetter {
  school: string[];
  arcanaDc: number;
  religionDc: number;
  traits: string[];
  message: string;
}

export interface CampaignAct {
  id: string;
  label: string;
  name: string;
  summary: string;
  objective: string;
  status: 'Preparado' | 'En curso' | 'Completado';
  scenes: string[];
}
