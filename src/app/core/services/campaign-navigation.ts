import { computed, inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, defer, finalize, map, of, take } from 'rxjs';
import { CampaignDataService, CampaignNotFoundError } from './campaign-data';

/** Solo representa la lectura previa a entrar en una ruta de campaña. */
@Injectable({ providedIn: 'root' })
export class CampaignNavigationState {
  private readonly pending = signal(0);
  readonly loading = computed(() => this.pending() > 0);
  begin(): void { this.pending.update((count) => count + 1); }
  end(): void { this.pending.update((count) => Math.max(0, count - 1)); }
}
export const campaignAvailable: CanActivateFn = (route, state) => {
  const data = inject(CampaignDataService), router = inject(Router), navigation = inject(CampaignNavigationState);
  const id = route.paramMap.get('campaignId') ?? '';
  return defer(() => {
    navigation.begin();
    return data.getCampaignById(id).pipe(
      take(1), map(() => true),
      catchError((error: unknown) => of(router.createUrlTree(['/error-campana'], { queryParams: {
        tipo: error instanceof CampaignNotFoundError ? 'ausente' : 'lectura', id, volver: state.url,
      } }))),
      finalize(() => navigation.end()),
    );
  });
};
