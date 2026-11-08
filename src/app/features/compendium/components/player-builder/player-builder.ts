import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameStatBlock, PlayerOption } from '../../../../core/models/campaign';
import { Ability, CharacterBuild } from '../../../../core/models/character-build';
import { RuleSpell, RulesCompendium } from '../../../../core/models/rules';
import { CHARACTER_BACKGROUNDS, CHARACTER_ORIGINS } from '../../../../core/data/character-origins';
import { ABILITIES, CLASS_RULES, CharacterCalculation, availableSpells, alwaysPreparedSpellIds, calculateCharacter, featLevels, initialBuild, magicProgression, normalizeBuildChoices, originMagic } from '../../../../core/services/character-builder';
export interface PlayerBuilderValue {
    build: CharacterBuild;
    calculation: CharacterCalculation;
}
@Component({ selector: 'app-player-builder', imports: [FormsModule], templateUrl: './player-builder.html', styleUrl: './player-builder.scss' })
export class PlayerBuilder implements OnChanges {
    @Input({ required: true })
    rules!: RulesCompendium;
    @Input()
    sheet?: PlayerOption;
    @Input()
    busy = false;
    @Input()
    resetKey = 0;
    @Output()
    valueChange = new EventEmitter<PlayerBuilderValue | undefined>();
    protected build!: CharacterBuild;
    protected active = false;
    protected calculation!: CharacterCalculation;
    protected readonly origins = CHARACTER_ORIGINS;
    protected readonly backgrounds = CHARACTER_BACKGROUNDS;
    protected readonly abilities = ABILITIES;
    protected readonly classRules = CLASS_RULES;
    protected readonly Array = Array;
    protected readonly magicProgression = magicProgression;
    protected readonly originMagic = originMagic;
    protected readonly featLevels = featLevels;
    ngOnChanges(changes: SimpleChanges): void {
        if (!this.build || changes['resetKey'] || changes['sheet']) {
            this.build = initialBuild(this.sheet, this.rules);
            this.active = !this.sheet || !!this.sheet.build;
            this.changed();
        }
    }
    protected convert(): void {
        if (this.sheet && !this.build.legacy) {
            const { armorClass, hitPoints, speed, initiative, proficiencyBonus, abilities, saves, skills, attacks, features, spells, equipment, combat } = this.sheet;
            this.build.legacy = structuredClone({ armorClass, hitPoints, speed, initiative, proficiencyBonus, abilities, saves, skills, attacks, features, spells, equipment, combat });
        }
        this.active = true;
        this.changed();
    }
    protected changed(): void { this.build = normalizeBuildChoices(this.build); this.calculation = calculateCharacter(this.build, this.rules, this.sheet); this.valueChange.emit(this.active ? { build: structuredClone(this.build), calculation: this.calculation } : undefined); }
    protected changeClass(): void { this.build.subclass = ''; this.build.classSkills = []; this.build.expertise = []; this.build.cantripIds = []; this.build.preparedIds = []; this.build.spellbookIds = []; this.build.fightingStyle = ''; this.changed(); }
    protected changeLevel(): void {
        if (this.build.level < 3)
            this.build.subclass = '';
        this.changed();
    }
    protected changeAncestry(): void { this.build.variantId = ''; this.build.humanFeatId = ''; this.build.originCantripIds = []; this.changed(); }
    protected changeBackground(): void { this.build.backgroundBoosts = {}; delete this.build.magicChoices['background']; this.changed(); }
    protected variant() { return this.origins.find((o) => o.id === this.build.ancestryId); }
    protected background() { return this.backgrounds.find((b) => b.id === this.build.backgroundId); }
    protected originFeats() { return this.rules.feats.filter((f) => f.category === 'Dote de origen'); }
    protected chooseSkill(id: string, checked: boolean, kind: 'classSkills' | 'extraSkills' | 'expertise'): void { this.build[kind] = checked ? [...new Set([...this.build[kind], id])] : this.build[kind].filter((s) => s !== id); this.changed(); }
    protected classSkillOptions() { const ids = this.classRules[this.build.classId]?.skills; return this.rules.skills.filter((s) => !ids?.length || ids.includes(s.id)); }
    protected expertiseOptions() { const bg = this.background(); return this.rules.skills.filter((s) => [...this.build.classSkills, ...this.build.extraSkills, ...(bg?.skills ?? [])].includes(s.id)); }
    protected spellOptions(cantrip: boolean, book = false): RuleSpell[] { return availableSpells(this.build, this.rules, cantrip, !book); }
    protected spellRows(cantrip: boolean): number[] { return Array.from({ length: Math.max(cantrip ? magicProgression(this.build).cantrips : magicProgression(this.build).prepared, (cantrip ? this.build.cantripIds : this.build.preparedIds).length) }, (_, i) => i); }
    protected slotsFilled(cantrip: boolean): number { return (cantrip ? this.build.cantripIds : this.build.preparedIds).filter(Boolean).length; }
    protected setSpell(index: number, id: string, cantrip: boolean): void {
        const list = cantrip ? this.build.cantripIds : this.build.preparedIds;
        list[index] = id;
        while (list.length && !list[list.length - 1])
            list.pop();
        this.changed();
    }
    protected selectBook(id: string, checked: boolean): void {
        if (checked && !id)
            return;
        this.build.spellbookIds = checked ? [...new Set([...this.build.spellbookIds, id])] : this.build.spellbookIds.filter((s) => s !== id);
        this.changed();
    }
    protected addEquipment(): void { this.build.equipment.push({ id: '', quantity: 1, equipped: false, twoHanded: false }); this.changed(); }
    protected removeEquipment(index: number): void { this.build.equipment.splice(index, 1); this.changed(); }
    protected rows(count: number): number[] { return Array.from({ length: Math.max(0, Math.min(40, count)) }, (_, i) => i); }
    protected originChoice(key: string, classId: string) { return this.build.magicChoices[key] ?? (this.build.magicChoices[key] = { classId, ability: 'intelligence', cantripIds: [], spellId: '' }); }
    protected originOptions(classId: string, level: number) { const cls = this.rules.classes.find((c) => c.id === classId); return this.rules.spells.filter((s) => s.level === level && s.classes.includes(cls?.name ?? '')); }
    protected abilityName(id: Ability): string { return this.abilities.find((a) => a.id === id)!.name; }
    protected setBoost(id: Ability, value: number): void { this.build.backgroundBoosts[id] = Number(value); this.changed(); }
    protected spellName(id: string): string { return this.rules.spells.find((s) => s.id === id)?.name ?? (id || 'Selección vacía'); }
    protected featName(id: string): string { return this.rules.feats.find((f) => f.id === id)?.name ?? id; }
    protected automaticSpellNames(): string { return alwaysPreparedSpellIds(this.build).map((id) => this.spellName(id)).join(' · '); }
    protected ritualOptions(): RuleSpell[] { return this.rules.spells.filter((s) => s.level === 1 && /ritual/i.test(s.castingTime)); }
    protected ritualChoice(index: number, id: string): void { this.build.ritualSpellIds ??= []; this.build.ritualSpellIds[index] = id; this.changed(); }
    protected hasRitualCaster(): boolean { return this.build.featIds.includes('lanzador-ritual'); }
    protected hasLance(): boolean { return this.build.equipment.some((item) => item.id === 'lanza-de-caballeria'); }
    protected skillNames(ids: string[]): string { return ids.map((id) => this.rules.skills.find((s) => s.id === id)?.name ?? id).join(', '); }
    protected versatile(id: string): boolean { return this.rules.equipment.find((e) => e.id === id)?.properties.some((p) => p.toLowerCase().includes('versatil')) ?? false; }
    protected itemName(id: string): string { return this.rules.equipment.find((e) => e.id === id)?.name ?? id; }
    protected featChoices(level: number) { return this.rules.feats.filter((f) => f.category === 'Dote general' || f.category === 'Dote de origen' || level >= 19 && f.category === 'Dote de don épico'); }
    protected styleOptions() { return this.rules.feats.filter((f) => f.category === 'Dote de estilo de combate'); }
    protected hasFightingStyle(): boolean { return this.build.classId === 'guerrero' || ['explorador', 'paladin'].includes(this.build.classId) && this.build.level >= 2; }
    protected preview(): GameStatBlock { return !this.active && this.sheet ? this.sheet : this.calculation.stats; }
}
