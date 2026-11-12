import { syntheticNetwork } from './travel-network.fixture';
import { planTravelRoute, RoutePlanningOptions } from './travel-route-planner';
import { advanceRouteTravelDay, advanceRouteTravel, assertRouteTravelProgress, startRouteTravel } from './travel-route-progress';

describe('Avance por horas de un itinerario conservado', () => {
  function trip(options: Partial<RoutePlanningOptions> = {}, network = syntheticNetwork()) {
    const result = planTravelRoute(network, { x: 1, y: 1 }, { x: 3, y: 3 }, { startMode: 'foot', allowOffRoad: false, allowTransfers: true,
      speedsKmh: { 'foot:plain': 2, 'boat:water': 4 }, speedSource: 'Velocidades sintéticas, no reglas de personajes', ...options });
    if (result.status !== 'ok') throw Error(result.message);
    return startRouteTravel(network, result.itinerary);
  }
  it('consume primero pie y después barco sin multiplicar los kilómetros físicos', () => {
    const initial = trip(), before = structuredClone(initial), result = advanceRouteTravel(initial, 62.1);
    expect(result.status).toBe('moving'); expect(result.distanceKm).toBeCloseTo(126.2);
    expect(result.hoursUsed).toBeCloseTo(62.1); expect(result.hoursRemaining).toBe(0);
    expect(result.position.x).toBe(3); expect(result.position.y).toBeCloseTo(1 + 4 / 43.1);
    expect(initial).toEqual(before); expect(result.progress.itinerary.legs.map((leg) => leg.mode)).toEqual(['foot', 'boat']);
  });
  it('dividir una jornada conserva el mismo cursor que consumir sus horas de una vez', () => {
    const first = advanceRouteTravel(trip(), 60), split = advanceRouteTravel(first.progress, 10), whole = advanceRouteTravel(trip(), 70);
    expect(split.progress.travelledKm).toBeCloseTo(whole.progress.travelledKm, 10);
    expect(split.progress.baseHours).toBeCloseTo(whole.progress.baseHours, 10);
    expect(split.position.x).toBeCloseTo(whole.position.x, 10); expect(split.position.y).toBeCloseTo(whole.position.y, 10);
  });
  it('llega exactamente y devuelve el tiempo que sobra, también al continuar un viaje ya llegado', () => {
    const initial = trip(), result = advanceRouteTravel(initial, 100);
    expect(result.status).toBe('arrived'); expect(result.progress.travelledKm).toBe(initial.itinerary.distanceKm);
    expect(result.hoursUsed).toBeCloseTo(82.65); expect(result.hoursRemaining).toBeCloseTo(17.35); expect(result.position).toEqual({ x: 3, y: 3 });
    const again = advanceRouteTravel(result.progress, 8); expect(again.distanceKm).toBe(0); expect(again.hoursUsed).toBe(0); expect(again.hoursRemaining).toBe(8);
  });
  it('se detiene en el tramo sin velocidad confirmada sin inferir una del ritmo terrestre', () => {
    const result = advanceRouteTravel(trip({ speedsKmh: { 'foot:plain': 2 } }), 100);
    expect(result.status).toBe('needs-speed'); expect(result.missingSpeedEdgeId).toBe('river');
    expect(result.progress.travelledKm).toBeCloseTo(122.2); expect(result.hoursUsed).toBeCloseTo(61.1);
    expect(result.position).toEqual({ x: 3, y: 1 }); expect(result.hoursRemaining).toBeCloseTo(38.9);
  });
  it('la instantánea resiste cambios de red y conserva geometría, opciones y atribuciones tras JSON', () => {
    const source = syntheticNetwork(), initial = trip({}, source), result = advanceRouteTravel(initial, 5);
    source.revision++; source.edges[0].geometry[1].x = 9;
    const restored = JSON.parse(JSON.stringify(result.progress)); expect(() => assertRouteTravelProgress(restored)).not.toThrow();
    expect(advanceRouteTravel(restored, 5)).toEqual(advanceRouteTravel(result.progress, 5));
    expect(restored.network.revision).toBe(1); expect(restored.network.sources[0].kind).toBe('synthetic');
  });
  it('rechaza un avance corrupto o un tiempo negativo/no finito sin sustituir el original', () => {
    const initial = trip(), corrupt = structuredClone(initial); corrupt.itinerary.legs[0].durationHours = 1;
    expect(() => assertRouteTravelProgress(corrupt)).toThrow();
    for (const amount of [-1, NaN, Infinity]) expect(() => advanceRouteTravel(initial, amount)).toThrow();
    expect(() => assertRouteTravelProgress({ ...initial, travelledKm: 1, baseHours: 0 })).toThrow();
    expect(() => assertRouteTravelProgress({ ...initial, version: 99 })).toThrow(); expect(initial.travelledKm).toBe(0);
  });
  it('una pausa de cero horas no consume tiempo, kilómetros ni opciones', () => {
    const initial = advanceRouteTravel(trip(), 12).progress, result = advanceRouteTravel(initial, 0);
    expect(result.progress).toEqual(initial); expect(result.distanceKm).toBe(0); expect(result.hoursUsed).toBe(0);
  });
  it('un origen que ya es destino no crea tramos ni consume horas', () => {
    const network = syntheticNetwork(), planned = planTravelRoute(network, { x: 1, y: 1 }, { x: 1, y: 1 }, { startMode: 'foot', allowTransfers: false, allowOffRoad: false });
    if (planned.status !== 'ok') throw Error(planned.message);
    const result = advanceRouteTravel(startRouteTravel(network, planned.itinerary), 8);
    expect(result.status).toBe('arrived'); expect(result.position).toEqual({ x: 1, y: 1 }); expect(result.hoursRemaining).toBe(8);
  });
  it('se detiene exactamente ante velocidad desconocida tras varios tramos fraccionarios', () => {
    const n = syntheticNetwork(), x = .1 / 61.1, y = .2 / 43.1;
    n.nodes = [{ ...n.nodes[0], id: 'a', x: 0, y: 0 }, { ...n.nodes[0], id: 'b', x, y: 0 },
      { ...n.nodes[1], id: 'c', x, y }, { ...n.nodes[2], id: 'd', x: x + 1 / 61.1, y }];
    n.edges = [{ ...n.edges[0], id: 'first', from: 'a', to: 'b', geometry: [{ x: 0, y: 0 }, { x, y: 0 }] },
      { ...n.edges[0], id: 'second', from: 'b', to: 'c', geometry: [{ x, y: 0 }, { x, y }] },
      { ...n.edges[1], id: 'unknown', from: 'c', to: 'd', geometry: [{ x, y }, { x: x + 1 / 61.1, y }] }];
    const planned = planTravelRoute(n, { x: 0, y: 0 }, { x: x + 1 / 61.1, y }, { startMode: 'foot', allowOffRoad: false, allowTransfers: true, speedsKmh: { 'foot:plain': 1 }, speedSource: 'Fixture fraccionaria' });
    if (planned.status !== 'ok') throw Error(planned.message);
    const result = advanceRouteTravel(startRouteTravel(n, planned.itinerary), 1);
    expect(result.status).toBe('needs-speed'); expect(result.position).toEqual({ x, y });
    expect(result.progress.travelledKm).toBeCloseTo(.3, 14); expect(result.hoursUsed).toBeCloseTo(.3, 14);
  });
  it('mantiene modificadores de eventos y separa el tiempo de jornada del tiempo de referencia', () => {
    const result = advanceRouteTravelDay(trip(), 10, { distancePercent: .2, distanceKm: 5 });
    expect(result.distanceKm).toBeCloseTo(29); expect(result.hoursUsed).toBe(10); expect(result.hoursRemaining).toBe(0);
    expect(result.progress.baseHours).toBeCloseTo(14.5); expect(() => assertRouteTravelProgress(result.progress)).not.toThrow();
    const arrival = advanceRouteTravelDay(trip(), 100, { distancePercent: .25, distanceKm: 0 });
    expect(arrival.status).toBe('arrived'); expect(arrival.hoursUsed).toBeCloseTo(82.65 / 1.25);
    expect(arrival.hoursRemaining).toBeCloseTo(100 - 82.65 / 1.25);
  });
  it('los km de evento tampoco permiten cruzar agua con velocidad desconocida', () => {
    const result = advanceRouteTravelDay(trip({ speedsKmh: { 'foot:plain': 2 } }), 60, { distancePercent: 0, distanceKm: 20 });
    expect(result.status).toBe('needs-speed'); expect(result.position).toEqual({ x: 3, y: 1 });
    expect(result.progress.travelledKm).toBeCloseTo(122.2); expect(() => assertRouteTravelProgress(result.progress)).not.toThrow();
  });

});
