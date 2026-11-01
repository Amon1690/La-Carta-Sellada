import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GENERIC_NPCS } from '../data/generic-npcs';
import { Campaign, CampaignNpc, CampaignPlayerCharacter, PlayerOption } from '../models/campaign';
import { RuleGenericNpc } from '../models/rules';

export interface EditablePlayerSheet extends PlayerOption {
  tokenUrl?: string;
  gridTokenUrl?: string;
  affiliation?: string;
}

interface EditableCollection<T extends { id: string }> {
  edited: Record<string, T>;
  created: T[];
}

export const CHARACTER_SHEET_STORAGE = new InjectionToken<Storage | undefined>('Character sheet storage', {
  providedIn: 'root',
  factory: () => {
    try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
    catch { return undefined; }
  },
});

@Injectable({ providedIn: 'root' })
export class CharacterSheetsService {
  private readonly storage = inject(CHARACTER_SHEET_STORAGE);
  private readonly changes = new BehaviorSubject(0);
  readonly changes$ = this.changes.asObservable();

  constructor() {
    if (typeof window === 'undefined') return;
    const refresh = (event: StorageEvent): void => {
      if ((event.storageArea === null || event.storageArea === this.storage) &&
          (event.key === null || event.key.startsWith('la-carta-sellada:editable:'))) {
        this.changes.next(this.changes.value + 1);
      }
    };
    window.addEventListener('storage', refresh);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', refresh));
  }

  savePlayer(player: EditablePlayerSheet, mode: 'create' | 'edit'): void {
    this.saveEditableEntity(this.playerSheetsStoreKey(), player, mode);
  }

  saveGenericNpc(npc: RuleGenericNpc, mode: 'create' | 'edit'): void {
    this.saveEditableEntity(this.genericNpcsStoreKey(), npc, mode);
  }

  saveCampaignNpc(campaignId: string, npc: CampaignNpc, mode: 'create' | 'edit'): void {
    this.saveEditableEntity(this.campaignNpcsStoreKey(campaignId), npc, mode);
  }

  tokenImage(group: 'players' | 'npcs' | 'generic', id: string, grid = false, override?: string): string {
    if (override) return override;
    const folder = grid ? 'tokens-grid' : 'tokens';
    return id.startsWith('custom-')
      ? `assets/${folder}/generic/aldeano.png`
      : `assets/${folder}/${group}/${id}.png`;
  }

  playerSheets(campaign: Campaign | undefined): EditablePlayerSheet[] {
    if (!campaign) {
      return this.withEditablePlayerSheets([]);
    }

    const namedPlayers = campaign.playerCharacters.map((player) =>
      this.playerCharacterToSheet(player, campaign.playerOptions)
    );
    const visibleOptions = campaign.playerOptions
      .filter((player) => player.showToken !== false)
      .map((player) => this.playerOptionToSheet(player));

    return this.withEditablePlayerSheets([...namedPlayers, ...visibleOptions]);
  }

  private withEditablePlayerSheets(
    base: EditablePlayerSheet[]
  ): EditablePlayerSheet[] {
    return this.applyEditableCollection(base, this.playerSheetsStoreKey());
  }

  private playerOptionToSheet(player: PlayerOption): EditablePlayerSheet {
    const hasToken = player.showToken !== false && !player.id.startsWith('custom-');
    return {
      ...player,
      tokenUrl: hasToken ? this.tokenPath('players', player.id) : undefined,
      gridTokenUrl: hasToken ? this.gridTokenPath('players', player.id) : undefined,
    };
  }

  private playerCharacterToSheet(
    player: CampaignPlayerCharacter,
    templates: PlayerOption[]
  ): EditablePlayerSheet {
    const template =
      this.findPlayerTemplate(player, templates) ?? this.defaultPlayerTemplate();
    return {
      ...template,
      id: player.id,
      showToken: true,
      name: player.name,
      tags: player.tags,
      ancestry: player.ancestry,
      className: player.className,
      subclass: player.subclass,
      background: player.background,
      hook: player.summary,
      tokenUrl: player.tokenUrl,
      gridTokenUrl: player.gridTokenUrl,
      affiliation: player.affiliation,
    };
  }

  private findPlayerTemplate(
    player: CampaignPlayerCharacter,
    templates: PlayerOption[]
  ): PlayerOption | undefined {
    const className = this.normalize(player.className);
    const subclass = this.normalize(player.subclass);
    return (
      templates.find(
        (template) =>
          this.normalize(template.className) === className &&
          this.normalize(template.subclass) === subclass
      ) ??
      templates.find((template) => this.normalize(template.subclass) === subclass) ??
      templates.find((template) => this.normalize(template.className) === className)
    );
  }

  private defaultPlayerTemplate(): PlayerOption {
    return {
      id: 'template',
      name: 'PJ',
      ancestry: 'Humano',
      className: 'Clase',
      subclass: 'A elegir',
      background: 'A elegir',
      hook: 'Pendiente de definir.',
      level: 5,
      feat: 'A elegir',
      armorClass: 12,
      hitPoints: 38,
      speed: '9 m',
      initiative: '+0',
      proficiencyBonus: 3,
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      saves: [],
      skills: [],
      attacks: [],
      features: [],
      spells: [],
      equipment: [],
    };
  }

  genericNpcs(base: RuleGenericNpc[] = GENERIC_NPCS): RuleGenericNpc[] {
    return this.applyEditableCollection(base, this.genericNpcsStoreKey());
  }

  campaignNpcs(
    campaignId: string,
    base: CampaignNpc[]
  ): CampaignNpc[] {
    return this.applyEditableCollection(base, this.campaignNpcsStoreKey(campaignId));
  }

  private applyEditableCollection<T extends { id: string }>(
    base: T[],
    key: string
  ): T[] {
    const collection = this.loadEditableCollection<T>(key);
    const baseIds = new Set(base.map((entry) => entry.id));
    const edited = base.map((entry) => collection.edited[entry.id] ?? entry);
    const created = collection.created.filter((entry) => !baseIds.has(entry.id));
    return [...edited, ...created];
  }

  private saveEditableEntity<T extends { id: string }>(
    key: string,
    entity: T,
    mode: 'create' | 'edit'
  ): void {
    const collection = this.loadEditableCollection<T>(key);
    const createdIndex = collection.created.findIndex(
      (entry) => entry.id === entity.id
    );

    if (mode === 'create' || entity.id.startsWith('custom-') || createdIndex >= 0) {
      if (createdIndex >= 0) {
        collection.created[createdIndex] = entity;
      } else {
        collection.created.push(entity);
      }
      delete collection.edited[entity.id];
    } else {
      collection.edited[entity.id] = entity;
    }

    this.saveEditableCollection(key, collection);
  }

  private loadEditableCollection<T extends { id: string }>(
    key: string
  ): EditableCollection<T> {
    if (!this.storage) {
      return { edited: {}, created: [] };
    }

    try {
      const raw = this.storage.getItem(key);
      if (!raw) return { edited: {}, created: [] };
      const parsed = JSON.parse(raw) as Partial<EditableCollection<T>>;
      return {
        edited: parsed.edited ?? {},
        created: Array.isArray(parsed.created) ? parsed.created : [],
      };
    } catch {
      return { edited: {}, created: [] };
    }
  }

  private saveEditableCollection<T extends { id: string }>(
    key: string,
    collection: EditableCollection<T>
  ): void {
    if (!this.storage) return;
    this.storage.setItem(key, JSON.stringify(collection));
    this.changes.next(this.changes.value + 1);
  }

  private playerSheetsStoreKey(): string {
    return 'la-carta-sellada:editable:fichas-pjs';
  }

  private genericNpcsStoreKey(): string {
    return 'la-carta-sellada:editable:fichas-genericas';
  }

  private campaignNpcsStoreKey(campaignId: string): string {
    return `la-carta-sellada:editable:${campaignId || 'sin-campana'}:pnjs`;
  }


  private tokenPath(group: 'npcs' | 'players', id: string): string {
    return `assets/tokens/${group}/${id}.png`;
  }
  private gridTokenPath(group: 'npcs' | 'players', id: string): string {
    return `assets/tokens-grid/${group}/${id}.png`;
  }
  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
