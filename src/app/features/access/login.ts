import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AccessService, accessError } from '../../core/services/access';
@Component({ selector: 'app-login', imports: [FormsModule], templateUrl: './login.html', styleUrl: './access.scss' })
export class Login {
  private readonly access = inject(AccessService); private readonly router = inject(Router);
  protected username = ''; protected password = ''; protected readonly busy = signal(false); protected readonly error = signal('');
  constructor() { void this.access.initialize().then(() => { if (this.access.user()) void this.router.navigateByUrl(this.access.home()); }); }
  protected async submit(event: Event): Promise<void> {
    event.preventDefault(); if (this.busy()) return; this.busy.set(true); this.error.set('');
    try { await this.access.login(this.username, this.password); this.password = ''; window.location.assign(this.access.home()); }
    catch (error) { this.error.set(accessError(error)); } finally { this.busy.set(false); }
  }
}
