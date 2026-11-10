import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
export type UserRole = 'administrador' | 'director' | 'jugador';
export interface AccessUser { id: string; username: string; role: UserRole; campaigns: string[]; }
export interface AccessContext { user: () => AccessUser | null; }
export const ACCESS_CONTEXT = new InjectionToken<AccessContext | undefined>('Access context', { providedIn: 'root', factory: () => undefined });
export function accessError(error: unknown): string { return error instanceof HttpErrorResponse ? error.error?.message || 'No se puede contactar con el servidor. Conserva los cambios y vuelve a intentarlo.' : error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
@Injectable({ providedIn: 'root' })
export class AccessService implements AccessContext {
  private readonly http = inject(HttpClient);
  readonly user = signal<AccessUser | null>(null);
  private initialization?: Promise<void>;
  initialize(): Promise<void> { return this.initialization ??= firstValueFrom(this.http.get<AccessUser | null>('/api/session')).then((user) => { this.user.set(user); }).catch(() => { this.user.set(null); }); }
  async refresh(): Promise<void> { this.user.set(await firstValueFrom(this.http.get<AccessUser | null>('/api/session'))); }
  async login(username: string, password: string): Promise<void> { this.user.set(await firstValueFrom(this.http.post<AccessUser>('/api/session', { username, password }))); }
  async logout(): Promise<void> { await firstValueFrom(this.http.delete('/api/session')); this.user.set(null); window.location.assign('/login'); }
  home(): string { return this.user()?.role === 'administrador' ? '/usuarios' : '/'; }
}
export const accessGuard: CanActivateFn & CanActivateChildFn = async (route, state) => {
  const access = inject(AccessService), router = inject(Router);
  try { await access.refresh(); } catch { access.user.set(null); }
  const user = access.user();
  if (!user) return router.createUrlTree(['/login']);
  const path = state.url.split('?')[0];
  if (user.role === 'administrador') return path === '/usuarios' || router.parseUrl('/usuarios');
  if (path === '/usuarios') return router.parseUrl('/');
  const campaign = path.match(/^\/(?:campanas|vtt)\/([^/]+)/)?.[1];
  if (campaign && !user.campaigns.includes(decodeURIComponent(campaign))) return router.parseUrl('/');
  if (user.role === 'jugador') {
    const allowed = /^\/$|^\/(?:hechizos|dotes|habilidades|equipo|rasgos-clase)(?:\/[^/]+)?$|^\/campanas\/[^/]+\/(?:fichas-pjs|encuentros)$|^\/error-campana$/;
    if (!allowed.test(path)) return router.parseUrl('/');
  }
  return true;
};

@Injectable()
export class CampaignRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return future.paramMap.keys.length === current.paramMap.keys.length && future.paramMap.keys.every((key) => future.paramMap.get(key) === current.paramMap.get(key)) && super.shouldReuseRoute(future, current);
  }
}
