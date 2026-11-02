import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AccessService, AccessUser, accessGuard, UserRole, CampaignRouteReuseStrategy } from './access';

describe('Permisos de navegación', () => {
  let current: ReturnType<typeof signal<AccessUser | null>>;
  beforeEach(() => {
    current = signal<AccessUser | null>(null);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AccessService, useValue: { user: current, refresh: async () => {} } }] });
  });
  const asUser = (role: UserRole) => ({ id: 'u', username: 'Prueba', role, campaigns: ['one'] });
  const enter = async (url: string) => await TestBed.runInInjectionContext(() => accessGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  it('requiere sesión incluso para direcciones escritas a mano', async () => {
    expect((await enter('/campanas/one/fichas-pjs') as UrlTree).toString()).toBe('/login');
  });
  it('administrador entra solo en gestión de usuarios', async () => {
    current.set(asUser('administrador'));
    expect(await enter('/usuarios')).toBeTrue();
    for (const url of ['/', '/hechizos', '/campanas/one/actos', '/vtt/one/scene/s']) expect((await enter(url) as UrlTree).toString()).toBe('/usuarios');
  });
  it('director usa reglas y contenido completo solo de sus campañas', async () => {
    current.set(asUser('director'));
    for (const url of ['/', '/criaturas', '/campanas/one/fichas-pjs', '/campanas/one/viajes', '/vtt/one/scene/s']) expect(await enter(url)).toBeTrue();
    for (const url of ['/usuarios', '/campanas/two/actos', '/vtt/two/scene/s']) expect((await enter(url) as UrlTree).toString()).toBe('/');
  });
  it('jugador solo ve las cinco secciones de reglas y sus fichas', async () => {
    current.set(asUser('jugador'));
    for (const url of ['/', '/hechizos', '/dotes', '/habilidades', '/equipo', '/rasgos-clase', '/rasgos-clase/mago', '/campanas/one/fichas-pjs']) expect(await enter(url)).toBeTrue();
    for (const url of ['/usuarios', '/criaturas', '/fichas-genericas', '/encuentros-genericos', '/campanas/one/actos', '/campanas/one/viajes', '/vtt/one/scene/s', '/campanas/two/fichas-pjs']) expect((await enter(url) as UrlTree).toString()).toBe('/');
  });
});
describe('Sesión de servidor', () => {
  let access: AccessService; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] }); access = TestBed.inject(AccessService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('un cambio de permisos vuelve a leerse del servidor y no confía en la cuenta anterior', async () => {
    access.user.set({ id: 'old', username: 'Anterior', role: 'director', campaigns: ['one'] });
    const reading = access.refresh(); http.expectOne('/api/session').flush(null); await reading;
    expect(access.user()).toBeNull();
  });
  it('un login fallido no crea una sesión local', async () => {
    const login = access.login('Jugador', 'incorrecta').catch(() => {});
    http.expectOne('/api/session').flush({ message: 'Credenciales incorrectas' }, { status: 401, statusText: 'Unauthorized' }); await login;
    expect(access.user()).toBeNull();
  });
});

describe('Cambio de campaña en la misma pantalla', () => {
  it('recrea el editor y el atlas al cambiar campaña y conserva la ruta si no cambia', () => {
    const strategy = new CampaignRouteReuseStrategy();
    const config = { path: 'campanas/:campaignId/fichas-pjs' };
    const snapshot = (campaignId: string) => ({ paramMap: convertToParamMap({ campaignId }), routeConfig: config }) as ActivatedRouteSnapshot;
    expect(strategy.shouldReuseRoute(snapshot('one'), snapshot('two'))).toBeFalse();
    expect(strategy.shouldReuseRoute(snapshot('one'), snapshot('one'))).toBeTrue();
  });
});
