import type { RoutePoint, TravelNetwork } from '../models/travel-network';
import { TRAVEL_MAP_REFERENCE } from '../models/travel-network';
import { assertTravelNetwork } from './travel-network-format';
import { planTravelRoute, TravelItinerary } from './travel-route-planner';

/** Instantánea autónoma: cambiar la red de la campaña no modifica un viaje iniciado. */
export interface RouteTravelProgress {
  version: 1;
  network: TravelNetwork;
  itinerary: TravelItinerary;
  travelledKm: number;
  /** Tiempo equivalente a las velocidades declaradas, sin modificadores de eventos. */
  baseHours: number;
}
export interface RouteAdvance {
  progress: RouteTravelProgress;
  distanceKm: number;
  hoursUsed: number;
  hoursRemaining: number;
  position: RoutePoint;
  status: 'moving' | 'arrived' | 'needs-speed';
  missingSpeedEdgeId?: string;
}
function fail(): never { throw new Error('El avance del itinerario no es válido; conserva el original.'); }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const tolerance = (...values: number[]): number => Number.EPSILON * 64 * Math.max(Number.MIN_VALUE, ...values.map(Math.abs));
const same = (a: number, b: number): boolean => Math.abs(a - b) <= tolerance(a, b);
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .filter(([, item]) => item !== undefined).map(([key, item]) => JSON.stringify(key) + ':' + stable(item)).join(',') + '}';
  return JSON.stringify(value);
}
function hoursAt(itinerary: TravelItinerary, distanceKm: number): number | undefined {
  let before = 0, hours = 0;
  for (const leg of itinerary.legs) {
    if (distanceKm <= before) break;
    const used = Math.min(distanceKm - before, leg.distanceKm);
    if (used > 0 && leg.durationHours === undefined) return undefined;
    if (leg.distanceKm > 0) hours += used / leg.distanceKm * (leg.durationHours ?? 0);
    before += leg.distanceKm;
  }
  return hours;
}

/** Valida también datos derivados: una copia no puede cambiar tiempos o geometría aislados. */
export function assertRouteTravelProgress(value: unknown): asserts value is RouteTravelProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !['version', 'network', 'itinerary', 'travelledKm', 'baseHours'].includes(key)) ||
      data['version'] !== 1 || !finite(data['travelledKm']) || !finite(data['baseHours']) || !data['itinerary'] ||
      typeof data['itinerary'] !== 'object' || Array.isArray(data['itinerary'])) fail();
  assertTravelNetwork(data['network']);
  const network = data['network'], itinerary = data['itinerary'] as TravelItinerary;
  const travelledKm = data['travelledKm'] as number, baseHours = data['baseHours'] as number;
  const from = network.nodes.find((node) => node.id === itinerary.fromNodeId), to = network.nodes.find((node) => node.id === itinerary.toNodeId);
  if (!from || !to) fail();
  const planned = planTravelRoute(network, { x: from.x, y: from.y, nodeId: from.id }, { x: to.x, y: to.y, nodeId: to.id }, itinerary.options);
  if (planned.status !== 'ok' || stable(planned.itinerary) !== stable(itinerary) || travelledKm > itinerary.distanceKm) fail();
  const hours = hoursAt(itinerary, travelledKm);
  if (hours === undefined || !same(hours, baseHours)) fail();
}

export function startRouteTravel(network: TravelNetwork, itinerary: TravelItinerary): RouteTravelProgress {
  const progress: RouteTravelProgress = { version: 1, network: structuredClone(network), itinerary: structuredClone(itinerary), travelledKm: 0, baseHours: 0 };
  assertRouteTravelProgress(progress); return progress;
}

/** Interpolación sobre toda la polilínea, sin redondear tramos ni kilómetros. */
function positionAt(itinerary: TravelItinerary, distanceKm: number): RoutePoint {
  let beforeLeg = 0;
  for (const leg of itinerary.legs) {
    const end = beforeLeg + leg.distanceKm;
    if (distanceKm === end) return { ...leg.geometry[leg.geometry.length - 1] };
    if (distanceKm < end) {
      const within = distanceKm - beforeLeg;
      let beforeSegment = 0;
      for (let i = 1; i < leg.geometry.length; i++) {
        const a = leg.geometry[i - 1], b = leg.geometry[i];
        const length = Math.hypot((b.x - a.x) * TRAVEL_MAP_REFERENCE.kmPerXPercent, (b.y - a.y) * TRAVEL_MAP_REFERENCE.kmPerYPercent);
        if (length > 0 && within <= beforeSegment + length) {
          const ratio = Math.max(0, Math.min(1, (within - beforeSegment) / length));
          return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
        }
        beforeSegment += length;
      }
      return { ...leg.geometry[leg.geometry.length - 1] };
    }
    beforeLeg = end;
  }
  return { ...itinerary.geometry[itinerary.geometry.length - 1] };
}

/** Consume horas por tramo. Si falta una velocidad, se detiene sin inventarla. */
export function advanceRouteTravel(value: RouteTravelProgress, hours: number): RouteAdvance {
  assertRouteTravelProgress(value);
  if (!finite(hours)) fail();
  const progress = structuredClone(value), itinerary = progress.itinerary;
  let budget = hours, cursor = progress.travelledKm, beforeLeg = 0, missingSpeedEdgeId: string | undefined;
  for (const leg of itinerary.legs) {
    const end = beforeLeg + leg.distanceKm;
    if (cursor >= end) { beforeLeg = end; continue; }
    if (budget <= 0) break;
    if (leg.durationHours === undefined) { missingSpeedEdgeId = leg.edgeId; break; }
    const remaining = end - cursor, needed = remaining / leg.distanceKm * leg.durationHours;
    if (budget >= needed) {
      budget = Math.max(0, budget - needed); cursor = end;
    } else {
      cursor += budget / leg.durationHours * leg.distanceKm; budget = 0;
    }
    beforeLeg = end;
  }
  const arrived = cursor >= itinerary.distanceKm || same(cursor, itinerary.distanceKm);
  progress.travelledKm = arrived ? itinerary.distanceKm : cursor;
  progress.baseHours = hoursAt(itinerary, progress.travelledKm) ?? fail();
  return { progress, distanceKm: progress.travelledKm - value.travelledKm, hoursUsed: progress.baseHours - value.baseHours,
    hoursRemaining: budget, position: arrived ? { ...itinerary.geometry[itinerary.geometry.length - 1] } : positionAt(itinerary, progress.travelledKm),
    status: arrived ? 'arrived' : missingSpeedEdgeId ? 'needs-speed' : 'moving', ...(missingSpeedEdgeId ? { missingSpeedEdgeId } : {}) };
}

/** Mantiene los modificadores globales de los eventos sin alterar geometría ni velocidades guardadas.
 * El porcentaje modifica el rendimiento de la jornada; los km son avance adicional explícito.
 * baseHours sigue siendo tiempo de referencia; hoursUsed es tiempo de esta jornada. */
export function advanceRouteTravelDay(value: RouteTravelProgress, hours: number,
  effects: { distancePercent: number; distanceKm: number }): RouteAdvance {
  if (!finite(hours) || !Number.isFinite(effects.distancePercent) || !Number.isFinite(effects.distanceKm)) fail();
  const factor = Math.max(0, 1 + effects.distancePercent);
  const baseline = advanceRouteTravel(value, hours * factor);
  const target = Math.max(value.travelledKm, Math.min(value.itinerary.distanceKm, baseline.progress.travelledKm + effects.distanceKm));
  // Un evento tampoco permite atravesar un tramo cuya velocidad no esté declarada.
  let end = 0, limit = value.itinerary.distanceKm;
  for (const leg of value.itinerary.legs) {
    if (end >= value.travelledKm && leg.durationHours === undefined) { limit = end; break; }
    end += leg.distanceKm;
  }
  const distance = Math.min(target, limit), progress = structuredClone(baseline.progress);
  progress.travelledKm = distance; progress.baseHours = hoursAt(progress.itinerary, distance) ?? fail();
  const arrived = distance === progress.itinerary.distanceKm;
  const used = factor > 0 ? Math.min(hours, baseline.hoursUsed / factor) : arrived ? 0 : hours;
  return { ...baseline, progress, distanceKm: distance - value.travelledKm,
    position: positionAt(progress.itinerary, distance), hoursUsed: used, hoursRemaining: Math.max(0, hours - used),
    status: arrived ? 'arrived' : baseline.status === 'needs-speed' || distance === limit && limit < progress.itinerary.distanceKm ? 'needs-speed' : 'moving' };
}
