import { RouteEdge, RouteNode, TravelNetwork } from '../models/travel-network';
import { syntheticNetwork } from './travel-network.fixture';
import { networkEdgeDistance } from './travel-network-format';
import { planTravelRoute, RoutePlanningOptions, TravelItinerary } from './travel-route-planner';

describe('Itinerarios por red declarada', () => {
  const options = (extra: Partial<RoutePlanningOptions> = {}): RoutePlanningOptions => ({ startMode: 'foot', allowTransfers: false, allowOffRoad: false, ...extra });
  const point = (n: TravelNetwork, id: string) => { const node = n.nodes.find(node => node.id === id)!; return { x: node.x, y: node.y }; };
  function route(n: TravelNetwork, from: string, to: string, extra: Partial<RoutePlanningOptions> = {}): TravelItinerary {
    const result = planTravelRoute(n, point(n, from), point(n, to), options(extra));
    if (result.status !== 'ok') throw Error(result.message); return result.itinerary;
  }
  function detour(): TravelNetwork {
    const n = syntheticNetwork(); n.nodes.push({ id: 'd', name: 'D', x: 1, y: 3, sourceId: 'test', boarding: false });
    const edge = (id: string, from: string, to: string, kind: RouteEdge['kind']): RouteEdge => ({ ...n.edges[0], id, from, to, kind,
      geometry: [point(n, from), point(n, to)] });
    n.edges = [edge('ad', 'a', 'd', 'road'), edge('db', 'd', 'b', 'trail'), edge('ab', 'a', 'b', 'off-road')]; return n;
  }
  it('prefiere caminos por defecto y el check solo habilita un enlace fuera de camino declarado', () => {
    const n = detour(), before = structuredClone(n);
    expect(route(n, 'a', 'b').legs.map(leg => leg.edgeId)).toEqual(['ad', 'db']);
    const direct = route(n, 'a', 'b', { allowOffRoad: true }); expect(direct.legs.map(leg => leg.edgeId)).toEqual(['ab']);
    expect(direct.distanceKm).toBeCloseTo(122.2); expect(n).toEqual(before);
    n.edges = n.edges.filter(e => e.id !== 'ab'); expect(route(n, 'a', 'b', { allowOffRoad: true }).legs.map(leg => leg.edgeId)).toEqual(['ad', 'db']);
  });
  it('usa la polilínea completa y conserva sus vértices al recorrerla en sentido inverso', () => {
    const n = syntheticNetwork(); n.edges[0].geometry = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 1 }];
    const forward = route(n, 'a', 'b'), backward = route(n, 'b', 'a');
    expect(forward.distanceKm).toBeCloseTo(networkEdgeDistance(n.edges[0])); expect(forward.distanceKm).toBeGreaterThan(122.2);
    expect(backward.geometry).toEqual([...forward.geometry].reverse()); expect(backward.distanceKm).toBe(forward.distanceKm);
    backward.geometry[0].x = 99; expect(n.edges[0].geometry.at(-1)!.x).toBe(3);
  });
  it('distingue barco, pie, transbordo y vía de una sola dirección', () => {
    const n = syntheticNetwork();
    expect(planTravelRoute(n, point(n, 'a'), point(n, 'c'), options()).status).toBe('no-route');
    const mixed = route(n, 'a', 'c', { allowTransfers: true }); expect(mixed.legs.map(leg => leg.mode)).toEqual(['foot', 'boat']);
    expect(mixed.transfers).toEqual([{ nodeId: 'b', from: 'foot', to: 'boat' }]); expect(mixed.geometry.at(-1)).toEqual(point(n, 'c'));
    expect(route(n, 'b', 'c', { startMode: 'boat' }).legs[0].edgeId).toBe('river');
    expect(planTravelRoute(n, point(n, 'c'), point(n, 'b'), options({ startMode: 'boat', allowTransfers: true, allowOffRoad: true })).status).toBe('no-route');
  });
  it('rechaza una conexión pie/barco sin embarque y no deja caminar por un río al activar el check', () => {
    const n = syntheticNetwork(); n.nodes[1].boarding = false;
    expect(planTravelRoute(n, point(n, 'a'), point(n, 'c'), options({ allowTransfers: true })).status).toBe('invalid-network');
    const valid = syntheticNetwork(); expect(planTravelRoute(valid, point(valid, 'b'), point(valid, 'c'), options({ allowOffRoad: true })).status).toBe('no-route');
  });
  it('permite puentes y vados explícitos a pie sin convertirlos en tramos navegables', () => {
    for (const crossing of ['bridge', 'ford'] as const) {
      const n = syntheticNetwork(); n.edges[0] = { ...n.edges[0], terrain: 'water', crossing };
      expect(route(n, 'a', 'b').legs[0].crossing).toBe(crossing);
      expect(planTravelRoute(n, point(n, 'a'), point(n, 'b'), options({ startMode: 'boat' })).status).toBe('no-route');
    }
  });
  it('conserva kilómetros físicos y deja tiempo desconocido cuando faltan velocidades por terreno', () => {
    const n = syntheticNetwork(), unknown = route(n, 'a', 'c', { allowTransfers: true }); expect(unknown.durationHours).toBeUndefined();
    const known = route(n, 'a', 'c', { allowTransfers: true, speedsKmh: { 'foot:plain': 2, 'boat:water': 4 }, speedSource: 'Velocidades sintéticas, no estadísticas de juego' });
    expect(known.distanceKm).toBe(unknown.distanceKm); expect(known.durationHours).toBeCloseTo(122.2 / 2 + 86.2 / 4);
    const partial = route(n, 'a', 'c', { allowTransfers: true, speedsKmh: { 'foot:plain': 2 }, speedSource: 'Fixture' }); expect(partial.durationHours).toBeUndefined();
    expect(partial.legs[0].durationHours).toBeCloseTo(61.1); expect(partial.legs[1].durationHours).toBeUndefined();
  });
  it('rechaza costes negativos, no finitos, velocidad cero y ausencia de fuente sin tocar la red', () => {
    const n = syntheticNetwork();
    for (const speed of [-1, 0, NaN, Infinity]) expect(planTravelRoute(n, point(n, 'a'), point(n, 'b'), options({ speedsKmh: { 'foot:plain': speed }, speedSource: 'Prueba' })).status).toBe('invalid-options');
    expect(planTravelRoute(n, point(n, 'a'), point(n, 'b'), options({ speedsKmh: { 'foot:plain': 2 } })).status).toBe('invalid-options');
  });
  it('no inventa enlaces hasta nodos cercanos ni atraviesa huecos de cobertura', () => {
    const n = syntheticNetwork();
    expect(planTravelRoute(n, { x: 1.001, y: 1 }, point(n, 'b'), options()).status).toBe('unmapped-endpoint');
    expect(planTravelRoute(n, { x: 50, y: 50 }, point(n, 'b'), options({ allowOffRoad: true })).status).toBe('outside-coverage');
    n.edges = []; expect(planTravelRoute(n, point(n, 'a'), point(n, 'b'), options({ allowOffRoad: true })).status).toBe('no-route');
  });
  it('exige desambiguar nodos coincidentes y no conecta vías superpuestas', () => {
    const n = syntheticNetwork(); n.nodes.push({ ...n.nodes[0], id: 'same', name: 'Otra vía' });
    expect(planTravelRoute(n, point(n, 'a'), point(n, 'b'), options()).status).toBe('ambiguous-endpoint');
    expect(planTravelRoute(n, { ...point(n, 'a'), nodeId: 'same' }, point(n, 'b'), options()).status).toBe('no-route');
    expect(planTravelRoute(n, { ...point(n, 'a'), nodeId: 'a' }, point(n, 'b'), options()).status).toBe('ok');
  });
  it('resuelve empates de forma determinista aunque cambie el orden de importación', () => {
    const n = syntheticNetwork(); n.nodes.push({ id: 'z', name: 'Z', x: 2, y: 1, sourceId: 'test', boarding: false });
    const edge = (id: string, from: RouteNode, to: RouteNode): RouteEdge => ({ ...n.edges[0], id, from: from.id, to: to.id, geometry: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }] });
    n.edges = [edge('one', n.nodes[0], n.nodes[3]), edge('two', n.nodes[3], n.nodes[1]), { ...n.edges[0], id: 'direct' }];
    const expected = route(n, 'a', 'b'); n.edges.reverse(); n.nodes.reverse(); expect(route(n, 'a', 'b')).toEqual(expected);
    expect(expected.legs.map(leg => leg.edgeId)).toEqual(['direct']);
  });
  it('calcula origen igual a destino sin generar movimientos ni horas de viaje', () => {
    const n = syntheticNetwork(), result = route(n, 'a', 'a'); expect(result.distanceKm).toBe(0); expect(result.durationHours).toBe(0); expect(result.legs).toEqual([]); expect(result.geometry).toEqual([point(n, 'a')]);
  });
  it('explica red ausente o inválida sin normalizar versiones futuras', () => {
    expect(planTravelRoute(null, { x: 1, y: 1 }, { x: 3, y: 1 }, options()).status).toBe('no-network');
    const n = syntheticNetwork(); (n as { version: number }).version = 99;
    expect(planTravelRoute(n, { x: 1, y: 1 }, { x: 3, y: 1 }, options()).status).toBe('invalid-network'); expect(n.version as number).toBe(99);
  });
});
