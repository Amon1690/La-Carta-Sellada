import { Routes } from '@angular/router';
import { campaignAvailable } from './core/services/campaign-navigation';
import { CampaignError } from './features/dashboard/pages/campaign-error/campaign-error';

export const routes: Routes = [
  { path: 'error-campana', component: CampaignError },
  {
    path: 'vtt/:campaignId/:kind/:entryId',
    canActivate: [campaignAvailable],
    loadComponent: () =>
      import('./features/vtt/pages/vtt-board/vtt-board').then(
        (m) => m.VttBoard
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/campaign-list/campaign-list').then(
            (m) => m.CampaignList
          ),
      },
      {
        path: 'hechizos',
        data: { section: 'spells' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'dotes',
        data: { section: 'feats' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'habilidades',
        data: { section: 'skills' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'equipo',
        data: { section: 'equipment' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'rasgos-clase/:classId',
        loadComponent: () =>
          import(
            './features/class-features/pages/class-detail/class-detail'
          ).then((m) => m.ClassDetail),
      },
      {
        path: 'rasgos-clase',
        loadComponent: () =>
          import(
            './features/class-features/pages/class-list/class-list'
          ).then((m) => m.ClassList),
      },
      {
        path: 'criaturas',
        loadComponent: () =>
          import('./features/creatures/pages/creature-list/creature-list').then(
            (m) => m.CreatureList
          ),
      },
      {
        path: 'fichas-pjs',
        data: { section: 'rule-players' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'fichas-genericas',
        data: { section: 'generic-npcs' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'encuentros-genericos',
        loadComponent: () =>
          import(
            './features/generic-encounters/pages/generic-encounter-list/generic-encounter-list'
          ).then((m) => m.GenericEncounterList),
      },
      {
        path: 'viajes',
        loadComponent: () =>
          import('./features/travel/pages/travel-map/travel-map').then(
            (m) => m.TravelMap
          ),
      },
      {
        path: 'campanas/:campaignId/introduccion',
        canActivate: [campaignAvailable],
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then(
            (m) => m.Dashboard
          ),
      },
      {
        path: 'campanas/:campaignId/resumen',
        redirectTo: 'campanas/:campaignId/introduccion',
      },
      {
        path: 'campanas/:campaignId/buscar',
        canActivate: [campaignAvailable],
        data: { section: 'search' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/actos/:id',
        canActivate: [campaignAvailable],
        loadComponent: () =>
          import('./features/acts/pages/act-detail/act-detail').then(
            (m) => m.ActDetail
          ),
      },
      {
        path: 'campanas/:campaignId/actos',
        canActivate: [campaignAvailable],
        loadComponent: () =>
          import('./features/acts/pages/act-list/act-list').then(
            (m) => m.ActList
          ),
      },
      {
        path: 'campanas/:campaignId/personajes',
        canActivate: [campaignAvailable],
        data: { section: 'npcs' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/tokens',
        canActivate: [campaignAvailable],
        data: { section: 'tokens' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/jugadores',
        canActivate: [campaignAvailable],
        data: { section: 'players' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/documentos',
        canActivate: [campaignAvailable],
        data: { section: 'items' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/hechizos',
        canActivate: [campaignAvailable],
        data: { section: 'spells' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/dotes',
        canActivate: [campaignAvailable],
        data: { section: 'feats' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/habilidades',
        canActivate: [campaignAvailable],
        data: { section: 'skills' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/equipo',
        canActivate: [campaignAvailable],
        data: { section: 'equipment' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/lugares',
        canActivate: [campaignAvailable],
        data: { section: 'locations' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/escenas',
        canActivate: [campaignAvailable],
        data: { section: 'scenes' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/encuentros',
        canActivate: [campaignAvailable],
        data: { section: 'encounters' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/timeline',
        canActivate: [campaignAvailable],
        data: { section: 'timeline' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/antagonistas',
        canActivate: [campaignAvailable],
        data: { section: 'antagonists' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: '**',
        redirectTo: '',
      },
    ],
  },
];
