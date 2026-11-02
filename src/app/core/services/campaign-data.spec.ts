import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignDataService } from './campaign-data';

const index = [{ id: 'known', dataPath: 'data/known.json' }];
describe('Lectura de campañas y ausencias', () => {
  let service: CampaignDataService; let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CampaignDataService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('entrega una campaña válida con su identificador y datos originales', () => {
    let received: unknown;
    service.getCampaignById('known').subscribe((value) => { received = value; });
    http.expectOne('data/campaigns.json').flush(index);
    const campaign = { id: 'known', name: 'Campaña de prueba' };
    http.expectOne('data/known.json').flush(campaign); expect(received).toEqual(campaign);
  });
  it('termina con una ausencia explícita en lugar de completar sin emitir', () => {
    let error: Error | undefined;
    service.getCampaignById('missing').subscribe({ next: () => fail('No debe inventar una campaña'), error: (value) => { error = value; } });
    http.expectOne('data/campaigns.json').flush(index);
    expect(error).toBeDefined(); http.expectNone('data/known.json');
  });
  it('mantiene un error HTTP de lectura distinto de una campaña desconocida', () => {
    let error: unknown;
    service.getCampaignById('known').subscribe({ error: (value) => { error = value; } });
    http.expectOne('data/campaigns.json').flush(index);
    http.expectOne('data/known.json').flush('No disponible', { status: 503, statusText: 'Service Unavailable' });
    expect(error instanceof HttpErrorResponse).toBeTrue(); expect((error as HttpErrorResponse).status).toBe(503);
  });
});
