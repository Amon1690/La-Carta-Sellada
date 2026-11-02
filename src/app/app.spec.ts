import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampaignNavigationState } from './core/services/campaign-navigation';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should provide the router outlet for application views', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
  it('distingue visualmente la lectura pendiente y retira el indicador al terminar', () => {
    const fixture = TestBed.createComponent(App); const state = TestBed.inject(CampaignNavigationState);
    state.begin(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('Cargando campaña');
    state.end(); fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

});
