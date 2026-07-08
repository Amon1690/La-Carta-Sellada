import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CampaignDataService } from '../../../../core/services/campaign-data';

@Component({
  selector: 'app-campaign-list',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './campaign-list.html',
  styleUrl: './campaign-list.scss',
})
export class CampaignList {
  private readonly campaignData = inject(CampaignDataService);

  protected readonly campaigns$ = this.campaignData.getCampaigns();
}
