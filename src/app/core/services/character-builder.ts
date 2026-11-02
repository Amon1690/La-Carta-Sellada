import { AbilityScores, GameStatBlock, PlayerOption } from '../models/campaign';
import { Ability, CharacterBuild } from '../models/character-build';
import { CombatAction, CombatProfile, CombatResource } from '../models/combat';
import { RulesCompendium, RuleEquipment, RuleSpell } from '../models/rules';
import { CHARACTER_BACKGROUNDS, CHARACTER_ORIGINS } from '../data/character-origins';
import { deriveCombat, normalizeCombat } from './combat-rules';
export const ABILITIES: {
    id: Ability;
    label: string;
    name: string;
}[] = [
    { id: 'strength', label: 'FUE', name: 'Fuerza' }, { id: 'dexterity', label: 'DES', name: 'Destreza' },
    { id: 'constitution', label: 'CON', name: 'Constitución' }, { id: 'intelligence', label: 'INT', name: 'Inteligencia' },
    { id: 'wisdom', label: 'SAB', name: 'Sabiduría' }, { id: 'charisma', label: 'CAR', name: 'Carisma' },
];
export const modifier = (score: number): number => Math.floor((score - 10) / 2);
export const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value}`;
const n = normalizeCombat;
export const CLASS_RULES: Record<string, {
    saves: Ability[];
    skills: string[];
    skillCount: number;
    martial: boolean;
    armor: string[];
    subclasses: string[];
}> = {
    barbaro: { saves: ['strength', 'constitution'], skills: ['trato-con-animales', 'atletismo', 'intimidacion', 'naturaleza', 'percepcion', 'supervivencia'], skillCount: 2, martial: true, armor: ['ligera', 'media', 'escudo'], subclasses: ['Senda del Árbol del Mundo', 'Senda del berserker', 'Senda del corazón salvaje', 'Senda del fanático'] },
    bardo: { saves: ['dexterity', 'charisma'], skills: [], skillCount: 3, martial: false, armor: ['ligera'], subclasses: ['Colegio de la danza', 'Colegio del conocimiento', 'Colegio del glamour', 'Colegio del valor'] },
    brujo: { saves: ['wisdom', 'charisma'], skills: ['conocimiento-arcano', 'engano', 'historia', 'intimidacion', 'investigacion', 'naturaleza', 'religion'], skillCount: 2, martial: false, armor: ['ligera'], subclasses: ['Patrón celestial', 'Patrón feérico', 'Patrón infernal', 'Patrón primigenio'] },
    clerigo: { saves: ['wisdom', 'charisma'], skills: ['historia', 'perspicacia', 'medicina', 'persuasion', 'religion'], skillCount: 2, martial: false, armor: ['ligera', 'media', 'escudo'], subclasses: ['Dominio de la guerra', 'Dominio de la luz', 'Dominio de la vida', 'Dominio del engaño'] },
    druida: { saves: ['intelligence', 'wisdom'], skills: ['conocimiento-arcano', 'trato-con-animales', 'perspicacia', 'medicina', 'naturaleza', 'percepcion', 'religion', 'supervivencia'], skillCount: 2, martial: false, armor: ['ligera', 'escudo'], subclasses: ['Círculo de la luna', 'Círculo de la tierra', 'Círculo de las estrellas', 'Círculo del mar'] },
    explorador: { saves: ['strength', 'dexterity'], skills: ['trato-con-animales', 'atletismo', 'perspicacia', 'investigacion', 'naturaleza', 'percepcion', 'sigilo', 'supervivencia'], skillCount: 3, martial: true, armor: ['ligera', 'media', 'escudo'], subclasses: ['Acechador en la penumbra', 'Cazador', 'Errante feérico', 'Señor de las bestias'] },
    guerrero: { saves: ['strength', 'constitution'], skills: ['acrobacias', 'trato-con-animales', 'atletismo', 'historia', 'perspicacia', 'intimidacion', 'percepcion', 'persuasion', 'supervivencia'], skillCount: 2, martial: true, armor: ['ligera', 'media', 'pesada', 'escudo'], subclasses: ['Caballero arcano', 'Campeón', 'Guerrero psiónico', 'Maestro del combate'] },
    hechicero: { saves: ['constitution', 'charisma'], skills: ['conocimiento-arcano', 'engano', 'perspicacia', 'intimidacion', 'persuasion', 'religion'], skillCount: 2, martial: false, armor: [], subclasses: ['Hechicería aberrante', 'Hechicería de magia salvaje', 'Hechicería dracónica', 'Hechicería mecánica'] },
    mago: { saves: ['intelligence', 'wisdom'], skills: ['conocimiento-arcano', 'historia', 'perspicacia', 'investigacion', 'medicina', 'naturaleza', 'religion'], skillCount: 2, martial: false, armor: [], subclasses: ['Abjurador', 'Adivino', 'Evocador', 'Ilusionista'] },
    monje: { saves: ['strength', 'dexterity'], skills: ['acrobacias', 'atletismo', 'historia', 'perspicacia', 'religion', 'sigilo'], skillCount: 2, martial: false, armor: [], subclasses: ['Guerrero de la mano abierta', 'Guerrero de la misericordia', 'Guerrero de la sombra', 'Guerrero de los elementos'] },
    paladin: { saves: ['wisdom', 'charisma'], skills: ['atletismo', 'perspicacia', 'intimidacion', 'medicina', 'persuasion', 'religion'], skillCount: 2, martial: true, armor: ['ligera', 'media', 'pesada', 'escudo'], subclasses: ['Juramento de entrega', 'Juramento de gloria', 'Juramento de los antiguos', 'Juramento de venganza'] },
    picaro: { saves: ['dexterity', 'intelligence'], skills: ['acrobacias', 'atletismo', 'engano', 'perspicacia', 'intimidacion', 'investigacion', 'juego-de-manos', 'percepcion', 'persuasion', 'sigilo'], skillCount: 4, martial: false, armor: ['ligera'], subclasses: ['Asesino', 'Embaucador arcano', 'Ladrón', 'Rebanaalmas'] },
};
const PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const HALF_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const WIZARD_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25];
const WARLOCK_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
const THIRD_PREPARED = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
const FULL_SLOTS = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const THIRD_SLOTS = [[], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]];
export function magicProgression(build: CharacterBuild): {
    prepared: number;
    cantrips: number;
    maximum: number;
    slots: number[];
    ability: Ability;
    classId: string;
    pact: boolean;
} {
    const level = Math.max(1, Math.min(20, Math.floor(Number.isFinite(build.level) ? build.level : 1))), i = level - 1, id = build.classId;
    const third = (id === 'guerrero' && n(build.subclass) === 'caballero arcano') || (id === 'picaro' && n(build.subclass) === 'embaucador arcano');
    let slots: number[] = [], prepared = 0, cantrips = 0;
    if (third) {
        slots = THIRD_SLOTS[i];
        prepared = THIRD_PREPARED[i];
        cantrips = level < 3 ? 0 : (id === 'picaro' ? 3 : 2) + (level >= 10 ? 1 : 0);
    }
    else if (['bardo', 'clerigo', 'druida', 'hechicero', 'mago'].includes(id)) {
        slots = FULL_SLOTS[i];
        prepared = id === 'mago' ? WIZARD_PREPARED[i] : id === 'hechicero' && level < 3 ? level * 2 : PREPARED[i];
        cantrips = (['mago', 'clerigo'].includes(id) ? 3 : id === 'hechicero' ? 4 : 2) + (level >= 4 ? 1 : 0) + (level >= 10 ? 1 : 0);
    }
    else if (['paladin', 'explorador'].includes(id)) {
        slots = FULL_SLOTS[Math.ceil(level / 2) - 1];
        prepared = HALF_PREPARED[i];
    }
    else if (id === 'brujo') {
        slots = Array.from({ length: Math.min(5, Math.ceil(level / 2)) }, () => 0);
        slots[slots.length - 1] = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
        prepared = WARLOCK_PREPARED[i];
        cantrips = 2 + (level >= 4 ? 1 : 0) + (level >= 10 ? 1 : 0);
    }
    if (id === 'clerigo' && build.divineOrder === 'thaumaturge')
        cantrips++;
    if (id === 'druida' && build.primalOrder === 'magician')
        cantrips++;
    return { prepared, cantrips, slots: [...slots], maximum: slots.length, ability: third || id === 'mago' ? 'intelligence' : ['clerigo', 'druida', 'explorador'].includes(id) ? 'wisdom' : 'charisma', classId: third ? 'mago' : id, pact: id === 'brujo' };
}
export const featLevels = (classId: string): number[] => [4, 8, 12, 16, ...(classId === 'guerrero' ? [6, 14] : classId === 'picaro' ? [10] : []), 19].sort((a, b) => a - b);
const aliases: Record<string, string> = { humana: 'humano', elfica: 'elfo', elfico: 'elfo', elfa: 'elfo', enana: 'enano', gnoma: 'gnomo', mediana: 'mediano', orca: 'orco', draconida: 'draconido', paladina: 'paladin', barda: 'bardo', guerrera: 'guerrero', maga: 'mago', exploradora: 'explorador', picara: 'picaro', hechicera: 'hechicero', cleriga: 'clerigo', animadora: 'animador', artesana: 'artesano', charlatana: 'charlatan', guardiana: 'guardia', ermitana: 'ermitano', sabio: 'erudito', mercader: 'comerciante' };
export const canonicalChoice = (text: string): string => aliases[n(text)] ?? n(text);
export function initialBuild(sheet: PlayerOption | undefined, rules: RulesCompendium): CharacterBuild {
    if (sheet?.build?.version === 1)
        return structuredClone(sheet.build);
    const classId = canonicalChoice(sheet?.className ?? ''), config = CLASS_RULES[classId];
    const subclass = config?.subclasses.find((s) => n(s).replace(' de la ', ' de ') === n(sheet?.subclass ?? '').replace(' de la ', ' de ').replace('cazadora', 'cazador').replace('evocadora', 'evocador').replace('maestra', 'maestro').replace('guerrera', 'guerrero').replace('embaucadora', 'embaucador')) ?? '';
    return { version: 1, ancestryId: canonicalChoice(sheet?.ancestry ?? ''), variantId: '', backgroundId: canonicalChoice(sheet?.background ?? ''), classId, subclass, level: sheet?.level ?? 1,
        scores: structuredClone(sheet?.abilities ?? { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }), scoresIncludeBonuses: !!sheet, backgroundBoosts: {}, classSkills: [], extraSkills: [], expertise: [], humanFeatId: '', featIds: [],
        equipment: (sheet?.equipment ?? []).flatMap((text) => { const item = rules.equipment.find((e) => n(e.name) === n(text)); return item ? [{ id: item.id, quantity: 1, equipped: true, twoHanded: false }] : []; }),
        cantripIds: [], preparedIds: [], spellbookIds: [], originCantripIds: [], magicAbility: 'intelligence', magicChoices: {}, hpMethod: 'fixed', hpRolls: [], resilientAbility: 'constitution', fightingStyle: '', divineOrder: 'protector', primalOrder: 'warden' };
}
export function availableSpells(build: CharacterBuild, rules: RulesCompendium, cantrip: boolean, fromBook = true): RuleSpell[] {
    const magic = magicProgression(build), ids = build.spellbookIds;
    const className = rules.classes.find((c) => c.id === magic.classId)?.name;
    const lists = build.classId === 'bardo' && build.level >= 10 && !cantrip ? ['bardo', 'clerigo', 'druida', 'mago'] : [canonicalChoice(className ?? '')];
    return rules.spells.filter((s) => s.classes.some((c) => lists.includes(canonicalChoice(c))) && (cantrip ? s.level === 0 : s.level > 0 && s.level <= magic.maximum) && (cantrip || !fromBook || build.classId !== 'mago' || ids.includes(s.id)));
}
export function originMagic(build: CharacterBuild): {
    key: string;
    classId: string;
    name: string;
}[] {
    const result: {
        key: string;
        classId: string;
        name: string;
    }[] = [];
    const bg = CHARACTER_BACKGROUNDS.find((b) => b.id === build.backgroundId);
    if (bg?.feat === 'iniciado-en-la-magia')
        result.push({ key: 'background', classId: bg.id === 'acolito' ? 'clerigo' : bg.id === 'guia' ? 'druida' : 'mago', name: `${bg.name}: Iniciado en la magia` });
    if (build.ancestryId === 'humano' && build.humanFeatId === 'iniciado-en-la-magia')
        result.push({ key: 'human', classId: build.magicChoices['human']?.classId ?? 'mago', name: 'Humano: Iniciado en la magia' });
    build.featIds.forEach((id, index) => {
        if (id === 'iniciado-en-la-magia') {
            const key = `feat-${index}`;
            result.push({ key, classId: build.magicChoices[key]?.classId ?? 'mago', name: `Dote de nivel ${featLevels(build.classId)[index]}: Iniciado en la magia` });
        }
    });
    return result;
}
const WEAPON_RANGES: Record<string, [
    number,
    number
]> = { daga: [6, 18], 'hacha-de-mano': [6, 18], jabalina: [9, 36], lanza: [6, 18], 'martillo-ligero': [6, 18], tridente: [6, 18], dardo: [6, 18], 'arco-corto': [24, 96], 'ballesta-ligera': [24, 96], honda: [9, 36], 'arco-largo': [45, 180], 'ballesta-de-mano': [9, 36], 'ballesta-pesada': [30, 120], cerbatana: [7.5, 30], mosquete: [12, 36], pistola: [9, 27] };
export interface CharacterCalculation {
    stats: GameStatBlock;
    ancestry: string;
    className: string;
    background: string;
    subclass: string;
    feat: string;
    errors: string[];
    warnings: string[];
    formulas: string[];
    choiceLimits: {
        extraSkills: number;
        expertise: number;
    };
}
export function calculateCharacter(build: CharacterBuild, rules: RulesCompendium, original?: PlayerOption): CharacterCalculation {
    const errors: string[] = [], warnings: string[] = [], formulas: string[] = [];
    const ancestry = CHARACTER_ORIGINS.find((o) => o.id === build.ancestryId), background = CHARACTER_BACKGROUNDS.find((b) => b.id === build.backgroundId), cls = rules.classes.find((c) => c.id === build.classId), config = CLASS_RULES[build.classId];
    const level = build.level;
    if (!Number.isInteger(level) || level < 1 || level > 20)
        errors.push('El nivel debe estar entre 1 y 20.');
    if (!ancestry)
        errors.push('Selecciona un linaje del catálogo.');
    if (ancestry?.variants && !ancestry.variants.some((v) => v.id === build.variantId))
        errors.push('Elige la variante de tu linaje.');
    if (!background)
        errors.push('Selecciona un trasfondo del catálogo.');
    if (!cls || !config)
        errors.push('Selecciona una clase del catálogo.');
    if (level >= 3 && !config?.subclasses.includes(build.subclass))
        errors.push('Selecciona una subclase de tu clase.');
    if (level < 3 && build.subclass)
        errors.push('La subclase se obtiene en el nivel 3.');
    const abilities = { ...build.scores };
    for (const { id, name } of ABILITIES) {
        if (!Number.isInteger(abilities[id]) || abilities[id] < 1 || abilities[id] > 30)
            errors.push(`${name}: introduce una puntuación entre 1 y 30.`);
        if (!build.scoresIncludeBonuses && (build.backgroundBoosts[id] ?? 0) > 0)
            abilities[id] = Math.max(abilities[id], Math.min(20, abilities[id] + (build.backgroundBoosts[id] ?? 0)));
    }
    if (!build.scoresIncludeBonuses) {
        const boosts = Object.entries(build.backgroundBoosts).filter(([, v]) => v !== 0);
        if (boosts.reduce((sum, [, v]) => sum + v, 0) !== 3 || boosts.some(([id, v]) => !background?.abilities.includes(id as Ability) || !Number.isInteger(v) || v < 1 || v > 2))
            errors.push('Distribuye los aumentos del trasfondo: +2 y +1, o +1 a sus tres características.');
    }
    const proficiency = 2 + Math.floor((Math.max(1, level) - 1) / 4), dex = modifier(abilities.dexterity), con = modifier(abilities.constitution), str = modifier(abilities.strength), wis = modifier(abilities.wisdom), cha = modifier(abilities.charisma);
    const feats = [...(background ? [background.feat] : []), ...(build.ancestryId === 'humano' ? [build.humanFeatId] : []), ...build.featIds].filter(Boolean);
    if (build.ancestryId === 'humano' && !rules.feats.some((f) => f.id === build.humanFeatId && n(f.category).includes('origen')))
        errors.push('Elige la dote de origen del humano.');
    if (build.featIds.filter(Boolean).length > featLevels(build.classId).filter((l) => l <= level).length)
        errors.push('Hay más dotes elegidas que mejoras disponibles para el nivel.');
    if (build.featIds.some((id, i) => id && featLevels(build.classId)[i] > level))
        errors.push('Quita las dotes de niveles que todavía no has alcanzado.');
    if (build.featIds.filter(Boolean).some((id) => !rules.feats.some((f) => f.id === id)))
        errors.push('Hay una dote que no pertenece al catálogo.');
    if (build.fightingStyle && !(build.classId === 'guerrero' || ['explorador', 'paladin'].includes(build.classId) && level >= 2))
        errors.push('Tu clase y nivel todavía no conceden estilo de combate.');
    if (build.featIds.some((id) => rules.feats.find((f) => f.id === id)?.category === 'Dote de don épico') && level < 19)
        errors.push('Los dones épicos requieren nivel 19.');
    const training = new Set(config?.armor ?? []);
    if (build.classId === 'clerigo' && build.divineOrder === 'protector')
        training.add('pesada');
    if (build.classId === 'druida' && build.primalOrder === 'warden')
        training.add('media');
    if (build.classId === 'bardo' && n(build.subclass) === 'colegio del valor' && level >= 3) {
        training.add('media');
        training.add('escudo');
    }
    if (feats.includes('ligeramente-acorazado')) {
        training.add('ligera');
        training.add('escudo');
    }
    if (feats.includes('moderadamente-acorazado'))
        training.add('media');
    if (feats.includes('muy-acorazado'))
        training.add('pesada');
    const shieldTrained = training.has('escudo');
    const items = build.equipment.map((assigned) => ({ assigned, item: rules.equipment.find((e) => e.id === assigned.id) }));
    if (items.some(({ item, assigned }) => !item || !Number.isInteger(assigned.quantity) || assigned.quantity < 1 || assigned.quantity > 999))
        errors.push('Revisa los objetos y sus cantidades (1–999).');
    const equipped = items.filter((x) => x.item && x.assigned.equipped) as {
        assigned: CharacterBuild['equipment'][number];
        item: RuleEquipment;
    }[];
    const armors = equipped.filter(({ item }) => n(item.category).includes('armadura')), shields = equipped.filter(({ item }) => item.id === 'escudo'), armor = armors[0]?.item, shield = shields.length > 0;
    if (armors.length > 1 || shields.length > 1)
        errors.push('Solo puedes equipar una armadura y un escudo.');
    const weapons = equipped.filter(({ item }) => /sencilla|marcial/i.test(item.category));
    if (shield && weapons.some(({ item, assigned }) => n(item.properties.join(' ')).includes('a dos manos') || assigned.twoHanded))
        errors.push('No puedes usar un arma a dos manos y un escudo a la vez.');
    if (shield && !shieldTrained)
        errors.push('No tienes entrenamiento con escudos: quítalo o completa la elección que concede ese entrenamiento.');
    const heavy = !!armor && n(armor.category).includes('pesada');
    let ac = 10 + dex;
    if (armor) {
        const base = Number(armor.properties.join(' ').match(/CA (\d+)/)?.[1]);
        if (!base)
            errors.push('Falta la CA de la armadura.');
        ac = base + (heavy ? 0 : n(armor.category).includes('media') ? Math.min(feats.includes('maestro-en-armaduras-medias') ? 3 : 2, dex) : dex);
    }
    else if (build.classId === 'barbaro')
        ac = Math.max(ac, 10 + dex + con);
    else if (build.classId === 'monje' && !shield)
        ac = Math.max(ac, 10 + dex + wis);
    else if (build.classId === 'bardo' && n(build.subclass) === 'colegio de la danza' && level >= 3 && !shield)
        ac = Math.max(ac, 10 + dex + cha);
    else if (build.classId === 'hechicero' && n(build.subclass) === 'hechiceria draconica' && level >= 3)
        ac = Math.max(ac, 10 + dex + cha);
    ac += (shield && shieldTrained ? 2 : 0) + (armor && build.fightingStyle === 'defensa' ? 1 : 0);
    const die = Number(cls?.hitDie.replace('d', '') ?? 0);
    let hp = die + con;
    for (let i = 1; i < Math.max(1, Math.min(20, level)); i++) {
        const roll = build.hpMethod === 'rolled' ? build.hpRolls[i - 1] : die / 2 + 1;
        if (!Number.isInteger(roll) || roll < 1 || roll > die)
            errors.push(`Introduce el resultado del dado de PG para el nivel ${i + 1} (1–${die}).`);
        hp += Math.max(1, (roll || 0) + con);
    }
    hp = Math.max(1, hp) + (build.ancestryId === 'enano' ? level : 0) + (feats.includes('duro') ? 2 * level : 0) + (feats.includes('don-de-la-fortaleza') ? 40 : 0) + (build.classId === 'hechicero' && n(build.subclass) === 'hechiceria draconica' && level >= 3 ? level : 0);
    let speed = ancestry?.speed ?? 0;
    if (build.ancestryId === 'elfo' && build.variantId === 'bosque')
        speed = 10.5;
    if (build.classId === 'barbaro' && level >= 5 && !heavy)
        speed += 3;
    if (build.classId === 'monje' && level >= 2 && !armor && !shield)
        speed += 3 + 1.5 * Math.min(4, Math.floor((level - 2) / 4));
    if (build.classId === 'explorador' && level >= 6 && !heavy)
        speed += 3;
    if (feats.includes('veloz'))
        speed += 3;
    if (feats.includes('don-de-la-velocidad'))
        speed += 9;
    const strengthRequired = Number(armor?.properties.join(' ').match(/Fue (\d+)/)?.[1] ?? 0);
    if (abilities.strength < strengthRequired)
        speed = Math.max(0, speed - 3);
    const initiative = dex + (feats.includes('alerta') ? proficiency : 0);
    const aura = build.classId === 'paladin' && level >= 6 ? Math.max(1, cha) : 0;
    const saves = ABILITIES.map(({ id, label }) => `${label} ${signed(modifier(abilities[id]) + (config?.saves.includes(id) || (build.classId === 'monje' && level >= 14) || (build.classId === 'picaro' && level >= 15 && ['wisdom', 'charisma'].includes(id)) || (feats.includes('resiliente') && build.resilientAbility === id) ? proficiency : 0) + aura)}`);
    const features = [...(ancestry?.traits ?? []), ...(ancestry?.variants?.find((v) => v.id === build.variantId)?.traits ?? []), ...(cls?.features.filter((f) => f.level <= level).map((f) => `${f.name} (nivel ${f.level}). ${f.description}`) ?? []), ...(background ? [`Trasfondo ${background.name}: ${background.tools}.`] : []), ...feats.map((id) => { const f = rules.feats.find((f) => f.id === id); return f ? `${f.name}. ${f.description}` : id; })];
    const selectedStyle = rules.feats.find((f) => f.id === build.fightingStyle);
    if (selectedStyle)
        features.push(`${selectedStyle.name}. ${selectedStyle.description}`);
    if (build.classId === 'clerigo')
        features.push(`Orden divina: ${build.divineOrder === 'protector' ? 'Protector' : 'Taumaturgo'}.`);
    if (build.classId === 'druida')
        features.push(`Orden primigenia: ${build.primalOrder === 'warden' ? 'Guardián' : 'Mago'}.`);
    if (level >= 3)
        features.push(`Subclase: ${build.subclass}. Consulta sus rasgos específicos en el manual de 2024.`);
    const knownSkills = new Set([...(background?.skills ?? []), ...build.classSkills, ...build.extraSkills]);
    if (build.classSkills.length !== (config?.skillCount ?? 0) || new Set(build.classSkills).size !== build.classSkills.length || build.classSkills.some((id) => config?.skills.length && !config.skills.includes(id)))
        errors.push(`Selecciona ${config?.skillCount ?? 0} habilidades de clase distintas.`);
    const featSkills = feats.filter((id) => id === 'habilidoso').length * 3;
    const extraCount = (build.ancestryId === 'humano' || build.ancestryId === 'elfo' ? 1 : 0) + featSkills + (build.classId === 'barbaro' && level >= 3 ? 1 : 0) + (build.classId === 'bardo' && n(build.subclass) === 'colegio del conocimiento' && level >= 3 ? 3 : 0);
    if (build.extraSkills.length !== extraCount || new Set(build.extraSkills).size !== build.extraSkills.length)
        errors.push(`El origen y los rasgos requieren ${extraCount} elecciones adicionales de habilidades distintas.`);
    if (build.ancestryId === 'elfo' && !build.extraSkills.some((id) => ['percepcion', 'perspicacia', 'supervivencia'].includes(id)))
        errors.push('Sentidos agudos requiere Percepción, Perspicacia o Supervivencia.');
    if ([...build.classSkills, ...build.extraSkills].filter((id) => background?.skills.includes(id)).length || new Set([...build.classSkills, ...build.extraSkills]).size !== build.classSkills.length + build.extraSkills.length)
        errors.push('Elige habilidades diferentes de las ya concedidas por el trasfondo y los otros rasgos.');
    const expertiseCount = build.classId === 'picaro' ? (level >= 6 ? 4 : 2) : build.classId === 'bardo' ? (level >= 9 ? 4 : level >= 2 ? 2 : 0) : build.classId === 'explorador' ? (level >= 9 ? 3 : level >= 2 ? 1 : 0) : build.classId === 'mago' && level >= 2 ? 1 : 0;
    if (build.expertise.length !== expertiseCount || new Set(build.expertise).size !== build.expertise.length)
        errors.push(`Selecciona ${expertiseCount} pericias distintas de tus habilidades competentes.`);
    if (build.classId === 'mago' && build.expertise.some((id) => !['conocimiento-arcano', 'historia', 'investigacion', 'medicina', 'naturaleza', 'religion'].includes(id)))
        errors.push('La pericia de Erudito debe ser una de las habilidades de conocimiento de mago.');
    if (feats.some((id, i) => id && feats.indexOf(id) !== i && !rules.feats.find((f) => f.id === id)?.repeatable))
        errors.push('No puedes repetir una dote que no es repetible.');
    const allSkillIds = rules.skills.map((s) => s.id);
    if ([...knownSkills, ...build.expertise].some((id) => !allSkillIds.includes(id)) || build.expertise.some((id) => !knownSkills.has(id)))
        errors.push('Las pericias necesitan una habilidad competente válida.');
    const skillAbility = (text: string): Ability => ABILITIES.find((a) => n(a.name) === n(text))?.id ?? 'wisdom';
    const skills = rules.skills.map((s) => `${s.name} ${signed(modifier(abilities[skillAbility(s.ability)]) + (knownSkills.has(s.id) || feats.includes('don-de-la-habilidad') ? proficiency * (build.expertise.includes(s.id) ? 2 : 1) : build.classId === 'bardo' && level >= 2 ? Math.floor(proficiency / 2) : 0) + (((build.classId === 'clerigo' && build.divineOrder === 'thaumaturge' && ['conocimiento-arcano', 'religion'].includes(s.id)) || (build.classId === 'druida' && build.primalOrder === 'magician' && ['conocimiento-arcano', 'naturaleza'].includes(s.id))) ? Math.max(1, wis) : 0))}`);
    const magic = magicProgression(build), classSpells = [...build.cantripIds, ...build.preparedIds].filter(Boolean);
    const cantrips = availableSpells(build, rules, true), prepared = availableSpells(build, rules, false);
    if (build.cantripIds.filter(Boolean).length > magic.cantrips || build.preparedIds.filter(Boolean).length > magic.prepared)
        errors.push('La cantidad de conjuros supera la de tu clase y nivel.');
    if (build.cantripIds.some((id) => id && !cantrips.some((s) => s.id === id)) || build.preparedIds.some((id) => id && !prepared.some((s) => s.id === id)))
        errors.push('Hay conjuros que no están disponibles para tu clase, nivel o libro.');
    if (new Set(classSpells).size !== classSpells.length)
        errors.push('No repitas conjuros en la lista de clase.');
    if (build.classId === 'mago' && build.spellbookIds.some((id) => !availableSpells(build, rules, false, false).some((s) => s.id === id)))
        errors.push('El libro contiene conjuros que no están disponibles para tu nivel.');
    const granted: string[] = [];
    const grants: {
        id: string;
        ability: Ability;
        resource?: CombatResource;
    }[] = [];
    const grant = (name: string, ability: Ability = build.magicAbility, maximum = 1, key = 'ancestry') => {
        const spell = rules.spells.find((s) => n(s.name) === n(name));
        if (!spell) {
            errors.push(`El catálogo no contiene el conjuro concedido «${name}».`);
            return;
        }
        granted.push(spell.id);
        grants.push({ id: spell.id, ability, resource: spell.level > 0 ? { id: `builder:${key}:${spell.id}`, name: `${name}: usos de ${key === 'ancestry' ? 'linaje' : key === 'class' ? 'clase' : 'Iniciado en la magia'}`, maximum, kind: 'uses' } : undefined });
    };
    if (build.ancestryId === 'aasimar')
        grant('Luz', 'charisma');
    if (build.ancestryId === 'tiflin') {
        grant('Taumaturgia');
        const names = build.variantId === 'infernal' ? ['Descarga de fuego', 'Reprensión infernal', 'Oscuridad'] : build.variantId === 'abisal' ? ['Rociada venenosa', 'Rayo nauseabundo', 'Inmovilizar persona'] : ['Toque helado', 'Falsa vida', 'Rayo debilitador'];
        grant(names[0]);
        if (level >= 3)
            grant(names[1]);
        if (level >= 5)
            grant(names[2]);
    }
    if (build.ancestryId === 'elfo') {
        const names = build.variantId === 'bosque' ? ['Saber druídico', 'Zancada prodigiosa', 'Pasar sin rastro'] : build.variantId === 'drow' ? ['Luces danzantes', 'Fuego feérico', 'Oscuridad'] : ['', 'Detectar magia', 'Paso brumoso'];
        if (names[0])
            grant(names[0]);
        else {
            const id = build.originCantripIds[0];
            if (!rules.spells.some((s) => s.id === id && s.level === 0 && s.classes.some((c) => canonicalChoice(c) === 'mago')))
                errors.push('Elige el truco de mago de tu linaje alto elfo.');
            else {
                granted.push(id);
                grants.push({ id, ability: build.magicAbility });
            }
        }
        if (level >= 3)
            grant(names[1]);
        if (level >= 5)
            grant(names[2]);
    }
    if (build.ancestryId === 'gnomo')
        (build.variantId === 'bosque' ? ['Ilusión menor', 'Hablar con los animales'] : ['Prestidigitación', 'Reparar']).forEach((name) => grant(name, build.magicAbility, name === 'Hablar con los animales' ? proficiency : 1));
    const originLists = originMagic(build).map((origin) => origin.classId);
    if (new Set(originLists).size !== originLists.length)
        errors.push('Las repeticiones de Iniciado en la magia deben elegir listas de clase diferentes.');
    for (const origin of originMagic(build)) {
        const choice = build.magicChoices[origin.key];
        const list = rules.spells.filter((s) => s.classes.some((c) => canonicalChoice(c) === origin.classId));
        if (!choice || choice.cantripIds.filter(Boolean).length !== 2 || new Set(choice.cantripIds).size !== 2 || choice.cantripIds.some((id) => !list.some((s) => s.id === id && s.level === 0)) || !list.some((s) => s.id === choice.spellId && s.level === 1))
            errors.push(`Completa los dos trucos y el conjuro de nivel 1 de ${origin.name}.`);
        else
            [...choice.cantripIds, choice.spellId].forEach((id) => grant(rules.spells.find((s) => s.id === id)!.name, choice.ability, 1, origin.key));
    }
    if (build.classId === 'explorador')
        grant('Marca del cazador', 'wisdom', level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2, 'class');
    if (build.classId === 'paladin' && level >= 2)
        grant('Castigo divino', 'charisma', 1, 'class');
    if (build.classId === 'picaro' && n(build.subclass) === 'embaucador arcano' && level >= 3 && !build.cantripIds.includes('mano-de-mago'))
        errors.push('Embaucador arcano debe incluir Mano de mago entre sus trucos.');
    const resources: CombatResource[] = magic.slots.flatMap((count, i) => count ? [{ id: `builder:slot:${i + 1}`, name: `${magic.pact ? 'Magia de pacto' : 'Espacios'} nivel ${i + 1}`, maximum: count, kind: 'slot' as const, level: i + 1 }] : []);
    resources.push(...grants.flatMap((g) => g.resource ? [g.resource] : []));
    const spellIds = [...new Set([...classSpells, ...granted])];
    const spells = spellIds.map((id) => rules.spells.find((s) => s.id === id)?.name ?? id);
    const attacks: string[] = [], actions: CombatAction[] = [];
    for (const { item, assigned } of weapons) {
        const properties = n(item.properties.join(' ')), ranged = n(item.category).includes('distancia'), finesse = properties.includes('sutil'), monk = build.classId === 'monje' && !armor && !shield && (n(item.category).includes('sencilla') && !ranged || ['espada-corta', 'cimitarra'].includes(item.id));
        const ability = ranged && !properties.includes('arrojad') ? dex : finesse || monk ? Math.max(str, dex) : str;
        const proficient = n(item.category).includes('sencilla') ? !['mago', 'hechicero'].includes(build.classId) || properties.includes('ligera') : !!config?.martial || (build.classId === 'monje' && properties.includes('ligera')) || (build.classId === 'picaro' && (properties.includes('sutil') || properties.includes('ligera'))) || build.classId === 'clerigo' && build.divineOrder === 'protector' || build.classId === 'druida' && build.primalOrder === 'warden';
        const bonus = ability + (proficient ? proficiency : 0) + (ranged && build.fightingStyle === 'tiro-con-arco' ? 2 : 0);
        const damage = item.properties[0]?.match(/(\d+d\d+|1) (.+)/), versatile = assigned.twoHanded ? properties.match(/versatil \((\d+d\d+)\)/)?.[1] : undefined;
        if (!damage) {
            warnings.push(`Revisa el daño de ${item.name}.`);
            continue;
        }
        const mode = (isRanged: boolean, range: number, longRange?: number) => {
            const damageBonus = ability + (build.fightingStyle === 'duelo' && !isRanged && !assigned.twoHanded && !properties.includes('a dos manos') && weapons.length === 1 ? 2 : 0) + (build.fightingStyle === 'combate-con-armas-arrojadizas' && isRanged && properties.includes('arrojad') ? 2 : 0);
            const weaponDice = versatile ?? damage[1];
            const martialDie = level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
            const bestDice = monk && Number(weaponDice.match(/^1d(\d+)$/)?.[1] ?? 99) < martialDie ? `1d${martialDie}` : weaponDice;
            const dice = damage[1] === '1' ? String(Math.max(0, 1 + damageBonus)) : `${bestDice}${signed(damageBonus)}`;
            const source = `${item.name}${isRanged && !ranged ? ' (arrojada)' : ''}. Ataque ${isRanged ? 'a distancia' : 'cuerpo a cuerpo'}: ${signed(bonus)} al ataque, alcance ${range} m${longRange ? ` (largo ${longRange} m)` : ''}. Impacto: ${dice ? `(${dice})` : '1'} de ${damage[2]}.`;
            attacks.push(source);
            actions.push({ source, name: item.name + (isRanged && !ranged ? ' (arrojada)' : ''), kind: isRanged ? 'ranged' : 'melee', resolution: 'attack', bonus, range, longRange, targets: 1, repeatTargets: false, halfOnSave: false, damage: dice ? [{ dice, type: damage[2] }] : [], effectOnly: !dice, reviewed: !!dice, resourceConfirmed: true, notes: source });
        };
        const ranges = WEAPON_RANGES[item.id];
        if (ranged) {
            if (ranges)
                mode(true, ...ranges);
            else
                warnings.push(`Falta el alcance de ${item.name}.`);
        }
        else {
            mode(false, properties.includes('gran alcance') ? 3 : 1.5);
            if (properties.includes('arrojad') && ranges)
                mode(true, ...ranges);
        }
    }
    const equipment = items.filter((x) => x.item).map(({ item, assigned }) => `${item!.name}${assigned.quantity > 1 ? ` ×${assigned.quantity}` : ''}${assigned.equipped ? '' : ' (guardado)'}`);
    const stats: GameStatBlock = { armorClass: ac, hitPoints: hp, speed: `${speed.toLocaleString('es-ES')} m`, initiative: signed(initiative), proficiencyBonus: proficiency, abilities, saves, skills, attacks, features, spells, equipment };
    const derived = deriveCombat({ ...stats, combat: original?.combat }, rules);
    const changedMagic = !!original && (original.level !== level || JSON.stringify(original.abilities) !== JSON.stringify(abilities));
    const casts = spellIds.flatMap((id) => {
        const spell = rules.spells.find((s) => s.id === id);
        if (!spell)
            return [];
        const sources: {
            ability: Ability;
            resource?: CombatResource;
        }[] = [];
        const pool = resources.find((r) => r.kind === 'slot' && (r.level ?? 0) >= spell.level);
        if (classSpells.includes(id))
            sources.push({ ability: magic.ability, resource: spell.level > 0 ? pool : undefined });
        for (const g of grants.filter((g) => g.id === id)) {
            sources.push({ ability: g.ability, resource: g.resource });
            if (spell.level > 0 && pool)
                sources.push({ ability: g.ability, resource: pool });
        }
        return sources.map((source) => ({ spell, ...source }));
    });
    const spellActions: CombatAction[] = [], spellReactions = derived.reactions.filter((r) => !r.spellLevel);
    const seen = new Set<string>();
    for (const cast of casts) {
        const { spell, ability, resource } = cast;
        const suffix = ` | ${ability}:${resource?.id ?? 'cantrip'}`;
        const key = spell.id + suffix;
        if (seen.has(key))
            continue;
        seen.add(key);
        const name = spell.name;
        const cost = resource ? { resourceId: resource.id, amount: 1 } : undefined;
        const reaction = derived.reactions.find((r) => n(r.name) === n(spell.name));
        if (reaction) {
            const source = reaction.source + suffix, saved = original?.combat?.reactions.find((r) => r.source === source);
            spellReactions.push({ ...reaction, ...saved, source, name, spellLevel: spell.level, cost, resourceConfirmed: spell.level === 0 || !!cost, reviewed: n(spell.name) === 'escudo' ? true : !changedMagic && !!saved?.reviewed });
        }
        else {
            const action = derived.actions.find((a) => a.kind === 'spell' && n(a.name) === n(spell.name));
            if (!action)
                continue;
            const source = action.source + suffix, saved = original?.combat?.actions.find((a) => a.source === source);
            spellActions.push({ ...action, ...saved, source, name, spellLevel: resource?.kind === 'slot' ? resource.level : spell.level, cost, bonus: proficiency + modifier(abilities[ability]), dc: 8 + proficiency + modifier(abilities[ability]), resourceConfirmed: spell.level === 0 || !!cost, reviewed: !changedMagic && !!saved?.reviewed });
        }
    }
    const profile: CombatProfile = { actions: [...actions, ...spellActions], reactions: spellReactions, resources: [...resources, ...(original?.combat?.resources ?? []).filter((r) => !r.id.startsWith('builder:'))], attacksPerTurn: build.classId === 'guerrero' && level >= 20 ? 4 : build.classId === 'guerrero' && level >= 11 ? 3 : ['barbaro', 'guerrero', 'monje', 'paladin', 'explorador'].includes(build.classId) && level >= 5 ? 2 : 1 };
    stats.combat = profile;
    for (const { item } of equipped) {
        const category = n(item.category);
        const needed = category.includes('pesada') ? 'pesada' : category.includes('media') ? 'media' : category.includes('ligera') && category.includes('armadura') ? 'ligera' : item.id === 'escudo' ? 'escudo' : undefined;
        if (needed && !training.has(needed))
            warnings.push(`${item.name}: no tienes entrenamiento de clase; aplica las limitaciones del manual.`);
    }
    formulas.push(`CA ${ac}: ${armor?.name ?? 'defensa sin armadura'}${shield ? ' + escudo' : ''}.`, `PG ${hp}: d${die}, nivel ${level}, CON ${signed(con)}, progresión ${build.hpMethod === 'fixed' ? 'fija' : 'por tiradas'}${build.ancestryId === 'enano' ? ', dureza enana' : ''}${feats.includes('duro') ? ', dote Duro' : ''}.`, `Iniciativa ${signed(initiative)}: DES ${signed(dex)}${feats.includes('alerta') ? ' + competencia por Alerta' : ''}.`, `Competencia ${signed(proficiency)}: nivel ${level}.`);
    return { stats, ancestry: ancestry?.name ?? '', background: background?.name ?? '', className: cls?.name ?? '', subclass: level >= 3 ? build.subclass : '', feat: feats.map((id) => rules.feats.find((f) => f.id === id)?.name ?? id).join(', '), errors: [...new Set(errors)], warnings: [...new Set(warnings)], formulas, choiceLimits: { extraSkills: extraCount, expertise: expertiseCount } };
}
