import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ACCESS_CONTEXT, AccessUser } from './access';
import { CampaignDataService } from './campaign-data';
import { CHARACTER_SHEET_STORAGE, CharacterSheetsService, EditablePlayerSheet } from './character-sheets';
import { REMOTE_SHEETS, RemoteSheetsService } from './remote-sheets';
import { Campaign } from '../models/campaign';

const player = (name: string): EditablePlayerSheet => ({ id: 'custom-hero', name, playerIds: ['player'], ancestry: '', className: '', subclass: '', background: '', hook: '', feat: '', level: 1, armorClass: 0, hitPoints: 0, speed: '', initiative: '', proficiencyBonus: 0, abilities: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 }, saves: [], skills: [], attacks: [], features: [], spells: [], equipment: [] });
const campaign = (id: string) => ({ id, startingLevel: 1, playerCharacters: [], playerOptions: [] }) as unknown as Campaign;
describe('Fichas y cachés con acceso por campaña', () => {
  let http: HttpTestingController; let remote: RemoteSheetsService; let sheets: CharacterSheetsService;
  const user = signal<AccessUser | null>(null);
  beforeEach(() => {
    user.set({ id: 'director', username: 'Director', role: 'director', campaigns: ['one', 'two'] });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ACCESS_CONTEXT, useValue: { user } }, { provide: REMOTE_SHEETS, useExisting: RemoteSheetsService }, { provide: CHARACTER_SHEET_STORAGE, useValue: undefined }] });
    http = TestBed.inject(HttpTestingController); remote = TestBed.inject(RemoteSheetsService); sheets = TestBed.inject(CharacterSheetsService);
  });
  afterEach(() => http.verify());
  it('el mismo ID de ficha conserva datos y asignaciones independientes en dos campañas', async () => {
    remote.hydrate('one', { edited: {}, created: [player('Norte')], revision: 3 });
    remote.hydrate('two', { edited: {}, created: [player('Sur')], revision: 1 });
    const saving = sheets.savePlayer({ ...player('Norte editado'), hitPoints: 30 }, 'edit', 'one');
    const request = http.expectOne('/api/campaigns/one/sheets');
    expect(request.request.body.revision).toBe(3); expect(request.request.body.created[0].playerIds).toEqual(['player']);
    request.flush({ ...request.request.body, revision: 4 }); await saving;
    expect(sheets.playerSheets(campaign('one'))[0].name).toBe('Norte editado');
    expect(sheets.playerSheets(campaign('two'))[0].name).toBe('Sur');
  });
  it('un guardado rechazado conserva la ficha anterior y muestra un fallo visible', async () => {
    remote.hydrate('one', { edited: {}, created: [player('Original')], revision: 2 });
    const saving = Promise.resolve(sheets.savePlayer(player('No guardado'), 'edit', 'one')).catch(() => {});
    http.expectOne('/api/campaigns/one/sheets').flush({ message: 'Otro director ha cambiado la ficha' }, { status: 409, statusText: 'Conflict' }); await saving;
    expect(sheets.playerSheets(campaign('one'))[0].name).toBe('Original'); expect(remote.error()).toContain('No se pudo guardar');
  });
  it('el jugador y la ausencia de campaña no pueden iniciar escritura', () => {
    expect(() => sheets.savePlayer(player('Sin campaña'), 'create')).toThrow();
    user.update((u) => ({ ...u!, role: 'jugador' }));
    expect(() => sheets.savePlayer(player('Intento'), 'create', 'one')).toThrow();
    http.expectNone('/api/campaigns/one/sheets');
  });
  it('al retirar campañas se descarta el catálogo anterior y no se reutilizan sus datos', () => {
    const data = TestBed.inject(CampaignDataService);
    data.getCampaignById('one').subscribe();
    http.expectOne('data/campaigns.json').flush([{ id: 'one', dataPath: '/api/campaigns/one' }]);
    http.expectOne('/api/campaigns/one').flush({ ...campaign('one'), sheetOverrides: { edited: {}, created: [], revision: 0 } });
    user.update((u) => ({ ...u!, campaigns: ['two'] }));
    let rejected = false;
    data.getCampaignById('one').subscribe({ error: () => { rejected = true; } });
    http.expectOne('data/campaigns.json').flush([{ id: 'two', dataPath: '/api/campaigns/two' }]);
    expect(rejected).toBeTrue(); http.expectNone('/api/campaigns/one');
  });

  it('el perfil de combate de un PJ devuelve el guardado pendiente y se publica solo tras confirmarlo', async () => {
    remote.hydrate('one', { edited: {}, created: [player('Ficha')], revision: 0 });
    const profile = { actions: [], reactions: [], resources: [], attacksPerTurn: 2 };
    const pending = sheets.saveCombatProfile(campaign('one'), 'player:custom-hero', profile);
    expect(pending instanceof Promise).toBeTrue(); expect(sheets.playerSheets(campaign('one'))[0].combat).toBeUndefined();
    const request = http.expectOne('/api/campaigns/one/sheets'); request.flush({ ...request.request.body, revision: 1 }); await pending;
    expect(sheets.playerSheets(campaign('one'))[0].combat?.attacksPerTurn).toBe(2);
  });
});
