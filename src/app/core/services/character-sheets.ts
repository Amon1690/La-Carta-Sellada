import { REMOTE_SHEETS } from './remote-sheets';
import { ACCESS_CONTEXT } from './access';
import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GENERIC_NPCS } from '../data/generic-npcs';
import { Campaign, CampaignNpc, CampaignPlayerCharacter, PlayerOption } from '../models/campaign';
import { RuleGenericNpc } from '../models/rules';
import { CombatProfile } from '../models/combat';
import { VisionProfile } from '../models/vision';
import { assertVisionProfile } from './vision-state';

export interface EditablePlayerSheet extends PlayerOption {
  playerIds?: string[];
  tokenUrl?: string;
  gridTokenUrl?: string;
  affiliation?: string;
  statisticsRecorded?: boolean;
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
  private readonly remote = inject(REMOTE_SHEETS);
  private readonly access = inject(ACCESS_CONTEXT);
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

  savePlayer(player: EditablePlayerSheet, mode: 'create' | 'edit', campaignId?: string): void | Promise<void> {
    if (player.vision !== undefined) assertVisionProfile(player.vision);
    if (this.remote) {
      const user = this.access?.user();
      if (!campaignId || !user || !user.campaigns.includes(campaignId)) throw new Error('No tienes acceso a esta campaña.');
      if (user.role !== 'director') {
        const collection = this.remote.read(campaignId);
        const existing = (collection.edited[player.id] ?? collection.created.find((entry) => entry.id === player.id)) as EditablePlayerSheet | undefined;
        if (user.role !== 'jugador' || mode !== 'edit' || !existing?.playerIds?.includes(user.id)) throw new Error('Solo puedes editar personajes vinculados a tu usuario.');
        if (player.playerIds !== undefined && JSON.stringify([...player.playerIds].sort()) !== JSON.stringify([...existing.playerIds].sort())) throw new Error('Solo el director puede cambiar los jugadores vinculados.');
      }
    }
    return this.saveEditableEntity(this.playerSheetsStoreKey(campaignId), player, mode);
  }

  visionProfile(campaign: Campaign, actorId: string): VisionProfile | undefined {
    const value = actorId.startsWith('player:')
      ? this.playerSheets(campaign).find((p) => p.id === actorId.slice(7))?.vision
      : actorId.startsWith('npc:')
        ? this.campaignNpcs(campaign.id, campaign.npcs).find((p) => p.id === actorId.slice(4))?.statBlock?.vision
        : actorId.startsWith('generic:')
          ? this.genericNpcs().find((p) => p.id === actorId.slice(8))?.vision : undefined;
    if (value === undefined) return undefined;
    try { assertVisionProfile(value); return structuredClone(value); }
    catch { return undefined; } // El original no se modifica; no se inventa un alcance.
  }

  saveVisionProfile(campaign: Campaign, actorId: string, vision: VisionProfile): void | Promise<void> {
    assertVisionProfile(vision);
    if (actorId.startsWith('player:')) {
      const sheet = this.playerSheets(campaign).find((p) => p.id === actorId.slice(7));
      if (!sheet) throw new Error('No se encuentra la ficha de PJ');
      return this.savePlayer({ ...sheet, vision: structuredClone(vision) }, 'edit', campaign.id);
    }
    if (actorId.startsWith('npc:')) {
      const sheet = this.campaignNpcs(campaign.id, campaign.npcs).find((p) => p.id === actorId.slice(4));
      if (!sheet?.statBlock) throw new Error('Completa las estadísticas del PNJ');
      return this.saveCampaignNpc(campaign.id, { ...sheet, statBlock: { ...sheet.statBlock, vision: structuredClone(vision) } }, 'edit');
    }
    if (actorId.startsWith('generic:')) {
      const sheet = this.genericNpcs().find((p) => p.id === actorId.slice(8));
      if (sheet) return this.saveGenericNpc({ ...sheet, vision: structuredClone(vision) }, 'edit');
    }
    throw new Error('No se encuentra la ficha de origen');
  }

  saveCombatProfile(campaign: Campaign, actorId: string, combat: CombatProfile): void | Promise<void> {
    if (actorId.startsWith('player:')) {
      const player = this.playerSheets(campaign).find((p) => p.id === actorId.slice(7));
      if (!player || player.statisticsRecorded === false) throw new Error('Completa las estadísticas de la ficha de PJ');
      return this.savePlayer({ ...player, combat }, 'edit', campaign.id);
    } else if (actorId.startsWith('npc:')) {
      const npc = this.campaignNpcs(campaign.id, campaign.npcs).find((p) => p.id === actorId.slice(4));
      if (!npc?.statBlock) throw new Error('Completa las estadísticas del PNJ');
      this.saveCampaignNpc(campaign.id, { ...npc, statBlock: { ...npc.statBlock, combat } }, 'edit');
    } else if (actorId.startsWith('generic:')) {
      const npc = this.genericNpcs().find((p) => p.id === actorId.slice(8));
      if (!npc) throw new Error('No se encuentra la ficha genérica');
      this.saveGenericNpc({ ...npc, combat }, 'edit');
    } else throw new Error('No se encuentra la ficha de origen');
  }

  saveGenericNpc(npc: RuleGenericNpc, mode: 'create' | 'edit'): void {
    if (npc.vision !== undefined) assertVisionProfile(npc.vision);
    this.saveEditableEntity(this.genericNpcsStoreKey(), npc, mode);
  }

  saveCampaignNpc(campaignId: string, npc: CampaignNpc, mode: 'create' | 'edit'): void {
    if (npc.statBlock?.vision !== undefined) assertVisionProfile(npc.statBlock.vision);
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
      this.playerCharacterToSheet(player, campaign.startingLevel)
    );
    const visibleOptions = campaign.playerOptions
      .filter((player) => player.showToken !== false)
      .map((player) => this.playerOptionToSheet(player));

    return this.withEditablePlayerSheets([...namedPlayers, ...visibleOptions], campaign.id);
  }

  private withEditablePlayerSheets(
    base: EditablePlayerSheet[], campaignId?: string
  ): EditablePlayerSheet[] {
    return this.applyEditableCollection(base, this.playerSheetsStoreKey(campaignId));
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
    startingLevel: number
  ): EditablePlayerSheet {
    const template = this.defaultPlayerTemplate();
    return {
      ...template,
      statisticsRecorded: false,
      level: startingLevel,
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
      armorClass: 0,
      hitPoints: 0,
      speed: '',
      initiative: '',
      proficiencyBonus: 0,
      abilities: {
        strength: 0,
        dexterity: 0,
        constitution: 0,
        intelligence: 0,
        wisdom: 0,
        charisma: 0,
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
  ): void | Promise<void> {
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

    return this.saveEditableCollection(key, collection);
  }

  private loadEditableCollection<T extends { id: string }>(
    key: string
  ): EditableCollection<T> {
    if (this.remote && key.includes(':fichas-pjs:')) return this.remote.read(key.split(':fichas-pjs:')[1]) as EditableCollection<T>;
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
  ): void | Promise<void> {
    if (this.remote && key.includes(':fichas-pjs:')) return this.remote.save(key.split(':fichas-pjs:')[1], collection).then(() => this.changes.next(this.changes.value + 1));
    if (!this.storage) return;
    this.storage.setItem(key, JSON.stringify(collection));
    this.changes.next(this.changes.value + 1);
  }

  private playerSheetsStoreKey(campaignId?: string): string {
    return this.remote ? `la-carta-sellada:editable:fichas-pjs:${campaignId ?? 'sin-campana'}` : 'la-carta-sellada:editable:fichas-pjs';
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
}
