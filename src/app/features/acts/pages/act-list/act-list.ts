import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Campaign, CampaignAct } from '../../../../core/models/campaign';
import { CampaignDataService } from '../../../../core/services/campaign-data';

@Component({
  selector: 'app-act-list',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './act-list.html',
  styleUrl: './act-list.scss',
})
export class ActList {
  private readonly campaignData = inject(CampaignDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaign$ = this.campaignData.getCampaign();
  protected readonly campaignId =
    this.route.snapshot.paramMap.get('campaignId') ?? '';

  protected sceneCount(campaign: Campaign, act: CampaignAct): number {
    return campaign.scenes.filter((scene) => scene.act === act.label).length;
  }

  protected encounterCount(campaign: Campaign, act: CampaignAct): number {
    return campaign.encounters.filter(
      (encounter) => encounter.act === act.label
    ).length;
  }
}
