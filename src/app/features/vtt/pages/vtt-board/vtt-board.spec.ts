import { VttCombat } from '../../../../core/services/vtt-combat';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, WritableSignal, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Campaign, GameStatBlock } from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CHARACTER_SHEET_STORAGE, CharacterSheetsService, EditablePlayerSheet } from '../../../../core/services/character-sheets';
import { VttBoard } from './vtt-board';
import { emptyBoardVision } from '../../../../core/services/vision-state';
import { BoardVisionState, VisionProfile } from '../../../../core/models/vision';
import { RulesDataService } from '../../../../core/services/rules-data';
import { ENCOUNTER_PUBLISHER, EncounterSharingService, SharingSnapshot } from '../../../../core/services/encounter-sharing';

interface Token {
  instanceId: string; actorId: string; name: string; image: string;
  x: number; y: number; size: number; hp: number; maxHp: number; initiative: number; hidden: boolean;
}
interface Harness {
  tokens: WritableSignal<Token[]>;
  zoom: WritableSignal<number>;
  selectedTokenIds: WritableSignal<string[]>;
  selectedTokens: Signal<Token[]>;
  activeTurnId: WritableSignal<string | undefined>;
}
const GRID = 51.2;
const key = (id = 'vtt-selection-test') => `la-carta-sellada:vtt:${id}:scene:test-scene:spec`;
const params = (id = 'vtt-selection-test') => convertToParamMap({ campaignId: id, kind: 'scene', entryId: 'test-scene' });
const token = (id: string, x: number, y: number, size = 1): Token => ({
  instanceId: id, actorId: `test:${id}`, name: id, image: 'assets/tokens/generic/aldeano.png',
  x, y, size, hp: 7, maxHp: 20, initiative: 14, hidden: false,
});
const campaign = (id: string): Campaign => ({
  id, name: 'Prueba VTT', system: '2024', startingLevel: 5, partySize: '4', premise: '',
  npcs: [], playerOptions: [], playerCharacters: [], items: [], locations: [], encounters: [],
  antagonistOptions: [], rewards: [], mysteryHooks: [], acts: [],
  scenes: [{ id: 'test-scene', name: 'Mapa', summary: '', tags: [], act: '', order: 1,
    mapUrl: 'assets/maps/emboscada-camino.png', objective: '', checks: [], clues: [] }],
  sealedLetter: { school: [], arcanaDc: 10, religionDc: 10, traits: [], message: '' },
});

describe('Multiselección de fichas en VTT', () => {
  let fixture: ComponentFixture<VttBoard>;
  let board: Harness;
  let map: HTMLElement;
  let routeParams: BehaviorSubject<ReturnType<typeof params>>;
  let previous: Map<string, string | null>;
  let sheets: CharacterSheetsService;
  let publisher: jasmine.SpyObj<EncounterSharingService>;

  beforeEach(async () => {
    previous = new Map([key(), key('other-selection-test')].map((k) => [k, localStorage.getItem(k)]));
    previous.forEach((_, k) => localStorage.removeItem(k));
    routeParams = new BehaviorSubject(params());
    publisher = jasmine.createSpyObj<EncounterSharingService>('publisher', ['status', 'publish', 'unshare', 'sheetRevision']);
    publisher.sheetRevision.and.returnValue(0);
    publisher.status.and.resolveTo({ shared: false }); publisher.publish.and.resolveTo(); publisher.unshare.and.resolveTo({});
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      { provide: ENCOUNTER_PUBLISHER, useValue: publisher },
      { provide: RulesDataService, useValue: { getRules: () => of({ spells: [], equipment: [] }) } },
      { provide: CampaignDataService, useValue: { getCampaignById: (id: string) => of(campaign(id)) } },
      { provide: CHARACTER_SHEET_STORAGE, useValue: (() => {
        const values = new Map<string, string>();
        return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, value: string) => values.set(k, value) };
      })() },
      { provide: ActivatedRoute, useValue: {
        paramMap: routeParams, snapshot: { queryParamMap: convertToParamMap({ run: 'spec' }) },
      } },
    ] });
    sheets = TestBed.inject(CharacterSheetsService);
    fixture = TestBed.createComponent(VttBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    board = fixture.componentInstance as unknown as Harness;
    board.zoom.set(0.5);
    board.tokens.set([token('A', GRID * 2, GRID * 2), token('B', GRID * 4, GRID * 2), token('C', GRID * 8, GRID * 6, 2)]);
    fixture.detectChanges();
    map = fixture.nativeElement.querySelector('.map-board');
    spyOn(HTMLElement.prototype, 'setPointerCapture').and.stub();
    spyOn(HTMLElement.prototype, 'hasPointerCapture').and.returnValue(false);
  });

  afterEach(() => {
    fixture.destroy();
    previous.forEach((value, k) => value === null ? localStorage.removeItem(k) : localStorage.setItem(k, value));
  });

  const button = (id: string): HTMLElement => fixture.nativeElement.querySelector(`.vtt-token[aria-label="${id}"]`);
  it('adopta movimientos remotos sin republicarlos y conserva cambios locales en conflicto', () => {
    const view = fixture.componentInstance as any;
    view.persist(); view.sharingDirty = true;
    const state = view.captureBoardState(); state.tokens[0].x = 700;
    const conflictKey = `la-carta-sellada:encounter-conflict:${key()}`, old = localStorage.getItem(conflictKey);
    try {
      view.acceptRemoteEncounter({ shared: true, revision: 5, state }, false);
      expect(board.tokens()[0].x).toBe(700); expect(view.sharingRevision).toBe(5);
      expect(JSON.parse(localStorage.getItem(conflictKey)!).at(-1).state.tokens[0].x).toBe(GRID * 2);
      expect(publisher.publish).not.toHaveBeenCalled();
    } finally { view.encounterShared.set(false); old === null ? localStorage.removeItem(conflictKey) : localStorage.setItem(conflictKey, old); }
  });
  it('una consulta de ausencia anterior no cancela la primera publicación local pendiente', () => {
    const view = fixture.componentInstance as any;
    view.encounterShared.set(true); view.sharingDirty = true; view.sharingRevision = 0;
    view.acceptRemoteEncounter({ shared: false, revision: 0 }, false);
    expect(view.encounterShared()).toBeTrue(); expect(view.sharingDirty).toBeTrue();
    view.acceptRemoteEncounter({ shared: false, revision: 1 }, false);
    expect(view.encounterShared()).toBeFalse();
  });
  it('procesa un movimiento de jugador solo en el turno activo y publica el acuse', () => {
    const view = confirmedPreview(); actorFor('A', 'player:hero');
    board.activeTurnId.set('A'); view.combat.start('A');
    view.acceptRemoteEncounter({ shared: true, revision: 3, state: view.captureBoardState(), pendingCommand: {
      id: 'player-move', observerId: 'A', userId: 'u', type: 'move', cell: 63, sheetRevision: 0, expiresAt: Date.now() + 15000,
    } }, false);
    expect(board.tokens()[0].x).toBe(GRID * 3); expect(view.pendingAck.status).toBe('applied');
    expect(view.pendingAck.id).toBe('player-move');
  });
  it('no resuelve automáticamente un ataque si falta confirmar la visión del objetivo', () => {
    const view = confirmedPreview(); actorFor('A', 'generic:guardia-veterano'); actorFor('B', 'generic:guardia');
    (sheets.visionProfile as jasmine.Spy).and.callFake((_campaign, actorId: string) => actorId === 'generic:guardia' ? undefined : {
      version: 1, senses: [{ sense: 'normal', rangeFeet: 60, source: { kind: 'director', reference: 'Prueba' } }],
    });
    view.sheetRevision.update((revision: number) => revision + 1);
    const action = view.combat.find('A').actions[0], begin = spyOn(view.combat, 'begin');
    spyOn(view, 'playerControls').and.returnValue({ A: { canAttack: true, attacks: [{ source: action.source, targetIds: ['B'] }] } });
    view.applyPlayerCommand({ id: 'uncertain', observerId: 'A', userId: 'u', type: 'attack', source: action.source, targetId: 'B', sheetRevision: 0, expiresAt: Date.now() + 15000 });
    expect(begin).not.toHaveBeenCalled(); expect(view.pendingAck.status).toBe('rejected');
  });
  it('al salir antes del debounce publica la niebla final y no conserva la imagen anterior', async () => {
    const sharing = fixture.componentInstance as unknown as {
      encounterShared: WritableSignal<boolean>; fogRects: WritableSignal<{ id: string; x: number; y: number; width: number; height: number }[]>;
      persist(): void; sharingChain: Promise<void>;
    };
    sharing.encounterShared.set(true);
    publisher.sheetRevision.and.returnValue(1);
    sharing.fogRects.set([{ id: 'new-fog', x: 0, y: 0, width: 400, height: 400 }]);
    sharing.persist(); fixture.destroy();
    publisher.sheetRevision.and.returnValue(2);
    await sharing.sharingChain;
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const snapshot: SharingSnapshot = publisher.publish.calls.mostRecent().args[2];
    expect(snapshot.fog).toEqual([jasmine.objectContaining({ x: 0, y: 0, width: 400, height: 400 })]);
    expect(snapshot.sheetRevision).toBe(1);
    expect(publisher.publish.calls.mostRecent().args[3]()).toBeTrue();
  });
  it('retira la publicación si falla la actualización final, sin borrar el guardado local', async () => {
    publisher.publish.and.rejectWith(new Error('Sin conexión durante la composición'));
    const sharing = fixture.componentInstance as unknown as { encounterShared: WritableSignal<boolean>; persist(): void; sharingChain: Promise<void>; };
    sharing.encounterShared.set(true); sharing.persist(); fixture.destroy(); await sharing.sharingChain;
    expect(publisher.unshare).toHaveBeenCalledWith('vtt-selection-test', key(), 0);
    expect(localStorage.getItem(key())).not.toBeNull();
  });
  it('retirar un encuentro con visión inválida se completa aunque se destruya inmediatamente el tablero', async () => {
    const sharing = fixture.componentInstance as unknown as { encounterShared: WritableSignal<boolean>; visionStorageBlocked: boolean; toggleEncounterSharing(): void; sharingChain: Promise<void>; };
    sharing.encounterShared.set(true); sharing.visionStorageBlocked = true;
    sharing.toggleEncounterSharing(); fixture.destroy(); await sharing.sharingChain;
    expect(publisher.unshare).toHaveBeenCalledWith('vtt-selection-test', key());
    expect(publisher.publish).not.toHaveBeenCalled();
  });
  function pointer(target: HTMLElement, type: string, x: number, y: number, options: PointerEventInit = {}): void {
    const bounds = map.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, button: 0,
      clientX: bounds.left + x * board.zoom(), clientY: bounds.top + y * board.zoom(), ...options }));
    fixture.detectChanges();
  }
  function clickToken(id: string, options: PointerEventInit = {}): void {
    const t = board.tokens().find((item) => item.instanceId === id)!;
    pointer(button(id), 'pointerdown', t.x + 10, t.y + 10, options);
    pointer(map, 'pointerup', t.x + 10, t.y + 10, options);
    button(id).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, ...options }));
    fixture.detectChanges();
  }
  function rectangle(x1: number, y1: number, x2: number, y2: number, options: PointerEventInit = {}): void {
    pointer(map, 'pointerdown', x1, y1, options);
    pointer(map, 'pointermove', x2, y2, options);
    pointer(map, 'pointerup', x2, y2, options);
  }

  function doubleClickToken(id: string, options: PointerEventInit = {}): HTMLDialogElement {
    clickToken(id, options); clickToken(id, options);
    button(id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2, ...options }));
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.token-sheet-dialog');
  }

  function actorFor(id: string, actorId: string): void {
    board.tokens.update((tokens) => tokens.map((t) => t.instanceId === id ? { ...t, actorId } : t));
    fixture.detectChanges();
  }

  function playerSheet(): EditablePlayerSheet {
    const generic = sheets.genericNpcs()[0];
    return { ...generic, id: 'custom-pj', name: 'PJ editado', ancestry: 'Humana', className: 'Exploradora',
      subclass: 'Cazadora', background: 'Viajera', hook: 'Ficha compartida', level: 5, feat: 'Alerta',
      features: ['Rasgo propio'], hitPoints: 53, skills: ['Supervivencia +8'] };
  }

  it('abre la ficha genérica por doble clic, separa PG de combate y devuelve el foco al cerrar', async () => {
    const generic = sheets.genericNpcs()[0];
    actorFor('A', `generic:${generic.id}`);
    const before = board.tokens().map((t) => ({ ...t }));
    const write = spyOn(localStorage, 'setItem').and.callThrough();
    const dialog = doubleClickToken('A');
    expect(dialog.open).toBeTrue();
    expect(dialog.textContent).toContain(generic.name);
    expect(dialog.textContent).toContain('Ataques');
    expect(dialog.querySelector('.token-sheet-combat')!.textContent).toContain('7 / 20 PG');
    expect(dialog.querySelector('.token-sheet-stats')!.textContent).toContain(String(generic.hitPoints));
    expect(board.tokens()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    const closed = new Promise<void>((resolve) => dialog.addEventListener('close', () => resolve(), { once: true }));
    (dialog.querySelector('[aria-label="Cerrar ficha"]') as HTMLButtonElement).click();
    await closed;
    expect(dialog.open).toBeFalse();
    expect(document.activeElement).toBe(button('A'));
    expect(board.selectedTokenIds()).toEqual(['A']);
  });

  it('consulta la ficha de PJ editada y la actualiza sin alterar los PG del token colocado', () => {
    const player = playerSheet();
    sheets.savePlayer(player, 'create');
    actorFor('A', 'player:custom-pj');
    const dialog = doubleClickToken('A');
    expect(dialog.textContent).toContain('PJ editado');
    expect(dialog.textContent).toContain('Supervivencia +8');
    expect(dialog.querySelector('.token-sheet-stats')!.textContent).toContain('53');
    sheets.savePlayer({ ...player, hitPoints: 72, skills: ['Percepción +9'] }, 'edit');
    fixture.detectChanges();
    expect(dialog.querySelector('.token-sheet-stats')!.textContent).toContain('72');
    expect(dialog.textContent).toContain('Percepción +9');
    expect(dialog.querySelector('.token-sheet-combat')!.textContent).toContain('7 / 20 PG');
    expect(board.tokens()[0].hp).toBe(7);
  });

  it('muestra ausencia de estadísticas sin presentar ceros como datos de la ficha', () => {
    sheets.savePlayer({ ...playerSheet(), statisticsRecorded: false, hitPoints: 0 }, 'create');
    actorFor('A', 'player:custom-pj');
    const dialog = doubleClickToken('A');
    expect(dialog.textContent).toContain('Estadísticas sin registrar');
    expect(dialog.querySelector('.token-sheet-stats')).toBeNull();
    expect(dialog.querySelector('.token-sheet-abilities')).toBeNull();
  });

  it('resuelve PNJs por campaña y cierra la ficha al cambiar de tablero', async () => {
    const stats: GameStatBlock = { ...playerSheet(), hitPoints: 41 };
    sheets.saveCampaignNpc('vtt-selection-test', { id: 'custom-guide', name: 'Guía propio', summary: 'De esta campaña',
      tags: [], role: 'Guía', faction: 'Libre', motivation: 'Viajar', statBlock: stats }, 'create');
    sheets.saveCampaignNpc('other-selection-test', { id: 'custom-guide', name: 'Guía ajeno', summary: '',
      tags: [], role: 'Guía', faction: '', motivation: '' }, 'create');
    actorFor('A', 'npc:custom-guide');
    const dialog = doubleClickToken('A');
    expect(dialog.textContent).toContain('Guía propio');
    expect(dialog.textContent).not.toContain('Guía ajeno');
    expect(dialog.querySelector('.token-sheet-stats')!.textContent).toContain('41');
    routeParams.next(params('other-selection-test'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(dialog.open).toBeFalse();
  });

  it('informa de una ficha de origen ausente y bloquea los atajos destructivos del tablero en el diálogo', () => {
    const dialog = doubleClickToken('A');
    expect(dialog.textContent).toContain('No se encuentra la ficha de origen');
    expect(dialog.querySelector('.token-sheet-stats')).toBeNull();
    dialog.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
    expect(board.tokens().length).toBe(3);
    expect(board.selectedTokenIds()).toEqual(['A']);
  });

  it('no abre con modificadores, tras un arrastre ni con las herramientas de dibujo; ofrece botón accesible', () => {
    expect(doubleClickToken('A', { ctrlKey: true }).open).toBeFalse();
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointerup', GRID * 3 + 10, GRID * 3 + 10);
    clickToken('A');
    button('A').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBeFalse();
    (fixture.nativeElement.querySelector('button[title="Medir distancias"]') as HTMLButtonElement).click();
    expect(doubleClickToken('A').open).toBeFalse();
    (fixture.nativeElement.querySelector('button[title="Seleccionar y mover fichas"]') as HTMLButtonElement).click();
    clickToken('A');
    (fixture.nativeElement.querySelector('.open-token-sheet') as HTMLButtonElement).click();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
  });

  it('añade y quita con Mayús, Ctrl o Meta; el clic simple vuelve a una ficha', () => {
    clickToken('A'); clickToken('B', { shiftKey: true });
    expect(board.selectedTokenIds()).toEqual(['A', 'B']);
    expect(button('A').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.token-inspector input').length).toBe(0);
    clickToken('A', { ctrlKey: true });
    expect(board.selectedTokenIds()).toEqual(['B']);
    clickToken('C', { metaKey: true }); clickToken('B');
    expect(board.selectedTokenIds()).toEqual(['B']);
  });

  it('selecciona por área en sentido inverso y suma otra área con Mayús respetando el zoom', () => {
    rectangle(GRID * 5.5, GRID * 3.5, GRID * 1.5, GRID * 1.5);
    expect(board.selectedTokenIds()).toEqual(['A', 'B']);
    rectangle(GRID * 7.5, GRID * 5.5, GRID * 10.5, GRID * 8.5, { shiftKey: true });
    expect(board.selectedTokenIds()).toEqual(['A', 'B', 'C']);
    rectangle(0, 0, 0, 0);
    expect(board.selectedTokenIds()).toEqual([]);
  });

  it('mueve el grupo en vivo y guarda una vez con ajuste a cuadrícula sin alterar combate ni otras fichas', () => {
    clickToken('A'); clickToken('B', { ctrlKey: true });
    board.activeTurnId.set('C');
    const before = board.tokens().map((t) => ({ ...t }));
    const write = spyOn(localStorage, 'setItem').and.callThrough();
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', GRID * 3 + 14, GRID * 3 + 14);
    expect(board.tokens()[0].x).toBeCloseTo(before[0].x + GRID + 4);
    expect(board.tokens()[1].x - board.tokens()[0].x).toBeCloseTo(GRID * 2);
    expect(write).not.toHaveBeenCalled();
    pointer(map, 'pointerup', GRID * 3 + 14, GRID * 3 + 14);
    expect(board.selectedTokenIds()).toEqual(['A', 'B']);
    expect(board.tokens()[0].x).toBeCloseTo(GRID * 3);
    expect(board.tokens()[1].y).toBeCloseTo(GRID * 3);
    expect(board.tokens()[2]).toEqual(before[2]);
    expect(board.tokens()[0].hp).toBe(7);
    expect(board.activeTurnId()).toBe('C');
    expect(write.calls.count()).toBe(1);
    expect(JSON.parse(localStorage.getItem(key())!).tokens).toEqual(board.tokens());
  });

  it('limita el grupo entero en los cuatro bordes sin perder formación, incluso con fichas grandes', () => {
    board.tokens.set([token('A', 0, 0), token('B', 1433.6, 921.6, 2)]);
    fixture.detectChanges();
    clickToken('A'); clickToken('B', { shiftKey: true });
    const before = board.tokens().map((t) => ({ ...t }));
    pointer(button('A'), 'pointerdown', 10, 10);
    pointer(map, 'pointermove', 600, 600);
    pointer(map, 'pointerup', 600, 600);
    expect(board.tokens()[0].x).toBeCloseTo(0);
    expect(board.tokens()[1].x).toBeCloseTo(before[1].x);
    pointer(button('B'), 'pointerdown', 1440, 930);
    pointer(map, 'pointerup', 0, 0);
    expect(board.tokens()[0].x).toBeCloseTo(0);
    expect(board.tokens()[1].y).toBeCloseTo(before[1].y);
  });

  it('cancelar o perder la captura restaura posiciones y no escribe un movimiento parcial', () => {
    clickToken('A'); clickToken('B', { shiftKey: true });
    const before = board.tokens().map((t) => ({ ...t }));
    const write = spyOn(localStorage, 'setItem').and.callThrough();
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', GRID * 5, GRID * 5);
    pointer(map, 'pointercancel', GRID * 5, GRID * 5);
    expect(board.tokens()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', GRID * 5, GRID * 5);
    pointer(map, 'lostpointercapture', GRID * 5, GRID * 5);
    expect(board.tokens()).toEqual(before);
  });

  it('ignora otros punteros y Esc cancela un arrastre en curso', () => {
    clickToken('A');
    const before = board.tokens().map((t) => ({ ...t }));
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', 500, 500, { pointerId: 8 });
    pointer(map, 'pointerup', 500, 500, { pointerId: 8 });
    expect(board.tokens()).toEqual(before);
    pointer(map, 'pointermove', 500, 500);
    map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(board.tokens()).toEqual(before);
    expect(board.selectedTokenIds()).toEqual([]);
  });

  it('oculta, muestra y elimina solo la selección, conservando el turno de otra ficha', () => {
    clickToken('A'); clickToken('B', { shiftKey: true });
    board.activeTurnId.set('C');
    const action = (label: string) => (Array.from(fixture.nativeElement.querySelectorAll('.token-inspector button')) as HTMLButtonElement[]).find((b) => b.textContent?.trim() === label)!.click();
    action('Ocultar'); fixture.detectChanges();
    expect(board.tokens().map((t) => t.hidden)).toEqual([true, true, false]);
    action('Mostrar'); fixture.detectChanges();
    expect(board.tokens().every((t) => !t.hidden)).toBeTrue();
    action('Eliminar'); fixture.detectChanges();
    expect(board.tokens().map((t) => t.instanceId)).toEqual(['C']);
    expect(board.activeTurnId()).toBe('C');
    expect(board.selectedTokenIds()).toEqual([]);
  });

  it('admite selección con teclado y Ctrl+A dentro del mapa, sin interceptar formularios', () => {
    button('A').click();
    button('B').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    fixture.detectChanges();
    expect(board.selectedTokenIds()).toEqual(['A', 'B']);
    map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'a' }));
    expect(board.selectedTokens().length).toBe(3);
    const input = fixture.nativeElement.querySelector('.token-search input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
    expect(board.tokens().length).toBe(3);
    map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
    expect(board.tokens()).toEqual([]);
  });

  it('conserva las partidas antiguas y no traslada selección ni posiciones entre tableros', async () => {
    clickToken('A'); clickToken('B', { shiftKey: true });
    const saved = { tokens: board.tokens(), fogRects: [{ id: 'fog', x: 0, y: 0, width: 51.2, height: 51.2 }],
      layers: { grid: true, fog: true, tokens: true, labels: true }, zoom: 0.5, activeTurnId: 'B' };
    localStorage.setItem(key(), JSON.stringify(saved));
    routeParams.next(params('other-selection-test'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(board.tokens()).toEqual([]);
    expect(board.selectedTokenIds()).toEqual([]);
    routeParams.next(params());
    fixture.detectChanges(); await fixture.whenStable();
    expect(board.tokens()).toEqual(saved.tokens);
    expect(board.activeTurnId()).toBe('B');
    expect(board.selectedTokenIds()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(key())!).fogRects).toEqual(saved.fogRects);
  });

  it('cambiar zoom durante un arrastre cancela la vista previa antes de guardar', () => {
    clickToken('A'); clickToken('B', { ctrlKey: true });
    const before = board.tokens().map((t) => ({ ...t }));
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', 500, 500);
    (fixture.nativeElement.querySelector('button[title="Acercar"]') as HTMLButtonElement).click();
    expect(board.tokens()).toEqual(before);
    expect(JSON.parse(localStorage.getItem(key())!).tokens).toEqual(before);
  });

  it('una acción secundaria no guarda posiciones provisionales al cancelar y recargar', async () => {
    clickToken('A'); clickToken('B', { shiftKey: true });
    const before = board.tokens().map((t) => ({ ...t }));
    pointer(button('A'), 'pointerdown', GRID * 2 + 10, GRID * 2 + 10);
    pointer(map, 'pointermove', 500, 500);
    const hide = (Array.from(fixture.nativeElement.querySelectorAll('.token-inspector button')) as HTMLButtonElement[])
      .find((b) => b.textContent?.trim() === 'Ocultar')!;
    hide.click(); fixture.detectChanges();
    expect(board.tokens()[0].x).not.toBe(before[0].x);
    const saved = JSON.parse(localStorage.getItem(key())!).tokens as Token[];
    expect(saved[0]).toEqual({ ...before[0], hidden: true });
    expect(saved[1]).toEqual({ ...before[1], hidden: true });
    map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    routeParams.next(params());
    fixture.detectChanges(); await fixture.whenStable();
    expect(board.tokens()).toEqual(saved);
  });

  it('mantiene los gestos de niebla, revelado y medida separados de la selección', () => {
    const mode = (title: string) => {
      (fixture.nativeElement.querySelector(`button[title="${title}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    clickToken('A'); clickToken('B', { shiftKey: true });
    mode('Cubrir una zona con niebla');
    rectangle(0, 0, GRID * 2, GRID * 2);
    expect(fixture.nativeElement.querySelectorAll('.fog-rect').length).toBe(1);
    expect(board.selectedTokenIds()).toEqual(['A', 'B']);
    mode('Descubrir una zona');
    rectangle(0, 0, GRID * 2, GRID * 2);
    expect(fixture.nativeElement.querySelectorAll('.fog-rect').length).toBe(0);
    mode('Medir distancias');
    rectangle(0, 0, GRID * 2, GRID * 2);
    expect(fixture.nativeElement.querySelector('.measure-layer text').textContent).toContain('casillas');
    mode('Seleccionar y mover fichas');
    expect(fixture.nativeElement.querySelector('.measure-layer')).toBeNull();
  });

  it('integra combate con la iniciativa y conserva el bloque inválido completo sin borrar la partida', async () => {
    const view = fixture.componentInstance as unknown as { combat: VttCombat; rollAllInitiatives(): void; startCombat(): void; setActiveTurn(id: string): void };
    actorFor('A', 'generic:guardia-veterano'); actorFor('B', 'generic:aprendiz-arcano'); actorFor('C', 'generic:guardia');
    view.rollAllInitiatives();
    expect(view.combat.state().started).toBeTrue();
    expect(view.combat.state().turnId).toBe(board.activeTurnId());
    const current = JSON.parse(localStorage.getItem(key())!);
    const corrupt = { version: 1, broken: true };
    current.combat = corrupt; localStorage.setItem(key(), JSON.stringify(current));
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.combat.error()).toContain('no es válido');
    expect(board.tokens().length).toBe(3);
    expect(JSON.parse(localStorage.getItem(key())!).combat).toEqual(corrupt);
  });
  it('Atacar selecciona el objetivo por clic sin moverlo y abre solo la reacción', () => {
    const view = fixture.componentInstance as any;
    actorFor('A', 'generic:guardia-veterano'); actorFor('B', 'generic:aprendiz-arcano');
    view.tokens.update((list: Token[]) => list.map((t) => t.instanceId === 'B' ? { ...t, x: GRID * 3, hp: 14, maxHp: 14, conditions: [], side: 'enemy' } : { ...t, conditions: [], side: 'party' }));
    view.setActiveTurn('A'); view.startCombat(); view.setSidebarTab('turns');
    const owner = view.combat.find('B'); const shield = owner.reactions.find((r: any) => r.name === 'Escudo');
    view.combat.configure('B', { ...shield, reviewed: true, resourceConfirmed: true, cost: { resourceId: 'magic', amount: 1 } }, { id: 'magic', name: 'Usos de Escudo', maximum: 3 }, 3);
    spyOn(Math, 'random').and.returnValue(.4);
    view.beginAttack('A'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
    const before = board.tokens().map((t) => ({ id: t.instanceId, x: t.x, y: t.y })); clickToken('B');
    expect(board.tokens().map((t) => ({ id: t.instanceId, x: t.x, y: t.y }))).toEqual(before);
    const sword = Array.from(fixture.nativeElement.querySelectorAll('app-vtt-attack button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Espada larga'))!;
    sword.click(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('dialog[open]')).toBeNull();
    const confirm = Array.from(fixture.nativeElement.querySelectorAll('app-vtt-attack button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Confirmar situación'))!;
    confirm.click(); fixture.detectChanges();
    expect(view.combat.state().pending.roll.total).toBe(13); expect(view.combat.find('B').hp).toBe(14);
    const dialog = fixture.nativeElement.querySelector('app-vtt-combat dialog') as HTMLDialogElement; expect(dialog.open).toBeTrue();
    const react = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.includes('Usar Escudo'))!; react.click(); fixture.detectChanges();
    expect(dialog.open).toBeFalse(); expect(view.combat.state().pending).toBeUndefined(); expect(view.combat.find('B').hp).toBe(14);
    expect(view.combat.state().resources['B']['magic']).toBe(2);
    clickToken('B'); const nextSword = Array.from(fixture.nativeElement.querySelectorAll('app-vtt-attack button') as NodeListOf<HTMLButtonElement>).find((b) => b.textContent?.includes('Espada larga'))!;
    nextSword.click(); fixture.detectChanges();
    expect(view.combat.state().usedAttacks).toBe(2); expect(dialog.open).toBeFalse();
  });


  function boardVision(): BoardVisionState {
    return { ...emptyBoardVision(), enabled: true, obstacles: [], groups: [
      { id: 'one', name: 'Uno', observerIds: ['A', 'B'] },
      { id: 'two', name: 'Dos', observerIds: ['C'] },
    ], activeGroupId: 'one' };
  }

  function confirmedPreview(): any {
    const view = fixture.componentInstance as any;
    const source = { kind: 'director' as const, reference: 'Fixture de previsualización' };
    spyOn(sheets, 'visionProfile').and.returnValue({ version: 1, senses: [{ sense: 'normal', rangeFeet: 10, source }] });
    view.tokens.update((tokens: any[]) => tokens.map((t) => ({ ...t, conditions: [] })));
    view.setBoardVision({ ...boardVision(), groups: [{ id: 'one', name: 'Uno', observerIds: ['A'] }, { id: 'two', name: 'Dos', observerIds: ['C'] }],
      environment: { illumination: 'bright', timeOfDay: 'unknown', weather: 'clear', source } });
    return view;
  }
  it('la vista previa elimina del DOM fichas, etiquetas, PG, turnos, fichas completas y objetivos no visibles', () => {
    const view = confirmedPreview();
    clickToken('C'); board.activeTurnId.set('C'); doubleClickToken('C');
    view.tokens.update((tokens: any[]) => tokens.map((t) => t.instanceId === 'C' ? { ...t, name: 'Enemigo secreto de prueba' } : t));
    view.toggleVisionPreview(); fixture.detectChanges();
    expect(view.displayedTokens().map((t: Token) => t.instanceId)).toEqual(['A']);
    expect(fixture.nativeElement.querySelector('[data-token-instance="C"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Enemigo secreto de prueba');
    for (const selector of ['.token-library', '.turn-panel', '.token-inspector header', 'app-vtt-token-sheet', 'app-vtt-combat', 'app-vtt-attack', '.tool-group']) {
      expect(fixture.nativeElement.querySelector(selector)).withContext(selector).toBeNull();
    }
    expect(board.selectedTokenIds()).toEqual([]); expect(view.openedTokenSheet()).toBeUndefined();
    view.beginAttack('C'); view.selectAllTokens(); view.openTokenSheet('C', new MouseEvent('click'));
    map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' }));
    expect(view.attackingId()).toBeUndefined(); expect(board.selectedTokenIds()).toEqual([]); expect(board.tokens().length).toBe(3);
  });
  it('la exploración opaca prevalece aunque el director haya ocultado su capa de edición', () => {
    const view = confirmedPreview(); view.toggleLayer('fog');
    view.fogRects.set([{ id: 'unexplored', x: GRID * 2, y: GRID * 2, width: 5, height: 5 }]);
    view.toggleVisionPreview(); fixture.detectChanges();
    expect(view.displayedTokens()).toEqual([]); expect(fixture.nativeElement.querySelectorAll('.fog-rect').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.vision-layer')).not.toBeNull();
    expect(view.fogRects()).toEqual([{ id: 'unexplored', x: GRID * 2, y: GRID * 2, width: 5, height: 5 }]);
  });
  it('cambia la unión al elegir otra lista y al mover observadores sin depender del turno', () => {
    const view = confirmedPreview(); view.toggleVisionPreview(); board.activeTurnId.set('C');
    expect(view.displayedTokens().map((t: Token) => t.instanceId)).toEqual(['A']);
    view.chooseVisionGroup('two');
    expect(view.displayedTokens().map((t: Token) => t.instanceId)).toEqual(['C']);
    board.tokens.update((tokens) => tokens.map((t) => t.instanceId === 'C' ? { ...t, x: 1200, y: 900 } : t));
    expect(view.previewGeometry().circles[0].x).toBeCloseTo(1200 + GRID);
    view.toggleVisionPreview(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('.token-library')).not.toBeNull();
  });
  it('conserva listas elegidas y exploración tras recargar; el modo de dirección vuelve explícitamente', async () => {
    const view = confirmedPreview(); view.createVisionGroup('Nueva lista'); view.toggleVisionObserver('B', true);
    const fog = [{ id: 'known-fog', x: 900, y: 600, width: 20, height: 20 }]; view.fogRects.set(fog); view.persist();
    const saved = localStorage.getItem(key()); view.toggleVisionPreview();
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.visionObserverIds()).toEqual(['B']); expect(view.fogRects()).toEqual(fog);
    expect(view.visionPreview()).toBeFalse(); expect(localStorage.getItem(key())).toBe(saved);
  });
  it('muestra la lista guardada en el desplegable al abrir Visión por primera vez', () => {
    const view = confirmedPreview(); view.setSidebarTab('vision'); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('.vision-panel select') as HTMLSelectElement;
    expect(select.value).toBe('one'); expect(select.selectedOptions[0].textContent).toBe('Uno');
    view.chooseVisionGroup('two'); fixture.detectChanges(); expect(select.value).toBe('two');
  });
  it('guarda datos explícitos de vista normal en el servicio compartido sin cambiar otros sentidos', async () => {
    const view = fixture.componentInstance as any, generic = sheets.genericNpcs()[0]; actorFor('A', `generic:${generic.id}`);
    const source = { kind: 'director' as const, reference: 'Otro sentido de prueba' };
    await sheets.saveVisionProfile(campaign('vtt-selection-test'), `generic:${generic.id}`, { version: 1, senses: [{ sense: 'darkvision', rangeFeet: 30, source }] });
    await view.saveNormalVision('A', '15', false, 'Alcance registrado por el director');
    const result = sheets.visionProfile(campaign('vtt-selection-test'), `generic:${generic.id}`)!;
    expect(result.senses.find((sense) => sense.sense === 'normal')?.rangeFeet).toBe(15);
    expect(result.senses.find((sense) => sense.sense === 'darkvision')).toEqual({ sense: 'darkvision', rangeFeet: 30, source });
    await view.saveNormalVision('A', '', false, '');
    expect(sheets.visionProfile(campaign('vtt-selection-test'), `generic:${generic.id}`)).toEqual(result);
  });
  it('la luz sigue al token, se guarda por instancia y se conserva al recargar', async () => {
    const view = confirmedPreview();
    view.saveTokenLight('A', '10', '20', 'Objeto de prueba con radios confirmados');
    view.setPreviewEnvironment('illumination', 'darkness');
    expect(view.vision().effects.every((effect: any) => effect.anchorTokenId === 'A')).toBeTrue();
    expect(view.previewGeometry().circles.length).toBe(2);
    board.tokens.update((tokens) => tokens.map((token) => token.instanceId === 'A' ? { ...token, x: 400 } : token));
    expect(view.previewGeometry().circles[0].clip.x).toBeCloseTo(425.6);
    view.persist(); routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.tokenLightRange('A', 'dim')).toBe(20);
    expect(view.vision().effects[0].anchorTokenId).toBe('A');
    view.removeTokenLight('A'); expect(view.previewGeometry().circles).toEqual([]);
  });
  it('la tirada de Percepción visual aplica dos dados en penumbra y falla sin tirar en oscuridad no visible', () => {
    const view = confirmedPreview(), random = spyOn(Math, 'random').and.returnValue(.4);
    view.setPreviewEnvironment('illumination', 'dim');
    view.rollVisualPerception('A', '', '5'); expect(view.perceptionMessage()).toContain('14 (9, 9; desventaja)');
    random.calls.reset(); view.setPreviewEnvironment('illumination', 'darkness');
    view.rollVisualPerception('A', '', '5'); expect(view.perceptionMessage()).toContain('falla'); expect(random).not.toHaveBeenCalled();
  });
  it('Percepción usa las condiciones del objetivo real y no tira ante invisibilidad o condiciones desconocidas', () => {
    const view = confirmedPreview(), random = spyOn(Math, 'random').and.returnValue(.4);
    view.tokens.update((tokens: any[]) => tokens.map((t) => t.instanceId === 'B' ? { ...t, x: 102.4, y: 102.4, conditions: ['invisible'] } : t));
    view.rollVisualPerception('A', 'B', '5'); expect(view.perceptionMessage()).toContain('falla'); expect(random).not.toHaveBeenCalled();
    view.tokens.update((tokens: any[]) => tokens.map((t) => t.instanceId === 'B' ? { ...t, conditions: undefined } : t));
    view.rollVisualPerception('A', 'B', '5'); expect(view.perceptionMessage()).toContain('Faltan'); expect(random).not.toHaveBeenCalled();
  });
  it('coloca un foco desde la barra con radio explícito y coordenadas libres al aplicar zoom', () => {
    const view = fixture.componentInstance as any, before = structuredClone(board.tokens());
    (fixture.nativeElement.querySelector('[aria-label="Colocar foco de luz"]') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(view.sidebarTab()).toBe('lights'); expect(view.lightRadius()).toBe('');
    const input = fixture.nativeElement.querySelector('[aria-label="Focos de luz del escenario"] input') as HTMLInputElement;
    input.value = '15.5'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    rectangle(301.5, 204.25, 301.5, 204.25);
    const light = view.sceneLights()[0];
    expect(light.scope.x).toBeCloseTo(301.5); expect(light.scope.y).toBeCloseTo(204.25); expect(light.scope.radiusFeet).toBe(15.5);
    expect(light.illumination).toBe('bright'); expect(light.anchorTokenId).toBeUndefined();
    expect(board.tokens()).toEqual(before); expect(view.fogRects()).toEqual([]); expect(view.draftFog()).toBeUndefined();
    expect(fixture.nativeElement.querySelector('[data-light-id]')).not.toBeNull();
  });
  it('no crea luces con radio vacío, no finito, nulo, negativo o superior al límite', () => {
    const view = fixture.componentInstance as any; view.setMode('light');
    for (const radius of ['', 'Infinity', 'NaN', '0', '-1', '100001']) {
      view.lightRadius.set(radius); rectangle(400, 300, 400, 300);
      expect(view.vision().effects).toEqual([]); expect(view.visionMessage()).toContain('radio');
    }
  });
  it('cancelar un foco o cambiar de herramienta no guarda una colocación pendiente', () => {
    const view = confirmedPreview(); view.lightRadius.set('10');
    for (const cancel of ['pointercancel', 'lostpointercapture', 'Escape', 'mode', 'preview']) {
      view.setMode('light'); pointer(map, 'pointerdown', 400, 300);
      if (cancel === 'Escape') map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      else if (cancel === 'mode') view.setMode('wall');
      else if (cancel === 'preview') view.toggleVisionPreview();
      else pointer(map, cancel, 400, 300);
      pointer(map, 'pointerup', 400, 300); expect(view.vision().effects).toEqual([]);
      if (cancel === 'preview') view.toggleVisionPreview();
    }
  });
  it('edita, apaga y elimina solo el foco indicado sin modificar luces de fichas o efectos temporales', () => {
    const view = confirmedPreview(); view.saveTokenLight('A', '0', '5', 'Fuente de prueba');
    const anchored = structuredClone(view.vision().effects[0]);
    const temporary = { ...anchored, id: 'temporary', anchorTokenId: undefined, duration: { kind: 'rounds', remaining: 2 } };
    view.setBoardVision({ ...view.vision(), effects: [...view.vision().effects, temporary] });
    view.setMode('light'); view.lightRadius.set('10'); rectangle(350, 300, 350, 300); rectangle(450, 300, 450, 300);
    const [first, second] = view.sceneLights();
    view.updateSceneLight(first.id, '0', 'dim'); expect(view.sceneLights()[0].scope.radiusFeet).toBe(10);
    view.updateSceneLight(first.id, '20', 'dim'); expect(view.sceneLights()[0].scope.radiusFeet).toBe(20);
    expect(view.sceneLights()[0].illumination).toBe('dim'); expect(view.sceneLights()[1]).toEqual(second);
    view.changeSceneLight(first.id); expect(view.sceneLights()[0].active).toBeFalse();
    view.changeSceneLight(first.id); expect(view.sceneLights()[0].active).toBeTrue();
    view.changeSceneLight(first.id, true); expect(view.sceneLights()).toEqual([second]);
    expect(view.vision().effects.slice(0, 2)).toEqual([anchored, temporary]);
  });
  it('los focos iluminan en oscuridad pero sus controles y círculos no aparecen en previsualización', () => {
    const view = confirmedPreview(); view.setPreviewEnvironment('illumination', 'darkness');
    expect(view.previewGeometry().circles).toEqual([]);
    view.setMode('light'); view.lightRadius.set('5'); rectangle(128, 128, 128, 128);
    const id = view.sceneLights()[0].id; expect(view.previewGeometry().circles.length).toBeGreaterThan(0);
    view.changeSceneLight(id); expect(view.previewGeometry().circles).toEqual([]); view.changeSceneLight(id);
    view.toggleVisionPreview(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.scene-light-layer')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Colocar foco de luz"]')).toBeNull();
    view.updateSceneLight(id, '90', 'dim'); view.changeSceneLight(id, true); view.setMode('light');
    expect(view.sceneLights()[0].scope.radiusFeet).toBe(5); expect(view.mode()).toBe('pan');
  });
  it('los focos se conservan al recargar y avanzar tiempo, con independencia de la campaña', async () => {
    const view = confirmedPreview(); view.setMode('light'); view.lightRadius.set('12'); rectangle(600, 450, 600, 450);
    view.advanceVisionTime('rounds', '10'); const light = structuredClone(view.sceneLights()[0]);
    routeParams.next(params('other-selection-test')); fixture.detectChanges(); await fixture.whenStable();
    expect(view.sceneLights()).toEqual([]);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.sceneLights()).toEqual([light]); expect(light.active).toBeTrue();
  });
  it('dibuja una puerta desde la barra, la abre y persiste el tiempo y expiración', async () => {
    const view = confirmedPreview();
    (fixture.nativeElement.querySelector('[aria-label="Dibujar puerta"]') as HTMLButtonElement).click(); fixture.detectChanges();
    rectangle(100, 0, 100, 300); expect(view.vision().obstacles[0].open).toBeFalse();
    view.changeVisionObstacle(view.vision().obstacles[0].id); expect(view.vision().obstacles[0].open).toBeTrue();
    view.setVisionGameTime('4', '1439', 'night'); view.advanceVisionTime('rounds', '10');
    expect(view.vision().environment.gameTime).toEqual({ day: 5, minuteOfDay: 0, second: 0 });
    const saved = localStorage.getItem(key()); routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(localStorage.getItem(key())).toBe(saved); expect(view.vision().obstacles[0].name).toBe('Puerta 1');
  });
  it('dibuja paredes y ventanas sin coordenadas ni ajuste a casillas y conserva tokens y niebla', () => {
    const view = fixture.componentInstance as any;
    view.fogRects.set([{ id: 'keep', x: 3, y: 4, width: 15, height: 20 }]);
    const before = structuredClone(board.tokens());
    for (const mode of ['wall', 'window']) { view.setMode(mode); rectangle(301.5, 204.25, 455.5, 307.75); }
    const [wall, window] = view.vision().obstacles;
    expect(wall.start.x).toBeCloseTo(301.5); expect(wall.end.y).toBeCloseTo(307.75);
    expect(wall.blocksSight).toBeTrue(); expect(window.blocksSight).toBeFalse(); expect(window.blocksEffect).toBeTrue();
    expect(view.sidebarTab()).toBe('geometry'); expect(board.tokens()).toEqual(before); expect(view.fogRects()[0].id).toBe('keep');
    expect(fixture.nativeElement.querySelector('[data-vision-obstacle-form]')).toBeNull();
  });
  it('cancelar, perder el puntero o cambiar de herramienta no guarda borradores ni líneas de un clic', () => {
    const view = fixture.componentInstance as any;
    for (const cancel of ['pointercancel', 'lostpointercapture', 'Escape', 'mode', 'preview']) {
      const ready = cancel === 'preview' ? confirmedPreview() : view;
      ready.setMode('wall'); pointer(map, 'pointerdown', 300, 200); pointer(map, 'pointermove', 500, 400);
      expect(ready.draftObstacle()).toBeDefined();
      if (cancel === 'Escape') map.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      else if (cancel === 'mode') ready.setMode('door');
      else if (cancel === 'preview') ready.toggleVisionPreview();
      else pointer(map, cancel, 500, 400);
      expect(ready.draftObstacle()).toBeUndefined(); expect(ready.vision().obstacles ?? []).toEqual([]);
      if (cancel === 'preview') ready.toggleVisionPreview();
    }
    view.setMode('wall'); rectangle(400, 400, 400, 400); expect(view.vision().obstacles ?? []).toEqual([]);
  });
  it('solo el puntero iniciador termina el segmento y usa el punto final aunque no haya pointermove', () => {
    const view = fixture.componentInstance as any; view.setMode('window');
    pointer(map, 'pointerdown', 400, 400); pointer(map, 'pointerup', 700, 500, { pointerId: 8 });
    expect(view.vision().obstacles).toBeUndefined();
    pointer(map, 'pointerup', 650, 450); expect(view.vision().obstacles[0].end).toEqual({ x: 650, y: 450 });
  });
  it('dirección ve todos los trazados; la previsualización solo contiene puertas recortadas y no permite editarlas', () => {
    const view = confirmedPreview();
    for (const mode of ['wall', 'window', 'door', 'door']) {
      view.setMode(mode); view.doorHasWindow.set(view.vision().obstacles.length === 3); rectangle(300, 40, 300, 160);
    }
    fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('[data-obstacle-id]').length).toBe(4);
    const door = view.vision().obstacles[3]; expect(door.kind).toBe('door-window'); expect(door.blocksSight).toBeFalse();
    view.changeVisionObstacle(door.id); expect(view.vision().obstacles[3].open).toBeTrue();
    view.toggleVisionPreview(); fixture.detectChanges();
    const lines = Array.from(fixture.nativeElement.querySelectorAll('[data-obstacle-kind]') as NodeListOf<SVGLineElement>);
    expect(lines.map((line) => line.getAttribute('data-obstacle-kind'))).toEqual(['door', 'door-window']);
    expect(lines[0].parentElement?.getAttribute('mask')).toContain('-doors)');
    view.changeVisionObstacle(door.id, true); view.setDoorWindow(door.id, false);
    expect(view.vision().obstacles[3].kind).toBe('door-window'); expect(view.vision().obstacles.length).toBe(4);
  });
  it('convierte una puerta existente en acristalada sin perder sus puntos, estado ni otros obstáculos', async () => {
    const view = fixture.componentInstance as any; view.setMode('door'); rectangle(700, 200, 800, 220);
    const original = structuredClone(view.vision().obstacles[0]); view.setDoorWindow(original.id, true);
    expect(view.vision().obstacles[0]).toEqual({ ...original, kind: 'door-window', blocksSight: false });
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision().obstacles[0].kind).toBe('door-window'); expect(view.vision().obstacles[0].open).toBeFalse();
    view.setDoorWindow(original.id, false); expect(view.vision().obstacles[0]).toEqual(original);
  });
  it('migra un tablero antiguo sin alterar niebla manual ni escribir al leer', async () => {
    const view = fixture.componentInstance as any;
    view.fogRects.set([{ id: 'old-fog', x: 5, y: 6, width: 20, height: 30 }]); view.persist();
    const old = JSON.parse(localStorage.getItem(key())!); delete old.vision;
    const raw = JSON.stringify(old); localStorage.setItem(key(), raw);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision()).toEqual(emptyBoardVision()); expect(view.fogRects()).toEqual(old.fogRects);
    expect(localStorage.getItem(key())).toBe(raw);
    view.persist(); expect(JSON.parse(localStorage.getItem(key())!).fogRects).toEqual(old.fogRects);
  });
  it('guarda contactos por instancia, restaura sus controles y no los arrastra a otra ejecución', async () => {
    const view = confirmedPreview(); view.setSidebarTab('vision'); fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('[data-vision-contact-form]') as HTMLFormElement;
    for (const [name, value] of Object.entries({ surfaceId: 'suelo', airborne: 'false', moving: 'unknown', subjectKind: 'creature', source: 'Datos sintéticos' })) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    view.saveVisionContact('A', form); expect(view.vision().contacts).toEqual([{ tokenId: 'A', surfaceId: 'suelo', airborne: false, subjectKind: 'creature', source: { kind: 'director', reference: 'Datos sintéticos' } }]);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable(); view.setSidebarTab('vision'); fixture.detectChanges();
    const restored = fixture.nativeElement.querySelector('[data-vision-contact-form]') as HTMLFormElement;
    expect((restored.elements.namedItem('airborne') as HTMLSelectElement).value).toBe('false');
    expect((restored.elements.namedItem('moving') as HTMLSelectElement).value).toBe('unknown');
    routeParams.next(params('other-selection-test')); fixture.detectChanges(); await fixture.whenStable(); expect(view.vision().contacts).toBeUndefined();
  });
  it('crea un efecto desde el formulario, expira y conserva otro lanzador y la fuente al recargar', async () => {
    const view = confirmedPreview(); view.setSidebarTab('vision'); fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('[data-vision-effect-form]') as HTMLFormElement;
    for (const [name, value] of Object.entries({ name: 'Cegado de prueba', kind: 'blinded', token: 'A', duration: 'rounds', remaining: '1', concentration: 'B', source: 'Fixture sintética' })) {
      (form.elements.namedItem(name) as HTMLInputElement).value = value;
    }
    view.addVisionEffect(form); expect(view.vision().effects.length).toBe(1); expect(view.vision().effects[0].concentrationTokenId).toBe('B');
    view.finishVisionConcentration('A'); expect(view.vision().effects[0].active).toBeTrue();
    view.advanceVisionTime('rounds', '1'); expect(view.vision().effects[0].active).toBeFalse();
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable(); expect(view.vision().effects[0].duration).toEqual({ kind: 'rounds', remaining: 0 });
    expect(view.vision().effects[0].source.reference).toBe('Fixture sintética');
  });
  it('persiste listas elegidas, ignora turno/selección y aísla campaña y ejecución de encuentro', async () => {
    const view = fixture.componentInstance as any;
    view.setBoardVision(boardVision());
    board.selectedTokenIds.set(['C']); board.activeTurnId.set('C');
    expect(view.visionObserverIds()).toEqual(['A', 'B']);
    view.setBoardVision({ ...view.vision(), activeGroupId: 'two' });
    expect(view.visionObserverIds()).toEqual(['C']);
    const saved = localStorage.getItem(key());
    routeParams.next(params('other-selection-test')); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision().groups).toEqual([]);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision()).toEqual({ ...boardVision(), activeGroupId: 'two' });
    const otherRun = key().replace(':spec', ':other-run'); previous.set(otherRun, localStorage.getItem(otherRun)); localStorage.removeItem(otherRun);
    (TestBed.inject(ActivatedRoute).snapshot as any).queryParamMap = convertToParamMap({ run: 'other-run' });
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision().groups).toEqual([]); expect(localStorage.getItem(key())).toBe(saved);
  });
  it('limpia observadores al borrar un token y conserva la otra lista y la niebla', () => {
    const view = fixture.componentInstance as any;
    view.setBoardVision(boardVision()); view.fogRects.set([{ id: 'fog', x: 1, y: 1, width: 10, height: 10 }]);
    board.selectedTokenIds.set(['A']); view.removeSelectedTokens();
    expect(view.vision().groups[0].observerIds).toEqual(['B']); expect(view.vision().groups[1].observerIds).toEqual(['C']);
    expect(JSON.parse(localStorage.getItem(key())!).vision.groups[0].observerIds).toEqual(['B']);
    expect(view.fogRects().length).toBe(1);
  });
  it('conserva un estado de visión futuro o inválido y bloquea su sobrescritura', async () => {
    const view = fixture.componentInstance as any; view.persist();
    const saved = JSON.parse(localStorage.getItem(key())!); saved.vision = { ...boardVision(), version: 99 };
    const raw = JSON.stringify(saved); localStorage.setItem(key(), raw);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.vision().enabled).toBeFalse(); expect(board.tokens().length).toBe(3);
    view.persist(); expect(localStorage.getItem(key())).toBe(raw); expect(view.saveStatus()).toContain('conserva');
    expect(() => view.setBoardVision(emptyBoardVision())).toThrow();
  });
  it('rechaza una lista ajena antes de guardar y comparte el perfil de la ficha entre instancias', () => {
    const view = fixture.componentInstance as any;
    const write = spyOn(localStorage, 'setItem').and.callThrough();
    expect(() => view.setBoardVision({ ...boardVision(), groups: [{ id: 'bad', name: 'Ajena', observerIds: ['missing'] }] })).toThrow();
    expect(write).not.toHaveBeenCalled();
    const generic = sheets.genericNpcs()[0]; actorFor('A', `generic:${generic.id}`); actorFor('B', `generic:${generic.id}`);
    expect(view.tokenVisionProfiles().get('A')).toBeUndefined();
    const profile: VisionProfile = { version: 1, senses: [{ sense: 'darkvision', rangeFeet: 30, source: { kind: 'director', reference: 'Perfil sintético de prueba' } }] };
    sheets.saveVisionProfile(campaign('vtt-selection-test'), `generic:${generic.id}`, profile);
    expect(view.tokenVisionProfiles().get('A')).toEqual(profile); expect(view.tokenVisionProfiles().get('B')).toEqual(profile);
  });

  it('no arrastra el aviso de visión inválida a un tablero guardado válido', async () => {
    const view = fixture.componentInstance as any; view.persist();
    const base = JSON.parse(localStorage.getItem(key())!);
    localStorage.setItem(key(), JSON.stringify({ ...base, vision: { version: 99 } }));
    const original = localStorage.getItem(key());
    localStorage.setItem(key('other-selection-test'), JSON.stringify({ ...base, vision: emptyBoardVision() }));
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    expect(view.saveStatus()).toContain('no se guardarán');
    routeParams.next(params('other-selection-test')); fixture.detectChanges(); await fixture.whenStable();
    expect(view.saveStatus()).toBe('Guardado'); view.persist();
    expect(localStorage.getItem(key())).toBe(original);
    expect(JSON.parse(localStorage.getItem(key('other-selection-test'))!).vision).toEqual(emptyBoardVision());
  });
  it('solo descarta un estado de visión incompatible tras confirmar restablecer el tablero', async () => {
    const view = fixture.componentInstance as any; view.persist();
    const base = JSON.parse(localStorage.getItem(key())!);
    const original = JSON.stringify({ ...base, vision: { version: 99 } }); localStorage.setItem(key(), original);
    routeParams.next(params()); fixture.detectChanges(); await fixture.whenStable();
    const confirm = spyOn(window, 'confirm').and.returnValue(false); view.resetBoard();
    expect(localStorage.getItem(key())).toBe(original);
    confirm.and.returnValue(true); view.resetBoard();
    const reset = JSON.parse(localStorage.getItem(key())!);
    expect(reset.vision).toEqual(emptyBoardVision()); expect(reset.tokens).toEqual([]); expect(reset.fogRects).toEqual([]);
  });

});
