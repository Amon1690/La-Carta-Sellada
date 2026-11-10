import { accessGuard, AccessService } from './core/services/access';
import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { campaignAvailable } from './core/services/campaign-navigation';
import { CampaignError } from './features/dashboard/pages/campaign-error/campaign-error';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/access/login').then((m) => m.Login) },
  { path: 'usuarios', canActivate: [accessGuard], loadComponent: () => import('./features/access/users').then((m) => m.Users) },
  { path: 'error-campana', canActivate: [accessGuard], component: CampaignError },
  {
    path: 'vtt/:campaignId/:kind/:entryId',
    canActivate: [accessGuard, campaignAvailable],
    loadComponent: () =>
      import('./features/vtt/pages/vtt-board/vtt-board').then(
        (m) => m.VttBoard
      ),
  },
  {
    path: '',
    canActivate: [accessGuard], canActivateChild: [accessGuard],
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
        redirectTo: ''
      },
      {
        path: 'campanas/:campaignId/fichas-pjs',
        canActivate: [campaignAvailable],
        data: { section: 'players' },
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
        path: 'viajes', redirectTo: ''
      },
      {
        path: 'campanas/:campaignId/copias',
        canActivate: [campaignAvailable],
        loadComponent: () => import('./features/backups/backups').then((m) => m.Backups),
      },
      {
        path: 'campanas/:campaignId/viajes',
        canActivate: [campaignAvailable],
        loadComponent: () =>
          import('./features/travel/pages/travel-map/travel-map').then(
            (m) => m.TravelMap
          ),
      },
      {
        path: 'campanas/:campaignId/introduccion',
        canActivate: [accessGuard, campaignAvailable],
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
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'search' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/actos/:id',
        canActivate: [accessGuard, campaignAvailable],
        loadComponent: () =>
          import('./features/acts/pages/act-detail/act-detail').then(
            (m) => m.ActDetail
          ),
      },
      {
        path: 'campanas/:campaignId/actos',
        canActivate: [accessGuard, campaignAvailable],
        loadComponent: () =>
          import('./features/acts/pages/act-list/act-list').then(
            (m) => m.ActList
          ),
      },
      {
        path: 'campanas/:campaignId/personajes',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'npcs' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/tokens',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'tokens' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/jugadores',
        redirectTo: 'campanas/:campaignId/fichas-pjs',
      },
      {
        path: 'campanas/:campaignId/documentos',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'items' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/hechizos',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'spells' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/dotes',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'feats' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/habilidades',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'skills' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/equipo',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'equipment' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/lugares',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'locations' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/escenas',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'scenes' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/encuentros',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'encounters' },
        loadComponent: () =>
          inject(AccessService).user()?.role === 'jugador'
          ? import('./features/encounters/player-encounters').then((m) => m.PlayerEncounters)
          : import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/timeline',
        canActivate: [accessGuard, campaignAvailable],
        data: { section: 'timeline' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/antagonistas',
        canActivate: [accessGuard, campaignAvailable],
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
