import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoutePlanner } from './route-planner';
import { syntheticNetwork } from '../../../../core/services/travel-network.fixture';
import { TravelItinerary } from '../../../../core/services/travel-route-planner';

describe('Panel de itinerarios declarados', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [RoutePlanner], providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(RoutePlanner), network = syntheticNetwork(), previews: (TravelItinerary | undefined)[] = [];
    fixture.componentRef.setInput('network', network); fixture.componentRef.setInput('origin', { x: 1, y: 1 });
    fixture.componentRef.setInput('destination', { x: 3, y: 1 }); fixture.componentRef.setInput('contextKey', 'campaña:grupo-a');
    fixture.componentInstance.previewChange.subscribe(value => previews.push(value)); fixture.detectChanges(); await fixture.whenStable();
    return { fixture, network, previews, view: fixture.componentInstance as any };
  }
  it('calcula una previsualización con caminos por defecto y ofrece manual como acción distinta', async () => {
    const { fixture, view, previews } = await setup(); let manual = 0;
    fixture.componentInstance.manualRequested.subscribe(() => manual++);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(b => b.textContent?.includes('Calcular por caminos'))!.click(); fixture.detectChanges();
    expect(previews.at(-1)?.distanceKm).toBeCloseTo(122.2); expect(view.allowOffRoad()).toBeFalse(); expect(manual).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Tiempo pendiente'); expect(fixture.nativeElement.textContent).toContain('Red sintética de prueba');
    buttons.find(b => b.textContent?.includes('ruta manual'))!.click(); expect(manual).toBe(1); expect(previews.at(-1)).toBeUndefined();
  });
  it('una red inválida o sin extremos válidos muestra motivo y nunca publica una recta como camino', async () => {
    const { fixture, view, previews } = await setup(); fixture.componentRef.setInput('origin', { x: 1.001, y: 1 }); fixture.detectChanges();
    view.calculate(); fixture.detectChanges(); expect(view.error()).toContain('falta un nodo'); expect(previews.at(-1)).toBeUndefined();
    fixture.componentRef.setInput('network', null); fixture.detectChanges(); view.calculate(); fixture.detectChanges(); expect(view.error()).toContain('falta una red');
  });
  it('cambiar contexto o red retira la vista previa y no hereda opciones de otro grupo', async () => {
    const { fixture, view, previews, network } = await setup(); view.allowOffRoad.set(true); view.allowTransfers.set(true); view.calculate();
    fixture.componentRef.setInput('contextKey', 'campaña:grupo-b'); fixture.detectChanges(); expect(previews.at(-1)).toBeUndefined();
    expect(view.allowOffRoad()).toBeFalse(); expect(view.allowTransfers()).toBeFalse(); expect(view.itinerary()).toBeUndefined();
    view.calculate(); fixture.componentRef.setInput('network', { ...network, revision: 2 }); fixture.detectChanges(); expect(view.itinerary()).toBeUndefined(); expect(previews.at(-1)).toBeUndefined();
  });
  it('editar un coste invalida el resultado y exige fuente sin alterar los kilómetros', async () => {
    const { fixture, view, previews } = await setup(); view.calculate(); const distance = previews.at(-1)!.distanceKm;
    view.updateRate('foot:plain', '2,5'); expect(previews.at(-1)).toBeUndefined(); view.calculate(); expect(view.error()).toContain('fuente');
    view.source.set('Velocidad sintética de la prueba'); view.calculate(); fixture.detectChanges();
    expect(previews.at(-1)!.distanceKm).toBe(distance); expect(previews.at(-1)!.durationHours).toBeCloseTo(distance / 2.5);
  });
});
