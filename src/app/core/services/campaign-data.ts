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
  private readonly loadedCampaigns = new Map<string, Campaign>();

  private readonly campaigns$ = this.http
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
    return this.campaigns$;
  }

  getCampaign(): Observable<Campaign> {
    return this.selectedCampaignId$.pipe(
      filter((id): id is string => Boolean(id)),
      switchMap((id) => this.getCampaignById(id))
    );
  }

  getDefaultCampaign(): Observable<Campaign> {
    return this.campaigns$.pipe(
      map((campaigns) => campaigns[0]),
      filter((campaign): campaign is CampaignIndexEntry => Boolean(campaign)),
      switchMap((campaign) => this.http.get<Campaign>(campaign.dataPath)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  getCampaignById(id: string): Observable<Campaign> {
    const loaded = this.loadedCampaigns.get(id);
    if (loaded) return of(loaded);
    return this.campaigns$.pipe(
      switchMap((campaigns) => {
        const campaign = campaigns.find((entry) => entry.id === id);
        return campaign ? this.http.get<Campaign>(campaign.dataPath).pipe(tap((loaded) => this.loadedCampaigns.set(id, loaded))) : throwError(() => new CampaignNotFoundError(id));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private campaignIdFromUrl(url: string): string | undefined {
    return url.match(/^\/campanas\/([^/?#]+)/)?.[1];
  }
}
