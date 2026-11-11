import type { RouteEdge, RouteNode, RoutePoint, TravelNetwork } from '../models/travel-network';
import { assertTravelNetwork, networkCoversPoint, networkEdgeDistance } from './travel-network-format';

export type TravelMode = 'foot' | 'boat';
export type TravelRateKey = `${TravelMode}:${RouteEdge['terrain']}`;
export interface RouteEndpoint extends RoutePoint { nodeId?: string; }
export interface RoutePlanningOptions {
  startMode: TravelMode;
  allowTransfers: boolean;
  allowOffRoad: boolean;
  /** Velocidades declaradas; ausente no equivale a cero ni a una regla inferida. */
  speedsKmh?: Partial<Record<TravelRateKey, number>>;
  speedSource?: string;
}
export interface PlannedLeg {
  edgeId: string; from: string; to: string; mode: TravelMode;
  kind: RouteEdge['kind']; terrain: RouteEdge['terrain']; crossing: RouteEdge['crossing']; sourceId: string;
  geometry: RoutePoint[]; distanceKm: number; durationHours?: number;
}
export interface TravelItinerary {
  network: Pick<TravelNetwork, 'id' | 'name' | 'revision' | 'dataKind'>;
  fromNodeId: string; toNodeId: string; options: RoutePlanningOptions;
  legs: PlannedLeg[]; transfers: { nodeId: string; from: TravelMode; to: TravelMode }[];
  geometry: RoutePoint[]; distanceKm: number; durationHours?: number;
}
export type RoutePlanningResult = { status: 'ok'; itinerary: TravelItinerary } |
  { status: 'no-network' | 'invalid-network' | 'invalid-options' | 'outside-coverage' | 'unmapped-endpoint' | 'ambiguous-endpoint' | 'no-route'; message: string };
type Failure = Exclude<RoutePlanningResult, { status: 'ok' }>;
interface QueueItem { key: string; distance: number; hops: number; }
const compare = (a: QueueItem, b: QueueItem): number => a.distance - b.distance || a.hops - b.hops || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
/** Cola mínima acotada por la red; desempate estable sin depender del idioma del navegador. */
class Queue {
  private items: QueueItem[] = [];
  push(item: QueueItem): void {
    const items = this.items; let index = items.push(item) - 1;
    while (index) { const parent = (index - 1) >> 1; if (compare(items[parent], item) <= 0) break; items[index] = items[parent]; index = parent; } items[index] = item;
  }
  pop(): QueueItem | undefined {
    const first = this.items[0], last = this.items.pop(); if (!this.items.length || !last) return first;
    let index = 0;
    while (index * 2 + 1 < this.items.length) {
      let next = index * 2 + 1;
      if (next + 1 < this.items.length && compare(this.items[next + 1], this.items[next]) < 0) next++;
      if (compare(last, this.items[next]) <= 0) break;
      this.items[index] = this.items[next]; index = next;
    }
    this.items[index] = last; return first;
  }
}
const rateKeys = ['foot', 'boat'].flatMap(mode => ['plain', 'forest', 'hills', 'mountain', 'swamp', 'water'].map(terrain => `${mode}:${terrain}`));
function optionsValid(options: RoutePlanningOptions): boolean {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => !['startMode', 'allowTransfers', 'allowOffRoad', 'speedsKmh', 'speedSource'].includes(key)) ||
    !['foot', 'boat'].includes(options.startMode) || typeof options.allowOffRoad !== 'boolean' || typeof options.allowTransfers !== 'boolean') return false;
  if (options.speedsKmh !== undefined && (!options.speedsKmh || typeof options.speedsKmh !== 'object' || Array.isArray(options.speedsKmh))) return false;
  const entries = Object.entries(options.speedsKmh ?? {});
  if (options.speedSource !== undefined && (typeof options.speedSource !== 'string' || !options.speedSource.trim() || options.speedSource.length > 2000)) return false;
  return entries.every(([key, value]) => rateKeys.includes(key) && typeof value === 'number' && Number.isFinite(value) && value > 0) &&
    (!entries.length || typeof options.speedSource === 'string' && !!options.speedSource.trim() && options.speedSource.length <= 2000);
}
export function routeNodesAt(network: TravelNetwork, point: RoutePoint): RouteNode[] {
  return network.nodes.filter(node => node.x === point.x && node.y === point.y).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
function endpoint(network: TravelNetwork, point: RouteEndpoint): RouteNode | Failure {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !networkCoversPoint(network, point)) return { status: 'outside-coverage', message: 'No hay itinerario verificado: un extremo queda fuera de la cobertura declarada.' };
  const nodes = routeNodesAt(network, point).filter(node => !point.nodeId || node.id === point.nodeId);
  if (!nodes.length) return { status: 'unmapped-endpoint', message: 'No hay itinerario verificado: falta un nodo en el origen o destino exactos. No se inventa un enlace hasta el nodo más cercano.' };
  if (nodes.length > 1) return { status: 'ambiguous-endpoint', message: 'Hay varios nodos en el mismo punto. Elige explícitamente cuál usar para evitar conexiones entre vías distintas.' };
  return nodes[0];
}

/** Dijkstra por kilómetros físicos. La duración se calcula aparte y nunca altera la geometría. */
export function planTravelRoute(network: TravelNetwork | null, from: RouteEndpoint, to: RouteEndpoint, options: RoutePlanningOptions): RoutePlanningResult {
  if (!network) return { status: 'no-network', message: 'No hay itinerario verificado: falta una red guardada para esta campaña. Puedes trazar una ruta manual identificada.' };
  try { assertTravelNetwork(network); } catch { return { status: 'invalid-network', message: 'No se puede calcular sobre una red inválida o de versión desconocida. Se conserva su original.' }; }
  if (!optionsValid(options)) return { status: 'invalid-options', message: 'Confirma los medios y velocidades positivas finitas con su fuente; no se deducen de los nombres de los tramos.' };
  const origin = endpoint(network, from), destination = endpoint(network, to);
  if ('status' in origin) return origin; if ('status' in destination) return destination;
  type Arc = { edge: RouteEdge; from: string; to: string; reversed: boolean; distance: number };
  const nodes = new Map(network.nodes.map(node => [node.id, node]));
  const arcs = new Map<string, Arc[]>();
  for (const edge of [...network.edges].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (edge.kind === 'off-road' && !options.allowOffRoad) continue;
    const distance = networkEdgeDistance(edge);
    for (const reversed of edge.direction === 'both' ? [false, true] : [false]) {
      const a = reversed ? edge.to : edge.from, b = reversed ? edge.from : edge.to;
      const entries = arcs.get(a) ?? []; entries.push({ edge, from: a, to: b, reversed, distance }); arcs.set(a, entries);
    }
  }
  const key = (id: string, mode: TravelMode) => `${id}|${mode}`;
  type Record = QueueItem & { node: string; mode: TravelMode; previous?: string; via?: Arc };
  const start = key(origin.id, options.startMode), records = new Map<string, Record>([[start, { key: start, node: origin.id, mode: options.startMode, distance: 0, hops: 0 }]]);
  const queue = new Queue(), settled = new Set<string>(); queue.push(records.get(start)!);
  let goal: Record | undefined;
  while (true) {
    const item = queue.pop(); if (!item) break;
    const current = records.get(item.key)!;
    if (settled.has(item.key) || item.distance !== current.distance || item.hops !== current.hops) continue;
    settled.add(item.key);
    if (current.node === destination.id) { goal = current; break; }
    const offer = (node: string, mode: TravelMode, distance: number, via?: Arc): void => {
      const target = key(node, mode), old = records.get(target), hops = current.hops + 1;
      if (settled.has(target) || old && (old.distance < distance || old.distance === distance && old.hops <= hops)) return;
      const next = { key: target, node, mode, distance, hops, previous: item.key, via }; records.set(target, next); queue.push(next);
    };
    for (const arc of arcs.get(current.node) ?? []) if (arc.edge.modes.includes(current.mode)) offer(arc.to, current.mode, current.distance + arc.distance, arc);
    if (options.allowTransfers && nodes.get(current.node)!.boarding) offer(current.node, current.mode === 'foot' ? 'boat' : 'foot', current.distance);
  }
  if (!goal) return { status: 'no-route', message: 'No hay itinerario verificado con esos medios y enlaces. Permitir tramos fuera de camino solo habilita alternativas declaradas; puedes conservar o trazar una ruta manual.' };
  const chain: Record[] = []; let cursor = goal;
  while (cursor.previous) { chain.push(cursor); cursor = records.get(cursor.previous)!; }
  chain.reverse();
  const legs: PlannedLeg[] = [], transfers: TravelItinerary['transfers'] = [];
  for (const step of chain) {
    if (!step.via) { transfers.push({ nodeId: step.node, from: records.get(step.previous!)!.mode, to: step.mode }); continue; }
    const arc = step.via, geometry = (arc.reversed ? [...arc.edge.geometry].reverse() : arc.edge.geometry).map(p => ({ ...p }));
    const speed = options.speedsKmh?.[`${step.mode}:${arc.edge.terrain}`];
    const hours = speed === undefined ? undefined : arc.distance / speed;
    if (hours !== undefined && (!Number.isFinite(hours) || hours <= 0)) return { status: 'invalid-options', message: 'La velocidad declarada no permite calcular una duración positiva finita.' };
    legs.push({ edgeId: arc.edge.id, from: arc.from, to: arc.to, mode: step.mode, kind: arc.edge.kind, terrain: arc.edge.terrain, crossing: arc.edge.crossing,
      sourceId: arc.edge.sourceId, geometry, distanceKm: arc.distance, ...(hours === undefined ? {} : { durationHours: hours }) });
  }
  const durationHours = legs.every(leg => leg.durationHours !== undefined) ? legs.reduce((sum, leg) => sum + leg.durationHours!, 0) : undefined;
  if (durationHours !== undefined && !Number.isFinite(durationHours)) return { status: 'invalid-options', message: 'La duración total supera el intervalo numérico admitido.' };
  return { status: 'ok', itinerary: { network: { id: network.id, name: network.name, revision: network.revision, dataKind: network.dataKind }, fromNodeId: origin.id, toNodeId: destination.id,
    options: structuredClone(options), legs, transfers, geometry: legs.length ? legs.flatMap((leg, index) => index ? leg.geometry.slice(1) : leg.geometry) : [{ x: origin.x, y: origin.y }],
    distanceKm: goal.distance, ...(durationHours === undefined ? {} : { durationHours }) } };
}
