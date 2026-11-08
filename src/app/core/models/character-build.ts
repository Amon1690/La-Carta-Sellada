import type { AbilityScores, GameStatBlock } from './campaign';
export type Ability = keyof AbilityScores;
export interface AssignedEquipment {
    id: string;
    quantity: number;
    equipped: boolean;
    twoHanded: boolean;
}
/** Versioned choices; the existing stat-block fields remain the shared consumer contract. */
export interface CharacterBuild {
    version: 1;
    ancestryId: string;
    variantId: string;
    backgroundId: string;
    classId: string;
    subclass: string;
    level: number;
    scores: AbilityScores;
    scoresIncludeBonuses: boolean;
    backgroundBoosts: Partial<AbilityScores>;
    classSkills: string[];
    extraSkills: string[];
    expertise: string[];
    humanFeatId: string;
    featIds: string[];
    equipment: AssignedEquipment[];
    cantripIds: string[];
    preparedIds: string[];
    spellbookIds: string[];
    originCantripIds: string[];
    magicAbility: Ability;
    magicChoices: Record<string, {
        classId: string;
        ability: Ability;
        cantripIds: string[];
        spellId: string;
    }>;
    legacy?: GameStatBlock;
    hpMethod: 'fixed' | 'rolled';
    hpRolls: number[];
    resilientAbility: Ability;
    fightingStyle: string;
    /** Elecciones pendientes en guardados anteriores; nunca se deducen del libro. */
    ritualSpellIds?: string[];
    ritualAbility?: Ability;
    mounted?: boolean;
    divineOrder: 'protector' | 'thaumaturge';
    primalOrder: 'magician' | 'warden';
}
