import { CampaignDataService } from '../../core/services/campaign-data';
import { AccessService } from '../../core/services/access';
import { CampaignIndexEntry } from '../../core/models/campaign';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

interface CampaignNavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  private readonly router = inject(Router);
  protected readonly access = inject(AccessService);
  protected readonly campaigns = signal<CampaignIndexEntry[]>([]);
  protected campaignName(): string { return this.campaigns().find((c) => c.id === this.campaignId())?.name ?? 'Campaña'; }

  protected readonly campaignId = signal(this.campaignIdFromUrl(this.router.url));
  protected readonly campaignItems: CampaignNavItem[] = [
    { label: 'Introducción', path: 'introduccion' },
    { label: 'Fichas PJs', path: 'fichas-pjs' },
    { label: 'Viajes', path: 'viajes' },
    { label: 'Actos', path: 'actos' },
    { label: 'Fichas de PNJ', path: 'personajes' },
    { label: 'Tokens', path: 'tokens' },
    { label: 'Escenas', path: 'escenas' },
    { label: 'Encuentros', path: 'encuentros' },
    { label: 'Documentos', path: 'documentos' },
    { label: 'Lugares', path: 'lugares' },
    { label: 'Timeline', path: 'timeline' },
    { label: 'Antagonistas', path: 'antagonistas' },
  ];
  protected readonly ruleItems: CampaignNavItem[] = [
    { label: 'Hechizos', path: 'hechizos' },
    { label: 'Dotes', path: 'dotes' },
    { label: 'Habilidades', path: 'habilidades' },
    { label: 'Equipo', path: 'equipo' },
    { label: 'Rasgos de clase', path: 'rasgos-clase' },
    { label: 'Criaturas', path: 'criaturas' },
    { label: 'Fichas genéricas', path: 'fichas-genericas' },
    { label: 'Encuentros genéricos', path: 'encuentros-genericos' },
  ];

  constructor() {
    inject(CampaignDataService).getCampaigns().pipe(takeUntilDestroyed()).subscribe((items) => this.campaigns.set(items));
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        const id = this.campaignIdFromUrl(event.urlAfterRedirects);
        if (id || event.urlAfterRedirects === '/') this.campaignId.set(id);
      });
  }

  protected campaignPath(path: string): string[] {
    return ['/campanas', this.campaignId() ?? '', path];
  }

  private campaignIdFromUrl(url: string): string | undefined {
    return url.match(/^\/campanas\/([^/?#]+)/)?.[1];
  }
}
