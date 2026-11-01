import { AsyncPipe } from '@angular/common';
import {
  Component,
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

import { Campaign } from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import {
  GENERIC_ENCOUNTERS,
  scaledEncounterMonsters,
} from '../../../../core/data/generic-encounters';

import { TokenSheet, VttTokenSheet } from './token-sheet';

type VttEntryKind = 'scene' | 'encounter' | 'location' | 'generic';
type ToolMode = 'select' | 'pan' | 'fog' | 'reveal' | 'measure';
type SidebarTab = 'tokens' | 'layers' | 'turns';

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
  tokens: BoardToken[];
  fogRects: FogRect[];
  layers: LayerState;
  zoom: number;
  activeTurnId?: string;
}

@Component({
  selector: 'app-vtt-board',
  imports: [AsyncPipe, VttTokenSheet],
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
  private readonly openedSheetTokenId = signal<string | undefined>(undefined);
  private readonly sheetRevision = signal(0);
  protected readonly openedTokenSheet = computed(() => {
    this.sheetRevision();
    const token = this.tokens().find((item) => item.instanceId === this.openedSheetTokenId());
    return token && this.currentCampaign ? this.resolveTokenSheet(token, this.currentCampaign) : undefined;
  });

  protected readonly filteredTokenChoices = computed(() => {
    const query = this.normalize(this.tokenQuery());
    return this.tokenChoices().filter((choice) =>
      this.normalize(`${choice.name} ${choice.subtitle} ${choice.group}`).includes(
        query
      )
    );
  });

  protected readonly selectedTokens = computed(() =>
    this.tokens().filter((token) => this.selectedTokenIds().includes(token.instanceId))
  );
  protected readonly selectedToken = computed(() =>
    this.selectedTokens().length === 1 ? this.selectedTokens()[0] : undefined
  );

  protected readonly initiativeTokens = computed(() =>
    this.tokens()
      .slice()
      .sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name))
  );

  @ViewChild('viewport')
  private viewport?: ElementRef<HTMLDivElement>;

  @ViewChild('board')
  private board?: ElementRef<HTMLDivElement>;

  @ViewChild(VttTokenSheet)
  private tokenSheetDialog?: VttTokenSheet;

  private readonly campaignData = inject(CampaignDataService);
  private readonly characterSheets = inject(CharacterSheetsService);
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
    this.vm$.pipe(takeUntilDestroyed()).subscribe((vm) => {
      this.closeTokenSheet();
      if (!vm) return;
      this.cancelInteraction();
      this.selectedTokenIds.set([]);
      this.currentCampaign = vm.campaign;
      const runId = this.route.snapshot.queryParamMap.get('run');
      const runSuffix = runId ? `:${runId.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
      this.storageKey = `la-carta-sellada:vtt:${vm.campaign.id}:${vm.entry.kind}:${vm.entry.id}${runSuffix}`;
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
    });
  }

  protected setMode(mode: ToolMode): void {
    this.cancelInteraction();
    this.lastTokenClickId = this.doubleClickTokenId = undefined;
    this.mode.set(mode);
    this.draftFog.set(undefined);
    this.measureLine.set(undefined);
  }

  protected setSidebarTab(tab: SidebarTab): void {
    this.sidebarTab.set(tab);
  }

  protected updateTokenQuery(value: string): void {
    this.tokenQuery.set(value);
  }

  protected addToken(choice: TokenChoice): void {
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
    };

    this.tokens.update((tokens) => [...tokens, token]);
    this.selectedTokenIds.set([token.instanceId]);
    this.persist();
  }

  protected selectToken(instanceId: string, event: MouseEvent): void {
    event.stopPropagation();
    // El puntero selecciona antes de arrastrar; los clics con detail 0 vienen del teclado.
    if (this.mode() !== 'select' || event.detail !== 0) return;
    this.chooseToken(instanceId, event.shiftKey || event.ctrlKey || event.metaKey);
  }

  protected openTokenSheet(instanceId: string, event: MouseEvent): void {
    event.stopPropagation();
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
    this.cancelInteraction();
    this.selectedTokenIds.set(this.layers().tokens ? this.tokens().map((token) => token.instanceId) : []);
  }

  protected clearSelection(): void {
    this.cancelInteraction();
    this.selectedTokenIds.set([]);
  }

  protected tokenPointerDown(token: BoardToken, event: PointerEvent): void {
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
    const ids = new Set(this.selectedTokenIds());
    this.tokens.update((tokens) => tokens.map((token) => ids.has(token.instanceId) ? { ...token, hidden } : token));
    this.persist();
  }

  protected updateSelectedNumber(
    field: 'hp' | 'maxHp' | 'size',
    value: string
  ): void {
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
    const token = this.selectedToken();
    if (token) this.updateToken(token.instanceId, { hidden });
  }

  protected hpPercent(token: BoardToken): number {
    if (token.maxHp <= 0) return 0;
    return this.clamp((token.hp / token.maxHp) * 100, 0, 100);
  }

  protected removeSelectedTokens(): void {
    const ids = new Set(this.selectedTokenIds());
    if (!ids.size) return;
    if (ids.has(this.openedSheetTokenId() ?? '')) this.closeTokenSheet();
    this.cancelInteraction();
    this.tokens.update((tokens) => tokens.filter((token) => !ids.has(token.instanceId)));
    if (ids.has(this.activeTurnId() ?? '')) this.activeTurnId.set(undefined);
    this.selectedTokenIds.set([]);
    this.persist();
  }

  protected updateInitiative(instanceId: string, value: string): void {
    const initiative = Number(value);
    if (Number.isFinite(initiative)) {
      this.updateToken(instanceId, { initiative: Math.round(initiative) });
    }
  }

  protected rollAllInitiatives(): void {
    const rolledTokens = this.tokens().map((token) => ({
      ...token,
      initiative: this.roll(20),
    }));
    if (!rolledTokens.length) return;

    this.tokens.set(rolledTokens);
    const [firstTurn] = rolledTokens
      .slice()
      .sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
    this.activeTurnId.set(firstTurn?.instanceId);
    this.diceResult.set(`Iniciativa: ${rolledTokens.length}`);
    this.persist();
  }

  protected advanceTurn(): void {
    const ordered = this.initiativeTokens();
    if (!ordered.length) return;
    const currentIndex = ordered.findIndex(
      (token) => token.instanceId === this.activeTurnId()
    );
    this.activeTurnId.set(ordered[(currentIndex + 1) % ordered.length].instanceId);
    this.persist();
  }

  protected setActiveTurn(instanceId: string): void {
    this.activeTurnId.set(instanceId);
    this.persist();
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
    this.drawStart = this.snapPoint(point, this.mode() === 'measure');
    this.capturePointer(event);

    if (this.mode() === 'measure') {
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

    if (!this.drawStart) return;
    const point = this.boardPoint(event);
    if (!point) return;
    const snapped = this.snapPoint(point, this.mode() === 'measure');

    if (this.mode() === 'measure') {
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
    if (!window.confirm('¿Restablecer tokens, niebla y turnos de este mapa?')) return;
    this.closeTokenSheet();
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
    if (this.tokenSheetDialog?.isOpen) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
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
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
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
        (state.tokens ?? []).map((token) => ({
          ...token,
          image: choiceImages.get(token.actorId) ?? token.image,
        }))
      );
      this.fogRects.set(state.fogRects ?? []);
      this.layers.set(
        state.layers ?? { grid: false, fog: true, tokens: true, labels: true }
      );
      this.zoom.set(state.zoom ?? 0.65);
      this.activeTurnId.set(state.activeTurnId);
      return true;
    } catch {
      localStorage.removeItem(this.storageKey);
      return false;
    }
  }

  private persist(): void {
    if (!this.storageKey) return;
    this.saveStatus.set('Guardando');
    // Otras acciones pueden guardar durante un gesto: las posiciones provisionales
    // solo se confirman al soltar el puntero, nunca al ocultar o cambiar de turno.
    const origins = new Map(this.tokenDrag?.origins.map((token) => [token.instanceId, token]));
    const state: StoredBoardState = {
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
