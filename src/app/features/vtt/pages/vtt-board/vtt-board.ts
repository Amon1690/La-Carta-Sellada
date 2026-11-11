import { AsyncPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, shareReplay, skip, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { Campaign } from '../../../../core/models/campaign';
import { BoardVisionState, VisionEffect, VisionObstacle, VisionProfile, VisionSense } from '../../../../core/models/vision';
import { isVisionDoor } from '../../../../core/services/vision-geometry';
import { advanceVisionEffects, endVisionConcentration, endVisionEffect } from '../../../../core/services/vision-effects';
import { assertBoardVision, emptyBoardVision, withoutRemovedObservers } from '../../../../core/services/vision-state';
import { previewSight, previewTokenVisible } from '../../../../core/services/vision-preview';
import { evaluateVision } from '../../../../core/services/vision-engine';
import { ENCOUNTER_PUBLISHER, SharingSnapshot } from '../../../../core/services/encounter-sharing';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { RulesDataService } from '../../../../core/services/rules-data';
import { RulesCompendium } from '../../../../core/models/rules';
import { CombatAction, CombatCondition, CombatSide, Combatant } from '../../../../core/models/combat';
import { actionProblem, deriveCombat } from '../../../../core/services/combat-rules';
import { attackSituation, normalAttackFacts } from '../../../../core/services/attack-situation';
import { CommandReceipt, DirectorEncounter, EncounterCommand, LiveBoardState, PlayerControls } from '../../../../core/models/encounter-live';
import { VttCombat } from '../../../../core/services/vtt-combat';
import { combatNarrative } from '../../../../core/services/combat-narrative';
import { VttCombatPanel } from './combat-panel';
import { VttAttackPicker } from './attack-picker';
import { CONDITION_LABELS } from '../../../../core/services/attack-situation';
import {
  GENERIC_ENCOUNTERS,
  scaledEncounterMonsters,
} from '../../../../core/data/generic-encounters';

import { TokenSheet, VttTokenSheet } from './token-sheet';
import { WeatherOverlay } from '../../components/weather-overlay';

type VttEntryKind = 'scene' | 'encounter' | 'location' | 'generic';
type ToolMode = 'select' | 'pan' | 'fog' | 'reveal' | 'measure' | 'wall' | 'door' | 'window' | 'light';
type SidebarTab = 'tokens' | 'layers' | 'turns' | 'vision' | 'geometry' | 'lights';
type SceneLight = VisionEffect & { kind: 'light'; scope: { kind: 'circle'; x: number; y: number; radiusFeet: number } };

interface VttEntry {
  id: string;
  name: string;
  mapUrl: string;
  kind: VttEntryKind;
  kindLabel: string;
  seedTokens?: EncounterSeedToken[];
}

interface EncounterSeedToken {
  actorId: string;
  side: 'party' | 'enemy';
  size?: number;
}

interface VttViewModel {
  campaign: Campaign;
  entry: VttEntry;
}

interface TokenChoice {
  id: string;
  name: string;
  image: string;
  subtitle: string;
  group: 'PJ' | 'PNJ' | 'Genérico';
  maxHp: number;
}

interface BoardToken {
  instanceId: string;
  conditions?: CombatCondition[];
  side?: CombatSide;
  actorId: string;
  name: string;
  image: string;
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  initiative: number;
  hidden: boolean;
}

interface FogRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayerState {
  grid: boolean;
  fog: boolean;
  tokens: boolean;
  labels: boolean;
}

interface MeasureLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface BoardPoint {
  x: number;
  y: number;
}

interface TokenDrag {
  start: BoardPoint;
  origins: Pick<BoardToken, 'instanceId' | 'x' | 'y' | 'size'>[];
  clickedId: string;
  collapseOnClick: boolean;
  moved: boolean;
}


interface StoredBoardState {
  vision?: BoardVisionState;
  combat?: unknown;
  tokens: BoardToken[];
  fogRects: FogRect[];
  layers: LayerState;
  zoom: number;
  activeTurnId?: string;
}

@Component({
  selector: 'app-vtt-board',
  imports: [AsyncPipe, VttTokenSheet, VttCombatPanel, VttAttackPicker, WeatherOverlay],
  templateUrl: './vtt-board.html',
  styleUrl: './vtt-board.scss',
})
export class VttBoard {
  protected readonly mapWidth = 1536;
  protected readonly mapHeight = 1024;
  protected readonly gridSize = 51.2;

  protected readonly mode = signal<ToolMode>('select');
  protected readonly sidebarTab = signal<SidebarTab>('tokens');
  protected readonly zoom = signal(0.65);
  protected readonly tokens = signal<BoardToken[]>([]);
  protected readonly fogRects = signal<FogRect[]>([]);
  protected readonly vision = signal<BoardVisionState>(emptyBoardVision());
  protected readonly visionPreview = signal(false);
  protected readonly visionMessage = signal('');
  protected readonly doorHasWindow = signal(false);
  protected readonly lightRadius = signal('');
  protected readonly lightIllumination = signal<'bright' | 'dim'>('bright');
  protected readonly sceneLights = computed(() => this.vision().effects.filter((effect): effect is SceneLight =>
    effect.kind === 'light' && effect.scope.kind === 'circle' && !effect.anchorTokenId && effect.duration.kind === 'until-ended'));
  protected readonly draftObstacle = signal<MeasureLine | undefined>(undefined);
  protected readonly isVisionDoor = isVisionDoor;
  protected readonly drawingObstacle = computed(() => ['wall', 'door', 'window'].includes(this.mode()));
  protected readonly displayedObstacles = computed(() => (this.vision().obstacles ?? []).filter((o) => !this.visionPreview() || isVisionDoor(o)));
  protected readonly perceptionMessage = signal('');
  protected readonly visionMaskId = this.newId('vision-mask');
  protected readonly visionObserverIds = computed(() =>
    this.vision().groups.find((group) => group.id === this.vision().activeGroupId)?.observerIds ?? []
  );
  protected visionStorageBlocked = false;
  protected readonly layers = signal<LayerState>({
    grid: false,
    fog: true,
    tokens: true,
    labels: true,
  });
  protected readonly tokenChoices = signal<TokenChoice[]>([]);
  protected readonly tokenQuery = signal('');
  protected readonly selectedTokenIds = signal<string[]>([]);
  protected readonly selectionRect = signal<FogRect | undefined>(undefined);
  protected readonly activeTurnId = signal<string | undefined>(undefined);
  protected readonly draftFog = signal<FogRect | undefined>(undefined);
  protected readonly measureLine = signal<MeasureLine | undefined>(undefined);
  protected readonly diceOpen = signal(false);
  protected readonly diceResult = signal<string>('');
  protected readonly saveStatus = signal('Guardado');
  protected readonly encounterShared = signal(false);
  protected readonly sharingReady = signal(false);
  protected readonly sharingMessage = signal('');
  private readonly publisher = inject(ENCOUNTER_PUBLISHER);
  private sharingTimer?: ReturnType<typeof setTimeout>;
  private sharingChain: Promise<void> = Promise.resolve();
  private sharingGeneration = 0;
  private sharingEntry?: VttEntry;
  private sharingRevision = 0;
  private sharingDirty = false;
  private sharingBusy = false;
  private applyingRemote = false;
  private syncing = false;
  private syncTimer?: ReturnType<typeof setInterval>;
  private pendingAck?: CommandReceipt;
  private syncEpoch = 0;
  private readonly publishedRevisions = new Map<string, { base: number; revision: number }>();
  protected readonly combatMessage = signal('');
  protected readonly attackingId = signal<string | undefined>(undefined);
  protected readonly attackTargetId = signal<string | undefined>(undefined);
  protected readonly conditionLabels = Object.entries(CONDITION_LABELS) as [CombatCondition, string][];
  protected readonly targeting = computed(() => !this.visionPreview() && !!this.attackingId() && this.combat.canAttack(this.attackingId()!));
  private readonly rules = signal<RulesCompendium | undefined>(undefined);
  protected readonly combatants = computed<Combatant[]>(() => {
    this.sheetRevision();
    const campaign = this.currentCampaign;
    if (!campaign) return [];
    return this.tokens().map((token) => {
      const stats = this.resolveTokenSheet(token, campaign).statistics;
      try { return { id: token.instanceId, actorId: token.actorId, name: token.name, x: token.x, y: token.y, size: token.size,
        conditions: token.conditions, side: token.side, hp: token.hp, maxHp: token.maxHp, armorClass: stats?.armorClass, ...deriveCombat(stats, this.rules()) }; }
      catch { return { id: token.instanceId, actorId: token.actorId, name: token.name, x: token.x, y: token.y, size: token.size,
        conditions: token.conditions, side: token.side, hp: token.hp, maxHp: token.maxHp, armorClass: undefined, ...deriveCombat(undefined), notes: ['La preparación de esta ficha no es válida. Revisa los datos antes de combatir.'] }; }
    });
  });
  protected readonly combat = new VttCombat(() => this.combatants(), () => this.activeTurnId(), (hp) => {
    if (hp) this.tokens.update((tokens) => tokens.map((token) => token.instanceId === hp.id ? { ...token, hp: hp.hp } : token));
    this.persist();
  }, (id, profile) => {
    const token = this.tokens().find((t) => t.instanceId === id);
    if (!token || !this.currentCampaign) throw new Error('La ficha ya no está disponible');
    return this.characterSheets.saveCombatProfile(this.currentCampaign, token.actorId, profile);
  }, undefined, (observerId, targetId) => {
    if (!this.vision().enabled) return undefined;
    const target = this.tokens().find((token) => token.instanceId === targetId);
    return target ? evaluateVision(this.vision(), this.tokens(), this.tokenVisionProfiles(), observerId, targetId, this.gridSize) : undefined;
  }, (result) => {
    if (!this.currentCampaign) return [];
    const sheets = this.characterSheets.playerSheets(this.currentCampaign);
    const observers = this.tokens().filter((token) => token.actorId.startsWith('player:')).map((token) => ({
      instanceId: token.instanceId, audience: sheets.find((sheet) => sheet.id === token.actorId.slice(7))?.playerIds ?? [],
    }));
    return combatNarrative(result, this.tokens(), observers, this.vision(), this.tokenVisionProfiles(), this.fogRects(), this.gridSize, this.mapWidth, this.mapHeight);
  });
  private readonly openedSheetTokenId = signal<string | undefined>(undefined);
  private readonly sheetRevision = signal(0);
  protected readonly openedTokenSheet = computed(() => {
    this.sheetRevision();
    const token = this.tokens().find((item) => item.instanceId === this.openedSheetTokenId());
    return !this.visionPreview() && token && this.currentCampaign ? this.resolveTokenSheet(token, this.currentCampaign) : undefined;
  });

  protected readonly tokenVisionProfiles = computed(() => {
    this.sheetRevision();
    const profiles = new Map<string, VisionProfile | undefined>();
    for (const token of this.tokens()) {
      profiles.set(token.instanceId, this.currentCampaign
        ? this.characterSheets.visionProfile(this.currentCampaign, token.actorId) : undefined);
    }
    return profiles;
  });

  protected readonly previewGeometry = computed(() => previewSight(this.vision(), this.tokens(),
    this.tokenVisionProfiles(), this.gridSize, this.mapWidth, this.mapHeight));
  protected readonly displayedTokens = computed(() => this.visionPreview()
    ? this.tokens().filter((token) => previewTokenVisible(token, this.previewGeometry().circles, this.fogRects(), this.gridSize))
    : this.tokens());

  protected readonly filteredTokenChoices = computed(() => {
    const query = this.normalize(this.tokenQuery());
    return this.tokenChoices().filter((choice) =>
      this.normalize(`${choice.name} ${choice.subtitle} ${choice.group}`).includes(
        query
      )
    );
  });

  protected readonly selectedTokens = computed(() =>
    this.visionPreview() ? [] : this.tokens().filter((token) => this.selectedTokenIds().includes(token.instanceId))
  );
  protected readonly selectedToken = computed(() =>
    this.selectedTokens().length === 1 ? this.selectedTokens()[0] : undefined
  );

  protected readonly initiativeTokens = computed(() =>
    this.displayedTokens()
      .slice()
      .sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name))
  );

  @ViewChild('viewport')
  private viewport?: ElementRef<HTMLDivElement>;

  @ViewChild('board')
  private board?: ElementRef<HTMLDivElement>;

  @ViewChild(VttTokenSheet)
  private tokenSheetDialog?: VttTokenSheet;

  @ViewChild(VttCombatPanel) private combatPanel?: VttCombatPanel;
  @ViewChild('sideContent') private sideContent?: ElementRef<HTMLElement>;

  private readonly campaignData = inject(CampaignDataService);
  private readonly characterSheets = inject(CharacterSheetsService);
  private readonly rulesData = inject(RulesDataService);
  private currentCampaign?: Campaign;
  private readonly route = inject(ActivatedRoute);
  private storageKey = '';
  private drawStart?: { x: number; y: number };
  private panStart?: { x: number; y: number; left: number; top: number };
  private interactionPointerId?: number;
  private pointerCaptureElement?: HTMLElement;
  private lastTokenClickId?: string;
  private doubleClickTokenId?: string;
  private sheetReturnFocus?: HTMLElement;
  private tokenDrag?: TokenDrag;
  private selectionStart?: { point: BoardPoint; previous: string[]; additive: boolean };

  protected readonly vm$ = this.route.paramMap.pipe(
    switchMap((params) => {
      const campaignId = params.get('campaignId') ?? '';
      const kind = (params.get('kind') ?? 'scene') as VttEntryKind;
      const entryId = params.get('entryId') ?? '';
      return this.campaignData.getCampaignById(campaignId).pipe(
        map((campaign): VttViewModel | undefined => {
          const entry = this.resolveEntry(campaign, kind, entryId);
          return entry ? { campaign, entry } : undefined;
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => { clearInterval(this.syncTimer); this.leaveSharedBoard(); });
    this.rulesData.getRules().pipe(takeUntilDestroyed()).subscribe({ next: (rules) => this.rules.set(rules),
      error: () => this.combatMessage.set('No se pudo leer el compendio de conjuros. Completa los datos desde la ficha antes de resolver acciones.') });
    this.vm$.pipe(takeUntilDestroyed()).subscribe((vm) => {
      this.leaveSharedBoard();
      this.closeTokenSheet();
      this.combatPanel?.close();
      this.cancelAttack();
      this.visionPreview.set(false);
      if (!vm) return;
      this.cancelInteraction();
      this.mode.set('select'); this.doorHasWindow.set(false);
      this.selectedTokenIds.set([]);
      this.currentCampaign = vm.campaign;
      const runId = this.route.snapshot.queryParamMap.get('run');
      const runSuffix = runId ? `:${runId.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
      this.storageKey = `la-carta-sellada:vtt:${vm.campaign.id}:${vm.entry.kind}:${vm.entry.id}${runSuffix}`;
      this.sharingEntry = vm.entry;
      this.sharingRevision = 0; this.sharingDirty = false; this.pendingAck = undefined;
      this.encounterShared.set(false); this.sharingReady.set(false); this.sharingMessage.set('');
      const sharingKey = this.storageKey, generation = ++this.sharingGeneration;
      if (this.publisher) void this.publisher.status(vm.campaign.id, sharingKey).then((status) => {
        if (generation !== this.sharingGeneration) return;
        this.acceptRemoteEncounter(status, true);
      }).catch(() => { if (generation === this.sharingGeneration) this.sharingMessage.set('No se pudo consultar si el encuentro está compartido. Recarga para reintentar.'); });
      clearInterval(this.syncTimer);
      if (this.publisher) this.syncTimer = setInterval(() => void this.syncEncounter(), 1000);
      this.tokenChoices.set(this.buildTokenChoices(vm.campaign));
      const restored = this.loadState();
      if (!restored && vm.entry.seedTokens?.length) {
        this.seedEncounterTokens(vm.entry.seedTokens);
      }
      if (!restored) setTimeout(() => this.fitMap(), 0);
    });
    this.characterSheets.changes$.pipe(skip(1), takeUntilDestroyed()).subscribe(() => {
      if (this.currentCampaign) this.tokenChoices.set(this.buildTokenChoices(this.currentCampaign));
      this.sheetRevision.update((revision) => revision + 1);
      this.scheduleSharing();
    });
  }

  private async syncEncounter(): Promise<void> {
    const publisher = this.publisher, campaign = this.currentCampaign?.id, key = this.storageKey;
    if (!publisher || !campaign || this.syncing) return;
    this.syncing = true;
    const epoch = this.syncEpoch;
    try {
      const status = await publisher.status(campaign, key, this.sharingReady() ? this.sharingRevision : undefined);
      if (key !== this.storageKey || epoch !== this.syncEpoch || this.sharingBusy) return;
      const sheetsChanged = status.sheetRevision !== undefined && status.sheetRevision !== publisher.sheetRevision(campaign);
      if (sheetsChanged) {
        await publisher.refreshSheets(campaign);
        if (key !== this.storageKey || epoch !== this.syncEpoch) return;
        this.sheetRevision.update((revision) => revision + 1);
        if (this.currentCampaign) this.tokenChoices.set(this.buildTokenChoices(this.currentCampaign));
      }
      this.acceptRemoteEncounter(status, !this.sharingReady());
      if (sheetsChanged && this.encounterShared()) this.scheduleSharing(true);
    } catch { this.sharingMessage.set('No se puede sincronizar el encuentro. Los cambios locales se conservan; se reintentará automáticamente.'); }
    finally { this.syncing = false; }
  }

  private preserveConflict(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;
    const key = `la-carta-sellada:encounter-conflict:${this.storageKey}`;
    const previous = JSON.parse(localStorage.getItem(key) ?? '[]') as { at: string; state: unknown }[];
    previous.push({ at: new Date().toISOString(), state: JSON.parse(raw) });
    localStorage.setItem(key, JSON.stringify(previous));
  }

  private acceptRemoteEncounter(status: DirectorEncounter, initial: boolean): void {
    // Una lectura de la misma revisión puede ser anterior a nuestra publicación/retirada local.
    // Solo una revisión nueva del servidor puede sustituir esa intención en curso.
    if (!initial && (status.revision ?? 0) === this.sharingRevision) return;
    const wasShared = this.encounterShared();
    this.sharingReady.set(true); this.encounterShared.set(status.shared);
    if (!status.shared) {
      if (wasShared) { clearTimeout(this.sharingTimer); this.sharingGeneration++; this.sharingDirty = false; this.pendingAck = undefined; }
      this.sharingRevision = status.revision ?? 0;
      if (wasShared && !initial) this.sharingMessage.set('Este encuentro se ha dejado de compartir desde otro navegador.');
      return;
    }
    if (status.changed === false) return;
    const different = (status.revision ?? 0) !== this.sharingRevision || initial || this.sharingRevision < 0;
    if (!different) return;
    clearTimeout(this.sharingTimer); this.sharingGeneration++;
    if (status.state) {
      const raw = localStorage.getItem(this.storageKey);
      const local = raw ? JSON.parse(raw) as LiveBoardState : undefined;
      const contents = (value: LiveBoardState) => JSON.stringify([value.tokens, value.fogRects, value.vision, value.combat, value.activeTurnId]);
      if (this.sharingDirty || (initial && local && contents(local) !== contents(status.state))) {
        this.preserveConflict(); this.sharingMessage.set('Se cargó la versión compartida. Tus cambios locales distintos se han conservado en una copia de conflicto.');
      }
      this.applyRemoteBoard(status.state);
    }
    this.sharingRevision = status.revision ?? 0; this.sharingDirty = false; this.pendingAck = undefined;
    if (status.pendingCommand) this.applyPlayerCommand(status.pendingCommand);
    else if (!status.state && initial) this.scheduleSharing(true);
  }

  private applyRemoteBoard(state: LiveBoardState): void {
    if (state.vision) assertBoardVision(state.vision, new Set(state.tokens.map((token) => token.instanceId)));
    this.applyingRemote = true;
    try {
      this.cancelInteraction(); this.cancelAttack(); this.closeTokenSheet();
      this.tokens.set(structuredClone(state.tokens)); this.fogRects.set(structuredClone(state.fogRects));
      this.vision.set(structuredClone(state.vision ?? emptyBoardVision()));
      this.layers.set(structuredClone(state.layers)); this.activeTurnId.set(state.activeTurnId);
      this.combat.restore(state.combat); this.selectedTokenIds.set([]);
      localStorage.setItem(this.storageKey, JSON.stringify({ ...state, zoom: this.zoom() }));
      this.visionStorageBlocked = false; this.saveStatus.set('Sincronizado');
    } finally { this.applyingRemote = false; }
  }

  private captureBoardState(): StoredBoardState {
    const origins = new Map(this.tokenDrag?.origins.map((token) => [token.instanceId, token]));
    return structuredClone({ vision: this.vision(), combat: this.combat.serialized(),
      tokens: this.tokens().map((token) => ({ ...token, ...(origins.get(token.instanceId) ?? {}) })),
      fogRects: this.fogRects(), layers: this.layers(), zoom: this.zoom(), activeTurnId: this.activeTurnId() });
  }

  private playerControls(tokens: BoardToken[]): Record<string, PlayerControls> {
    const result: Record<string, PlayerControls> = {};
    const profiles = this.tokenVisionProfiles();
    for (const token of tokens.filter((token) => token.actorId.startsWith('player:'))) {
      const state = { ...this.vision(), groups: [{ id: 'personal', name: 'Personal', observerIds: [token.instanceId] }], activeGroupId: 'personal' };
      const geometry = previewSight(state, tokens, profiles, this.gridSize, this.mapWidth, this.mapHeight);
      const visible = token.hidden ? [] : tokens.filter((item) => previewTokenVisible(item, geometry.circles, this.fogRects(), this.gridSize));
      const canMove = !this.tokenDrag && !token.hidden && !geometry.pending && this.vision().enabled && this.combat.state().started &&
        this.combat.state().turnId === token.instanceId && this.activeTurnId() === token.instanceId && !this.combat.busy() && token.hp > 0 && !token.conditions?.includes('incapacitated');
      const owner = this.combat.find(token.instanceId);
      const canAttack = canMove && this.combat.canAttack(token.instanceId);
      const cells: number[] = [];
      if (canMove) for (let row = 0; row < 20; row++) for (let column = 0; column < 30; column++) {
        const x = column * this.gridSize, y = row * this.gridSize;
        if (x + token.size * this.gridSize > this.mapWidth + .001 || y + token.size * this.gridSize > this.mapHeight + .001) continue;
        if (previewTokenVisible({ ...token, x, y }, geometry.circles, this.fogRects(), this.gridSize)) cells.push(row * 30 + column);
      }
      const targets = visible.filter((item) => item.instanceId !== token.instanceId).map((item) => ({ id: item.instanceId, name: item.name, x: item.x, y: item.y, size: item.size }));
      const attacks = canAttack && owner ? owner.actions.filter((action) => !actionProblem(action) && this.combat.available(owner, action.cost) >= (action.cost?.amount ?? 0) &&
        !(action.kind === 'spell' && action.resolution === 'attack' && !action.attackType)).map((action) => ({ source: action.source, name: action.name,
          targetIds: this.combat.targets(owner, action).filter((actor) => targets.some((target) => target.id === actor.id)).filter((target) => {
            const info = attackSituation(owner, target, action, this.combatants(), { ...normalAttackFacts(), reviewed: true }, this.combat.sight);
            return !info.blocked && !info.doubts.length && !info.threatUnknown && !info.spellTypeUnknown;
          }).map((actor) => actor.id) })) : [];
      result[token.instanceId] = { position: { x: token.x, y: token.y, size: token.size }, canMove, canAttack, cells, targets, attacks };
    }
    return result;
  }

  private applyPlayerCommand(command: EncounterCommand): void {
    const before = this.captureBoardState();
    this.applyingRemote = true;
    let receipt: CommandReceipt = { id: command.id, status: 'rejected', message: 'La acción ya no es válida. Revisa el turno y vuelve a intentarlo.' };
    try {
      if (command.expiresAt < Date.now()) throw new Error('Acción caducada.');
      if (this.publisher && this.currentCampaign && command.sheetRevision !== this.publisher.sheetRevision(this.currentCampaign.id)) throw new Error('Las fichas cambiaron.');
      const controls = this.playerControls(this.tokens())[command.observerId];
      if (command.type === 'move') {
        if (!controls?.canMove || command.cell === undefined || !controls.cells.includes(command.cell)) throw new Error('Movimiento no permitido.');
        const cell = command.cell;
        this.tokens.update((tokens) => tokens.map((token) => token.instanceId === command.observerId ? { ...token, x: cell % 30 * this.gridSize, y: Math.floor(cell / 30) * this.gridSize } : token));
        receipt = { id: command.id, status: 'applied', message: 'Token movido.' };
      } else {
        const owner = this.combat.find(command.observerId), target = this.combat.find(command.targetId);
        const action = owner?.actions.find((action) => action.source === command.source);
        if (!owner || !target || !action || !controls?.canAttack || !controls.attacks.some((attack) => attack.source === action.source && attack.targetIds.includes(target.id))) throw new Error('Ataque no permitido.');
        const situation = attackSituation(owner, target, action, this.combatants(), { ...normalAttackFacts(), reviewed: true }, this.combat.sight);
        if (situation.blocked || situation.doubts.length || situation.threatUnknown || situation.spellTypeUnknown) throw new Error('El director debe confirmar la situación.');
        this.combat.begin(action.source, [target.id], situation.context);
        const roll = this.combat.state().pending?.roll;
        this.combat.settleAutomatic();
        receipt = { id: command.id, status: 'applied', message: `${action.name}${roll ? `: d20 [${roll.dice.join(', ')}] + ${roll.bonus} = ${roll.total}.` : '.'} ${this.combat.state().pending ? 'El director resolverá las reacciones o efectos pendientes.' : 'Acción resuelta.'}` };
      }
      this.persist();
    } catch { this.applyRemoteBoard(before); }
    finally { this.applyingRemote = false; }
    this.pendingAck = receipt; this.sharingDirty = true; this.scheduleSharing(true);
  }

  protected toggleEncounterSharing(): void {
    if (!this.sharingReady() || (this.visionStorageBlocked && !this.encounterShared())) return;
    if (this.encounterShared() && this.publisher && this.currentCampaign) {
      this.encounterShared.set(false); clearTimeout(this.sharingTimer);
      const generation = ++this.sharingGeneration, publisher = this.publisher;
      const campaignId = this.currentCampaign.id, key = this.storageKey;
      this.sharingMessage.set('Retirando encuentro…');
      // Una retirada ya solicitada se completa aunque se cierre o cambie de tablero.
      this.sharingChain = this.sharingChain.then(() => publisher.unshare(campaignId, key)).then(() => {
        if (generation === this.sharingGeneration) this.sharingMessage.set('Encuentro retirado de jugadores.');
      }).catch(() => { if (generation === this.sharingGeneration) this.sharingMessage.set('No se pudo retirar el encuentro. Pulsa Actualizar estado compartido para reintentar.'); });
      return;
    }
    this.encounterShared.update((value) => !value);
    this.scheduleSharing(true);
  }

  private sharingSnapshot(): SharingSnapshot | undefined {
    if (!this.currentCampaign || !this.sharingEntry || this.visionStorageBlocked) return undefined;
    const state = this.captureBoardState();
    return {
      revision: this.sharingRevision, state, controls: this.playerControls(state.tokens), ack: this.pendingAck,
      sheetRevision: this.publisher?.sheetRevision(this.currentCampaign.id) ?? 0,
      title: this.sharingEntry.name, mapUrl: this.sharingEntry.mapUrl, vision: structuredClone(this.vision()),
      tokens: state.tokens,
      fog: structuredClone(this.fogRects()), profiles: structuredClone(this.tokenVisionProfiles()),
      actors: this.characterSheets.playerSheets(this.currentCampaign).filter((sheet) => sheet.playerIds?.length).map((sheet) => sheet.id),
    };
  }

  private leaveSharedBoard(): void {
    clearTimeout(this.sharingTimer); this.sharingGeneration++; this.syncEpoch++;
    const publisher = this.publisher, campaign = this.currentCampaign?.id, key = this.storageKey;
    if (!publisher || !campaign || !this.sharingReady() || !this.encounterShared()) return;
    const snapshot = this.sharingSnapshot();
    // Captura final inmutable: salir antes del debounce no deja una vista anterior sin niebla.
    // Si no puede actualizarse, retira la publicación y conserva el guardado local.
    this.sharingChain = this.sharingChain.then(async () => {
      try {
        if (!snapshot) throw new Error('Visión sin confirmar.');
        const ownPublication = this.publishedRevisions.get(key);
        if (ownPublication && ownPublication.base === snapshot.revision) snapshot.revision = ownPublication.revision;
        await publisher.publish(campaign, key, snapshot, () => true);
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 409) this.preserveConflict();
        else await publisher.unshare(campaign, key, snapshot?.revision ?? 0);
      }
    }).catch(() => { /* El guardado local se conserva si tampoco hay conexión para retirar. */ });
  }

  private scheduleSharing(force = false): void {
    if (this.applyingRemote || !this.publisher || !this.sharingReady() || (!force && !this.encounterShared())) return;
    this.sharingDirty = true;
    clearTimeout(this.sharingTimer);
    const generation = ++this.sharingGeneration;
    this.sharingMessage.set(this.encounterShared() ? 'Actualizando vista de jugadores…' : 'Retirando encuentro…');
    this.sharingTimer = setTimeout(() => {
      this.sharingChain = this.sharingChain.then(async () => {
        const campaign = this.currentCampaign, entry = this.sharingEntry, publisher = this.publisher;
        if (generation !== this.sharingGeneration || !campaign || !entry || !publisher) return;
        const current = (): boolean => generation === this.sharingGeneration;
        try {
          this.sharingBusy = true;
          if (!this.encounterShared()) await publisher.unshare(campaign.id, this.storageKey);
          else {
            if (this.visionStorageBlocked) throw new Error('Datos de visión no válidos.');
            const snapshot = this.sharingSnapshot();
            if (!snapshot) throw new Error('Visión sin confirmar.');
            const key = this.storageKey;
            const published = await publisher.publish(campaign.id, key, snapshot, current);
            if (published) {
              this.publishedRevisions.set(key, { base: snapshot.revision ?? 0, revision: published.revision });
              if (key === this.storageKey && snapshot.revision === this.sharingRevision) this.sharingRevision = published.revision;
            }
            if (current()) { if (!published) this.sharingRevision++; this.sharingDirty = false; this.pendingAck = undefined; }
          }
          if (current()) this.sharingMessage.set(this.encounterShared() ? 'Encuentro compartido y actualizado.' : 'Encuentro retirado de jugadores.');
        } catch (error) {
          if (error instanceof HttpErrorResponse && error.status === 409) this.preserveConflict();
          this.sharingRevision = -1;
          if (current()) this.sharingMessage.set('No se pudo actualizar el encuentro compartido. Reintenta; si las fichas han cambiado, recarga el tablero.');
        } finally { this.sharingBusy = false; }
      });
    }, force ? 0 : 500);
  }

  protected retryEncounterSharing(): void { this.scheduleSharing(true); }

  protected setMode(mode: ToolMode): void {
    if (this.visionPreview() && mode !== 'pan') return;
    if (['wall', 'door', 'window', 'light'].includes(mode) && (this.visionStorageBlocked || this.combat.busy())) return;
    this.cancelInteraction();
    this.lastTokenClickId = this.doubleClickTokenId = undefined;
    this.cancelAttack();
    this.mode.set(mode);
    if (this.drawingObstacle()) this.setSidebarTab('geometry');
    if (mode === 'light') this.setSidebarTab('lights');
    this.draftFog.set(undefined);
    this.measureLine.set(undefined);
  }

  protected setBoardVision(value: BoardVisionState): void {
    if (this.visionStorageBlocked) throw new Error('Conserva el guardado original antes de sustituir datos de visión no admitidos.');
    assertBoardVision(value, new Set(this.tokens().map((token) => token.instanceId)));
    this.vision.set(structuredClone(value));
    this.persist();
  }

  protected toggleVisionPreview(): void {
    if (this.combat.busy() || (!this.visionPreview() && (!this.vision().enabled || this.visionStorageBlocked))) return;
    this.closeTokenSheet(); this.combatPanel?.close(); this.cancelAttack(); this.clearSelection();
    this.cancelInteraction();
    this.diceOpen.set(false); this.diceResult.set(''); this.combatMessage.set('');
    this.visionPreview.update((value) => !value);
    this.mode.set(this.visionPreview() ? 'pan' : 'select');
  }

  protected enableVision(enabled: boolean): void { this.setBoardVision({ ...this.vision(), enabled }); }
  protected lightRadiusPixels(radiusFeet: number): number { return radiusFeet * 0.3048 / 1.5 * this.gridSize; }
  private validLightRadius(value: string): number | undefined {
    const radius = Number(value);
    if (!value.trim() || !Number.isFinite(radius) || radius <= 0 || radius > 100000) {
      this.visionMessage.set('Introduce un radio mayor que 0 y como máximo 100000 pies.'); return;
    }
    return radius;
  }
  private placeSceneLight(point: BoardPoint): void {
    if (this.visionPreview() || this.combat.busy() || this.visionStorageBlocked) return;
    const radiusFeet = this.validLightRadius(this.lightRadius());
    if (radiusFeet === undefined) return;
    const effect: SceneLight = { id: this.newId('scene-light'), name: `Foco ${this.sceneLights().length + 1}`, kind: 'light',
      scope: { kind: 'circle', ...point, radiusFeet }, illumination: this.lightIllumination(), active: true,
      duration: { kind: 'until-ended' }, source: { kind: 'director', reference: 'Foco colocado sobre el escenario; radio declarado por dirección' } };
    try { this.setBoardVision({ ...this.vision(), effects: [...this.vision().effects, effect] }); this.visionMessage.set('Foco guardado. Puedes ajustar su radio en Luces.'); }
    catch { this.visionMessage.set('No se pudo guardar el foco. Conserva el guardado original y revisa el límite de efectos.'); }
  }
  protected updateSceneLight(id: string, radius: string, illumination: string): void {
    if (this.visionPreview() || this.combat.busy() || this.visionStorageBlocked || !this.sceneLights().some((light) => light.id === id)) return;
    const radiusFeet = this.validLightRadius(radius);
    if (radiusFeet === undefined || (illumination !== 'bright' && illumination !== 'dim')) return;
    this.setBoardVision({ ...this.vision(), effects: this.vision().effects.map((effect) => effect.id === id && effect.scope.kind === 'circle'
      ? { ...effect, scope: { ...effect.scope, radiusFeet }, illumination } : effect) });
    this.visionMessage.set('Radio e iluminación del foco guardados.');
  }
  protected changeSceneLight(id: string, remove = false): void {
    if (this.visionPreview() || this.combat.busy() || this.visionStorageBlocked || !this.sceneLights().some((light) => light.id === id)) return;
    this.setBoardVision({ ...this.vision(), effects: this.vision().effects.filter((effect) => !remove || effect.id !== id)
      .map((effect) => effect.id === id ? { ...effect, active: !effect.active } : effect) });
    this.visionMessage.set(remove ? 'Foco eliminado.' : 'Estado del foco guardado.');
  }
  protected confirmVisionGeometry(): void {
    if (this.combat.busy()) return;
    this.setBoardVision({ ...this.vision(), obstacles: this.vision().obstacles ?? [] });
  }
  protected obstacleLabel(obstacle: VisionObstacle): string {
    if (isVisionDoor(obstacle)) return `${obstacle.kind === 'door-window' ? 'Puerta con ventana' : 'Puerta'} ${obstacle.open ? 'abierta' : 'cerrada'}`;
    return obstacle.kind === 'window' ? 'Ventana' : 'Pared';
  }
  private saveDrawnObstacle(end: BoardPoint): void {
    if (!this.drawStart || !this.drawingObstacle() || this.visionPreview() || this.combat.busy() || this.visionStorageBlocked) return;
    if (Math.hypot(end.x - this.drawStart.x, end.y - this.drawStart.y) * this.zoom() < 4) return;
    const mode = this.mode() as 'wall' | 'door' | 'window';
    const kind = mode === 'door' && this.doorHasWindow() ? 'door-window' : mode;
    const obstacle: VisionObstacle = { id: this.newId('obstacle'), name: `${kind === 'wall' ? 'Pared' : kind === 'window' ? 'Ventana' : kind === 'door-window' ? 'Puerta con ventana' : 'Puerta'} ${(this.vision().obstacles?.length ?? 0) + 1}`,
      kind, start: { ...this.drawStart }, end, blocksSight: kind === 'wall' || kind === 'door', blocksEffect: true,
      source: { kind: 'director', reference: 'Trazado sobre el mapa declarado por dirección' }, ...(mode === 'door' ? { open: false } : {}) };
    try { this.setBoardVision({ ...this.vision(), obstacles: [...(this.vision().obstacles ?? []), obstacle] }); this.visionMessage.set(`${this.obstacleLabel(obstacle)} guardada.`); }
    catch { this.visionMessage.set('No se pudo guardar el trazado. Conserva el guardado original y revisa el límite de obstáculos.'); }
  }
  protected setDoorWindow(id: string, hasWindow: boolean): void {
    if (this.visionPreview() || this.combat.busy() || this.visionStorageBlocked) return;
    this.setBoardVision({ ...this.vision(), obstacles: this.vision().obstacles?.map((o) => o.id === id && isVisionDoor(o)
      ? { ...o, kind: hasWindow ? 'door-window' : 'door', blocksSight: !hasWindow } : o) });
  }
  protected changeVisionObstacle(id: string, remove = false): void {
    if (this.visionPreview() || this.combat.busy() || this.visionStorageBlocked) return;
    this.setBoardVision({ ...this.vision(), obstacles: this.vision().obstacles?.filter((o) => !remove || o.id !== id)
      .map((o) => o.id === id && isVisionDoor(o) ? { ...o, open: !o.open } : o) });
  }
  protected setVisionGameTime(day: string, minute: string, period: string): void {
    if (this.combat.busy() || !day.trim() || !minute.trim() || !['unknown', 'dawn', 'day', 'dusk', 'night'].includes(period)) return;
    try { this.setBoardVision({ ...this.vision(), environment: { ...this.vision().environment,
      timeOfDay: period as BoardVisionState['environment']['timeOfDay'], gameTime: { day: Number(day), minuteOfDay: Number(minute), second: 0 },
      source: { kind: 'director', reference: 'Reloj del mundo de juego declarado por dirección' } } }); }
    catch { this.visionMessage.set('Indica un día válido y un minuto del día entre 0 y 1439.'); }
  }
  protected setVisionObscurement(value: string): void {
    if (this.combat.busy() || !['unknown', 'none', 'light', 'heavy'].includes(value)) return;
    this.setBoardVision({ ...this.vision(), environment: { ...this.vision().environment,
      obscurement: value as NonNullable<BoardVisionState['environment']['obscurement']>,
      source: { kind: 'director', reference: 'Oscurecimiento del entorno declarado por dirección' } } });
  }
  protected advanceVisionTime(kind: 'rounds' | 'minutes', amount: string): void {
    if (this.combat.busy() || !amount.trim()) return;
    try { this.setBoardVision(advanceVisionEffects(this.vision(), { kind, amount: Number(amount) })); this.visionMessage.set('Tiempo de juego y duraciones actualizados.'); }
    catch { this.visionMessage.set('Indica un número entero no negativo dentro del reloj de juego.'); }
  }
  protected finishVisionEffect(id: string): void {
    if (!this.combat.busy()) this.setBoardVision(endVisionEffect(this.vision(), id));
  }
  protected visionDurationLabel(effect: VisionEffect): string {
    const labels = { unknown: 'Duración sin confirmar', 'until-ended': 'Hasta terminar', rounds: 'asaltos', minutes: 'minutos' };
    return 'remaining' in effect.duration ? `${effect.duration.remaining} ${labels[effect.duration.kind]}` : labels[effect.duration.kind];
  }
  protected finishVisionConcentration(id: string): void {
    if (!this.combat.busy()) this.setBoardVision(endVisionConcentration(this.vision(), id));
  }
  protected visionContactValue(id: string, key: 'surfaceId' | 'airborne' | 'moving' | 'subjectKind' | 'source'): string {
    const contact = this.vision().contacts?.find((c) => c.tokenId === id);
    if (key === 'source') return contact?.source.reference ?? '';
    const value = contact?.[key]; return value === undefined ? (key === 'surfaceId' ? '' : 'unknown') : String(value);
  }
  protected saveVisionContact(id: string, form: HTMLFormElement): void {
    if (this.combat.busy() || !this.tokens().some((t) => t.instanceId === id)) return;
    const data = new FormData(form), value = (name: string) => String(data.get(name) ?? '').trim();
    if (!value('source') || !['unknown', 'creature', 'object'].includes(value('subjectKind')) ||
        ['airborne', 'moving'].some((key) => !['unknown', 'true', 'false'].includes(value(key)))) {
      this.visionMessage.set('Confirma el contacto y su fuente, dejando sin confirmar los datos que falten.'); return;
    }
    const contact = { tokenId: id, source: { kind: 'director' as const, reference: value('source') },
      ...(value('surfaceId') ? { surfaceId: value('surfaceId') } : {}),
      ...(value('airborne') !== 'unknown' ? { airborne: value('airborne') === 'true' } : {}),
      ...(value('moving') !== 'unknown' ? { moving: value('moving') === 'true' } : {}),
      ...(value('subjectKind') !== 'unknown' ? { subjectKind: value('subjectKind') as 'creature' | 'object' } : {}),
    };
    try { this.setBoardVision({ ...this.vision(), contacts: [...(this.vision().contacts ?? []).filter((c) => c.tokenId !== id), contact] });
      this.visionMessage.set('Contacto guardado solo para esta instancia y encuentro.'); }
    catch { this.visionMessage.set('No se pudo guardar el contacto: revisa los datos y su fuente.'); }
  }
  protected assessVisionDetection(observerId: string, targetId: string): void {
    const result = evaluateVision(this.vision(), this.tokens(), this.tokenVisionProfiles(), observerId, targetId, this.gridSize);
    const label = (value: boolean | undefined) => value === undefined ? 'sin confirmar' : value ? 'sí' : 'no';
    this.visionMessage.set(`Vista: ${label(result.visible)} · Detección de posición: ${label(result.detected)} · Línea de efecto: ${label(result.lineOfEffect)}. ${result.reasons.join(' ')}`);
  }
  protected addVisionEffect(form: HTMLFormElement): void {
    if (this.combat.busy()) return;
    const data = new FormData(form), value = (name: string) => String(data.get(name) ?? '').trim();
    const kind = value('kind'), durationKind = value('duration');
    if (!value('name') || !value('source') || !['light', 'magical-darkness', 'obscurement', 'blinded', 'sense'].includes(kind) ||
      !['unknown', 'until-ended', 'rounds', 'minutes'].includes(durationKind)) {
      this.visionMessage.set('Completa el nombre, tipo, fuente y duración del efecto.'); return;
    }
    const onToken = ['blinded', 'sense'].includes(kind);
    if (onToken ? !value('token') : ['x', 'y', 'radius'].some((k) => !value(k))) {
      this.visionMessage.set(onToken ? 'Elige la instancia afectada por el efecto.' : 'Indica el centro y radio de la zona.'); return;
    }
    if (['rounds', 'minutes'].includes(durationKind) && !value('remaining')) { this.visionMessage.set('Indica la duración restante.'); return; }
    const effect: VisionEffect = { id: this.newId('vision-effect'), name: value('name'), kind: kind as VisionEffect['kind'], active: true,
      source: { kind: 'director', reference: value('source') },
      scope: onToken ? { kind: 'tokens', tokenIds: [value('token')] } : { kind: 'circle', x: Number(value('x')), y: Number(value('y')), radiusFeet: Number(value('radius')) },
      duration: (['rounds', 'minutes'].includes(durationKind) ? { kind: durationKind, remaining: Number(value('remaining')) } : { kind: durationKind }) as VisionEffect['duration'],
      ...(value('concentration') ? { concentrationTokenId: value('concentration') } : {}),
      ...(kind === 'light' ? { illumination: value('illumination') as 'bright' | 'dim' } : {}),
      ...(kind === 'obscurement' ? { obscurement: value('obscurement') as 'light' | 'heavy' } : {}),
      ...(kind === 'sense' ? { grantedSense: { sense: value('sense') as VisionSense, rangeFeet: Number(value('range')),
        source: { kind: 'director' as const, reference: value('source') } } } : {}),
    };
    if (kind === 'sense' && !value('range')) { this.visionMessage.set('Indica el alcance del sentido concedido.'); return; }
    if ('remaining' in effect.duration && effect.duration.remaining === 0) effect.active = false;
    try { this.setBoardVision({ ...this.vision(), effects: [...this.vision().effects, effect] }); this.visionMessage.set('Efecto guardado con su fuente y duración.'); }
    catch { this.visionMessage.set('Revisa los alcances, duración, ámbito y fuente del efecto.'); }
  }
  protected createVisionGroup(name: string): void {
    const trimmed = name.trim(); if (!trimmed || trimmed.length > 500 || this.vision().groups.length >= 100) return;
    const id = this.newId('observers');
    this.setBoardVision({ ...this.vision(), groups: [...this.vision().groups, { id, name: trimmed, observerIds: [] }], activeGroupId: id });
  }
  protected chooseVisionGroup(id: string): void { this.setBoardVision({ ...this.vision(), activeGroupId: id || undefined }); }
  protected toggleVisionObserver(id: string, checked: boolean): void {
    const value = this.vision();
    this.setBoardVision({ ...value, groups: value.groups.map((group) => group.id !== value.activeGroupId ? group : {
      ...group, observerIds: checked ? [...new Set([...group.observerIds, id])] : group.observerIds.filter((item) => item !== id),
    }) });
  }
  protected setPreviewEnvironment(field: 'illumination' | 'weather', value: string): void {
    const allowed = field === 'illumination' ? ['unknown', 'bright', 'dim', 'darkness'] : ['unknown', 'clear', 'rain', 'snow', 'fog', 'other'];
    if (!allowed.includes(value)) return;
    this.setBoardVision({ ...this.vision(), environment: { ...this.vision().environment, [field]: value,
      source: { kind: 'director', reference: 'Entorno de juego declarado por el director en el VTT' } } });
  }
  protected normalVisionRange(id: string): number | null | undefined {
    return this.tokenVisionProfiles().get(id)?.senses.find((sense) => sense.sense === 'normal')?.rangeFeet;
  }
  protected shadowPoints(points: { x: number; y: number }[]): string { return points.map((point) => `${point.x},${point.y}`).join(' '); }
  protected async saveNormalVision(id: string, range: string, unlimited: boolean, reference: string): Promise<void> {
    await this.saveSense(id, 'normal', range, unlimited, reference);
  }

  protected async saveSense(id: string, sense: string, range: string, unlimited: boolean, reference: string): Promise<void> {
    if (this.visionPreview() || this.visionStorageBlocked || !this.currentCampaign) return;
    if (!['normal', 'darkvision', 'blindsight', 'truesight', 'tremorsense'].includes(sense) || (unlimited && sense !== 'normal')) return;
    const token = this.tokens().find((item) => item.instanceId === id); if (!token) return;
    const amount = unlimited ? null : Number(range);
    if ((!unlimited && (!range.trim() || !Number.isFinite(amount) || amount! < 0 || amount! > 100000)) || !reference.trim()) {
      this.visionMessage.set('Indica un alcance válido y su fuente; no se deducen de los nombres.'); return;
    }
    const senses = this.tokenVisionProfiles().get(id)?.senses.filter((entry) => entry.sense !== sense) ?? [];
    try {
      await this.characterSheets.saveVisionProfile(this.currentCampaign, token.actorId, { version: 1, senses: [...senses,
        { sense: sense as VisionSense, rangeFeet: amount, source: { kind: 'director', reference: reference.trim() } }] });
      this.sheetRevision.update((revision) => revision + 1); this.visionMessage.set('Sentido guardado en la ficha compartida.'); this.scheduleSharing();
    } catch { this.visionMessage.set('No se pudo guardar la visión. Revisa la ficha y su fuente.'); }
  }

  protected specialSenseSummary(id: string): string {
    const names = { normal: 'Vista normal', darkvision: 'Visión en la oscuridad', blindsight: 'Visión ciega', truesight: 'Visión verdadera', tremorsense: 'Sentido sísmico' };
    return this.tokenVisionProfiles().get(id)?.senses.filter((sense) => sense.sense !== 'normal').map((sense) => `${names[sense.sense]}: ${sense.rangeFeet} pies`).join(' · ') || 'Sin sentidos especiales registrados';
  }

  protected saveTokenLight(id: string, bright: string, dim: string, reference: string): void {
    const token = this.tokens().find((item) => item.instanceId === id);
    const brightFeet = Number(bright), dimFeet = Number(dim);
    if (!token || !bright.trim() || !dim.trim() || !reference.trim() || !Number.isFinite(brightFeet) || !Number.isFinite(dimFeet) || brightFeet < 0 || dimFeet < brightFeet || dimFeet > 100000) {
      this.visionMessage.set('Indica radios válidos desde la fuente, penumbra al menos igual que luz intensa y la fuente de esos alcances.'); return;
    }
    const effects = this.vision().effects.filter((effect) => !effect.id.startsWith(`token-light:${id}:`));
    for (const [illumination, radiusFeet] of [['bright', brightFeet], ['dim', dimFeet]] as const) if (radiusFeet > 0) effects.push({
      id: `token-light:${id}:${illumination}`, name: `Luz de ${token.name}`, kind: 'light', illumination, anchorTokenId: id,
      source: { kind: 'director', reference: reference.trim() }, scope: { kind: 'circle', x: token.x, y: token.y, radiusFeet },
      duration: { kind: 'until-ended' }, active: true,
    });
    this.setBoardVision({ ...this.vision(), effects }); this.visionMessage.set('Fuente de luz guardada; acompaña a esta instancia.');
  }

  protected removeTokenLight(id: string): void {
    this.setBoardVision({ ...this.vision(), effects: this.vision().effects.filter((effect) => !effect.id.startsWith(`token-light:${id}:`)) });
  }
  protected tokenLightRange(id: string, illumination: 'bright' | 'dim'): number {
    const effect = this.vision().effects.find((item) => item.id === `token-light:${id}:${illumination}`);
    return effect?.scope.kind === 'circle' ? effect.scope.radiusFeet : 0;
  }
  protected rollVisualPerception(id: string, targetId: string, bonusText: string): void {
    const observer = this.tokens().find((token) => token.instanceId === id), target = this.tokens().find((token) => token.instanceId === targetId) ?? observer;
    if (!observer || !target || !bonusText.trim() || !Number.isFinite(Number(bonusText))) { this.perceptionMessage.set('Indica el bonificador de Percepción de la ficha.'); return; }
    const assessment = evaluateVision(this.vision(), this.tokens(), this.tokenVisionProfiles(), id, target.instanceId, this.gridSize);
    if (assessment.perception === 'unknown' || assessment.perception === 'automatic-failure') { this.perceptionMessage.set(assessment.reasons.join(' ')); return; }
    const dice = assessment.perception === 'disadvantage' ? [this.roll(20), this.roll(20)] : [this.roll(20)];
    const result = `${observer.name} · Percepción visual: ${Math.min(...dice) + Number(bonusText)} (${dice.join(', ')}; ${assessment.perception === 'disadvantage' ? 'desventaja' : 'normal'})`;
    this.perceptionMessage.set(`${result}. ${assessment.reasons.join(' ')}`); this.diceResult.set(result);
  }

  protected setSidebarTab(tab: SidebarTab): void {
    this.sidebarTab.set(tab);
  }

  protected updateTokenQuery(value: string): void {
    this.tokenQuery.set(value);
  }

  protected addToken(choice: TokenChoice): void {
    if (this.visionPreview()) return;
    if (this.combat.busy()) return;
    const existing = this.tokens().length;
    const x = ((existing % 10) + 1) * this.gridSize;
    const y = (Math.floor(existing / 10) + 1) * this.gridSize;
    const token: BoardToken = {
      instanceId: `${choice.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actorId: choice.id,
      name: choice.name,
      image: choice.image,
      x: this.clamp(x, 0, this.mapWidth - this.gridSize),
      y: this.clamp(y, 0, this.mapHeight - this.gridSize),
      size: 1,
      hp: choice.maxHp,
      maxHp: choice.maxHp,
      initiative: 0,
      hidden: false,
      conditions: [],
    };

    this.tokens.update((tokens) => [...tokens, token]);
    this.selectedTokenIds.set([token.instanceId]);
    this.persist();
  }

  protected selectToken(instanceId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.visionPreview()) return;
    if (this.targeting()) {
      if (instanceId === this.attackingId()) { this.combatMessage.set('Elige otra ficha como objetivo'); return; }
      const target = this.combat.find(instanceId);
      if (!target || target.armorClass === undefined || target.maxHp <= 0) { this.combatMessage.set('Completa la ficha del objetivo antes de atacar'); return; }
      this.combatMessage.set(''); this.attackTargetId.set(instanceId); return;
    }
    // El puntero selecciona antes de arrastrar; los clics con detail 0 vienen del teclado.
    if (this.mode() !== 'select' || event.detail !== 0) return;
    this.chooseToken(instanceId, event.shiftKey || event.ctrlKey || event.metaKey);
  }

  protected openTokenSheet(instanceId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.visionPreview()) return;
    if (this.targeting()) return;
    if ((event.type === 'dblclick' && this.mode() !== 'select') || event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.type === 'dblclick' && this.doubleClickTokenId !== instanceId) return;
    const dialog = this.tokenSheetDialog;
    if (!dialog || !this.tokens().some((token) => token.instanceId === instanceId)) return;
    this.cancelInteraction();
    this.sheetReturnFocus = Array.from(this.board?.nativeElement.querySelectorAll<HTMLElement>('.vtt-token') ?? [])
      .find((element) => element.dataset['tokenInstance'] === instanceId);
    this.openedSheetTokenId.set(instanceId);
    dialog.open();
  }

  protected closeTokenSheet(): void {
    this.tokenSheetDialog?.close();
    this.openedSheetTokenId.set(undefined);
  }

  protected tokenSheetClosed(): void {
    this.openedSheetTokenId.set(undefined);
    if (this.sheetReturnFocus?.isConnected) this.sheetReturnFocus.focus({ preventScroll: true });
    this.sheetReturnFocus = undefined;
  }

  protected isTokenSelected(instanceId: string): boolean {
    return this.selectedTokenIds().includes(instanceId);
  }

  protected selectAllTokens(): void {
    if (this.visionPreview()) return;
    this.cancelInteraction();
    this.selectedTokenIds.set(this.layers().tokens ? this.tokens().map((token) => token.instanceId) : []);
  }

  protected clearSelection(): void {
    this.cancelInteraction();
    this.selectedTokenIds.set([]);
  }

  protected tokenPointerDown(token: BoardToken, event: PointerEvent): void {
    if (this.visionPreview()) return;
    if (this.targeting()) { event.stopPropagation(); return; }
    if (this.combat.busy()) { event.stopPropagation(); return; }
    if (this.mode() !== 'select' || event.button !== 0 || this.interactionPointerId !== undefined) return;
    event.stopPropagation();
    const point = this.boardPoint(event);
    if (!point) return;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const wasSelected = this.isTokenSelected(token.instanceId);
    if (additive || !wasSelected) this.chooseToken(token.instanceId, additive);
    if (!this.isTokenSelected(token.instanceId)) return;
    this.tokenDrag = {
      start: point,
      origins: this.selectedTokens().map(({ instanceId, x, y, size }) => ({ instanceId, x, y, size })),
      clickedId: token.instanceId,
      collapseOnClick: wasSelected && !additive,
      moved: false,
    };
    this.capturePointer(event, event.currentTarget as HTMLElement);
  }

  protected setSelectedHidden(hidden: boolean): void {
    if (this.combat.busy()) return;
    const ids = new Set(this.selectedTokenIds());
    this.tokens.update((tokens) => tokens.map((token) => ids.has(token.instanceId) ? { ...token, hidden } : token));
    this.persist();
  }

  protected updateSelectedNumber(
    field: 'hp' | 'maxHp' | 'size',
    value: string
  ): void {
    if (this.combat.busy()) return;
    this.cancelInteraction();
    const token = this.selectedToken();
    if (!token) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const nextValue =
      field === 'size'
        ? this.clamp(Math.round(numericValue), 1, 4)
        : Math.max(0, Math.round(numericValue));
    this.updateToken(token.instanceId, { [field]: nextValue });
  }

  protected updateSelectedHidden(hidden: boolean): void {
    if (this.combat.busy()) return;
    const token = this.selectedToken();
    if (token) this.updateToken(token.instanceId, { hidden });
  }

  protected hpPercent(token: BoardToken): number {
    if (token.maxHp <= 0) return 0;
    return this.clamp((token.hp / token.maxHp) * 100, 0, 100);
  }

  protected removeSelectedTokens(): void {
    if (this.combat.busy()) return;
    const ids = new Set(this.selectedTokenIds());
    if (!ids.size) return;
    if (ids.has(this.openedSheetTokenId() ?? '')) this.closeTokenSheet();
    this.cancelInteraction();
    this.tokens.update((tokens) => tokens.filter((token) => !ids.has(token.instanceId)));
    this.vision.update((vision) => withoutRemovedObservers(vision, new Set(this.tokens().map((token) => token.instanceId))));
    if (ids.has(this.activeTurnId() ?? '')) this.activeTurnId.set(undefined);
    this.selectedTokenIds.set([]);
    this.persist();
  }

  protected updateInitiative(instanceId: string, value: string): void {
    if (this.combat.busy()) return;
    const initiative = Number(value);
    if (Number.isFinite(initiative)) {
      this.updateToken(instanceId, { initiative: Math.round(initiative) });
    }
  }

  protected rollAllInitiatives(): void {
    if (this.combat.busy() || this.combat.state().started) return;
    const modifiers = this.tokens().map((token) => this.currentCampaign ? this.resolveTokenSheet(token, this.currentCampaign).statistics?.initiative : undefined);
    if (modifiers.some((v) => v === undefined || !/^[+-]?\d+$/.test(v.trim()))) { this.combatMessage.set('Registra los modificadores de iniciativa en las fichas, o introduce los resultados manualmente e inicia con esa iniciativa.'); return; }
    this.combatMessage.set('');
    const rolledTokens = this.tokens().map((token, index) => ({
      ...token,
      initiative: this.roll(20) + Number(modifiers[index]),
    }));
    if (!rolledTokens.length) return;

    this.tokens.set(rolledTokens);
    const [firstTurn] = rolledTokens
      .slice()
      .sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
    this.activeTurnId.set(firstTurn?.instanceId);
    if (firstTurn) this.combat.start(firstTurn.instanceId);
    this.diceResult.set(`Iniciativa: ${rolledTokens.length}`);
    this.persist();
  }

  protected advanceTurn(): void {
    if (this.combat.busy()) return;
    this.cancelAttack();
    const ordered = this.initiativeTokens();
    if (!ordered.length) return;
    const currentIndex = ordered.findIndex(
      (token) => token.instanceId === this.activeTurnId()
    );
    this.activeTurnId.set(ordered[(currentIndex + 1) % ordered.length].instanceId);
    this.combat.turn(this.activeTurnId()!, currentIndex === ordered.length - 1);
    this.persist();
  }

  protected setActiveTurn(instanceId: string): void {
    if (this.combat.busy()) return;
    this.cancelAttack();
    this.activeTurnId.set(instanceId);
    this.combat.turn(instanceId);
    this.persist();
  }

  protected startCombat(): void {
    const id = this.activeTurnId() ?? this.initiativeTokens()[0]?.instanceId;
    if (!id || this.combat.busy() || this.combat.state().started) return;
    this.cancelInteraction(); this.activeTurnId.set(id); this.combat.start(id);
  }

  protected beginAttack(id: string): void {
    if (this.visionPreview()) return;
    if (!this.combat.canAttack(id)) { this.prepareCombat(id); return; }
    this.cancelInteraction(); this.closeTokenSheet(); this.mode.set('select'); this.sidebarTab.set('turns');
    this.combatMessage.set(''); this.attackTargetId.set(undefined); this.attackingId.set(id); this.showLatestCombat();
  }
  protected cancelAttack(): void { this.attackingId.set(undefined); this.attackTargetId.set(undefined); }
  protected showLatestCombat(): void { requestAnimationFrame(() => this.sideContent?.nativeElement.scrollTo({ top: 0 })); }
  protected attackRolled(): void { this.attackTargetId.set(undefined); this.showLatestCombat(); }
  protected showCombatDecision(): void { this.combatPanel?.resume(true); }
  protected prepareAttack(event: { owner: Combatant; action: CombatAction }): void { this.combatPanel?.prepareEntry(event.owner, event.action); }
  protected multipleAttack(event: { owner: Combatant; action: CombatAction }): void {
    this.combatPanel?.open(event.owner.id); this.combatPanel?.choose(event.action);
    if (this.combatPanel && this.attackTargetId()) this.combatPanel.targetIds[0] = this.attackTargetId()!;
  }
  protected setTokenSide(id: string, side: string): void {
    if (this.combat.busy() || !['party', 'enemy', 'neutral', ''].includes(side)) return;
    this.updateToken(id, { side: side ? side as CombatSide : undefined });
  }
  protected setTokenCondition(id: string, condition: CombatCondition, enabled: boolean): void {
    if (this.combat.busy()) return;
    const token = this.tokens().find((t) => t.instanceId === id); if (!token) return;
    const conditions = token.conditions ?? [];
    this.updateToken(id, { conditions: enabled ? [...new Set([...conditions, condition])] : conditions.filter((c) => c !== condition) });
  }
  protected clearTokenConditions(id: string): void { if (!this.combat.busy()) this.updateToken(id, { conditions: [] }); }
  protected prepareCombat(id: string): void { if (this.visionPreview()) return; this.cancelInteraction(); this.combatPanel?.open(id); }
  protected resumeCombat(): void { this.combatPanel?.resume(); }
  protected endCombat(): void {
    if (this.combat.busy() || !window.confirm('¿Terminar el combate? Los PG y los recursos gastados se conservan.')) return;
    this.cancelAttack(); this.combat.end();
  }

  protected resetInvalidCombat(): void {
    if (!this.combat.error() || !window.confirm('¿Restablecer solo el combate inválido? Se perderán sus recursos y tiradas pendientes; los tokens, PG, mapa y niebla se conservarán.')) return;
    this.combat.reset();
  }

  protected toggleLayer(layer: keyof LayerState): void {
    this.layers.update((layers) => ({ ...layers, [layer]: !layers[layer] }));
    if (layer === 'tokens' && !this.layers().tokens) this.clearSelection();
    this.persist();
  }

  protected coverMap(): void {
    this.fogRects.set([
      {
        id: this.newId('fog'),
        x: 0,
        y: 0,
        width: this.mapWidth,
        height: this.mapHeight,
      },
    ]);
    this.persist();
  }

  protected revealMap(): void {
    this.fogRects.set([]);
    this.persist();
  }

  protected zoomBy(delta: number): void {
    this.setZoom(this.zoom() + delta);
  }

  protected zoomWithWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY === 0) return;

    const viewport = this.viewport?.nativeElement;
    if (!viewport) return;

    const oldZoom = this.zoom();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const bounds = viewport.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const mapX = (viewport.scrollLeft + pointerX) / oldZoom;
    const mapY = (viewport.scrollTop + pointerY) / oldZoom;

    this.setZoom(oldZoom * factor);
    const newZoom = this.zoom();
    if (newZoom === oldZoom) return;

    requestAnimationFrame(() => {
      viewport.scrollLeft = mapX * newZoom - pointerX;
      viewport.scrollTop = mapY * newZoom - pointerY;
    });
  }

  protected fitMap(): void {
    const viewport = this.viewport?.nativeElement;
    if (!viewport) return;
    const zoom = Math.min(
      (viewport.clientWidth - 32) / this.mapWidth,
      (viewport.clientHeight - 32) / this.mapHeight
    );
    this.setZoom(zoom);
    viewport.scrollTo({ left: 0, top: 0 });
  }

  protected rollDie(sides: number): void {
    const result = this.roll(sides);
    this.diceResult.set(`d${sides}: ${result}`);
    this.diceOpen.set(false);
  }

  protected toggleDice(): void {
    this.diceOpen.update((open) => !open);
  }

  protected boardPointerDown(event: PointerEvent): void {
    if (this.targeting()) return;
    if (this.combat.busy()) return;
    if (event.button !== 0 || this.interactionPointerId !== undefined) return;
    if ((event.target as HTMLElement).closest('.vtt-token')) return;

    if (this.mode() === 'select') {
      this.lastTokenClickId = this.doubleClickTokenId = undefined;
      const point = this.boardPoint(event);
      if (!point) return;
      this.selectionStart = {
        point,
        previous: this.selectedTokenIds().slice(),
        additive: event.shiftKey || event.ctrlKey || event.metaKey,
      };
      this.board?.nativeElement.focus({ preventScroll: true });
      this.capturePointer(event);
      return;
    }

    if (this.mode() === 'pan') {
      const viewport = this.viewport?.nativeElement;
      if (!viewport) return;
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      this.capturePointer(event);
      return;
    }

    const point = this.boardPoint(event);
    if (!point) return;
    this.drawStart = this.drawingObstacle() || this.mode() === 'light' ? point : this.snapPoint(point, this.mode() === 'measure');
    this.board?.nativeElement.focus({ preventScroll: true });
    this.capturePointer(event);

    if (this.mode() === 'light') return;
    if (this.drawingObstacle()) {
      this.draftObstacle.set({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    } else if (this.mode() === 'measure') {
      this.measureLine.set({
        x1: this.drawStart.x,
        y1: this.drawStart.y,
        x2: this.drawStart.x,
        y2: this.drawStart.y,
      });
    } else {
      this.draftFog.set(this.rectFromPoints(this.drawStart, this.drawStart));
    }
  }

  protected boardPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.interactionPointerId) return;
    if (this.tokenDrag) {
      const point = this.boardPoint(event);
      if (point) this.moveTokenSelection(this.tokenDrag, point, false);
      return;
    }
    if (this.selectionStart) {
      const point = this.boardPoint(event);
      if (point) this.selectionRect.set(this.selectionBounds(this.selectionStart.point, point));
      return;
    }
    if (this.panStart && this.mode() === 'pan') {
      const viewport = this.viewport?.nativeElement;
      if (!viewport) return;
      viewport.scrollLeft = this.panStart.left - (event.clientX - this.panStart.x);
      viewport.scrollTop = this.panStart.top - (event.clientY - this.panStart.y);
      return;
    }

    if (!this.drawStart || this.mode() === 'light') return;
    const point = this.boardPoint(event);
    if (!point) return;
    const snapped = this.drawingObstacle() ? point : this.snapPoint(point, this.mode() === 'measure');

    if (this.drawingObstacle()) {
      this.draftObstacle.set({ x1: this.drawStart.x, y1: this.drawStart.y, x2: snapped.x, y2: snapped.y });
    } else if (this.mode() === 'measure') {
      this.measureLine.set({
        x1: this.drawStart.x,
        y1: this.drawStart.y,
        x2: snapped.x,
        y2: snapped.y,
      });
    } else {
      this.draftFog.set(this.rectFromPoints(this.drawStart, snapped));
    }
  }

  protected boardPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.interactionPointerId) return;
    if (this.tokenDrag) {
      const drag = this.tokenDrag;
      const point = this.boardPoint(event);
      if (point) this.moveTokenSelection(drag, point, true);
      this.tokenDrag = undefined;
      if (drag.moved) {
        this.lastTokenClickId = this.doubleClickTokenId = undefined;
        this.persist();
      } else {
        this.doubleClickTokenId = this.lastTokenClickId === drag.clickedId ? drag.clickedId : undefined;
        this.lastTokenClickId = drag.clickedId;
        if (drag.collapseOnClick) this.selectedTokenIds.set([drag.clickedId]);
      }
      this.releasePointer();
      return;
    }
    if (this.selectionStart) {
      const { point: start, previous, additive } = this.selectionStart;
      const point = this.boardPoint(event) ?? start;
      const rect = this.selectionBounds(start, point);
      const moved = Math.hypot(rect.width, rect.height) * this.zoom() >= 4;
      const hits = moved && this.layers().tokens ? this.tokens().filter((token) =>
        token.x < rect.x + rect.width && token.x + token.size * this.gridSize > rect.x &&
        token.y < rect.y + rect.height && token.y + token.size * this.gridSize > rect.y
      ).map((token) => token.instanceId) : [];
      this.selectedTokenIds.set([...new Set([...(additive ? previous : []), ...hits])]);
      this.selectionStart = undefined;
      this.selectionRect.set(undefined);
      this.releasePointer();
      return;
    }
    if (this.panStart) {
      this.panStart = undefined;
      this.releasePointer();
      return;
    }

    if (!this.drawStart) return;
    if (this.mode() === 'light') {
      const point = this.boardPoint(event);
      if (point) this.placeSceneLight(point);
      this.cancelInteraction(); return;
    }
    if (this.drawingObstacle()) {
      const end = this.boardPoint(event);
      if (end) this.saveDrawnObstacle(end);
      this.cancelInteraction(); return;
    }
    const draft = this.draftFog();

    if (draft && this.mode() === 'fog') {
      this.fogRects.update((rects) => [
        ...rects,
        { ...draft, id: this.newId('fog') },
      ]);
      this.persist();
    } else if (draft && this.mode() === 'reveal') {
      this.fogRects.update((rects) =>
        rects.flatMap((rect) => this.subtractRect(rect, draft))
      );
      this.persist();
    }

    this.drawStart = undefined;
    this.draftFog.set(undefined);
    this.draftObstacle.set(undefined);
    this.releasePointer();
  }

  protected boardPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.interactionPointerId) {
      this.cancelInteraction();
      this.measureLine.set(undefined);
    }
  }

  protected measureLabel(): string {
    const line = this.measureLine();
    if (!line) return '';
    const squares = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) / this.gridSize;
    return `${squares.toFixed(1)} casillas · ${(squares * 1.5).toFixed(1)} m`;
  }

  protected resetBoard(): void {
    if (this.combat.busy()) return;
    if (!window.confirm('¿Restablecer tokens, niebla y turnos de este mapa?')) return;
    this.visionStorageBlocked = false;
    this.vision.set(emptyBoardVision());
    this.closeTokenSheet();
    this.combat.restore(undefined);
    this.cancelInteraction();
    this.tokens.set([]);
    this.fogRects.set([]);
    this.selectedTokenIds.set([]);
    this.activeTurnId.set(undefined);
    this.layers.set({ grid: false, fog: true, tokens: true, labels: true });
    this.persist();
  }

  @HostListener('window:keydown', ['$event'])
  protected handleKeyboard(event: KeyboardEvent): void {
    if (this.visionPreview()) return;
    if (this.tokenSheetDialog?.isOpen || this.combatPanel?.isOpen || this.combat.busy()) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (this.targeting()) {
      if (event.key === 'Escape') { event.preventDefault(); this.cancelAttack(); }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedTokens().length) {
        event.preventDefault();
        this.removeSelectedTokens();
      }
    } else if (event.key === 'Escape') {
      this.setMode('select');
      this.clearSelection();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' &&
      this.mode() === 'select' && this.board?.nativeElement.contains(target)) {
      event.preventDefault();
      this.selectAllTokens();
    } else if (event.key === '0') {
      this.fitMap();
    }
  }

  private resolveEntry(
    campaign: Campaign,
    kind: VttEntryKind,
    id: string
  ): VttEntry | undefined {
    if (kind === 'generic') {
      const entry = GENERIC_ENCOUNTERS.find((encounter) => encounter.id === id);
      if (!entry) return undefined;

      const level = this.queryNumber('level', campaign.startingLevel, 1, 20);
      const partySize = this.queryNumber('partySize', 4, 1, 10);
      const partyTokens = (this.route.snapshot.queryParamMap.get('members') ?? '')
        .split(',')
        .map((actorId) => actorId.trim())
        .filter(Boolean)
        .map((actorId): EncounterSeedToken => ({ actorId, side: 'party' }));
      const enemyTokens = scaledEncounterMonsters(entry, level, partySize).flatMap(
        (monster) =>
          Array.from(
            { length: monster.count },
            (): EncounterSeedToken => ({
              actorId: `generic:${monster.id}`,
              side: 'enemy',
              size: monster.size,
            })
          )
      );

      return {
        id,
        name: entry.name,
        mapUrl: entry.mapUrl,
        kind,
        kindLabel: `Encuentro genérico · Nivel ${level}`,
        seedTokens: [...partyTokens, ...enemyTokens],
      };
    }
    if (kind === 'scene') {
      const entry = campaign.scenes.find((scene) => scene.id === id);
      return entry
        ? { id, name: entry.name, mapUrl: entry.mapUrl, kind, kindLabel: 'Escena' }
        : undefined;
    }
    if (kind === 'encounter') {
      const entry = campaign.encounters.find((encounter) => encounter.id === id);
      return entry
        ? {
            id,
            name: entry.name,
            mapUrl: entry.mapUrl,
            kind,
            kindLabel: 'Encuentro',
          }
        : undefined;
    }
    const entry = campaign.locations.find((location) => location.id === id);
    return entry
      ? { id, name: entry.name, mapUrl: entry.mapUrl, kind, kindLabel: 'Lugar' }
      : undefined;
  }

  private resolveTokenSheet(token: BoardToken, campaign: Campaign): TokenSheet {
    const sheet: TokenSheet = { token, name: token.name, summary: '', meta: [], sections: [], missingSource: true };
    if (token.actorId.startsWith('player:')) {
      const player = this.characterSheets.playerSheets(campaign).find((entry) => entry.id === token.actorId.slice(7));
      if (player) {
        sheet.missingSource = false;
        sheet.name = player.name;
        sheet.summary = player.hook;
        sheet.meta = [`PJ · ${player.ancestry} · ${player.className} · ${player.subclass}`,
          `Nivel ${player.level} · Trasfondo: ${player.background}`, `Dote: ${player.feat}`,
          ...(player.affiliation ? [`Afiliación: ${player.affiliation}`] : [])];
        if (player.statisticsRecorded !== false) sheet.statistics = player;
      }
    } else if (token.actorId.startsWith('npc:')) {
      const npc = this.characterSheets.campaignNpcs(campaign.id, campaign.npcs).find((entry) => entry.id === token.actorId.slice(4));
      if (npc) {
        sheet.missingSource = false;
        sheet.name = npc.name;
        sheet.summary = npc.summary;
        sheet.meta = [`PNJ · ${npc.role}`, `Facción: ${npc.faction}`, `Motivación: ${npc.motivation}`,
          ...(npc.ancestry ? [`Linaje: ${npc.ancestry}`] : []), ...(npc.age ? [`Edad: ${npc.age}`] : [])];
        sheet.statistics = npc.statBlock;
        sheet.sections = [
          { title: 'Descripción', entries: npc.description ? [npc.description] : [] },
          { title: 'Personalidad', entries: npc.personality ?? [] },
          { title: 'Conocimientos', entries: npc.knowledge ?? [] },
          { title: 'Reacciones', entries: npc.reactions ?? [] },
          { title: 'Secreto', entries: npc.secret ? [npc.secret] : [] },
        ].filter((section) => section.entries.length);
      }
    } else if (token.actorId.startsWith('generic:')) {
      const npc = this.characterSheets.genericNpcs().find((entry) => entry.id === token.actorId.slice(8));
      if (npc) {
        sheet.missingSource = false;
        sheet.name = npc.name;
        sheet.summary = npc.summary;
        sheet.meta = [`Ficha genérica · ${npc.category}`, `Linaje: ${npc.lineage}`, `Función: ${npc.role}`];
        sheet.statistics = { ...npc, features: npc.traits };
        if (npc.personality?.length) sheet.sections.push({ title: 'Personalidad', entries: npc.personality });
      }
    }
    const stats = sheet.statistics;
    if (stats) sheet.sections.push(
      { title: 'Salvaciones', entries: stats.saves ?? [] },
      { title: 'Habilidades', entries: stats.skills ?? [] },
      { title: 'Rasgos', entries: stats.features ?? [] },
      { title: 'Ataques', entries: stats.attacks ?? [] },
      { title: 'Conjuros', entries: stats.spells ?? [] },
      { title: 'Equipo', entries: stats.equipment ?? [] },
    );
    return sheet;
  }

  private buildTokenChoices(campaign: Campaign): TokenChoice[] {
    const npcs = this.characterSheets.campaignNpcs(campaign.id, campaign.npcs).map((npc): TokenChoice => ({
      id: `npc:${npc.id}`,
      name: npc.name,
      image: this.characterSheets.tokenImage('npcs', npc.id),
      subtitle: npc.role,
      group: 'PNJ',
      maxHp: npc.statBlock?.hitPoints ?? 10,
    }));
    const players = this.characterSheets.playerSheets(campaign).map((player): TokenChoice => ({
      id: `player:${player.id}`,
      name: player.name,
      image: this.characterSheets.tokenImage('players', player.id, false, player.tokenUrl),
      subtitle: `${player.className} · ${player.subclass}${player.statisticsRecorded === false ? ' · PG sin registrar' : ''}`,
      group: 'PJ',
      maxHp: player.statisticsRecorded === false ? 0 : player.hitPoints,
    }));
    const genericNpcs = this.characterSheets.genericNpcs().map((npc): TokenChoice => ({
      id: `generic:${npc.id}`,
      name: npc.name,
      image: this.characterSheets.tokenImage('generic', npc.id),
      subtitle: `${npc.category} · ${npc.role}`,
      group: 'Genérico',
      maxHp: npc.hitPoints,
    }));
    return [...players, ...npcs, ...genericNpcs];
  }

  private seedEncounterTokens(seedTokens: EncounterSeedToken[]): void {
    const choices = new Map(
      this.tokenChoices().map((choice) => [choice.id, choice])
    );
    let partyIndex = 0;
    let enemyIndex = 0;
    const tokens = seedTokens.flatMap((seed): BoardToken[] => {
      const choice = choices.get(seed.actorId);
      if (!choice) return [];
      const index = seed.side === 'party' ? partyIndex++ : enemyIndex++;
      const column = index % 7;
      const row = Math.floor(index / 7);
      const size = this.clamp(Math.round(seed.size ?? 1), 1, 4);
      const x =
        seed.side === 'party'
          ? (2 + column) * this.gridSize
          : (20 + column) * this.gridSize;
      const y =
        seed.side === 'party'
          ? (15 + row * 2) * this.gridSize
          : (3 + row * 2) * this.gridSize;
      return [
        {
          instanceId: this.newId(seed.side),
          actorId: choice.id,
          name: choice.name,
          image: choice.image,
          x: this.clamp(x, 0, this.mapWidth - this.gridSize * size),
          y: this.clamp(y, 0, this.mapHeight - this.gridSize * size),
          size,
          hp: choice.maxHp,
          maxHp: choice.maxHp,
          initiative: 0,
          hidden: false,
          side: seed.side, conditions: [],
        },
      ];
    });

    this.tokens.set(tokens);
    this.selectedTokenIds.set(tokens.length ? [tokens[0].instanceId] : []);
    this.persist();
  }

  private updateToken(instanceId: string, patch: Partial<BoardToken>): void {
    this.tokens.update((tokens) =>
      tokens.map((token) =>
        token.instanceId === instanceId ? { ...token, ...patch } : token
      )
    );
    this.persist();
  }

  private chooseToken(instanceId: string, additive: boolean): void {
    this.selectedTokenIds.update((ids) => additive
      ? ids.includes(instanceId) ? ids.filter((id) => id !== instanceId) : [...ids, instanceId]
      : [instanceId]);
  }

  private capturePointer(event: PointerEvent, element: HTMLElement | undefined = this.board?.nativeElement): void {
    this.interactionPointerId = event.pointerId;
    this.pointerCaptureElement = element;
    element?.setPointerCapture(event.pointerId);
  }

  private releasePointer(): void {
    const pointerId = this.interactionPointerId;
    this.interactionPointerId = undefined;
    const element = this.pointerCaptureElement;
    this.pointerCaptureElement = undefined;
    if (pointerId !== undefined && element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }

  private cancelInteraction(): void {
    const origins = new Map(this.tokenDrag?.origins.map((token) => [token.instanceId, token]));
    if (origins.size) this.tokens.update((tokens) => tokens.map((token) => {
      const origin = origins.get(token.instanceId);
      return origin ? { ...token, x: origin.x, y: origin.y } : token;
    }));
    this.tokenDrag = undefined;
    this.selectionStart = undefined;
    this.selectionRect.set(undefined);
    this.panStart = undefined;
    this.drawStart = undefined;
    this.draftFog.set(undefined);
    this.draftObstacle.set(undefined);
    this.releasePointer();
  }

  private selectionBounds(start: BoardPoint, end: BoardPoint): FogRect {
    return { id: 'selection', x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  }

  private moveTokenSelection(drag: TokenDrag, point: BoardPoint, snap: boolean): void {
    let dx = point.x - drag.start.x;
    let dy = point.y - drag.start.y;
    drag.moved ||= Math.hypot(dx, dy) * this.zoom() >= 4;
    if (!drag.moved) return;
    if (snap) {
      dx = Math.round(dx / this.gridSize) * this.gridSize;
      dy = Math.round(dy / this.gridSize) * this.gridSize;
    }
    // Un único desplazamiento limitado conserva la formación y el tamaño de cada ficha.
    dx = this.clamp(dx, -Math.min(...drag.origins.map((t) => t.x)),
      this.mapWidth - Math.max(...drag.origins.map((t) => t.x + t.size * this.gridSize)));
    dy = this.clamp(dy, -Math.min(...drag.origins.map((t) => t.y)),
      this.mapHeight - Math.max(...drag.origins.map((t) => t.y + t.size * this.gridSize)));
    const positions = new Map(drag.origins.map((t) => [t.instanceId, { x: t.x + dx, y: t.y + dy }]));
    this.tokens.update((tokens) => tokens.map((token) => {
      const position = positions.get(token.instanceId);
      return position ? { ...token, ...position } : token;
    }));
  }

  private boardPoint(event: PointerEvent): { x: number; y: number } | undefined {
    const board = this.board?.nativeElement;
    if (!board) return undefined;
    const bounds = board.getBoundingClientRect();
    return {
      x: this.clamp((event.clientX - bounds.left) / this.zoom(), 0, this.mapWidth),
      y: this.clamp((event.clientY - bounds.top) / this.zoom(), 0, this.mapHeight),
    };
  }

  private snapPoint(
    point: { x: number; y: number },
    center: boolean
  ): { x: number; y: number } {
    if (center) {
      return {
        x: (Math.floor(point.x / this.gridSize) + 0.5) * this.gridSize,
        y: (Math.floor(point.y / this.gridSize) + 0.5) * this.gridSize,
      };
    }
    return {
      x: Math.floor(point.x / this.gridSize) * this.gridSize,
      y: Math.floor(point.y / this.gridSize) * this.gridSize,
    };
  }

  private rectFromPoints(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): FogRect {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      id: 'draft',
      x,
      y,
      width: Math.max(this.gridSize, Math.abs(end.x - start.x) + this.gridSize),
      height: Math.max(this.gridSize, Math.abs(end.y - start.y) + this.gridSize),
    };
  }

  private subtractRect(source: FogRect, cut: FogRect): FogRect[] {
    const x1 = Math.max(source.x, cut.x);
    const y1 = Math.max(source.y, cut.y);
    const x2 = Math.min(source.x + source.width, cut.x + cut.width);
    const y2 = Math.min(source.y + source.height, cut.y + cut.height);
    if (x1 >= x2 || y1 >= y2) return [source];

    const pieces: FogRect[] = [];
    const add = (x: number, y: number, width: number, height: number): void => {
      if (width > 0 && height > 0) {
        pieces.push({ id: this.newId('fog'), x, y, width, height });
      }
    };
    add(source.x, source.y, source.width, y1 - source.y);
    add(source.x, y2, source.width, source.y + source.height - y2);
    add(source.x, y1, x1 - source.x, y2 - y1);
    add(x2, y1, source.x + source.width - x2, y2 - y1);
    return pieces;
  }

  private setZoom(value: number): void {
    this.cancelInteraction();
    this.zoom.set(this.clamp(value, 0.2, 2));
    this.persist();
  }

  private loadState(): boolean {
    this.saveStatus.set('Guardado');
    this.visionStorageBlocked = false;
    this.vision.set(emptyBoardVision());
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      this.combat.restore(undefined);
      this.activeTurnId.set(undefined);
      this.tokens.set([]);
      this.fogRects.set([]);
      return false;
    }
    try {
      const state = JSON.parse(raw) as StoredBoardState;
      const choiceImages = new Map(
        this.tokenChoices().map((choice) => [choice.id, choice.image])
      );
      this.tokens.set(
        (state.tokens ?? []).map((token) => {
          const restored = { ...token, image: choiceImages.get(token.actorId) ?? token.image };
          if (!Array.isArray(restored.conditions) || !restored.conditions.every((c) => Object.hasOwn(CONDITION_LABELS, c))) delete restored.conditions;
          if (!['party', 'enemy', 'neutral'].includes(restored.side ?? '')) delete restored.side;
          return restored;
        })
      );
      if (state.vision !== undefined) {
        try {
          assertBoardVision(state.vision, new Set(this.tokens().map((token) => token.instanceId)));
          this.vision.set(structuredClone(state.vision));
        } catch {
          this.visionStorageBlocked = true;
          this.saveStatus.set('Visión no válida o de otra versión. Se conserva el guardado original; los cambios de este tablero no se guardarán.');
        }
      }
      this.fogRects.set(state.fogRects ?? []);
      this.layers.set(
        state.layers ?? { grid: false, fog: true, tokens: true, labels: true }
      );
      this.zoom.set(state.zoom ?? 0.65);
      this.activeTurnId.set(state.activeTurnId);
      this.combat.restore(state.combat);
      if (this.combat.state().started || this.combat.error()) this.sidebarTab.set('turns');
      return true;
    } catch {
      localStorage.removeItem(this.storageKey);
      return false;
    }
  }

  private persist(): void {
    if (!this.storageKey) return;
    if (this.visionStorageBlocked) {
      this.saveStatus.set('Visión no válida o de otra versión. Se conserva el guardado original; los cambios de este tablero no se guardarán.');
      return;
    }
    this.saveStatus.set('Guardando');
    // Otras acciones pueden guardar durante un gesto: las posiciones provisionales
    // solo se confirman al soltar el puntero, nunca al ocultar o cambiar de turno.
    const origins = new Map(this.tokenDrag?.origins.map((token) => [token.instanceId, token]));
    const state: StoredBoardState = {
      vision: this.vision(),
      combat: this.combat.serialized(),
      tokens: this.tokens().map((token) => {
        const origin = origins.get(token.instanceId);
        return origin ? { ...token, x: origin.x, y: origin.y } : token;
      }),
      fogRects: this.fogRects(),
      layers: this.layers(),
      zoom: this.zoom(),
      activeTurnId: this.activeTurnId(),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(state));
    this.saveStatus.set('Guardado');
    this.scheduleSharing();
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private queryNumber(
    key: string,
    fallback: number,
    min: number,
    max: number
  ): number {
    const value = Number(this.route.snapshot.queryParamMap.get(key));
    return this.clamp(Number.isFinite(value) && value > 0 ? Math.round(value) : fallback, min, max);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private roll(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }
}
