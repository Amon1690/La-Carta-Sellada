export type CombatCondition = 'prone' | 'blinded' | 'restrained' | 'poisoned' | 'incapacitated';
export type CombatSide = 'party' | 'enemy' | 'neutral';
export type SaveAbility = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
export interface CombatResource { id: string; name: string; maximum: number; kind?: 'slot' | 'uses' | 'charges'; level?: number }
export interface CombatCost { resourceId: string; amount: number }
export interface CombatDamage { dice: string; type: string; critical?: boolean }
export interface CombatAction {
  source: string; name: string; kind: 'melee' | 'ranged' | 'spell';
  resolution: 'attack' | 'save' | 'automatic'; bonus?: number;
  saveAbility?: SaveAbility; dc?: number; halfOnSave: boolean;
  range?: number; longRange?: number; targets: number; repeatTargets: boolean;
  damage: CombatDamage[]; cost?: CombatCost; resourceConfirmed: boolean;
  reviewed: boolean; notes: string;
  spellLevel?: number;
  attackType?: 'melee' | 'ranged';
  effectOnly?: boolean;
  manualEffects?: boolean;
}
export interface CombatReaction {
  source: string; name: string; trigger: 'hit' | 'damage' | 'miss' | 'spell'; protectOthers: boolean;
  range: number; meleeOnly: boolean;
  effect: 'armor' | 'reduce' | 'half' | 'disadvantage' | 'cancel' | 'redirect' | 'counter' | 'manual';
  amount: number; dice: string; duration: 'attack' | 'next-turn';
  actionSource?: string; cost?: CombatCost; resourceConfirmed: boolean; reviewed: boolean;
  saveAbility?: SaveAbility; dc?: number; refundSpell?: boolean;
  spellLevel?: number;
}
export interface CombatProfile {
  actions: CombatAction[]; reactions: CombatReaction[]; resources: CombatResource[];
  attacksPerTurn?: number;
}
export interface Combatant {
  id: string; actorId: string; name: string; x: number; y: number; size: number;
  hp: number; maxHp: number; armorClass?: number;
  conditions?: CombatCondition[]; side?: CombatSide;
  saves: Record<SaveAbility, number>; actions: CombatAction[]; reactions: CombatReaction[];
  resources: CombatResource[]; attacksPerTurn: number; notes: string[];
  profile: CombatProfile;
}
export interface CombatRoll { dice: number[]; bonus: number; total: number; natural: number; advantage?: boolean; disadvantage?: boolean }
export interface CombatPending {
  phase?: 'casting' | 'defense' | 'response';
  context?: { advantage: boolean; disadvantage: boolean; armorAdjustment: number; damageFactor: number; rangeResolved?: boolean };
  attackerId: string; targetId: string; action: CombatAction; roll?: CombatRoll; save?: CombatRoll;
  baseAc: number; extraAc: number; damage: { type: string; rolled: number; dice: number[]; bonus: number }[];
  factor: number; reduction: number; cancelled: boolean; redirected: boolean;
  manual: boolean; manualRequested?: boolean; effectsConfirmed: boolean; reactions: string[];
}
export interface CombatResolution { attackerId: string; targetId: string; hit: boolean; damage: number }
export interface CombatNarrativeMessage { observerId: string; audience: string[]; text: string }
export interface CombatNarrativeEvent { id: string; messages: CombatNarrativeMessage[] }
export interface CombatState {
  version: 1; started: boolean; round: number; turnId?: string;
  usedAttacks: number; spellUsed: boolean; reactionUsed: string[];
  armorEffects: Record<string, number>; resources: Record<string, Record<string, number>>;
  log: string[]; narrative?: CombatNarrativeEvent[]; pending?: CombatPending;
  context?: { advantage: boolean; disadvantage: boolean; armorAdjustment: number; damageFactor: number; rangeResolved?: boolean; confirmed: boolean };
  slotsSpent: string[];
  queue: { attackerId: string; action: CombatAction; targetId: string; reactionAttack?: boolean; castApproved?: boolean }[];
}
