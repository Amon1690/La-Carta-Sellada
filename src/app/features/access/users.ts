import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AccessService, AccessUser, UserRole, accessError } from '../../core/services/access';
interface CampaignChoice { id: string; name: string; }
@Component({ selector: 'app-users', imports: [FormsModule], templateUrl: './users.html', styleUrl: './access.scss' })
export class Users {
  protected readonly access = inject(AccessService); private readonly http = inject(HttpClient);
  protected readonly users = signal<AccessUser[]>([]); protected readonly campaigns = signal<CampaignChoice[]>([]);
  protected readonly error = signal(''); protected readonly busy = signal(false); protected readonly loaded = signal(false);
  protected editing = ''; protected username = ''; protected role: UserRole = 'jugador'; protected campaignIds: string[] = []; protected password = '';
  protected deleting?: AccessUser;
  constructor() { void this.load(); }
  private async load(): Promise<void> {
    try { const [users, campaigns] = await Promise.all([firstValueFrom(this.http.get<AccessUser[]>('/api/users')), firstValueFrom(this.http.get<CampaignChoice[]>('/api/campaigns'))]); this.users.set(users); this.campaigns.set(campaigns); this.loaded.set(true); }
    catch (error) { this.error.set(accessError(error)); }
  }
  protected reset(): void { this.editing = ''; this.username = ''; this.role = 'jugador'; this.campaignIds = []; this.password = ''; }
  protected edit(user: AccessUser): void { this.editing = user.id; this.username = user.username; this.role = user.role; this.campaignIds = [...user.campaigns]; this.password = ''; this.error.set(''); }
  protected names(ids: string[]): string { return this.campaigns().filter((c) => ids.includes(c.id)).map((c) => c.name).join(', ') || '—'; }
  protected async save(event: Event): Promise<void> {
    event.preventDefault(); if (this.busy()) return; this.busy.set(true); this.error.set('');
    try {
      const data = { username: this.username, role: this.role, campaigns: this.role === 'administrador' ? [] : this.campaignIds, password: this.password };
      if (this.editing) await firstValueFrom(this.http.put(`/api/users/${this.editing}`, data)); else await firstValueFrom(this.http.post('/api/users', data));
      if (this.editing === this.access.user()?.id) { await this.access.logout(); return; }
      this.reset(); await this.load();
    } catch (error) { this.error.set(accessError(error)); } finally { this.busy.set(false); }
  }
  protected async remove(): Promise<void> {
    if (!this.deleting || this.busy()) return; this.busy.set(true); this.error.set('');
    try { await firstValueFrom(this.http.delete(`/api/users/${this.deleting.id}`)); if (this.deleting.id === this.access.user()?.id) { await this.access.logout(); return; } this.deleting = undefined; await this.load(); }
    catch (error) { this.error.set(accessError(error)); } finally { this.busy.set(false); }
  }
  protected async logout(): Promise<void> { try { await this.access.logout(); } catch (error) { this.error.set(accessError(error)); } }
}
