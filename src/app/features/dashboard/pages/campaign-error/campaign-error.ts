import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({ selector: 'app-campaign-error', imports: [RouterLink], templateUrl: './campaign-error.html', styleUrl: './campaign-error.scss' })
export class CampaignError {
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly missing = computed(() => this.params()?.get('tipo') === 'ausente');
  protected readonly campaignId = computed(() => this.params()?.get('id')?.slice(0, 120) ?? '');
  protected readonly retryUrl = computed(() => {
    const value = this.params()?.get('volver') ?? '';
    return /^\/(?:campanas|vtt)\//.test(value) ? value : undefined;
  });
}
