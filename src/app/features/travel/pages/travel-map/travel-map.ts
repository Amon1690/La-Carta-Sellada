import { ActivatedRoute } from '@angular/router';
import { ACCESS_CONTEXT } from '../../../../core/services/access';
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import {
  EncounterEnvironment,
  GENERIC_ENCOUNTERS,
  scaledEncounterMonsters,
} from '../../../../core/data/generic-encounters';
import {
  TRAVEL_EVENTS,
  TravelEventDefinition,
  TravelEventEffect,
  TravelEventSkill,
  TravelRole,
} from '../../../../core/data/travel-events';
import {
  FAERUN_LOCATIONS,
  type FaerunTravelLocation,
} from '../../../../core/data/faerun-locations';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { Campaign } from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';

type MapMode = 'select' | 'place' | 'route' | 'pan';
type SideTab = 'groups' | 'plan' | 'days';
type Pace = 'fast' | 'normal' | 'slow';
type DangerLevel = 'safe' | 'road' | 'wild' | 'hostile' | 'extreme';

interface MapPoint {
  x: number;
  y: number;
}

type FaerunLocation = FaerunTravelLocation;

interface TravelMember {
  id: string;
  name: string;
  image: string;
  kind: 'PJ' | 'PNJ' | 'Genérico';
  detail: string;
  survivalBonus: number;
  perceptionBonus: number;
  survivalProficient: boolean;
  perceptionProficient: boolean;
  statisticsRecorded?: boolean;
}

interface TravelGroup extends MapPoint {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

interface TravelPlan {
  originId: string;
  destinationId: string;
  pace: Pace;
  hours: number;
  difficultTerrain: boolean;
  mountBoostHours: number;
  season: string;
  danger: DangerLevel;
  foodKg: number;
  waterLiters: number;
  gold: number;
  fatigue: number;
  guideId: string;
  hunterIds: string[];
  watcherIds: string[];
  marchOrder: string;
  activities: string;
  preparedEncounters: string;
  dmSecrets: string;
}

interface RoleEventResult {
  id: string;
  role: TravelRole;
  title: string;
  polarity: 'positive' | 'negative';
  story: string;
  actorId: string;
  actorName: string;
  skill: TravelEventSkill;
  roll: number;
  bonus: number;
  total: number;
  dc: number;
  success: boolean;
  outcome: string;
  effectSummary: string;
  effect?: TravelEventEffect;
  encounterTriggered: boolean;
  campaignHook?: string;
}

interface DayLog {
  day: number;
  weather: string;
  distance: number;
  totalDistance: number;
  encounter: string;
  resources: string;
  position: string;
  pendingDecision: boolean;
  events?: RoleEventResult[];
}

interface TravelDayEffects {
  foodKg: number;
  waterLiters: number;
  gold: number;
  fatigue: number;
  distancePercent: number;
  distanceKm: number;
}

interface PendingTravelEncounter {
  encounterId: string;
  runId: string;
  day: number;
  level: number;
  partySize: number;
  region: string;
  position: string;
  memberActorIds: string[];
}

interface GroupJourney {
  route: MapPoint[];
  plan: TravelPlan;
  logs: DayLog[];
  pendingEncounter?: PendingTravelEncounter;
}

interface StoredTravelState {
  version?: 2;
  journeys?: Record<string, GroupJourney>;
  unassignedJourney?: GroupJourney;
  groups: TravelGroup[];
  route: MapPoint[];
  plan: TravelPlan;
  logs: DayLog[];
  pendingEncounter?: PendingTravelEncounter;
  selectedGroupId?: string;
  zoom: number;
}

interface DragState {
  kind: 'token' | 'pan';
  id?: string;
  startX: number;
  startY: number;
  scrollLeft?: number;
  scrollTop?: number;
}

const MAP_WIDTH = 7990;
const MAP_HEIGHT = 5635;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 5;
const STORAGE_KEY = 'la-carta-sellada:travel-map:faerun-atlas-v3';
const KM_PER_X_PERCENT = 61.1;
const KM_PER_Y_PERCENT = 43.1;
const LOCATIONS = FAERUN_LOCATIONS;
const DISTANCE_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 });

@Component({
  selector: 'app-travel-map',
  imports: [CommonModule, FormsModule],
  templateUrl: './travel-map.html',
  styleUrl: './travel-map.scss',
})
export class TravelMap implements AfterViewInit {
  @ViewChild('mapViewport') private mapViewport?: ElementRef<HTMLElement>;
  @ViewChild('mapStage') private mapStage?: ElementRef<HTMLElement>;

  private readonly routeInfo = inject(ActivatedRoute, { optional: true });
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly campaignId = this.routeInfo?.snapshot.paramMap.get('campaignId') ?? '';
  private readonly storageKey = this.access ? `${STORAGE_KEY}:campaign:${this.campaignId}` : STORAGE_KEY;
  protected readonly legacyTravelAvailable = signal(false);
  private readonly campaignData = inject(CampaignDataService);
  private readonly characterSheets = inject(CharacterSheetsService);
  private readonly sheetsVersion = toSignal(this.characterSheets.changes$, { initialValue: 0 });
  private dragState?: DragState;
  private suppressMapClick = false;
  private journeys: Record<string, GroupJourney> = Object.create(null);
  private unassignedJourney?: GroupJourney;
  private legacySource?: string;
  private storageReadable = true;

  protected readonly mapWidth = MAP_WIDTH;
  protected readonly mapHeight = MAP_HEIGHT;
  protected readonly locations = LOCATIONS;
  protected readonly campaign = signal<Campaign | undefined>(undefined);
  protected readonly mode = signal<MapMode>('select');
  protected readonly sideTab = signal<SideTab>('groups');
  protected readonly zoom = signal(MIN_ZOOM);
  protected readonly groups = signal<TravelGroup[]>([]);
  protected readonly route = signal<MapPoint[]>([]);
  protected readonly logs = signal<DayLog[]>([]);
  protected readonly pendingEncounter = signal<PendingTravelEncounter | undefined>(undefined);
  protected readonly selectedGroupId = signal<string | undefined>(undefined);
  protected readonly selectedLocationId = signal<string | undefined>(undefined);
  protected readonly hoveredLocationId = signal<string | undefined>(undefined);
  protected readonly focusedLocationId = signal<string | undefined>(undefined);
  // Solo se monta el detalle que se está consultando; los marcadores siguen completos.
  protected readonly tooltipLocationId = computed(() =>
    this.hoveredLocationId() ?? this.focusedLocationId()
  );
  protected readonly memberQuery = signal('');
  protected readonly groupEditorOpen = signal(false);
  protected readonly groupName = signal('Compañía aventurera');
  protected readonly groupColor = signal('#c9964a');
  protected readonly draftMemberIds = signal<string[]>([]);
  protected readonly status = signal('Mapa preparado');
  protected readonly plan = signal<TravelPlan>(this.defaultPlan());

  protected readonly stageWidth = computed(() => MAP_WIDTH * this.zoom());
  protected readonly stageHeight = computed(() => MAP_HEIGHT * this.zoom());
  protected readonly selectedGroup = computed(() =>
    this.groups().find((group) => group.id === this.selectedGroupId())
  );
  protected readonly members = computed<TravelMember[]>(() => {
    this.sheetsVersion();
    return this.buildMembers(this.campaign());
  });
  protected readonly filteredMembers = computed(() => {
    const query = this.normalize(this.memberQuery());
    return this.members().filter((member) =>
      this.normalize(`${member.name} ${member.kind} ${member.detail}`).includes(query)
    );
  });
  protected readonly routeDistance = computed(() => this.calculateRouteDistance(this.route()));
  protected readonly travelledDistance = computed(() =>
    this.logs().reduce((total, log) => total + log.distance, 0)
  );
  protected readonly remainingDistance = computed(() => {
    const total = this.routeDistance(), travelled = this.travelledDistance();
    const remaining = Math.max(0, total - travelled);
    return remaining <= this.distanceTolerance(total, travelled) ? 0 : remaining;
  });
  protected readonly dailyDistance = computed(() => {
    const plan = this.plan();
    const speed = this.paceSpeed(plan.pace);
    const base = speed * Math.max(1, plan.hours);
    const mountBonus = speed * Math.max(0, plan.mountBoostHours);
    return (base + mountBonus) * (plan.difficultTerrain ? 0.5 : 1);
  });
  protected readonly estimatedDays = computed(() => {
    const daily = this.dailyDistance();
    return daily > 0 && this.routeDistance() > 0
      ? Math.ceil(this.remainingDistance() / daily)
      : 0;
  });
  protected readonly memberCount = computed(() => this.selectedGroup()?.memberIds.length ?? 0);
  protected readonly selectedGroupMembers = computed(() => {
    const ids = new Set(this.selectedGroup()?.memberIds ?? []);
    return this.members().filter((member) => ids.has(member.id));
  });
  protected readonly guideMember = computed(() =>
    this.selectedGroupMembers().find((member) => member.id === this.plan().guideId)
  );
  protected readonly guideRolePenalty = computed(() => {
    const missingRoles =
      Number(this.plan().hunterIds.length === 0) + Number(this.plan().watcherIds.length === 0);
    return missingRoles * 2;
  });
  protected readonly hunterSupportReduction = computed(() =>
    this.roleSupportReduction('hunter')
  );
  protected readonly watcherSupportReduction = computed(() =>
    this.roleSupportReduction('watch')
  );
  protected readonly pendingEncounterDefinition = computed(() => {
    const pending = this.pendingEncounter();
    return pending
      ? GENERIC_ENCOUNTERS.find((encounter) => encounter.id === pending.encounterId)
      : undefined;
  });
  protected readonly pendingEncounterRoster = computed(() => {
    this.sheetsVersion();
    const pending = this.pendingEncounter();
    const encounter = this.pendingEncounterDefinition();
    if (!pending || !encounter) return [];
    return scaledEncounterMonsters(encounter, pending.level, pending.partySize).map((monster) => ({
      ...monster,
      name: this.characterSheets.genericNpcs().find((npc) => npc.id === monster.id)?.name ?? monster.id,
    }));
  });
  protected readonly pendingEncounterVttUrl = computed(() => {
    const pending = this.pendingEncounter();
    const encounter = this.pendingEncounterDefinition();
    if (!pending || !encounter) return '';
    const query = new URLSearchParams({
      level: String(pending.level),
      partySize: String(pending.partySize),
      members: pending.memberActorIds.join(','),
      run: pending.runId || `travel-${pending.day}`,
    });
    return `/vtt/${this.campaign()?.id ?? 'la-carta-sellada'}/generic/${encounter.id}?${query.toString()}`;
  });
  protected readonly polylinePoints = computed(() =>
    this.route().map((point) => `${point.x},${point.y}`).join(' ')
  );

  constructor() {
    this.restoreState();
    try { this.legacyTravelAvailable.set(Boolean(this.access && localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(this.storageKey) && !localStorage.getItem(`${STORAGE_KEY}:campaign-destination`))); } catch { /* El original se conserva. */ }
    (this.campaignId ? this.campaignData.getCampaignById(this.campaignId) : this.campaignData.getDefaultCampaign())
      .pipe(takeUntilDestroyed())
      .subscribe((campaign) => {
        this.campaign.set(campaign);
        this.sanitizeRoleAssignments();
      });
  }

  protected importLegacyTravel(): void {
    if (!this.legacyTravelAvailable() || localStorage.getItem(this.storageKey)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      localStorage.setItem(this.storageKey, raw);
      this.restoreState();
      if (!this.storageReadable) {
        localStorage.removeItem(this.storageKey); this.storageReadable = true;
        this.status.set('El viaje anterior no es legible. Se conserva el original sin importarlo.'); return;
      }
      localStorage.setItem(`${STORAGE_KEY}:campaign-destination`, this.campaignId);
      this.legacyTravelAvailable.set(false);
      this.status.set('Viaje recuperado en esta campaña. El original se conserva.');
    } catch { this.status.set('No se pudo recuperar el viaje. Se conserva el original.'); }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.fitMap());
  }

  protected setMode(mode: MapMode): void {
    this.mode.set(mode);
    this.status.set(
      mode === 'route'
        ? 'Pulsa el mapa para añadir tramos'
        : mode === 'place'
          ? 'Pulsa el mapa para colocar el grupo'
          : mode === 'pan'
            ? 'Arrastra el mapa para desplazarte'
            : 'Selecciona o arrastra un grupo'
    );
  }

  protected setSideTab(tab: SideTab): void {
    this.sideTab.set(tab);
  }

  protected updateMemberQuery(value: string): void {
    this.memberQuery.set(value);
  }

  protected openGroupEditor(): void {
    this.groupName.set(`Grupo ${this.groups().length + 1}`);
    this.groupColor.set(this.groupColors[this.groups().length % this.groupColors.length]);
    this.draftMemberIds.set([]);
    this.groupEditorOpen.set(true);
  }

  protected closeGroupEditor(): void {
    this.groupEditorOpen.set(false);
  }

  protected toggleDraftMember(id: string, checked: boolean): void {
    this.draftMemberIds.update((ids) =>
      checked ? Array.from(new Set([...ids, id])) : ids.filter((memberId) => memberId !== id)
    );
  }

  protected draftHasMember(id: string): boolean {
    return this.draftMemberIds().includes(id);
  }

  protected createGroup(): void {
    const name = this.groupName().trim();
    if (!name || this.draftMemberIds().length === 0) {
      this.status.set('Añade un nombre y al menos un integrante');
      return;
    }

    const offset = this.groups().length * 1.2;
    const group: TravelGroup = {
      id: `travel-group-${Date.now()}`,
      name,
      color: this.groupColor(),
      memberIds: this.draftMemberIds(),
      x: 44.3 + offset,
      y: 37.5 + offset,
    };
    this.captureJourney();
    if (this.groups().length === 0 && this.unassignedJourney) {
      this.journeys[group.id] = structuredClone(this.unassignedJourney);
      this.unassignedJourney = undefined;
    }
    this.groups.update((groups) => [...groups, group]);
    this.activateJourney(group.id);
    this.groupEditorOpen.set(false);
    this.mode.set('place');
    this.status.set('Grupo creado. Pulsa el mapa para colocarlo');
    this.persistState();
  }

  protected selectGroup(id: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.groups().some((group) => group.id === id)) return;
    this.captureJourney();
    this.activateJourney(id);
    this.status.set(this.selectedGroup()?.name ?? 'Grupo seleccionado');
    this.persistState();
  }

  protected removeSelectedGroup(): void {
    const id = this.selectedGroupId();
    if (!id) return;
    this.captureJourney();
    this.groups.update((groups) => groups.filter((group) => group.id !== id));
    delete this.journeys[id];
    this.activateJourney(this.groups()[0]?.id);
    this.persistState();
  }

  protected mapClicked(event: MouseEvent): void {
    if (this.suppressMapClick) {
      this.suppressMapClick = false;
      return;
    }
    const point = this.mapPoint(event.clientX, event.clientY);
    if (!point) return;

    if (this.mode() === 'place') {
      const selectedId = this.selectedGroupId();
      if (!selectedId) {
        this.status.set('Selecciona o crea un grupo antes de colocarlo');
        return;
      }
      this.updateGroupPosition(selectedId, point);
      this.status.set('Grupo colocado en el mapa');
      this.persistState();
      return;
    }

    if (this.mode() === 'route') {
      this.route.update((route) => {
        if (route.length === 0 && this.selectedGroup()) {
          const group = this.selectedGroup()!;
          return [{ x: group.x, y: group.y }, point];
        }
        return [...route, point];
      });
      this.status.set(`Ruta: ${this.formatDistance(this.routeDistance())} km`);
      this.persistState();
    }
  }

  protected locationClicked(location: FaerunLocation, event: Event): void {
    event.stopPropagation();
    this.selectedLocationId.set(location.id);
    if (this.mode() === 'place' && this.selectedGroupId()) {
      this.updateGroupPosition(this.selectedGroupId()!, location);
      this.updatePlan({ originId: location.id });
      this.status.set(`Grupo colocado en ${location.name}`);
    } else if (this.mode() === 'route') {
      if (this.route().length === 0 && this.selectedGroup()) {
        const group = this.selectedGroup()!;
        this.route.set([{ x: group.x, y: group.y }, { x: location.x, y: location.y }]);
      } else {
        this.route.update((route) => [...route, { x: location.x, y: location.y }]);
      }
      this.updatePlan({ destinationId: location.id });
      this.status.set(`Destino añadido: ${location.name}`);
    } else {
      this.status.set(`${location.name} · ${location.categoryLabel} · ${location.region}`);
    }
    this.persistState();
  }

  protected beginTokenDrag(group: TravelGroup, event: PointerEvent): void {
    if (this.mode() !== 'select') return;
    event.stopPropagation();
    event.preventDefault();
    this.selectGroup(group.id);
    this.dragState = {
      kind: 'token',
      id: group.id,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  protected beginPan(event: PointerEvent): void {
    if (this.mode() !== 'pan' || !this.mapViewport) return;
    event.preventDefault();
    const viewport = this.mapViewport.nativeElement;
    this.dragState = {
      kind: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  }

  @HostListener('window:pointermove', ['$event'])
  protected pointerMoved(event: PointerEvent): void {
    if (!this.dragState) return;
    this.suppressMapClick = true;

    if (this.dragState.kind === 'pan' && this.mapViewport) {
      const viewport = this.mapViewport.nativeElement;
      viewport.scrollLeft = (this.dragState.scrollLeft ?? 0) - (event.clientX - this.dragState.startX);
      viewport.scrollTop = (this.dragState.scrollTop ?? 0) - (event.clientY - this.dragState.startY);
      return;
    }

    if (this.dragState.kind === 'token' && this.dragState.id) {
      const point = this.mapPoint(event.clientX, event.clientY);
      if (point) this.updateGroupPosition(this.dragState.id, point);
    }
  }

  @HostListener('window:pointerup')
  protected pointerReleased(): void {
    if (!this.dragState) return;
    this.dragState = undefined;
    this.persistState();
  }

  protected zoomBy(delta: number): void {
    this.zoom.update((value) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((value + delta).toFixed(2))))
    );
    this.persistState();
  }

  protected zoomWithWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.deltaY === 0) return;

    const viewport = this.mapViewport?.nativeElement;
    if (!viewport) return;

    const oldZoom = this.zoom();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Number((oldZoom * factor).toFixed(3)))
    );
    if (newZoom === oldZoom) return;

    const bounds = viewport.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const mapX = (viewport.scrollLeft + pointerX) / oldZoom;
    const mapY = (viewport.scrollTop + pointerY) / oldZoom;

    this.zoom.set(newZoom);
    this.persistState();

    requestAnimationFrame(() => {
      viewport.scrollLeft = mapX * newZoom - pointerX;
      viewport.scrollTop = mapY * newZoom - pointerY;
    });
  }

  protected resetView(): void {
    this.fitMap('smooth');
  }

  protected undoRoutePoint(): void {
    this.route.update((route) => route.slice(0, -1));
    this.persistState();
  }

  protected clearRoute(): void {
    this.route.set([]);
    this.logs.set([]);
    this.pendingEncounter.set(undefined);
    this.status.set('Ruta eliminada');
    this.persistState();
  }

  protected routeToSelectedDestination(): void {
    const destination = LOCATIONS.find((location) => location.id === this.plan().destinationId);
    if (!destination) return;
    const start = this.route().length
      ? this.route()
      : this.selectedGroup()
        ? [{ x: this.selectedGroup()!.x, y: this.selectedGroup()!.y }]
        : [];
    if (!start.length) {
      this.status.set('Selecciona un grupo antes de trazar la ruta');
      return;
    }
    this.route.set([...start, { x: destination.x, y: destination.y }]);
    this.status.set(`Ruta trazada hasta ${destination.name}`);
    this.persistState();
  }

  protected originChanged(id: string): void {
    this.updatePlan({ originId: id });
    const location = LOCATIONS.find((item) => item.id === id);
    if (location && this.selectedGroupId()) {
      this.updateGroupPosition(this.selectedGroupId()!, location);
    }
    this.persistState();
  }

  protected destinationChanged(id: string): void {
    this.updatePlan({ destinationId: id });
    this.persistState();
  }

  protected planFieldChanged<K extends keyof TravelPlan>(field: K, value: TravelPlan[K]): void {
    this.updatePlan({ [field]: value } as Pick<TravelPlan, K>);
    this.persistState();
  }

  protected guideChanged(memberId: string): void {
    this.updatePlan({
      guideId: memberId,
      hunterIds: this.plan().hunterIds.filter((id) => id !== memberId),
      watcherIds: this.plan().watcherIds.filter((id) => id !== memberId),
    });
    this.persistState();
  }

  protected toggleRoleMember(
    role: 'hunter' | 'watch',
    memberId: string,
    checked: boolean
  ): void {
    const field = role === 'hunter' ? 'hunterIds' : 'watcherIds';
    const otherField = role === 'hunter' ? 'watcherIds' : 'hunterIds';
    const current = this.plan()[field];
    this.updatePlan({
      [field]: checked
        ? Array.from(new Set([...current, memberId]))
        : current.filter((id) => id !== memberId),
      [otherField]: checked
        ? this.plan()[otherField].filter((id) => id !== memberId)
        : this.plan()[otherField],
    });
    this.persistState();
  }

  protected roleHasMember(role: 'hunter' | 'watch', memberId: string): boolean {
    return (role === 'hunter' ? this.plan().hunterIds : this.plan().watcherIds).includes(memberId);
  }

  protected memberSkillLabel(member: TravelMember, skill: TravelEventSkill): string {
    if (member.statisticsRecorded === false) return `${skill === 'survival' ? 'Supervivencia' : 'Percepción'} sin registrar`;
    const bonus = skill === 'survival' ? member.survivalBonus : member.perceptionBonus;
    const proficient =
      skill === 'survival' ? member.survivalProficient : member.perceptionProficient;
    return `${skill === 'survival' ? 'Supervivencia' : 'Percepción'} ${this.signed(bonus)}${proficient ? ' · competente' : ''}`;
  }

  protected memberRoleSummary(member: TravelMember): string {
    if (member.statisticsRecorded === false) return 'Habilidades sin registrar';
    return `Supervivencia ${this.signed(member.survivalBonus)} · Percepción ${this.signed(member.perceptionBonus)}`;
  }

  protected roleLabel(role: TravelRole): string {
    return role === 'guide' ? 'Guía' : role === 'hunter' ? 'Cazador' : 'Vigía';
  }

  protected eventSkillLabel(event: RoleEventResult): string {
    return `${event.skill === 'survival' ? 'Supervivencia' : 'Percepción'} ${this.signed(event.bonus)}`;
  }

  protected resolveDay(): void {
    if (this.pendingEncounter()) {
      this.status.set('Decide primero qué hacer con el encuentro pendiente');
      return;
    }
    if (!this.selectedGroup() || this.routeDistance() <= 0 || this.remainingDistance() <= 0) {
      this.status.set('Selecciona un grupo y traza una ruta pendiente');
      return;
    }
    if (!this.guideMember()) {
      this.status.set('Asigna un guía del grupo antes de resolver la jornada');
      this.sideTab.set('plan');
      return;
    }

    const assigned = new Set([this.plan().guideId, ...this.plan().hunterIds, ...this.plan().watcherIds]);
    const missing = this.selectedGroupMembers().filter((member) => assigned.has(member.id) && member.statisticsRecorded === false);
    if (missing.length) {
      this.status.set(`Registra las habilidades de ${missing.map((member) => member.name).join(', ')} antes de resolver la jornada`);
      this.sideTab.set('plan');
      return;
    }

    const day = this.logs().length + 1;
    const weather = this.rollWeather();
    const travelers = Math.max(1, this.memberCount());
    const events = this.resolveRoleEvents();
    const eventEffects = this.aggregateEventEffects(events);
    const adjustedDistance = Math.max(
      0,
      this.dailyDistance() * (1 + eventEffects.distancePercent) + eventEffects.distanceKm
    );
    const remaining = this.remainingDistance();
    const distance = Math.min(adjustedDistance, remaining);
    const totalDistance = adjustedDistance >= remaining
      ? this.routeDistance() : this.travelledDistance() + distance;
    const foodUsed = travelers * 0.45;
    const waterUsed = travelers * 3.8;
    const nextFood = Math.max(0, this.plan().foodKg - foodUsed + eventEffects.foodKg);
    const nextWater = Math.max(0, this.plan().waterLiters - waterUsed + eventEffects.waterLiters);
    this.updatePlan({
      foodKg: Number(nextFood.toFixed(1)),
      waterLiters: Number(nextWater.toFixed(1)),
      gold: Math.max(0, this.plan().gold + eventEffects.gold),
      fatigue: Math.max(0, this.plan().fatigue + eventEffects.fatigue),
    });

    const position = this.positionGroupAlongRoute(totalDistance);
    const pending = events.some((event) => event.encounterTriggered)
      ? this.createPendingEncounter(day, position)
      : undefined;
    const encounter = pending
      ? GENERIC_ENCOUNTERS.find((candidate) => candidate.id === pending.encounterId)
      : undefined;
    const log: DayLog = {
      day,
      weather,
      distance,
      totalDistance,
      encounter: encounter
        ? `${encounter.name} · decisión pendiente`
        : 'Sin encuentro derivado de los eventos',
      resources: `${foodUsed.toFixed(1)} kg de comida · ${waterUsed.toFixed(1)} l de agua`,
      position,
      pendingDecision: Boolean(pending),
      events,
    };
    this.logs.update((logs) => [...logs, log]);
    this.status.set(
      pending
        ? `Jornada ${day}: decide si quieres jugar ${encounter?.name ?? 'el encuentro'}`
        : `Jornada ${day} resuelta · ${this.formatDistance(distance)} km recorridos`
    );
    this.sideTab.set('days');
    this.persistState();
  }

  protected resetJourney(): void {
    this.logs.set([]);
    this.pendingEncounter.set(undefined);
    const origin = LOCATIONS.find((location) => location.id === this.plan().originId);
    if (origin && this.selectedGroupId()) this.updateGroupPosition(this.selectedGroupId()!, origin);
    this.status.set('Registro de jornadas reiniciado');
    this.persistState();
  }

  protected playPendingEncounter(): void {
    const pending = this.pendingEncounter();
    const encounter = this.pendingEncounterDefinition();
    if (!pending || !encounter) return;
    this.completePendingEncounter('Enviado al VTT');
  }

  protected skipPendingEncounter(): void {
    this.completePendingEncounter('Omitido por el DM');
  }

  protected groupMemberNames(group: TravelGroup): string {
    const names = this.members()
      .filter((member) => group.memberIds.includes(member.id))
      .map((member) => member.name);
    return names.slice(0, 3).join(', ') + (names.length > 3 ? ` y ${names.length - 3} más` : '');
  }

  protected groupMembers(group: TravelGroup): TravelMember[] {
    return this.members()
      .filter((member) => group.memberIds.includes(member.id))
      .slice(0, 3);
  }

  protected groupInitials(group: TravelGroup): string {
    return group.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected activePaceLabel(): string {
    return this.paceLabel(this.plan().pace);
  }

  protected locationName(id: string): string {
    return LOCATIONS.find((location) => location.id === id)?.name ?? 'Punto del mapa';
  }

  private readonly groupColors = ['#c9964a', '#4c8fa8', '#9b5c63', '#64865a', '#8a6aa2'];

  private defaultPlan(): TravelPlan {
    return {
      originId: 'waterdeep',
      destinationId: 'baldurs-gate',
      pace: 'normal',
      hours: 8,
      difficultTerrain: false,
      mountBoostHours: 0,
      season: 'Primavera',
      danger: 'road',
      foodKg: 20,
      waterLiters: 80,
      gold: 50,
      fatigue: 0,
      guideId: '',
      hunterIds: [],
      watcherIds: [],
      marchOrder: '',
      activities: '',
      preparedEncounters: '',
      dmSecrets: '',
    };
  }

  private buildMembers(campaign?: Campaign): TravelMember[] {
    if (!campaign) return [];
    const namedIds = new Set(campaign.playerCharacters.map((player) => player.id));
    const players: TravelMember[] = this.characterSheets.playerSheets(campaign).map((player) => ({
      // Preserve the IDs referenced by existing groups and role assignments.
      id: `${namedIds.has(player.id) ? 'player-' : 'player-option-'}${player.id}`,
      name: player.name,
      image: this.characterSheets.tokenImage('players', player.id, true, player.gridTokenUrl || player.tokenUrl),
      kind: 'PJ',
      detail: `${player.ancestry} · ${player.className}`,
      statisticsRecorded: player.statisticsRecorded !== false,
      ...this.travelSkillStats(player.statisticsRecorded === false ? [] : player.skills, player.statisticsRecorded === false ? 10 : player.abilities.wisdom),
    }));
    const npcs: TravelMember[] = this.characterSheets.campaignNpcs(campaign.id, campaign.npcs).map((npc) => ({
      id: `npc-${npc.id}`,
      name: npc.name,
      image: this.characterSheets.tokenImage('npcs', npc.id, true),
      kind: 'PNJ' as const,
      detail: npc.role,
      ...this.travelSkillStats(npc.statBlock?.skills, npc.statBlock?.abilities.wisdom),
    }));
    const generic: TravelMember[] = this.characterSheets.genericNpcs().map((npc) => ({
      id: `generic-${npc.id}`,
      name: npc.name,
      image: this.characterSheets.tokenImage('generic', npc.id, true),
      kind: 'Genérico' as const,
      detail: npc.role,
      ...this.travelSkillStats(npc.skills, npc.abilities.wisdom),
    }));
    const seen = new Set<string>();
    const retained = new Set([...this.groups().flatMap((group) => group.memberIds), this.plan().guideId, ...this.plan().hunterIds, ...this.plan().watcherIds]);
    return [...players, ...npcs, ...(this.access ? generic.filter((member) => retained.has(member.id)) : generic)].filter((member) => {
      const key = member.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private travelSkillStats(skills: string[] = [], wisdom = 10): Pick<
    TravelMember,
    'survivalBonus' | 'perceptionBonus' | 'survivalProficient' | 'perceptionProficient'
  > {
    const survival = this.findSkill(skills, 'Supervivencia');
    const perception = this.findSkill(skills, 'Percepción');
    const wisdomModifier = Math.floor((wisdom - 10) / 2);
    return {
      survivalBonus: survival?.bonus ?? wisdomModifier,
      perceptionBonus: perception?.bonus ?? wisdomModifier,
      survivalProficient: Boolean(survival),
      perceptionProficient: Boolean(perception),
    };
  }

  private findSkill(
    skills: string[],
    skillName: string
  ): { bonus: number } | undefined {
    const normalizedName = this.normalize(skillName);
    const entry = skills.find((skill) => this.normalize(skill).startsWith(normalizedName));
    if (!entry) return undefined;
    const match = entry.match(/[+-]\s*\d+/);
    return match ? { bonus: Number(match[0].replace(/\s/g, '')) } : undefined;
  }

  private sanitizeRoleAssignments(): void {
    if (!this.selectedGroup()) return;
    const available = new Set(this.selectedGroup()?.memberIds ?? []);
    const guideId = available.has(this.plan().guideId) ? this.plan().guideId : '';
    const hunterIds = this.plan().hunterIds.filter(
      (id) => available.has(id) && id !== guideId
    );
    const hunters = new Set(hunterIds);
    const watcherIds = this.plan().watcherIds.filter(
      (id) => available.has(id) && id !== guideId && !hunters.has(id)
    );
    this.updatePlan({ guideId, hunterIds, watcherIds });
  }

  private roleSupportReduction(role: 'hunter' | 'watch'): number {
    const ids = role === 'hunter' ? this.plan().hunterIds : this.plan().watcherIds;
    const skill = role === 'hunter' ? 'survival' : 'perception';
    return ids.reduce((total, id) => {
      const member = this.selectedGroupMembers().find((candidate) => candidate.id === id);
      if (!member) return total;
      const proficient =
        skill === 'survival' ? member.survivalProficient : member.perceptionProficient;
      return total + (proficient ? 2 : 1);
    }, 0);
  }

  private signed(value: number): string {
    return value >= 0 ? `+${value}` : String(value);
  }

  private updatePlan(changes: Partial<TravelPlan>): void {
    this.plan.update((plan) => ({ ...plan, ...changes }));
  }

  private updateGroupPosition(id: string, point: MapPoint): void {
    this.groups.update((groups) =>
      groups.map((group) =>
        group.id === id
          ? { ...group, x: this.clamp(point.x, 0, 100), y: this.clamp(point.y, 0, 100) }
          : group
      )
    );
  }

  private mapPoint(clientX: number, clientY: number): MapPoint | undefined {
    const rect = this.mapStage?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return undefined;
    return {
      x: this.clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: this.clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  private fitMap(behavior: ScrollBehavior = 'auto'): void {
    const viewport = this.mapViewport?.nativeElement;
    if (!viewport) return;
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, viewport.clientHeight - 24);
    const fittedZoom = this.clamp(
      Math.min(availableWidth / MAP_WIDTH, availableHeight / MAP_HEIGHT),
      MIN_ZOOM,
      1
    );
    this.zoom.set(Number(fittedZoom.toFixed(3)));
    this.persistState();
    requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0, behavior }));
  }

  private distanceTolerance(...values: number[]): number {
    return Number.EPSILON * 8 * Math.max(1, ...values.map(Math.abs));
  }

  protected formatDistance(value: number): string {
    return value > 0 && value < 0.001 ? '< 0,001' : DISTANCE_FORMAT.format(value);
  }

  private calculateRouteDistance(points: MapPoint[]): number {
    let distance = 0;
    for (let index = 1; index < points.length; index += 1) {
      const dx = (points[index].x - points[index - 1].x) * KM_PER_X_PERCENT;
      const dy = (points[index].y - points[index - 1].y) * KM_PER_Y_PERCENT;
      distance += Math.hypot(dx, dy);
    }
    return distance;
  }

  private positionGroupAlongRoute(distance: number): string {
    const groupId = this.selectedGroupId();
    const points = this.route();
    if (!groupId || points.length < 2) return 'Sin posición';

    if (distance >= this.routeDistance() - this.distanceTolerance(distance, this.routeDistance())) {
      const destination = points[points.length - 1];
      this.updateGroupPosition(groupId, destination);
      return this.nearestLocation(destination)?.name ?? 'En ruta';
    }
    let remaining = Math.max(0, distance);
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const segment = this.calculateRouteDistance([start, end]);
      if (remaining <= segment || index === points.length - 1) {
        const ratio = segment > 0 ? this.clamp(remaining / segment, 0, 1) : 1;
        const point = {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
        this.updateGroupPosition(groupId, point);
        return this.nearestLocation(point)?.name ?? 'En ruta';
      }
      remaining -= segment;
    }
    return this.locationName(this.plan().destinationId);
  }

  private nearestLocation(point: MapPoint): FaerunLocation | undefined {
    return LOCATIONS
      .map((location) => ({
        location,
        distance: Math.hypot(location.x - point.x, location.y - point.y),
      }))
      .filter((entry) => entry.distance <= 2.2)
      .sort((a, b) => a.distance - b.distance)[0]?.location;
  }

  private closestLocation(point: MapPoint): FaerunLocation | undefined {
    return LOCATIONS
      .map((location) => ({
        location,
        distance: Math.hypot(location.x - point.x, location.y - point.y),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.location;
  }

  private resolveRoleEvents(): RoleEventResult[] {
    const group = this.selectedGroup()!;
    const location = this.closestLocation(group);
    const environments = location
      ? this.environmentsForLocation(location)
      : this.environmentsForRegion('Tierras salvajes');
    const roles: TravelRole[] = ['guide'];
    if (this.roll(100) <= this.roleEventChance('hunter')) roles.push('hunter');
    if (this.roll(100) <= this.roleEventChance('watch')) roles.push('watch');
    return roles.map((role) =>
      this.resolveRoleEvent(this.pickTravelEvent(role, environments))
    );
  }

  private pickTravelEvent(
    role: TravelRole,
    environments: EncounterEnvironment[]
  ): TravelEventDefinition {
    const polarity = this.roll(2) === 1 ? 'positive' : 'negative';
    const rolePool = TRAVEL_EVENTS.filter(
      (event) => event.role === role && event.polarity === polarity
    );
    const environmentPool = rolePool.filter((event) =>
      event.environments.some((environment) => environments.includes(environment))
    );
    const pool = environmentPool.length ? environmentPool : rolePool;
    const totalWeight = pool.reduce((total, event) => total + (event.weight ?? 1), 0);
    let choice = this.roll(totalWeight);
    for (const event of pool) {
      choice -= event.weight ?? 1;
      if (choice <= 0) return event;
    }
    return pool[pool.length - 1];
  }

  private resolveRoleEvent(event: TravelEventDefinition): RoleEventResult {
    const actor = this.eventActor(event.role, event.skill);
    const bonus =
      event.skill === 'survival' ? actor.survivalBonus : actor.perceptionBonus;
    const dc = this.eventDifficulty(event.role, event.dc);
    const roll = this.roll(20);
    const total = roll + bonus;
    const success = total >= dc;
    const applies = event.polarity === 'positive' ? success : !success;
    const effect = applies
      ? this.materializeEffect(event.effect, Math.max(1, this.memberCount()))
      : undefined;
    const encounterCondition =
      event.encounterTrigger === 'always' ||
      (event.encounterTrigger === 'success' && success) ||
      (event.encounterTrigger === 'failure' && !success);
    const encounterTriggered =
      encounterCondition && this.roll(100) <= Math.round((event.encounterChance ?? 1) * 100);
    const campaignHook = applies ? event.campaignHook : undefined;
    return {
      id: event.id,
      role: event.role,
      title: event.title,
      polarity: event.polarity,
      story: event.story,
      actorId: actor.id,
      actorName: actor.name,
      skill: event.skill,
      roll,
      bonus,
      total,
      dc,
      success,
      outcome: success ? event.success : event.failure,
      effectSummary: this.eventEffectSummary(
        event.polarity,
        applies,
        effect,
        encounterTriggered,
        campaignHook
      ),
      effect,
      encounterTriggered,
      campaignHook,
    };
  }

  private eventActor(role: TravelRole, skill: TravelEventSkill): TravelMember {
    const guide = this.guideMember()!;
    const roleIds =
      role === 'hunter'
        ? this.plan().hunterIds
        : role === 'watch'
          ? this.plan().watcherIds
          : [];
    if (!roleIds.length) return guide;
    return this.selectedGroupMembers()
      .filter((member) => roleIds.includes(member.id))
      .sort(
        (a, b) =>
          (skill === 'survival' ? b.survivalBonus : b.perceptionBonus) -
          (skill === 'survival' ? a.survivalBonus : a.perceptionBonus)
      )[0] ?? guide;
  }

  private eventDifficulty(role: TravelRole, baseDc: number): number {
    if (role === 'guide') return baseDc + this.guideRolePenalty();
    const assigned =
      role === 'hunter' ? this.plan().hunterIds.length : this.plan().watcherIds.length;
    if (!assigned) return baseDc + this.guideRolePenalty();
    const support =
      role === 'hunter' ? this.hunterSupportReduction() : this.watcherSupportReduction();
    return Math.max(8, baseDc - support);
  }

  private roleEventChance(role: 'hunter' | 'watch'): number {
    const chances: Record<DangerLevel, Record<'hunter' | 'watch', number>> = {
      safe: { hunter: 35, watch: 25 },
      road: { hunter: 45, watch: 40 },
      wild: { hunter: 60, watch: 55 },
      hostile: { hunter: 72, watch: 72 },
      extreme: { hunter: 82, watch: 85 },
    };
    return chances[this.plan().danger][role];
  }

  private materializeEffect(
    effect: TravelEventEffect | undefined,
    travelers: number
  ): TravelEventEffect | undefined {
    if (!effect) return undefined;
    return {
      foodKg: (effect.foodKg ?? 0) + (effect.foodPerTraveler ?? 0) * travelers,
      waterLiters:
        (effect.waterLiters ?? 0) + (effect.waterPerTraveler ?? 0) * travelers,
      gold: effect.gold ?? 0,
      fatigue: effect.fatigue ?? 0,
      distancePercent: effect.distancePercent ?? 0,
      distanceKm: effect.distanceKm ?? 0,
    };
  }

  private aggregateEventEffects(events: RoleEventResult[]): TravelDayEffects {
    return events.reduce<TravelDayEffects>(
      (total, event) => ({
        foodKg: total.foodKg + (event.effect?.foodKg ?? 0),
        waterLiters: total.waterLiters + (event.effect?.waterLiters ?? 0),
        gold: total.gold + (event.effect?.gold ?? 0),
        fatigue: total.fatigue + (event.effect?.fatigue ?? 0),
        distancePercent:
          total.distancePercent + (event.effect?.distancePercent ?? 0),
        distanceKm: total.distanceKm + (event.effect?.distanceKm ?? 0),
      }),
      {
        foodKg: 0,
        waterLiters: 0,
        gold: 0,
        fatigue: 0,
        distancePercent: 0,
        distanceKm: 0,
      }
    );
  }

  private eventEffectSummary(
    polarity: 'positive' | 'negative',
    applies: boolean,
    effect: TravelEventEffect | undefined,
    encounterTriggered: boolean,
    campaignHook: string | undefined
  ): string {
    if (!applies) {
      return polarity === 'positive'
        ? 'El beneficio no se obtiene.'
        : 'El infortunio queda evitado.';
    }
    const parts: string[] = [];
    if (effect?.foodKg) parts.push(`${this.signed(Number(effect.foodKg.toFixed(1)))} kg de comida`);
    if (effect?.waterLiters) {
      parts.push(`${this.signed(Number(effect.waterLiters.toFixed(1)))} l de agua`);
    }
    if (effect?.gold) parts.push(`${this.signed(effect.gold)} po`);
    if (effect?.fatigue) parts.push(`${this.signed(effect.fatigue)} fatiga`);
    if (effect?.distancePercent) {
      parts.push(`${this.signed(Math.round(effect.distancePercent * 100))}% de recorrido`);
    }
    if (effect?.distanceKm) parts.push(`${this.signed(effect.distanceKm)} km`);
    if (encounterTriggered) parts.push('genera un encuentro');
    if (campaignHook) parts.push('revela un hilo de campaña');
    return parts.length ? parts.join(' · ') : 'El resultado altera la historia del viaje.';
  }

  private createPendingEncounter(day: number, position: string): PendingTravelEncounter {
    const group = this.selectedGroup()!;
    const location = this.closestLocation(group);
    const region = location?.region ?? 'Tierras salvajes';
    const environments = location
      ? this.environmentsForLocation(location)
      : this.environmentsForRegion(region);
    const scoredEncounters = GENERIC_ENCOUNTERS.map((encounter) => ({
      encounter,
      score: encounter.environments.reduce(
        (score, environment) =>
          score +
          (environments.includes(environment)
            ? environment === 'wild'
              ? 1
              : environment === 'road' || environment === 'ruins'
                ? 2
                : 4
            : 0),
        0
      ),
    }));
    const bestScore = Math.max(...scoredEncounters.map((entry) => entry.score));
    const candidates = scoredEncounters
      .filter((entry) => entry.score > 0 && entry.score >= bestScore - 2)
      .map((entry) => entry.encounter);
    const encounterPool = candidates.length ? candidates : GENERIC_ENCOUNTERS;
    const encounter = encounterPool[this.roll(encounterPool.length) - 1];
    const pending: PendingTravelEncounter = {
      encounterId: encounter.id,
      runId: `travel-${day}-${Date.now()}`,
      day,
      level: this.partyLevel(group),
      partySize: Math.max(1, group.memberIds.length),
      region,
      position,
      memberActorIds: group.memberIds.map((id) => this.toVttActorId(id)),
    };
    this.pendingEncounter.set(pending);
    return pending;
  }

  private completePendingEncounter(result: string): void {
    const pending = this.pendingEncounter();
    const encounter = this.pendingEncounterDefinition();
    if (!pending || !encounter) return;
    this.logs.update((logs) =>
      logs.map((log) =>
        log.day === pending.day
          ? { ...log, encounter: `${encounter.name} · ${result}`, pendingDecision: false }
          : log
      )
    );
    this.pendingEncounter.set(undefined);
    this.status.set(`Jornada ${pending.day}: ${encounter.name} · ${result}`);
    this.persistState();
  }

  private partyLevel(group: TravelGroup): number {
    const campaign = this.campaign();
    if (!campaign) return 1;
    const sheets = new Map(this.characterSheets.playerSheets(campaign).map((player) => [player.id, player.level]));
    const levels = group.memberIds.flatMap((memberId) => {
      const prefix = memberId.startsWith('player-option-') ? 'player-option-' : 'player-';
      if (!memberId.startsWith(prefix)) return [];
      return [sheets.get(memberId.slice(prefix.length)) ?? campaign.startingLevel];
    });
    if (!levels.length) return campaign.startingLevel;
    return Math.max(1, Math.min(20, Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length)));
  }

  private toVttActorId(memberId: string): string {
    if (memberId.startsWith('player-option-')) {
      return `player:${memberId.slice('player-option-'.length)}`;
    }
    if (memberId.startsWith('player-')) return `player:${memberId.slice('player-'.length)}`;
    if (memberId.startsWith('npc-')) return `npc:${memberId.slice('npc-'.length)}`;
    if (memberId.startsWith('generic-')) return `generic:${memberId.slice('generic-'.length)}`;
    return memberId;
  }

  private environmentsForRegion(region: string): EncounterEnvironment[] {
    const normalized = this.normalize(region);
    if (/moonshae|purple rocks|tuern|ruathym|gundarlun/.test(normalized)) {
      return ['islands', 'coast', 'sea'];
    }
    if (/chult|maztica|selva|jungla/.test(normalized)) return ['jungle', 'swamp', 'coast'];
    if (/anauroch|desierto|calimshan/.test(normalized)) return ['desert', 'ruins', 'road'];
    if (/costa de la espada/.test(normalized)) return ['coast', 'sea', 'road', 'forest'];
    if (/bosque alto|cormanthor|lurkwood/.test(normalized)) return ['forest', 'wild', 'village'];
    if (/el norte|hartsvale|espina|viento helado/.test(normalized)) {
      return ['mountain', 'forest', 'wild'];
    }
    if (/infraoscuridad/.test(normalized)) return ['underdark', 'ruins'];
    if (/paramo alto|najara|frontera salvaje|trollclaws/.test(normalized)) {
      return ['plains', 'wild', 'ruins', 'road'];
    }
    if (/elturgard|tierras centrales|colinas trielta/.test(normalized)) {
      return ['road', 'urban', 'plains', 'farmland'];
    }
    return ['road', 'plains', 'wild'];
  }

  private environmentsForLocation(location: FaerunLocation): EncounterEnvironment[] {
    const normalized = this.normalize(`${location.name} ${location.region}`);
    switch (location.category) {
      case 'city':
        return ['urban', 'road'];
      case 'town':
        return ['village', 'urban', 'road', 'farmland'];
      case 'fortress':
        return ['road', 'ruins'];
      case 'ruin':
      case 'tower':
        return ['ruins', 'wild'];
      case 'site':
        return /cave|cavern|gruta|cueva|mine|mina|grotto/.test(normalized)
          ? ['cave', 'ruins', 'wild']
          : ['ruins', 'wild'];
      case 'forest':
        return /chult|jungle|jungla|rainforest/.test(normalized)
          ? ['jungle', 'swamp', 'wild']
          : ['forest', 'wild'];
      case 'mountain':
        return ['mountain', 'wild'];
      case 'plain':
        return ['plains', 'farmland', 'road', 'wild'];
      case 'desert':
        return ['desert', 'ruins', 'wild'];
      case 'water':
        if (/river|rio|río|ford|vado|lake|lago/.test(normalized)) {
          return ['river', 'coast', 'wild'];
        }
        if (/swamp|marsh|pantano|ciénaga|cienaga|bog/.test(normalized)) {
          return ['swamp', 'river', 'wild'];
        }
        return ['sea', 'coast', 'islands'];
      case 'area':
        return /isla|mar|costa|sea|ocean|archipelago/.test(normalized)
          ? ['islands', 'coast', 'sea']
          : this.environmentsForRegion(location.region);
    }
  }

  private rollWeather(): string {
    const temperatureRoll = this.roll(20);
    const windRoll = this.roll(20);
    const rainRoll = this.roll(20);
    const temperature =
      temperatureRoll <= 14
        ? `temperatura normal de ${this.plan().season.toLowerCase()}`
        : temperatureRoll <= 17
          ? `${this.roll(4) * 5} °C más fría`
          : `${this.roll(4) * 5} °C más cálida`;
    const wind = windRoll <= 12 ? 'sin viento' : windRoll <= 17 ? 'viento leve' : 'viento fuerte';
    const rain =
      rainRoll <= 12
        ? 'sin precipitaciones'
        : rainRoll <= 17
          ? 'precipitación ligera'
          : 'precipitación intensa';
    return `${temperature}; ${wind}; ${rain}`;
  }

  private paceSpeed(pace: Pace): number {
    return pace === 'fast' ? 6 : pace === 'slow' ? 3 : 4.5;
  }

  private paceLabel(pace: Pace): string {
    return pace === 'fast' ? 'Rápido' : pace === 'slow' ? 'Lento' : 'Normal';
  }

  private roll(sides: number): number {
    return Math.floor(Math.random() * sides) + 1;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private currentJourney(): GroupJourney {
    return structuredClone({ route: this.route(), plan: this.plan(), logs: this.logs(), pendingEncounter: this.pendingEncounter() });
  }

  private captureJourney(): void {
    const id = this.selectedGroupId();
    if (id && this.groups().some((group) => group.id === id)) this.journeys[id] = this.currentJourney();
    else this.unassignedJourney = this.currentJourney();
  }

  private activateJourney(id: string | undefined): void {
    this.selectedGroupId.set(id);
    const saved = id && Object.hasOwn(this.journeys, id) ? this.journeys[id] : !id ? this.unassignedJourney : undefined;
    const journey = saved ? structuredClone(saved) : { route: [], logs: [], plan: this.defaultPlan(), pendingEncounter: undefined };
    this.route.set(journey.route);
    this.plan.set(journey.plan);
    this.logs.set(journey.logs);
    this.pendingEncounter.set(journey.pendingEncounter);
    this.sanitizeRoleAssignments();
  }

  private persistState(): void {
    if (!this.storageReadable) {
      this.status.set('No se puede guardar: el viaje original no es legible y se conserva para recuperarlo.');
      return;
    }
    this.captureJourney();
    const state: StoredTravelState = {
      version: 2, groups: this.groups(), journeys: this.journeys, unassignedJourney: this.unassignedJourney,
      // Mantener la instantánea seleccionada permite reconocer el formato anterior.
      ...this.currentJourney(), selectedGroupId: this.selectedGroupId(), zoom: this.zoom(),
    };
    try {
      const backupKey = `${this.storageKey}:before-group-journeys`;
      if (this.legacySource && localStorage.getItem(backupKey) === null) localStorage.setItem(backupKey, this.legacySource);
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      this.legacySource = undefined;
    } catch {
      this.status.set('No se pudo guardar el viaje. Los cambios siguen en esta sesión; libera espacio antes de cerrar.');
    }
  }

  private readJourney(value: Partial<GroupJourney>): GroupJourney {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Viaje ilegible');
    const route = value.route ?? [], logs = value.logs ?? [];
    if (!Array.isArray(route) || route.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) ||
        !Array.isArray(logs) || logs.some((log) => !log || !Number.isFinite(log.day) || !Number.isFinite(log.distance) || !Number.isFinite(log.totalDistance) || (log.events !== undefined && !Array.isArray(log.events)))) throw new Error('Ruta o registro ilegible');
    const defaults = this.defaultPlan();
    if (value.plan !== undefined && (!value.plan || typeof value.plan !== 'object' || Array.isArray(value.plan))) throw new Error('Plan ilegible');
    const plan = { ...defaults, ...value.plan };
    if (!Array.isArray(plan.hunterIds) || !Array.isArray(plan.watcherIds)) throw new Error('Roles ilegibles');
    if (!LOCATIONS.some((location) => location.id === plan.originId)) plan.originId = defaults.originId;
    if (!LOCATIONS.some((location) => location.id === plan.destinationId)) plan.destinationId = defaults.destinationId;
    const pending = value.pendingEncounter;
    if (pending && (!GENERIC_ENCOUNTERS.some((encounter) => encounter.id === pending.encounterId) || !Array.isArray(pending.memberActorIds))) throw new Error('Encuentro ilegible');
    return structuredClone({ route, logs, plan, pendingEncounter: pending });
  }

  private restoreState(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const state = JSON.parse(raw) as Partial<StoredTravelState>;
      if (!state || typeof state !== 'object' || Array.isArray(state) || (state.version !== undefined && state.version !== 2)) throw new Error('Formato de viaje desconocido');
      const groups = state.groups ?? [];
      if (!Array.isArray(groups) || groups.some((group) => !group || typeof group.id !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.memberIds) || !Number.isFinite(group.x) || !Number.isFinite(group.y)) || new Set(groups.map((group) => group.id)).size !== groups.length) throw new Error('Grupos ilegibles');
      const selected = groups.find((group) => group.id === state.selectedGroupId)?.id ?? groups[0]?.id;
      let journeys: Record<string, GroupJourney> = Object.create(null);
      let unassigned: GroupJourney | undefined;
      if (state.version === 2) {
        if (!state.journeys || typeof state.journeys !== 'object' || Array.isArray(state.journeys)) throw new Error('Viajes por grupo ilegibles');
        journeys = Object.fromEntries(Object.entries(state.journeys).map(([id, journey]) => [id, this.readJourney(journey)]));
        if (state.unassignedJourney) unassigned = this.readJourney(state.unassignedJourney);
      } else {
        const legacy = this.readJourney(state);
        if (selected) journeys[selected] = legacy;
        else unassigned = legacy;
        this.legacySource = raw;
      }
      this.groups.set(groups); this.journeys = journeys; this.unassignedJourney = unassigned;
      this.activateJourney(selected);
      if (typeof state.zoom === 'number' && Number.isFinite(state.zoom)) this.zoom.set(this.clamp(state.zoom, MIN_ZOOM, MAX_ZOOM));
    } catch {
      this.storageReadable = false;
      this.status.set('No se pudo leer el viaje guardado. El original se conserva; recupéralo antes de guardar cambios.');
    }
  }
}
