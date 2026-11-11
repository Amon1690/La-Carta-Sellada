import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ACCESS_CONTEXT } from '../../../../core/services/access';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { TravelMap } from './travel-map';
import { FAERUN_LOCATIONS } from '../../../../core/data/faerun-locations';
import { syntheticNetwork } from '../../../../core/services/travel-network.fixture';
import { networkStorageKey } from '../../../../core/services/travel-network-store';

const KEY = 'la-carta-sellada:travel-map:faerun-atlas-v3';
const groups = () => ['a', 'b'].map((id, i) => ({ id, name: `Grupo ${id}`, color: '#c9964a', memberIds: ['player-option-scout'], x: 44.3 + i, y: 37.5 }));
const pending = (runId: string) => ({ encounterId: 'emboscada-camino', runId, day: 1, level: 5, partySize: 1, region: 'Camino', position: 'Posición guardada', memberActorIds: ['player:scout'] });
const log = () => ({ day: 1, weather: 'Despejado', distance: 20, totalDistance: 20, encounter: 'Pendiente', resources: 'Reservas gastadas', position: 'Posición guardada', pendingDecision: true });

describe('Viajes independientes por grupo', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    spyOn(Storage.prototype, 'getItem').and.callFake((key) => values.get(key) ?? null);
    spyOn(Storage.prototype, 'setItem').and.callFake((key, value) => { values.set(key, value); });
    spyOn(Storage.prototype, 'removeItem').and.callFake((key) => { values.delete(key); });
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      { provide: CampaignDataService, useValue: { getDefaultCampaign: () => of({ id: 'test', playerCharacters: [], playerOptions: [], npcs: [] }) } },
      { provide: CharacterSheetsService, useValue: { changes$: of(0), playerSheets: () => [{ id: 'scout', name: 'Exploradora', level: 5, skills: ['Supervivencia +5', 'Percepción +5'], abilities: { wisdom: 14 }, className: 'Pícara', subclass: '', gridTokenUrl: '' }], campaignNpcs: () => [], genericNpcs: () => [], tokenImage: () => '' } },
    ] });
  });
  // Acceso de prueba a las acciones que la plantilla expone al usuario.
  const make = (): any => TestBed.runInInjectionContext(() => new TravelMap());
  function legacy(selectedGroupId = 'a'): void {
    values.set(KEY, JSON.stringify({ groups: groups(), selectedGroupId, route: [{ x: 44.3, y: 37.5 }, { x: 48, y: 37.5 }], plan: { foodKg: 10, waterLiters: 40, gold: 17, fatigue: 2, guideId: 'player-option-scout', hunterIds: [], watcherIds: [], dmSecrets: 'Solo grupo A' }, logs: [log()], pendingEncounter: pending('run-a'), zoom: 0.1 }));
  }
  it('restaura ruta, plan, roles, jornadas y encuentro al cambiar de grupo y recargar', () => {
    legacy(); const view = make(); const aRoute = structuredClone(view.route());
    view.selectGroup('b');
    expect(view.route()).toEqual([]); expect(view.logs()).toEqual([]); expect(view.pendingEncounter()).toBeUndefined();
    expect(view.plan().guideId).toBe(''); expect(view.plan().foodKg).toBe(20);
    view.route.set([{ x: 45.3, y: 37.5 }, { x: 49, y: 37.5 }]);
    view.planFieldChanged('foodKg', 73); view.guideChanged('player-option-scout');
    view.pendingEncounter.set(pending('run-b')); view.logs.set([{ ...log(), weather: 'Lluvia B' }]); view.persistState();
    view.selectGroup('a');
    expect(view.route()).toEqual(aRoute); expect(view.plan().foodKg).toBe(10); expect(view.plan().guideId).toBe('player-option-scout');
    expect(view.logs()[0].weather).toBe('Despejado'); expect(view.pendingEncounter().runId).toBe('run-a');
    view.selectGroup('b'); const restored = make();
    expect(restored.selectedGroupId()).toBe('b'); expect(restored.plan().foodKg).toBe(73);
    expect(restored.logs()[0].weather).toBe('Lluvia B'); expect(restored.pendingEncounter().runId).toBe('run-b');
    restored.selectGroup('a'); expect(restored.pendingEncounter().runId).toBe('run-a');
  });
  it('calcular no modifica ruta manual, provisiones, jornadas ni encuentro pendiente', () => {
    legacy(); const view = make(), original = values.get(KEY), snapshot = { route: structuredClone(view.route()), plan: structuredClone(view.plan()), logs: structuredClone(view.logs()), encounter: structuredClone(view.pendingEncounter()) };
    view.routeToSelectedDestination();
    expect(view.plannerOrigin()).toEqual(view.selectedGroup()); expect(view.plannerOrigin()).not.toEqual(snapshot.route.at(-1));
    expect(view.route()).toEqual(snapshot.route); expect(view.plan()).toEqual(snapshot.plan); expect(view.logs()).toEqual(snapshot.logs); expect(view.pendingEncounter()).toEqual(snapshot.encounter); expect(values.get(KEY)).toBe(original);
    view.addManualDestination(); expect(view.route().length).toBe(snapshot.route.length + 1); expect(view.status()).toContain('Ruta manual');
  });
  it('el botón del panel calcula sobre la red guardada y dibuja preview sin alterar la partida', async () => {
    const destination = FAERUN_LOCATIONS[0], network = syntheticNetwork();
    network.coverage[0].bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    network.nodes = [network.nodes[0], { ...network.nodes[1], x: destination.x, y: destination.y }];
    network.edges = [{ ...network.edges[0], geometry: [{ x: 1, y: 1 }, { x: destination.x, y: destination.y }] }];
    values.set(networkStorageKey('test'), JSON.stringify(network));
    values.set(KEY + ':campaign:test', JSON.stringify({ groups: [{ ...groups()[0], x: 1, y: 1 }], selectedGroupId: 'a', route: [], logs: [], plan: { destinationId: destination.id }, zoom: .1 }));
    TestBed.overrideProvider(ACCESS_CONTEXT, { useValue: { user: () => ({ id: 'qa', username: 'Prueba', role: 'director', campaigns: ['test'] }) } });
    TestBed.configureTestingModule({ imports: [TravelMap], providers: [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ campaignId: 'test' }) } } }] });
    TestBed.overrideProvider(CampaignDataService, { useValue: { getCampaignById: () => of({ id: 'test', playerCharacters: [], playerOptions: [], npcs: [] }) } });
    const fixture = TestBed.createComponent(TravelMap), view = fixture.componentInstance as any; fixture.detectChanges(); await fixture.whenStable();
    view.setSideTab('plan'); fixture.detectChanges(); await fixture.whenStable();
    const route = structuredClone(view.route()), plan = structuredClone(view.plan());
    const button = Array.from(fixture.nativeElement.querySelectorAll('app-route-planner button') as NodeListOf<HTMLButtonElement>).find(b => b.textContent?.includes('Calcular por caminos'))!;
    button.click(); fixture.detectChanges(); expect(view.plannedItinerary()?.legs[0].edgeId).toBe('road');
    expect(fixture.nativeElement.querySelector('[aria-label="Vista previa de itinerario calculado"]')).not.toBeNull();
    expect(view.route()).toEqual(route); expect(view.plan()).toEqual(plan); expect(view.logs()).toEqual([]);
    view.setSideTab('groups'); fixture.detectChanges(); expect(view.plannedItinerary()).toBeUndefined();
  });
  it('resolver una jornada solo consume provisiones y mueve el grupo seleccionado', () => {
    legacy(); const view = make(); view.skipPendingEncounter(); view.resetJourney();
    view.selectGroup('b'); view.planFieldChanged('foodKg', 50); const b = structuredClone(view.groups()[1]);
    view.selectGroup('a'); spyOn(view, 'resolveRoleEvents').and.returnValue([]); spyOn(view, 'rollWeather').and.returnValue('Despejado');
    view.resolveDay();
    expect(view.logs().length).toBe(1); expect(view.plan().foodKg).toBe(9.6); expect(view.plan().waterLiters).toBe(36.2);
    expect(view.groups()[0].x).not.toBe(44.3); expect(view.groups()[1]).toEqual(b);
    view.selectGroup('b'); expect(view.plan().foodKg).toBe(50); expect(view.plan().waterLiters).toBe(80); expect(view.logs()).toEqual([]);
  });
  it('resolver u omitir encuentros y reiniciar ruta no altera otro grupo', () => {
    legacy(); const view = make(); view.selectGroup('b');
    view.pendingEncounter.set(pending('run-b')); view.logs.set([log()]); view.persistState(); view.skipPendingEncounter(); view.clearRoute();
    view.selectGroup('a'); expect(view.pendingEncounter().runId).toBe('run-a'); expect(view.logs()[0].pendingDecision).toBeTrue(); expect(view.route().length).toBe(2);
  });
  it('un grupo nuevo no hereda el viaje activo y eliminarlo recupera el anterior', () => {
    legacy(); const view = make(); view.groupName.set('Nuevo'); view.draftMemberIds.set(['player-option-scout']); view.createGroup();
    expect(view.route()).toEqual([]); expect(view.logs()).toEqual([]); expect(view.pendingEncounter()).toBeUndefined(); expect(view.plan().dmSecrets).toBe('');
    view.planFieldChanged('foodKg', 99); const removed = view.selectedGroupId(); view.removeSelectedGroup();
    expect(view.selectedGroupId()).toBe('a'); expect(view.plan().foodKg).toBe(10); expect(view.pendingEncounter().runId).toBe('run-a');
    expect(JSON.parse(values.get(KEY)!).journeys[removed]).toBeUndefined();
  });
  it('migra al primer grupo si falta la selección y conserva una copia del original', () => {
    legacy('inexistente'); const original = values.get(KEY); const view = make();
    expect(view.selectedGroupId()).toBe('a'); expect(view.pendingEncounter().runId).toBe('run-a');
    view.selectGroup('b'); expect(values.get(`${KEY}:before-group-journeys`)).toBe(original);
    view.selectGroup('a'); expect(view.logs()[0].resources).toBe('Reservas gastadas');
  });
  it('conserva el viaje legado sin grupos hasta crear su primer grupo', () => {
    legacy(); const old = JSON.parse(values.get(KEY)!); old.groups = []; delete old.selectedGroupId; values.set(KEY, JSON.stringify(old));
    const view = make(); view.groupName.set('Primer grupo'); view.draftMemberIds.set(['player-option-scout']); view.createGroup();
    expect(view.plan().foodKg).toBe(10); expect(view.logs().length).toBe(1); expect(view.pendingEncounter().runId).toBe('run-a');
    view.persistState(); expect(make().logs()[0].resources).toBe('Reservas gastadas');
  });
  it('no borra ni sobrescribe estados ilegibles y conserva el original si falla guardar', () => {
    values.set(KEY, '{ilegible'); const invalid = make(); invalid.planFieldChanged('foodKg', 7); expect(values.get(KEY)).toBe('{ilegible');
    legacy(); const original = values.get(KEY); const valid = make();
    (Storage.prototype.setItem as jasmine.Spy).and.throwError('Cuota agotada');
    expect(() => valid.selectGroup('b')).not.toThrow(); expect(values.get(KEY)).toBe(original); expect(valid.status()).toContain('guardar');
  });

  it('el atlas con acceso guarda cada campaña por separado y usa la campaña de la ruta', () => {
    let id = 'one';
    TestBed.overrideProvider(ACCESS_CONTEXT, { useValue: { user: () => ({ role: 'director' }) } });
    TestBed.configureTestingModule({ providers: [{ provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap({ campaignId: id }); } } } }] });
    TestBed.overrideProvider(CampaignDataService, { useValue: { getCampaignById: (campaignId: string) => of({ id: campaignId, playerCharacters: [], playerOptions: [], npcs: [] }) } });
    const north = make(); north.planFieldChanged('foodKg', 73); expect(north.campaign().id).toBe('one');
    id = 'two'; const south = make(); expect(south.plan().foodKg).toBe(20); south.planFieldChanged('foodKg', 11);
    id = 'one'; expect(make().plan().foodKg).toBe(73); expect(values.has(KEY)).toBeFalse();
  });
  it('recupera el viaje global una sola vez sin borrar el original ni sus compañeros genéricos', () => {
    let id = 'one'; legacy(); const old = JSON.parse(values.get(KEY)!); old.groups[0].memberIds = ['generic-guide']; old.plan.guideId = 'generic-guide'; values.set(KEY, JSON.stringify(old));
    const original = values.get(KEY);
    TestBed.overrideProvider(ACCESS_CONTEXT, { useValue: { user: () => ({ role: 'director' }) } });
    TestBed.configureTestingModule({ providers: [{ provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap({ campaignId: id }); } } } }] });
    TestBed.overrideProvider(CampaignDataService, { useValue: { getCampaignById: (campaignId: string) => of({ id: campaignId, playerCharacters: [], playerOptions: [], npcs: [] }) } });
    TestBed.overrideProvider(CharacterSheetsService, { useValue: { changes$: of(0), playerSheets: () => [], campaignNpcs: () => [], genericNpcs: () => [{ id: 'guide', name: 'Guía guardado', role: 'Guía', skills: ['Supervivencia +4'], abilities: { wisdom: 12 } }], tokenImage: () => '' } });
    const view = make(); expect(view.groups()).toEqual([]); expect(view.legacyTravelAvailable()).toBeTrue();
    view.importLegacyTravel(); expect(values.get(KEY)).toBe(original); expect(view.plan().foodKg).toBe(10); expect(view.plan().guideId).toBe('generic-guide');
    expect(view.members().some((member: { id: string }) => member.id === 'generic-guide')).toBeTrue();
    id = 'two'; const other = make(); expect(other.legacyTravelAvailable()).toBeFalse(); expect(other.groups()).toEqual([]);
  });

  it('monta los 1456 marcadores con sus coordenadas sin crear detalles ocultos', async () => {
    const fixture = TestBed.createComponent(TravelMap);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const markers = Array.from(root.querySelectorAll<HTMLButtonElement>('.map-location'));
    expect(markers.length).toBe(1456);
    expect(root.querySelectorAll('.location-tooltip').length).toBe(0);
    expect(root.querySelectorAll('.map-location *').length).toBe(1456);
    markers.forEach((marker, index) => {
      const location = FAERUN_LOCATIONS[index];
      expect(marker.style.left).toBe(`${location.x}%`);
      expect(marker.style.top).toBe(`${location.y}%`);
      expect(marker.getAttribute('aria-label')).toBe(`${location.name}. ${location.categoryLabel}. ${location.summary}`);
    });
  });

  it('muestra un único detalle al pasar el ratón y recupera el foco de teclado al salir', async () => {
    const fixture = TestBed.createComponent(TravelMap);
    await fixture.whenStable();
    // Dejar terminar el ajuste inicial del mapa antes de observar escrituras.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    const savedBefore = Array.from(values.entries());
    const root: HTMLElement = fixture.nativeElement;
    const markers = root.querySelectorAll<HTMLButtonElement>('.map-location');
    const focused = markers[0], hovered = markers[1];
    focused.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="tooltip"]').length).toBe(1);
    expect(focused.querySelector('b')?.textContent).toBe(FAERUN_LOCATIONS[0].name);
    expect(focused.getAttribute('aria-describedby')).toBe(focused.querySelector('[role="tooltip"]')!.id);
    hovered.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(root.querySelectorAll('[role="tooltip"]').length).toBe(1);
    expect(hovered.querySelector('b')?.textContent).toBe(FAERUN_LOCATIONS[1].name);
    expect(focused.hasAttribute('aria-describedby')).toBeFalse();
    hovered.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    expect(focused.querySelector('[role="tooltip"]')).not.toBeNull();
    focused.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(root.querySelector('[role="tooltip"]')).toBeNull();
    expect(Array.from(values.entries())).toEqual(savedBefore);
  });

  it('mantiene la selección y el trazado exacto al activar un marcador con teclado o clic', async () => {
    const fixture = TestBed.createComponent(TravelMap);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const view = fixture.componentInstance as any;
    const markers = root.querySelectorAll<HTMLButtonElement>('.map-location');
    view.setMode('route');
    markers[0].dispatchEvent(new FocusEvent('focus'));
    markers[0].click();
    await fixture.whenStable();
    expect(view.selectedLocationId()).toBe(FAERUN_LOCATIONS[0].id);
    expect(view.route()).toEqual([{ x: FAERUN_LOCATIONS[0].x, y: FAERUN_LOCATIONS[0].y }]);
    markers[1455].click();
    await fixture.whenStable();
    expect(view.route()[1]).toEqual({ x: FAERUN_LOCATIONS[1455].x, y: FAERUN_LOCATIONS[1455].y });
    expect(view.plan().destinationId).toBe(FAERUN_LOCATIONS[1455].id);
    const saved = JSON.parse(values.get(KEY)!);
    expect(saved.route).toEqual(view.route());
    expect(saved.hoveredLocationId).toBeUndefined();
  });


  function preciseJourney(points: { x: number; y: number }[]): any {
    legacy(); const view = make(); view.skipPendingEncounter(); view.logs.set([]); view.route.set(points);
    view.groups.update((items: any[]) => items.map((g) => g.id === 'a' ? { ...g, ...points[0] } : g));
    spyOn(view, 'resolveRoleEvents').and.returnValue([]); spyOn(view, 'rollWeather').and.returnValue('Despejado');
    return view;
  }
  it('conserva 1,222 km y sitúa el primer kilómetro dentro del segundo tramo', () => {
    const view = preciseJourney([{ x: 20, y: 20 }, { x: 20.01, y: 20 }, { x: 20.02, y: 20 }]);
    expect(view.routeDistance()).toBeCloseTo(1.222, 10);
    view.positionGroupAlongRoute(1);
    expect(view.groups()[0].x).toBeCloseTo(20 + 1 / 61.1, 10);
    expect(view.groups()[0].y).toBe(20);
  });
  it('una ruta inferior a medio kilómetro sigue pendiente y llega exactamente', () => {
    const view = preciseJourney([{ x: 20, y: 20 }, { x: 20.004, y: 20 }]);
    expect(view.remainingDistance()).toBeCloseTo(0.2444, 10);
    view.resolveDay();
    expect(view.logs().length).toBe(1); expect(view.travelledDistance()).toBeCloseTo(0.2444, 10);
    expect(view.groups()[0].x).toBe(20.004); expect(view.remainingDistance()).toBe(0);
  });
  it('muchos tramos cortos avanzan la misma distancia que su geometría total', () => {
    const points = Array.from({ length: 1001 }, (_, i) => ({ x: 20 + i * 0.001, y: 20 }));
    const view = preciseJourney(points);
    expect(view.routeDistance()).toBeCloseTo(61.1, 9);
    view.resolveDay(); expect(view.groups()[0].x).toBeCloseTo(20 + 36 / 61.1, 9);
    view.resolveDay(); expect(view.groups()[0].x).toBe(21); expect(view.remainingDistance()).toBe(0);
    const before = view.groups()[0].x; view.resolveDay(); expect(view.logs().length).toBe(2); expect(view.groups()[0].x).toBe(before);
  });
  it('los tramos nulos no alteran la interpolación ni la llegada a los bordes', () => {
    const view = preciseJourney([{ x: 2, y: 2 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 2 }]);
    view.positionGroupAlongRoute(61.1); expect(view.groups()[0].x).toBeCloseTo(1, 10);
    view.positionGroupAlongRoute(view.routeDistance()); expect(view.groups()[0].x).toBe(0);
    expect(Number.isFinite(view.groups()[0].y)).toBeTrue();
    view.route.set([{ x: 5, y: 5 }, { x: 5, y: 5 }]); expect(view.routeDistance()).toBe(0);
  });
  it('mantiene fracciones de capacidad diaria y modificadores en vez de redondear el avance', () => {
    const view = preciseJourney([{ x: 20, y: 20 }, { x: 30, y: 20 }]);
    view.planFieldChanged('hours', 7); expect(view.dailyDistance()).toBe(31.5);
    spyOn(view, 'aggregateEventEffects').and.returnValue({ foodKg: 0, waterLiters: 0, gold: 0, fatigue: 0, distancePercent: 0.1, distanceKm: 0 });
    view.resolveDay(); expect(view.logs()[0].distance).toBeCloseTo(34.65, 10);
    expect(view.groups()[0].x).toBeCloseTo(20 + 34.65 / 61.1, 9);
  });
  it('conserva jornadas antiguas sin reescribir consumos ni mover grupos al leer', () => {
    legacy(); const old = JSON.parse(values.get(KEY)!); old.logs = [{ ...log(), distance: 1, totalDistance: 1 }];
    old.groups[0].x = 20.01; old.groups[0].y = 20;
    old.route = [{ x: 20, y: 20 }, { x: 20.01, y: 20 }, { x: 20.02, y: 20 }];
    const raw = JSON.stringify(old); values.set(KEY, raw); const view = make();
    expect(view.logs()).toEqual(old.logs); expect(view.groups()[0].x).toBe(20.01); expect(values.get(KEY)).toBe(raw);
    expect(view.plan().foodKg).toBe(10); expect(view.travelledDistance()).toBe(1);
  });
  it('restaura distancias fraccionarias y posiciones de dos grupos y campañas', () => {
    let id = 'precision-one';
    TestBed.overrideProvider(ACCESS_CONTEXT, { useValue: { user: () => ({ role: 'director' }) } });
    TestBed.configureTestingModule({ providers: [{ provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap({ campaignId: id }); } } } }] });
    TestBed.overrideProvider(CampaignDataService, { useValue: { getCampaignById: (campaignId: string) => of({ id: campaignId, playerCharacters: [], playerOptions: [], npcs: [] }) } });
    const view = make(); view.groups.set(groups()); view.selectGroup('a');
    view.route.set([{ x: 20, y: 20 }, { x: 20.004, y: 20 }]); view.guideChanged('player-option-scout');
    spyOn(view, 'resolveRoleEvents').and.returnValue([]); spyOn(view, 'rollWeather').and.returnValue('Despejado');
    view.resolveDay(); const first = structuredClone(view.logs()); view.selectGroup('b');
    view.route.set([{ x: 30, y: 30 }, { x: 30.006, y: 30 }]); view.guideChanged('player-option-scout'); view.resolveDay();
    const second = structuredClone(view.logs()); const restored = make();
    expect(restored.logs()).toEqual(second); expect(restored.groups()[1].x).toBe(30.006);
    restored.selectGroup('a'); expect(restored.logs()).toEqual(first); expect(restored.groups()[0].x).toBe(20.004);
    id = 'precision-two'; expect(make().groups()).toEqual([]);
    id = 'precision-one'; expect(make().logs()).toEqual(first);
  });

  it('cierra la última jornada sin consumir otra por un residuo de coma flotante', () => {
    const view = preciseJourney([{ x: 20, y: 20 }, { x: 20.99513, y: 20 }]);
    const neutral = { foodKg: 0, waterLiters: 0, gold: 0, fatigue: 0, distancePercent: 0, distanceKm: 0 };
    const effects = spyOn(view, 'aggregateEventEffects').and.returnValue({ ...neutral, distancePercent: -0.2 });
    view.resolveDay(); expect(view.logs()[0].distance).toBe(28.8);
    effects.and.returnValue(neutral); view.resolveDay();
    expect(view.remainingDistance()).toBe(0); expect(view.estimatedDays()).toBe(0);
    expect(view.logs()[1].totalDistance).toBe(view.routeDistance()); expect(view.groups()[0].x).toBe(20.99513);
    const provisions = structuredClone(view.plan()); view.resolveDay();
    expect(view.logs().length).toBe(2); expect(view.plan()).toEqual(provisions);
    const tiny = preciseJourney([{ x: 20, y: 20 }, { x: 20.00000001, y: 20 }]);
    expect(tiny.remainingDistance()).toBeGreaterThan(0); // No se confunde precisión de presentación con cero real.
  });

});
