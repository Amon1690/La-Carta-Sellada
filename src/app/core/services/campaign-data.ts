import { ACCESS_CONTEXT } from './access';
import { REMOTE_SHEETS, SheetCollection } from './remote-sheets';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import {
  Observable,
  filter,
  map,
  shareReplay,
  startWith,
  switchMap,
  throwError,
  of,
  tap,
} from 'rxjs';

import { Campaign, CampaignIndexEntry } from '../models/campaign';

export class CampaignNotFoundError extends Error {
  constructor(readonly campaignId: string) { super('La campaña no existe en el catálogo'); this.name = 'CampaignNotFoundError'; }
}

@Injectable({
  providedIn: 'root',
})
export class CampaignDataService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly access = inject(ACCESS_CONTEXT);
  private scope = '';
  private readonly remoteSheets = inject(REMOTE_SHEETS);
  private readonly loadedCampaigns = new Map<string, Campaign>();

  private campaigns$ = this.http
    .get<CampaignIndexEntry[]>('data/campaigns.json')
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  readonly selectedCampaignId$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
    startWith(null),
    map((url) => this.campaignIdFromUrl(url ?? this.router.url)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  getCampaigns(): Observable<CampaignIndexEntry[]> {
    this.checkScope();
    return this.campaigns$;
  }

  getCampaign(): Observable<Campaign> {
    return this.selectedCampaignId$.pipe(
      filter((id): id is string => Boolean(id)),
      switchMap((id) => this.getCampaignById(id))
    );
  }

  getDefaultCampaign(): Observable<Campaign> {
    return this.getCampaigns().pipe(
      map((campaigns) => campaigns[0]),
      filter((campaign): campaign is CampaignIndexEntry => Boolean(campaign)),
      switchMap((campaign) => this.getCampaignById(campaign.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getCampaignById(id: string): Observable<Campaign> {
    this.checkScope();
    const loaded = this.loadedCampaigns.get(id);
    if (loaded) return of(loaded);
    return this.campaigns$.pipe(
      switchMap((campaigns) => {
        const campaign = campaigns.find((entry) => entry.id === id);
        return campaign ? this.http.get<Campaign>(campaign.dataPath).pipe(tap((loaded) => this.remember(id, loaded))) : throwError(() => new CampaignNotFoundError(id));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private checkScope(): void {
    if (!this.access) return;
    const user = this.access.user();
    const scope = JSON.stringify([user?.id, user?.role, user?.campaigns]);
    if (scope !== this.scope) {
      this.scope = scope; this.loadedCampaigns.clear();
      this.campaigns$ = this.http.get<CampaignIndexEntry[]>('data/campaigns.json').pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
  }

  private remember(id: string, campaign: Campaign): void {
    const sheets = (campaign as Campaign & { sheetOverrides?: SheetCollection }).sheetOverrides;
    if (sheets) this.remoteSheets?.hydrate(id, sheets);
    this.loadedCampaigns.set(id, campaign);
  }

  private campaignIdFromUrl(url: string): string | undefined {
    return url.match(/^\/campanas\/([^/?#]+)/)?.[1];
  }
}
