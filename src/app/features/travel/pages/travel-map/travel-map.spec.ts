import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ACCESS_CONTEXT } from '../../../../core/services/access';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { TravelMap } from './travel-map';
import { FAERUN_LOCATIONS } from '../../../../core/data/faerun-locations';

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

});
