import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-toolbar',
  imports: [RouterLink],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class ToolbarComponent {
  private readonly router = inject(Router);

  protected readonly term = signal('');
  protected readonly campaignId = signal(this.campaignIdFromUrl(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.campaignId.set(this.campaignIdFromUrl(event.urlAfterRedirects));
      });
  }

  protected updateTerm(value: string): void {
    this.term.set(value);
  }

  protected submitSearch(event: SubmitEvent): void {
    event.preventDefault();

    const query = this.term().trim();
    const campaignId = this.campaignId();
    if (!campaignId) return;

    void this.router.navigate(['/campanas', campaignId, 'buscar'], {
      queryParams: query ? { q: query } : {},
    });
  }

  private campaignIdFromUrl(url: string): string | undefined {
    return url.match(/^\/campanas\/([^/?#]+)/)?.[1];
  }
}
