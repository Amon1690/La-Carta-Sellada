import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EncounterView } from '../../core/services/encounter-sharing';
import { PlayerEncounters } from './player-encounters';

describe('Encuentro del jugador sincronizado', () => {
  let fixture: ComponentFixture<PlayerEncounters>, http: HttpTestingController;
  const base = '/api/campaigns/one/encounters';
  const detail = (): EncounterView => ({ id: 'board', title: 'Encuentro de prueba', updatedAt: '2026-11-08T00:00:00Z', characters: [{ instanceId: 'hero', name: 'Héroe' }],
    observerId: 'hero', image: 'data:image/png;base64,test', pending: false, revision: 1, directorOnline: true, weather: 'rain', actionPending: false,
    controls: { position: { x: 51.2, y: 51.2, size: 1 }, canMove: true, canAttack: true, cells: [31, 32, 33],
      targets: [{ id: 'enemy', name: 'Adversario visible', x: 102.4, y: 51.2, size: 1 }], attacks: [{ source: 'sword', name: 'Espada', targetIds: ['enemy'] }] } });
  function flushView(value = detail()): void {
    http.expectOne(base).flush([{ id: value.id, title: value.title, characters: value.characters, updatedAt: value.updatedAt }]);
    http.expectOne((request) => request.url.startsWith(`${base}/board?observer=hero`)).flush(value);
    fixture.detectChanges();
  }
  beforeEach(() => {
    jasmine.clock().install();
    const paramMap = convertToParamMap({ campaignId: 'one' }), queryParamMap = convertToParamMap({ encuentro: 'board' });
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(paramMap), queryParamMap: of(queryParamMap), snapshot: { paramMap, queryParamMap } } },
    ] });
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(PlayerEncounters);
    fixture.detectChanges(); jasmine.clock().tick(0); flushView();
  });
  afterEach(() => { fixture.destroy(); http.verify(); jasmine.clock().uninstall(); });
  const button = (name: string): HTMLButtonElement => [...fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>].find((button) => button.textContent?.trim() === name)!;
  it('actualiza turno y permisos cada segundo sin descargar de nuevo ni borrar la imagen', () => {
    const image = fixture.nativeElement.querySelector('.player-board img').getAttribute('src');
    jasmine.clock().tick(1000);
    const next = detail(); next.unchanged = true; delete (next as Partial<EncounterView>).image;
    next.controls!.canMove = false; next.controls!.canAttack = false;
    next.controls!.attacks = [];
    flushView(next);
    expect(button('Mover tu token').disabled).toBeTrue();
    expect(button('Atacar').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.player-board img').getAttribute('src')).toBe(image);
  });
  it('envía solo una acción del personaje con revisión y espera su resultado', async () => {
    const view = fixture.componentInstance as any;
    const sending = view.sendAction(detail(), { type: 'move', cell: 32 });
    view.sendAction(detail(), { type: 'move', cell: 33 });
    const request = http.expectOne(`${base}/board/actions`);
    expect(request.request.body).toEqual(jasmine.objectContaining({ observerId: 'hero', revision: 1, type: 'move', cell: 32 }));
    expect(request.request.body.hp).toBeUndefined();
    const id = request.request.body.id; request.flush({ pending: true, id }); await sending;
    const next = detail(); next.revision = 3; next.receipt = { id, status: 'applied', message: 'Token movido.' }; next.controls!.position.x = 102.4;
    flushView(next);
    expect(view.waitingId()).toBe(''); expect(fixture.nativeElement.textContent).toContain('Token movido.');
  });
  it('mantiene acciones a la izquierda y recibe el relato en directo sin recrear entradas anteriores', () => {
    expect(fixture.nativeElement.querySelector('.action-dock').contains(button('Atacar'))).toBeTrue();
    expect(button('Mover tu token').disabled).toBeFalse(); expect(button('Atacar').disabled).toBeFalse();
    button('Atacar').click(); fixture.detectChanges();
    expect(button('Confirmar ataque').disabled).toBeTrue();
    jasmine.clock().tick(1000);
    const next = detail(); next.combatLog = [{ id: 'miss', text: 'El bandido ataca a Valian Foregon. Su ataque falla.' }]; flushView(next);
    const first = fixture.nativeElement.querySelector('[role=log] p');
    jasmine.clock().tick(1000); next.combatLog.push({ id: 'hit', text: 'El bandido ataca a Valian Foregon y le hace 14 de daño.' }); flushView(next);
    expect(fixture.nativeElement.querySelectorAll('[role=log] p').length).toBe(2);
    expect(fixture.nativeElement.querySelector('[role=log] p')).toBe(first);
    expect(fixture.nativeElement.querySelector('[role=log]').textContent).toContain('14 de daño');
  });
  it('el ataque usa un ataque preparado y un objetivo visible, sin enviar tiradas ni daño', async () => {
    const view = fixture.componentInstance as any;
    const sending = view.sendAction(detail(), { type: 'attack', source: 'sword', targetId: 'enemy' });
    const request = http.expectOne(`${base}/board/actions`);
    expect(request.request.body.source).toBe('sword'); expect(request.request.body.targetId).toBe('enemy');
    expect(request.request.body.roll).toBeUndefined(); expect(request.request.body.damage).toBeUndefined();
    request.flush({ message: 'El turno ha cambiado.' }, { status: 403, statusText: 'Forbidden' }); await sending; flushView();
    expect(fixture.nativeElement.textContent).toContain('El turno ha cambiado.');
  });
  it('las flechas no saltan del borde derecho al izquierdo de otra fila ni viceversa', () => {
    const view = fixture.componentInstance as any;
    const send = spyOn(view, 'sendAction').and.resolveTo();
    const right = detail(); right.controls!.position.x = 29 * 51.2; right.controls!.cells = Array.from({ length: 600 }, (_, i) => i);
    view.tokenKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }), right);
    const left = detail(); left.controls!.position.x = 0; left.controls!.cells = right.controls!.cells;
    view.tokenKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), left);
    expect(send).not.toHaveBeenCalled();
  });
  it('un arrastre sobre la imagen escalada mueve a la casilla visible correcta', () => {
    const view = fixture.componentInstance as any, send = spyOn(view, 'sendAction').and.resolveTo();
    const board = fixture.nativeElement.querySelector('.player-board') as HTMLElement;
    spyOn(board, 'getBoundingClientRect').and.returnValue({ x: 100, y: 200, left: 100, top: 200, right: 1000, bottom: 800, width: 900, height: 600, toJSON: () => ({}) });
    const token = fixture.nativeElement.querySelector('.own-token') as HTMLElement;
    token.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 145, clientY: 245 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 175, clientY: 245 }));
    expect(send).toHaveBeenCalledWith(jasmine.objectContaining({ observerId: 'hero' }), { type: 'move', cell: 32 });
  });
  it('una revocación durante la sesión retira la imagen y los controles', () => {
    jasmine.clock().tick(1000);
    http.expectOne(base).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.player-board')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('ya no está disponible');
  });
  it('tras una desconexión conserva el identificador y reintenta exactamente la misma acción', async () => {
    const view = fixture.componentInstance as any;
    const sending = view.sendAction(detail(), { type: 'move', cell: 32 });
    const request = http.expectOne(`${base}/board/actions`), original = request.request.body;
    request.error(new ProgressEvent('error')); await sending; flushView();
    expect(view.waitingId()).toBe(original.id);
    const retry = view.retryPendingAction(); const retried = http.expectOne(`${base}/board/actions`);
    expect(retried.request.body).toEqual(original);
    retried.flush({ receipt: { message: 'Token movido.' } }); await retry; flushView();
    expect(view.waitingId()).toBe('');
  });
});
