import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoutePoint, TravelNetwork } from '../../../../core/models/travel-network';
import { planTravelRoute, RoutePlanningResult, TravelItinerary, TravelMode, TravelRateKey, routeNodesAt } from '../../../../core/services/travel-route-planner';

@Component({ selector: 'app-route-planner', imports: [FormsModule], templateUrl: './route-planner.html', styleUrl: './route-planner.scss' })
export class RoutePlanner implements OnChanges, OnDestroy {
  @Input() network: TravelNetwork | null = null;
  @Input() origin?: RoutePoint;
  @Input() destination?: RoutePoint;
  @Input() contextKey = '';
  @Output() previewChange = new EventEmitter<TravelItinerary | undefined>();
  @Output() manualRequested = new EventEmitter<void>();
  protected readonly allowOffRoad = signal(false);
  protected readonly allowTransfers = signal(false);
  protected readonly startMode = signal<TravelMode>('foot');
  protected readonly originNode = signal('');
  protected readonly destinationNode = signal('');
  protected readonly rates = signal<Partial<Record<TravelRateKey, string>>>({});
  protected readonly source = signal('');
  protected readonly result = signal<RoutePlanningResult | undefined>(undefined);
  protected readonly itinerary = computed(() => { const result = this.result(); return result?.status === 'ok' ? result.itinerary : undefined; });
  protected readonly error = computed(() => { const result = this.result(); return result && result.status !== 'ok' ? result.message : ''; });
  protected readonly rateFields: { key: TravelRateKey; name: string }[] = [
    { key: 'foot:plain', name: 'A pie · llanura' }, { key: 'foot:forest', name: 'A pie · bosque' },
    { key: 'foot:hills', name: 'A pie · colinas' }, { key: 'foot:mountain', name: 'A pie · montaña' },
    { key: 'foot:swamp', name: 'A pie · pantano' }, { key: 'foot:water', name: 'A pie · puente o vado' },
    { key: 'boat:water', name: 'En barco · agua' },
  ];
  ngOnChanges(changes: SimpleChanges): void {
    this.changed();
    if (changes['contextKey']) { this.allowOffRoad.set(false); this.allowTransfers.set(false); this.startMode.set('foot'); this.rates.set({}); this.source.set(''); }
    if (changes['origin'] || changes['network'] || changes['contextKey']) this.originNode.set('');
    if (changes['destination'] || changes['network'] || changes['contextKey']) this.destinationNode.set('');
  }
  ngOnDestroy(): void { this.previewChange.emit(undefined); }
  protected changed(): void { this.result.set(undefined); this.previewChange.emit(undefined); }
  protected nodesAt(point?: RoutePoint) { return this.network && point ? routeNodesAt(this.network, point) : []; }
  protected updateRate(key: TravelRateKey, value: string | number | null): void { this.rates.update(rates => ({ ...rates, [key]: value === null ? '' : String(value) })); this.changed(); }
  calculate(): void {
    if (!this.origin || !this.destination) { this.result.set({ status: 'unmapped-endpoint', message: 'Selecciona un grupo y un destino antes de calcular. La ruta manual y sus jornadas se conservan.' }); this.previewChange.emit(undefined); return; }
    const speedsKmh: Partial<Record<TravelRateKey, number>> = {};
    for (const [key, text] of Object.entries(this.rates())) if (text?.trim()) speedsKmh[key as TravelRateKey] = Number(text.replace(',', '.'));
    const result = planTravelRoute(this.network, { ...this.origin, ...(this.originNode() ? { nodeId: this.originNode() } : {}) },
      { ...this.destination, ...(this.destinationNode() ? { nodeId: this.destinationNode() } : {}) },
      { startMode: this.startMode(), allowOffRoad: this.allowOffRoad(), allowTransfers: this.allowTransfers(), speedsKmh, ...(this.source().trim() ? { speedSource: this.source().trim() } : {}) });
    this.result.set(result); this.previewChange.emit(result.status === 'ok' ? result.itinerary : undefined);
  }
  protected manual(): void { this.changed(); this.manualRequested.emit(); }
  protected format(value: number): string { return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(value); }
  protected nodeName(id: string): string { return this.network?.nodes.find(node => node.id === id)?.name ?? id; }
  protected kindName(kind: string): string { return ({ road: 'Camino', trail: 'Sendero', 'off-road': 'Fuera de camino', water: 'Vía acuática' } as Record<string, string>)[kind] ?? kind; }
}
