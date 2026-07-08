import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';

import {
  CampaignAct,
  CampaignEncounter,
  CampaignScene,
} from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';

interface ActDetailViewModel {
  act: CampaignAct;
  scenes: CampaignScene[];
  encounters: CampaignEncounter[];
}

@Component({
  selector: 'app-act-detail',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './act-detail.html',
  styleUrl: './act-detail.scss',
})
export class ActDetail {
  private readonly campaignData = inject(CampaignDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaignId =
    this.route.snapshot.paramMap.get('campaignId') ?? '';

  protected campaignPath(path: string): string[] {
    return ['/campanas', this.campaignId, path];
  }

  protected vttPath(
    kind: 'scene' | 'encounter',
    id: string
  ): string {
    return `/vtt/${this.campaignId}/${kind}/${id}`;
  }

  protected readonly vm$ = combineLatest([
    this.campaignData.getCampaign(),
    this.route.paramMap,
  ]).pipe(
    map(([campaign, params]): ActDetailViewModel | undefined => {
      const act = campaign.acts.find((entry) => entry.id === params.get('id'));
      if (!act) return undefined;

      return {
        act,
        scenes: campaign.scenes
          .filter((scene) => scene.act === act.label)
          .sort((a, b) => a.order - b.order),
        encounters: campaign.encounters.filter(
          (encounter) => encounter.act === act.label
        ),
      };
    })
  );
}
