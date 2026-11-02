import { AsyncPipe } from '@angular/common';
import { Component, inject, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CampaignError } from '../../features/dashboard/pages/campaign-error/campaign-error';
import { CampaignDataService } from './campaign-data';
import { campaignAvailable, CampaignNavigationState } from './campaign-navigation';

@Component({ template: '<h1>Catálogo de campañas</h1>' }) class Home {}
@Component({ imports: [AsyncPipe], template: '<h1>Campaña válida</h1>@if (campaign$ | async; as campaign) { <p>{{ campaign.name }}</p> } @else { <p>Cargando campaña…</p> }' }) class Ready { readonly campaign$ = inject(CampaignDataService).getCampaign(); }
const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const known = [{ id: 'known', dataPath: 'data/known.json' }];
describe('Recuperación de rutas de campaña', () => {
  let http: HttpTestingController; let harness: RouterTestingHarness; let router: Router; let state: CampaignNavigationState;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([
      { path: '', component: Home },
      { path: 'campanas/:campaignId/introduccion', canActivate: [campaignAvailable], component: Ready },
      { path: 'vtt/:campaignId/:kind/:entryId', canActivate: [campaignAvailable], component: Ready },
      { path: 'error-campana', component: CampaignError },
    ])] });
    http = TestBed.inject(HttpTestingController); router = TestBed.inject(Router); state = TestBed.inject(CampaignNavigationState);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));
  it('muestra carga mientras lee y deja entrar en una campaña válida', async () => {
    const navigation = harness.navigateByUrl('/campanas/known/introduccion', Ready); await nextTurn();
    expect(state.loading()).toBeTrue(); http.expectOne('data/campaigns.json').flush(known);
    expect(state.loading()).toBeTrue(); http.expectOne('data/known.json').flush({ id: 'known', name: 'Campaña sin segunda lectura' });
    await navigation; expect(state.loading()).toBeFalse(); expect(harness.routeNativeElement?.textContent).toContain('Campaña sin segunda lectura');
    expect(harness.routeNativeElement?.textContent).not.toContain('Cargando'); http.expectNone('data/known.json');
  });
  it('un identificador desconocido termina en ausencia recuperable, también en el VTT', async () => {
    const navigation = harness.navigateByUrl('/vtt/missing/scene/test?run=partida', CampaignError); await nextTurn();
    http.expectOne('data/campaigns.json').flush(known); await navigation;
    expect(state.loading()).toBeFalse(); expect(harness.routeNativeElement?.textContent).toContain('No encontramos esa campaña');
    const back = Array.from(harness.routeNativeElement!.querySelectorAll('a')).find((a) => a.textContent?.includes('Volver al catálogo'))!;
    expect(back.getAttribute('href')).toBe('/'); expect(router.url).toContain('tipo=ausente');
    expect(harness.routeNativeElement?.textContent).not.toContain('Cargando');
  });
  it('distingue un error de lectura HTTP y permite reintentar el enlace original', async () => {
    const navigation = harness.navigateByUrl('/campanas/known/introduccion', CampaignError); await nextTurn();
    http.expectOne('data/campaigns.json').flush(known);
    http.expectOne('data/known.json').flush('No disponible', { status: 503, statusText: 'Unavailable' }); await navigation;
    expect(harness.routeNativeElement?.textContent).toContain('No se pudo leer la campaña');
    expect(router.url).toContain('tipo=lectura'); expect(state.loading()).toBeFalse();
    const retry = Array.from(harness.routeNativeElement!.querySelectorAll('a')).find((a) => a.textContent?.includes('Reintentar enlace'))!;
    expect(retry.getAttribute('href')).toBe('/campanas/known/introduccion');
    const retried = harness.navigateByUrl(retry.getAttribute('href')!, Ready); await nextTurn();
    http.match('data/campaigns.json').forEach((request) => request.flush(known));
    http.expectOne('data/known.json').flush({ id: 'known' }); await retried;
    expect(state.loading()).toBeFalse(); expect(router.url).toBe('/campanas/known/introduccion');
  });
  it('no deja la carga activa si el usuario cancela la navegación', async () => {
    const navigation = router.navigateByUrl('/campanas/known/introduccion'); await nextTurn();
    const request = http.expectOne('data/campaigns.json'); expect(state.loading()).toBeTrue();
    await router.navigateByUrl('/'); expect(await navigation).toBeFalse(); expect(request.cancelled).toBeTrue(); expect(state.loading()).toBeFalse();
  });
  it('no ofrece reintentos hacia direcciones externas introducidas en la URL de error', async () => {
    await harness.navigateByUrl('/error-campana?tipo=lectura&volver=https%3A%2F%2Fejemplo.invalid', CampaignError);
    expect(harness.routeNativeElement?.textContent).not.toContain('Reintentar enlace');
    expect(harness.routeNativeElement?.querySelector('a')?.getAttribute('href')).toBe('/');
  });
});
