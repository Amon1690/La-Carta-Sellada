import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { Campaign, CampaignNpc, PlayerOption } from '../models/campaign';
import { RuleGenericNpc, RulesCompendium } from '../models/rules';
import { CampaignDataService } from './campaign-data';
import { RulesDataService } from './rules-data';
import { CHARACTER_SHEET_STORAGE, CharacterSheetsService } from './character-sheets';
import { Compendium } from '../../features/compendium/pages/compendium/compendium';
import { TravelMap } from '../../features/travel/pages/travel-map/travel-map';
import { VttBoard } from '../../features/vtt/pages/vtt-board/vtt-board';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const player = (): PlayerOption => ({
  id: 'template-player', name: 'Exploradora', ancestry: 'Humana', className: 'Pícara',
  subclass: 'Exploradora', background: 'Viajera', hook: 'Un camino por explorar',
  level: 5, feat: 'Alerta', armorClass: 15, hitPoints: 37, speed: '9 m', initiative: '+3',
  proficiencyBonus: 3, abilities: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 14, charisma: 10 },
  saves: [], skills: ['Supervivencia +5', 'Percepción +5'], attacks: [], features: [], spells: [], equipment: [],
});
const npc = (): CampaignNpc => ({
  id: 'guide', name: 'Guía', summary: 'Guía local', tags: [], role: 'Guía',
  faction: 'Libre', motivation: 'Viajar', statBlock: player(),
});
const genericNpc = (): RuleGenericNpc => ({
  ...player(), id: 'test-generic', name: 'Vigía', summary: 'Vigila el camino', tags: [],
  category: 'Habitante', role: 'Vigía', lineage: 'Humano', challenge: '1', personality: [], traits: [],
});
const campaign = (): Campaign => ({
  id: 'shared-sheets-test', name: 'Prueba', system: '2024', startingLevel: 5, partySize: '4', premise: '',
  npcs: [npc()], playerOptions: [player()], playerCharacters: [{
    id: 'named-player', name: 'Personaje principal', summary: 'Gancho propio', tags: [], ancestry: 'Humana',
    className: 'Pícara', subclass: 'Exploradora', background: 'Viajera', affiliation: 'Libre',
    tokenUrl: 'assets/tokens/players/named-player.png', gridTokenUrl: 'assets/tokens-grid/players/named-player.png',
  }], items: [], locations: [], encounters: [], antagonistOptions: [], rewards: [], mysteryHooks: [], acts: [],
  scenes: [{ id: 'test-scene', name: 'Mapa', summary: '', tags: [], act: '', order: 1, mapUrl: '', objective: '', checks: [], clues: [] }],
  sealedLetter: { school: [], arcanaDc: 10, religionDc: 10, traits: [], message: '' },
});
const PLAYER_KEY = 'la-carta-sellada:editable:fichas-pjs';
const GENERIC_KEY = 'la-carta-sellada:editable:fichas-genericas';
const NPC_KEY = 'la-carta-sellada:editable:shared-sheets-test:pnjs';

describe('CharacterSheetsService y consumidores', () => {
  let storage: MemoryStorage;
  let sheets: CharacterSheetsService;
  let adventure: Campaign;
  let section: string;
  let snapshotData: { section: string };

  beforeEach(() => {
    storage = new MemoryStorage(); adventure = campaign(); section = 'players'; snapshotData = { section };
    const params = convertToParamMap({ campaignId: adventure.id, kind: 'scene', entryId: 'test-scene' });
    const emptyParams = convertToParamMap({});
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      { provide: CHARACTER_SHEET_STORAGE, useValue: storage },
      { provide: CampaignDataService, useValue: { getCampaign: () => of(adventure), getDefaultCampaign: () => of(adventure), getCampaignById: () => of(adventure) } },
      { provide: RulesDataService, useValue: { getRules: () => of({ source: '', edition: '', spells: [], feats: [], skills: [], equipment: [], classes: [], creatures: [] } satisfies RulesCompendium) } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: params, queryParamMap: emptyParams, data: snapshotData }, paramMap: of(params), queryParamMap: of(emptyParams), get data() { return of({ section }); } } },
    ] });
    sheets = TestBed.inject(CharacterSheetsService);
  });

  it('recupera colecciones antiguas sin cambiar claves ni partidas', () => {
    storage.setItem(PLAYER_KEY, JSON.stringify({ edited: { 'template-player': { ...player(), hitPoints: 63 } }, created: [{ ...player(), id: 'custom-saved', name: 'Creado antes' }] }));
    storage.setItem(NPC_KEY, JSON.stringify({ edited: { guide: { ...npc(), name: 'Guía editado' } }, created: [] }));
    storage.setItem(GENERIC_KEY, JSON.stringify({ edited: {}, created: [genericNpc()] }));
    storage.setItem('la-carta-sellada:vtt:existing', 'combate intacto');
    const before = storage.getItem(PLAYER_KEY);
    expect(sheets.playerSheets(adventure).find((p) => p.id === 'template-player')?.hitPoints).toBe(63);
    expect(sheets.playerSheets(adventure).some((p) => p.id === 'custom-saved')).toBeTrue();
    expect(sheets.campaignNpcs(adventure.id, adventure.npcs)[0].name).toBe('Guía editado');
    expect(sheets.campaignNpcs('other-campaign', adventure.npcs)[0].name).toBe('Guía');
    expect(sheets.genericNpcs([])[0].name).toBe('Vigía');
    expect(storage.getItem(PLAYER_KEY)).toBe(before);
    expect(storage.getItem('la-carta-sellada:vtt:existing')).toBe('combate intacto');
  });

  it('actualiza una creación sin duplicarla y notifica solo después de guardar', () => {
    const versions: number[] = []; sheets.changes$.subscribe((v) => versions.push(v));
    const created = { ...player(), id: 'custom-one' };
    sheets.savePlayer(created, 'create'); sheets.savePlayer({ ...created, hitPoints: 71 }, 'edit');
    expect(sheets.playerSheets(adventure).filter((p) => p.id === created.id).length).toBe(1);
    expect(sheets.playerSheets(adventure).find((p) => p.id === created.id)?.hitPoints).toBe(71);
    spyOn(storage, 'setItem').and.throwError('Cuota agotada');
    expect(() => sheets.savePlayer(player(), 'edit')).toThrowError('Cuota agotada');
    expect(versions).toEqual([0, 1, 2]);
  });

  it('no borra una colección ilegible al consultarla', () => {
    storage.setItem(PLAYER_KEY, '{ilegible');
    expect(sheets.playerSheets(adventure).length).toBe(2);
    expect(storage.getItem(PLAYER_KEY)).toBe('{ilegible');
  });

  it('conserva retratos e identidad sin tomar estadísticas de una plantilla ajena', () => {
    const named = sheets.playerSheets(adventure).find((p) => p.id === 'named-player');
    expect(named?.statisticsRecorded).toBeFalse();
    expect(named?.hitPoints).toBe(0);
    expect(named?.skills).toEqual([]);
    expect(named?.tokenUrl).toBe(adventure.playerCharacters[0].tokenUrl);
    expect(sheets.tokenImage('players', 'custom-new')).toBe('assets/tokens/generic/aldeano.png');
    expect(sheets.tokenImage('npcs', 'custom-new', true)).toBe('assets/tokens-grid/generic/aldeano.png');
  });

  function compendiumCards(): { key: string; name: string; stats?: { label: string; value: string }[] }[] {
    snapshotData.section = section;
    const view = TestBed.runInInjectionContext(() => new Compendium()) as unknown as {
      vm$: Observable<{ entries: { key: string; name: string; stats?: { label: string; value: string }[] }[] }>;
    };
    let cards: { key: string; name: string; stats?: { label: string; value: string }[] }[] = [];
    const subscription = view.vm$.subscribe((vm) => { cards = vm.entries; }); subscription.unsubscribe();
    return cards;
  }

  it('propaga una ficha editada y otra creada desde el editor a compendio, viajes y VTT', () => {
    const editor = TestBed.runInInjectionContext(() => new Compendium()) as unknown as {
      startCreate(kind: string): void; draft: { name: string; hitPoints: number }; saveDraft(event: Event): void;
    };
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as { members(): { id: string; name: string; survivalBonus: number }[] };
    const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as { tokenChoices(): { id: string; name: string; maxHp: number }[] };
    expect(board.tokenChoices().some((p) => p.name === 'Creada desde el editor')).toBeFalse();
    sheets.savePlayer({ ...player(), name: 'Ficha editada', hitPoints: 64, skills: ['Supervivencia +9'] }, 'edit');
    editor.startCreate('player'); editor.draft.name = 'Creada desde el editor'; editor.draft.hitPoints = 48; editor.saveDraft(new Event('submit'));
    expect(compendiumCards().some((p) => p.name === 'Ficha editada' && p.stats?.some((s) => s.label === 'PG' && s.value === '64'))).toBeTrue();
    expect(compendiumCards().some((p) => p.name === 'Creada desde el editor')).toBeTrue();
    expect(travel.members().find((p) => p.id === 'player-option-template-player')?.survivalBonus).toBe(9);
    expect(travel.members().some((p) => p.name === 'Creada desde el editor')).toBeTrue();
    expect(board.tokenChoices().find((p) => p.id === 'player:template-player')?.maxHp).toBe(64);
    expect(board.tokenChoices().some((p) => p.name === 'Creada desde el editor' && p.maxHp === 48)).toBeTrue();
  });

  it('comparte PNJs de campaña y genéricos editados y creados sin perder IDs de viaje', () => {
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as { members(): { id: string; name: string }[] };
    const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as { tokenChoices(): { id: string; name: string; maxHp: number }[] };
    sheets.saveCampaignNpc(adventure.id, { ...npc(), name: 'PNJ editado' }, 'edit');
    sheets.saveCampaignNpc(adventure.id, { ...npc(), id: 'custom-npc', name: 'PNJ nuevo' }, 'create');
    const baseGeneric = sheets.genericNpcs()[0];
    sheets.saveGenericNpc({ ...baseGeneric, name: 'Genérico editado', hitPoints: 82 }, 'edit');
    sheets.saveGenericNpc({ ...genericNpc(), id: 'custom-generic', name: 'Genérico nuevo' }, 'create');
    section = 'npcs';
    expect(compendiumCards().map((p) => p.name)).toContain('PNJ editado');
    expect(compendiumCards().map((p) => p.name)).toContain('PNJ nuevo');
    section = 'generic-npcs';
    expect(compendiumCards().map((p) => p.name)).toContain('Genérico editado');
    expect(compendiumCards().map((p) => p.name)).toContain('Genérico nuevo');
    expect(travel.members().find((p) => p.id === 'npc-guide')?.name).toBe('PNJ editado');
    expect(travel.members().some((p) => p.id === 'npc-custom-npc')).toBeTrue();
    expect(travel.members().some((p) => p.id === 'generic-custom-generic')).toBeTrue();
    expect(board.tokenChoices().find((p) => p.id === `generic:${baseGeneric.id}`)?.maxHp).toBe(82);
    expect(board.tokenChoices().some((p) => p.id === 'npc:custom-npc')).toBeTrue();
    expect(board.tokenChoices().some((p) => p.id === 'generic:custom-generic')).toBeTrue();
  });

  it('actualiza consumidores abiertos al recibir cambios desde otra pestaña', () => {
    const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as { tokenChoices(): { id: string; maxHp: number }[] };
    storage.setItem(PLAYER_KEY, JSON.stringify({ edited: { 'template-player': { ...player(), hitPoints: 93 } }, created: [] }));
    window.dispatchEvent(new StorageEvent('storage', { key: PLAYER_KEY }));
    expect(board.tokenChoices().find((p) => p.id === 'player:template-player')?.maxHp).toBe(93);
  });

  it('calcula el nivel del viaje desde las fichas editadas de PJs principales y creados', () => {
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as { partyLevel(group: { memberIds: string[] }): number };
    const named = sheets.playerSheets(adventure).find((p) => p.id === 'named-player')!;
    sheets.savePlayer({ ...named, level: 9 }, 'edit');
    sheets.savePlayer({ ...player(), id: 'custom-traveler', level: 7 }, 'create');
    expect(travel.partyLevel({ memberIds: ['player-named-player'] })).toBe(9);
    expect(travel.partyLevel({ memberIds: ['player-named-player', 'player-option-custom-traveler'] })).toBe(8);
  });

  it('refresca nombres del encuentro pendiente al editar una ficha genérica', () => {
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as {
      pendingEncounter: { set(value: unknown): void };
      pendingEncounterRoster(): { id: string; name: string }[];
    };
    travel.pendingEncounter.set({ encounterId: 'emboscada-camino', level: 5, partySize: 4 });
    const before = travel.pendingEncounterRoster()[0];
    const sheet = sheets.genericNpcs().find((p) => p.id === before.id)!;
    sheets.saveGenericNpc({ ...sheet, name: 'Adversario renombrado' }, 'edit');
    expect(travel.pendingEncounterRoster().find((p) => p.id === before.id)?.name).toBe('Adversario renombrado');
  });

  it('actualiza el catálogo sin restablecer PG, posiciones o niebla de un combate abierto', () => {
    const key = 'la-carta-sellada:vtt:shared-sheets-test:scene:test-scene';
    const original = localStorage.getItem(key);
    try {
      const token = { instanceId: 'placed', actorId: 'player:template-player', name: 'Exploradora', image: '', x: 100, y: 200, size: 1, hp: 15, maxHp: 37, initiative: 18, hidden: false };
      const fogRects = [{ id: 'fog', x: 0, y: 0, width: 100, height: 100 }];
      const saved = JSON.stringify({ tokens: [token], fogRects, zoom: 0.8, activeTurnId: 'placed' });
      localStorage.setItem(key, saved);
      const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as {
        tokens: { (): typeof token[]; set(value: typeof token[]): void };
        fogRects(): typeof fogRects;
        activeTurnId(): string;
        tokenChoices(): { id: string; maxHp: number }[];
      };
      board.tokens.set([{ ...token, x: 400, hp: 2 }]);
      sheets.savePlayer({ ...player(), hitPoints: 64 }, 'edit');
      expect(board.tokenChoices().find((p) => p.id === 'player:template-player')?.maxHp).toBe(64);
      expect(board.tokens()[0].hp).toBe(2);
      expect(board.tokens()[0].x).toBe(400);
      expect(board.fogRects()).toEqual(fogRects);
      expect(board.activeTurnId()).toBe('placed');
      expect(localStorage.getItem(key)).toBe(saved);
    } finally {
      if (original === null) localStorage.removeItem(key);
      else localStorage.setItem(key, original);
    }
  });

  it('muestra ausencia explícita para los cuatro PJs principales sin ficha', () => {
    const base = adventure.playerCharacters[0];
    adventure.playerCharacters = ['valian', 'erwan', 'megara', 'durgan'].map((id) => ({ ...base, id, name: id }));
    const cards = compendiumCards();
    const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as { tokenChoices(): { id: string; maxHp: number; subtitle: string }[] };
    for (const main of adventure.playerCharacters) {
      expect(cards.find((c) => c.key === `player:${main.id}`)?.stats).toEqual([{ label: 'Estadísticas', value: 'Sin registrar' }]);
      const choice = board.tokenChoices().find((c) => c.id === `player:${main.id}`);
      expect(choice?.maxHp).toBe(0);
      expect(choice?.subtitle).toContain('PG sin registrar');
    }
  });

  it('conserva fichas antiguas de PJs principales y propaga PG y habilidades propios al editarlas', () => {
    const old = { ...player(), id: 'named-player', name: 'Principal con ficha', hitPoints: 67, skills: ['Supervivencia +8', 'Percepción +7'], abilities: { ...player().abilities, wisdom: 18 } };
    storage.setItem(PLAYER_KEY, JSON.stringify({ edited: { 'named-player': old }, created: [] }));
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as { members(): { id: string; survivalBonus: number; perceptionBonus: number }[] };
    const board = TestBed.runInInjectionContext(() => new VttBoard()) as unknown as { tokenChoices(): { id: string; maxHp: number }[] };
    expect(board.tokenChoices().find((p) => p.id === 'player:named-player')?.maxHp).toBe(67);
    expect(travel.members().find((p) => p.id === 'player-named-player')?.survivalBonus).toBe(8);
    expect(storage.getItem(PLAYER_KEY)).toContain('Principal con ficha');
    sheets.savePlayer({ ...old, hitPoints: 72, skills: ['Supervivencia +10', 'Percepción +9'] }, 'edit');
    expect(compendiumCards().find((c) => c.key === 'player:named-player')?.stats).toContain({ label: 'PG', value: '72' });
    expect(board.tokenChoices().find((p) => p.id === 'player:named-player')?.maxHp).toBe(72);
    expect(travel.members().find((p) => p.id === 'player-named-player')?.survivalBonus).toBe(10);
    expect(travel.members().find((p) => p.id === 'player-named-player')?.perceptionBonus).toBe(9);
  });

  it('no resuelve tiradas ni consume recursos de un guía con habilidades sin registrar', () => {
    const travel = TestBed.runInInjectionContext(() => new TravelMap()) as unknown as {
      groups: { set(value: unknown): void }; route: { set(value: unknown): void }; selectedGroupId: { set(value: string): void };
      plan: { (): { foodKg: number; guideId: string }; set(value: unknown): void };
      members(): { id: string }[]; memberRoleSummary(member: unknown): string; memberSkillLabel(member: unknown, skill: string): string;
      logs(): unknown[]; status(): string; resolveDay(): void;
    };
    travel.groups.set([{ id: 'test-group', name: 'Grupo', color: '#000', x: 44, y: 37, memberIds: ['player-named-player'] }]);
    travel.selectedGroupId.set('test-group'); travel.route.set([{ x: 44, y: 37 }, { x: 45, y: 37 }]);
    travel.plan.set({ ...travel.plan(), guideId: 'player-named-player' });
    const member = travel.members().find((p) => p.id === 'player-named-player')!;
    expect(travel.memberRoleSummary(member)).toBe('Habilidades sin registrar');
    expect(travel.memberSkillLabel(member, 'survival')).toBe('Supervivencia sin registrar');
    const food = travel.plan().foodKg;
    travel.resolveDay();
    expect(travel.status()).toContain('Registra las habilidades');
    expect(travel.logs()).toEqual([]);
    expect(travel.plan().foodKg).toBe(food);
  });

  it('editar identidad no confirma estadísticas ausentes; la confirmación explícita habilita la ficha', () => {
    const editor = TestBed.runInInjectionContext(() => new Compendium()) as unknown as {
      startEdit(entry: unknown): void; draft: { name: string; hitPoints: number; statisticsRecorded: boolean }; saveDraft(event: Event): void;
    };
    editor.startEdit(compendiumCards().find((c) => c.key === 'player:named-player'));
    expect(editor.draft.statisticsRecorded).toBeFalse();
    editor.draft.name = 'Identidad editada'; editor.saveDraft(new Event('submit'));
    expect(sheets.playerSheets(adventure).find((p) => p.id === 'named-player')?.statisticsRecorded).toBeFalse();
    expect(compendiumCards().find((c) => c.key === 'player:named-player')?.stats).toEqual([{ label: 'Estadísticas', value: 'Sin registrar' }]);
    editor.startEdit(compendiumCards().find((c) => c.key === 'player:named-player'));
    editor.draft.hitPoints = 53; editor.draft.statisticsRecorded = true; editor.saveDraft(new Event('submit'));
    expect(sheets.playerSheets(adventure).find((p) => p.id === 'named-player')?.hitPoints).toBe(53);
    expect(sheets.playerSheets(adventure).find((p) => p.id === 'named-player')?.statisticsRecorded).toBeTrue();
  });
});
