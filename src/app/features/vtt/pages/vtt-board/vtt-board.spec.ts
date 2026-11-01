import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal, WritableSignal, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Campaign } from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';
import { CharacterSheetsService } from '../../../../core/services/character-sheets';
import { VttBoard } from './vtt-board';

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

  beforeEach(async () => {
    previous = new Map([key(), key('other-selection-test')].map((k) => [k, localStorage.getItem(k)]));
    previous.forEach((_, k) => localStorage.removeItem(k));
    routeParams = new BehaviorSubject(params());
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      { provide: CampaignDataService, useValue: { getCampaignById: (id: string) => of(campaign(id)) } },
      { provide: CharacterSheetsService, useValue: {
        changes$: of(0), campaignNpcs: () => [], playerSheets: () => [], genericNpcs: () => [],
      } },
      { provide: ActivatedRoute, useValue: {
        paramMap: routeParams, snapshot: { queryParamMap: convertToParamMap({ run: 'spec' }) },
      } },
    ] });
    fixture = TestBed.createComponent(VttBoard);
    fixture.detectChanges();
    await fixture.whenStable();
    board = fixture.componentInstance as unknown as Harness;
    board.zoom.set(0.5);
    board.tokens.set([token('A', GRID * 2, GRID * 2), token('B', GRID * 4, GRID * 2), token('C', GRID * 8, GRID * 6, 2)]);
    fixture.detectChanges();
    map = fixture.nativeElement.querySelector('.map-board');
    spyOn(map, 'setPointerCapture').and.stub();
    spyOn(map, 'hasPointerCapture').and.returnValue(false);
  });

  afterEach(() => {
    fixture.destroy();
    previous.forEach((value, k) => value === null ? localStorage.removeItem(k) : localStorage.setItem(k, value));
  });

  const button = (id: string): HTMLElement => fixture.nativeElement.querySelector(`.vtt-token[aria-label="${id}"]`);
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
});
