import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { TravelMap } from './travel-map';

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
});
