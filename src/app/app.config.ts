import { ACCESS_CONTEXT, AccessService, CampaignRouteReuseStrategy } from './core/services/access';
import { REMOTE_SHEETS, RemoteSheetsService } from './core/services/remote-sheets';
import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    { provide: ACCESS_CONTEXT, useExisting: AccessService },
    { provide: REMOTE_SHEETS, useExisting: RemoteSheetsService },
    { provide: RouteReuseStrategy, useClass: CampaignRouteReuseStrategy },
    provideRouter(routes)
  ]
};
