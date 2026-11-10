import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { SidebarComponent } from '../sidebar/sidebar';
import { ToolbarComponent } from '../toolbar/toolbar';
import { StatusbarComponent } from '../statusbar/statusbar';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    SidebarComponent,
    ToolbarComponent,
    StatusbarComponent,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class ShellComponent {
  private readonly router = inject(Router);
  protected readonly encounterOpen = toSignal(this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd), startWith(null),
    map(() => /^\/campanas\/[^/]+\/encuentros$/.test(this.router.url.split('?')[0]) && !!this.router.parseUrl(this.router.url).queryParams['encuentro'])
  ), { initialValue: false });
}
