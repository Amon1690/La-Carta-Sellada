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
} from 'rxjs';

import { Campaign, CampaignIndexEntry } from '../models/campaign';

@Injectable({
  providedIn: 'root',
})
export class CampaignDataService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

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

  getCampaignById(id: string): Observable<Campaign> {
    return this.campaigns$.pipe(
      map((campaigns) => campaigns.find((campaign) => campaign.id === id)),
      filter((campaign): campaign is CampaignIndexEntry => Boolean(campaign)),
      switchMap((campaign) => this.http.get<Campaign>(campaign.dataPath)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private campaignIdFromUrl(url: string): string | undefined {
    return url.match(/^\/campanas\/([^/?#]+)/)?.[1];
  }
}
