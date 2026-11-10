import { AsyncPipe, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterEveryRender, Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, exhaustMap, firstValueFrom, map, merge, of, startWith, Subject, switchMap, timer } from 'rxjs';
import { accessError } from '../../core/services/access';
import { EncounterSharingService, EncounterView, SharedEncounter } from '../../core/services/encounter-sharing';
import { PlayerAttack } from '../../core/models/encounter-live';
import { WeatherOverlay } from '../vtt/components/weather-overlay';

interface EncountersViewModel { items: SharedEncounter[]; detail?: EncounterView; error: string; loading: boolean; }

@Component({
  selector: 'app-player-encounters', imports: [AsyncPipe, DatePipe, RouterLink, WeatherOverlay],
  templateUrl: './player-encounters.html', styleUrl: './player-encounters.scss',
})
export class PlayerEncounters {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sharing = inject(EncounterSharingService);
  private readonly refresh = new Subject<void>();
  protected readonly moving = signal(false);
  protected readonly attacking = signal(false);
  protected readonly targetId = signal('');
  protected readonly logOpen = signal(true);
  @ViewChild('combatLog') private combatLog?: ElementRef<HTMLElement>;
  private scrollLog = false;
  constructor() {
    afterEveryRender(() => {
      const log = this.combatLog?.nativeElement;
      if (log && this.scrollLog) { log.scrollTop = log.scrollHeight; this.scrollLog = false; }
    });
  }
  protected scrollLogToEnd(): void { this.scrollLog = true; }
  protected readonly sending = signal(false);
  protected readonly waitingId = signal('');
  protected readonly actionMessage = signal('');
  protected readonly attackSource = signal('');
  private drag?: { detail: EncounterView; board: HTMLElement; x: number; y: number };
  private pendingRequest?: { url: string; body: Record<string, unknown> };
  protected readonly vm$ = combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
    switchMap(([params, query]) => {
      const campaign = params.get('campaignId') ?? '', board = query.get('encuentro'), observer = query.get('personaje');
      let previous: EncounterView | undefined;
      this.moving.set(false); this.attacking.set(false); this.targetId.set(''); this.scrollLog = true; this.actionMessage.set(''); this.waitingId.set(''); this.attackSource.set(''); this.drag = undefined; this.pendingRequest = undefined;
      return merge(timer(0, 1000), this.refresh).pipe(
        exhaustMap(() => this.http.get<SharedEncounter[]>(this.sharing.url(campaign)).pipe(
          switchMap((items) => {
            const selected = items.find((item) => item.id === board);
            if (!board) return of<EncountersViewModel>({ items, error: '', loading: false });
            const character = selected?.characters.find((item) => item.instanceId === observer) ?? (!observer ? selected?.characters[0] : undefined);
            if (!selected || !character) { previous = undefined; return of<EncountersViewModel>({ items, error: 'Este encuentro o personaje ya no está disponible.', loading: false }); }
            const after = previous?.observerId === character.instanceId ? `&after=${previous.revision ?? 0}` : '';
            const receipt = this.waitingId() ? `&receipt=${encodeURIComponent(this.waitingId())}` : '';
            return this.http.get<EncounterView>(`${this.sharing.url(campaign, selected.id)}?observer=${encodeURIComponent(character.instanceId)}${after}${receipt}`).pipe(
              map((response): EncountersViewModel => {
                const detail = response.unchanged && previous ? { ...previous, ...response } : response;
                const log = this.combatLog?.nativeElement;
                if (previous?.combatLog?.at(-1)?.id !== detail.combatLog?.at(-1)?.id && (!log || log.scrollHeight - log.scrollTop - log.clientHeight < 48)) this.scrollLog = true;
                previous = detail;
                if (detail.receipt?.id === this.waitingId()) { this.waitingId.set(''); this.pendingRequest = undefined; this.actionMessage.set(detail.receipt.message); }
                if (!detail.controls?.canMove) this.moving.set(false);
                if (!detail.controls?.canAttack) this.attacking.set(false);
                return { items, detail, error: '', loading: false };
              })
            );
          }),
          catchError((error) => { previous = undefined; this.moving.set(false); return of<EncountersViewModel>({ items: [], error: accessError(error), loading: false }); })
        )),
        startWith<EncountersViewModel>({ items: [], error: '', loading: true })
      );
    })
  );

  protected chooseCharacter(instanceId: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { personaje: instanceId }, queryParamsHandling: 'merge' });
  }

  protected selectedAttack(detail: EncounterView): PlayerAttack | undefined {
    return detail.controls?.attacks.find((attack) => attack.source === this.attackSource()) ?? detail.controls?.attacks[0];
  }
  protected allowedTargets(detail: EncounterView) {
    const attack = this.selectedAttack(detail);
    return detail.controls?.targets.filter((target) => attack?.targetIds.includes(target.id)) ?? [];
  }
  protected busy(): boolean { return this.sending() || !!this.waitingId(); }
  protected async sendAction(detail: EncounterView, action: { type: 'move'; cell: number } | { type: 'attack'; source: string; targetId: string }): Promise<void> {
    if (this.busy()) return;
    const campaign = this.route.snapshot.paramMap.get('campaignId') ?? '';
    const id = crypto.randomUUID(); this.waitingId.set(id); this.sending.set(true); this.moving.set(false);
    this.actionMessage.set('Resolviendo la acción…');
    this.pendingRequest = { url: `${this.sharing.url(campaign, detail.id)}/actions`, body: { ...action, id, observerId: detail.observerId, revision: detail.revision ?? 0 } };
    await this.postPendingAction();
  }
  protected async retryPendingAction(): Promise<void> {
    if (!this.sending() && this.pendingRequest) { this.sending.set(true); await this.postPendingAction(); }
  }
  private async postPendingAction(): Promise<void> {
    const pending = this.pendingRequest; if (!pending) { this.sending.set(false); return; }
    try {
      const result = await firstValueFrom(this.http.post<{ receipt?: { message: string } }>(pending.url, pending.body));
      if (result.receipt) { this.waitingId.set(''); this.pendingRequest = undefined; this.actionMessage.set(result.receipt.message); }
      this.refresh.next();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        this.waitingId.set(''); this.pendingRequest = undefined; this.actionMessage.set(accessError(error));
      } else this.actionMessage.set('Se perdió la conexión. Consultaremos el resultado; puedes reintentar la misma acción sin duplicarla.');
      this.refresh.next();
    }
    finally { this.sending.set(false); }
  }
  protected attack(detail: EncounterView, targetId: string): void {
    const action = this.selectedAttack(detail);
    if (action && targetId) void this.sendAction(detail, { type: 'attack', source: action.source, targetId });
  }
  private moveAt(event: PointerEvent | MouseEvent, board: HTMLElement, detail: EncounterView): void {
    if (!detail.controls?.canMove || this.busy()) return;
    const bounds = board.getBoundingClientRect();
    const column = Math.floor((event.clientX - bounds.left) / bounds.width * 30), row = Math.floor((event.clientY - bounds.top) / bounds.height * 20);
    const cell = row * 30 + column;
    if (column < 0 || column >= 30 || row < 0 || row >= 20 || !detail.controls.cells.includes(cell)) { this.actionMessage.set('Elige una casilla visible permitida para tu token.'); return; }
    void this.sendAction(detail, { type: 'move', cell });
  }
  protected boardClick(event: MouseEvent, detail: EncounterView): void {
    if (this.moving()) this.moveAt(event, event.currentTarget as HTMLElement, detail);
  }
  protected startDrag(event: PointerEvent, detail: EncounterView): void {
    if (!detail.controls?.canMove || this.busy() || event.button !== 0) return;
    const board = (event.currentTarget as HTMLElement).closest<HTMLElement>('.player-board');
    if (board) this.drag = { detail, board, x: event.clientX, y: event.clientY };
  }
  @HostListener('window:pointerup', ['$event'])
  protected endDrag(event: PointerEvent): void {
    const drag = this.drag; this.drag = undefined;
    if (drag && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) this.moveAt(event, drag.board, drag.detail);
  }
  protected tokenKey(event: KeyboardEvent, detail: EncounterView): void {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -30, ArrowDown: 30 };
    const position = detail.controls?.position;
    if (!position || !detail.controls?.canMove || !(event.key in steps) || this.busy()) return;
    event.preventDefault();
    const column = Math.round(position.x / 51.2) + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
    const row = Math.round(position.y / 51.2) + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0);
    if (column < 0 || column >= 30 || row < 0 || row >= 20) return;
    const cell = row * 30 + column;
    if (detail.controls.cells.includes(cell)) void this.sendAction(detail, { type: 'move', cell });
  }
}
