import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'vtt/:campaignId/:kind/:entryId',
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
        path: 'fichas-genericas',
        data: { section: 'generic-npcs' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/introduccion',
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
        data: { section: 'search' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/actos/:id',
        loadComponent: () =>
          import('./features/acts/pages/act-detail/act-detail').then(
            (m) => m.ActDetail
          ),
      },
      {
        path: 'campanas/:campaignId/actos',
        loadComponent: () =>
          import('./features/acts/pages/act-list/act-list').then(
            (m) => m.ActList
          ),
      },
      {
        path: 'campanas/:campaignId/personajes',
        data: { section: 'npcs' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/tokens',
        data: { section: 'tokens' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/jugadores',
        data: { section: 'players' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/documentos',
        data: { section: 'items' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/hechizos',
        data: { section: 'spells' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/dotes',
        data: { section: 'feats' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/habilidades',
        data: { section: 'skills' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/equipo',
        data: { section: 'equipment' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/lugares',
        data: { section: 'locations' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/escenas',
        data: { section: 'scenes' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/encuentros',
        data: { section: 'encounters' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/timeline',
        data: { section: 'timeline' },
        loadComponent: () =>
          import('./features/compendium/pages/compendium/compendium').then(
            (m) => m.Compendium
          ),
      },
      {
        path: 'campanas/:campaignId/antagonistas',
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
