import type { Combatant, CombatTurnRoute, TurnMovement } from '../models/combat';
import { effectiveSpeed, movementRemaining, type MovementPath } from './combat-movement';

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const cell = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < 600;
const near = (a: number, b: number) => Math.abs(a - b) < .00001;
export function routeSpent(route: CombatTurnRoute): number {
  return route.spentBefore + route.stepCosts.slice(0, route.next).reduce((sum, cost) => sum + cost, 0);
}
/** Validación de guardados; no acredita geometría, visión ni derechos del personaje. */
export function validTurnRoute(value: unknown): value is CombatTurnRoute {
  if (!value || typeof value !== 'object') return false;
  const route = value as CombatTurnRoute;
  if (route.perspective !== undefined && !['personal','director'].includes(route.perspective)) return false;
  if (!id(route.id) || !id(route.moverId) || !cell(route.origin) || !Array.isArray(route.path) || !route.path.length || route.path.length > 600 || !route.path.every(cell) || !Array.isArray(route.stepCosts) || route.stepCosts.length !== route.path.length || Array.from(route.stepCosts).some(cost => !Number.isFinite(cost) || cost <= 0 || cost > 10000) || !Number.isInteger(route.next) || route.next < 0 || route.next >= route.path.length || !Number.isFinite(route.spentBefore) || route.spentBefore < 0 || routeSpent(route) > 100000) return false;
  let previous = route.origin;
  for (const next of route.path) {
    if (Math.abs(next % 30 - previous % 30) + Math.abs(Math.floor(next / 30) - Math.floor(previous / 30)) !== 1) return false;
    previous = next;
  }
  const window = route.window;
  return window === undefined || !!window && id(window.id) && window.step === route.next && Array.isArray(window.handled) && window.handled.length <= 600 && Array.from(window.handled).every(id) && new Set(window.handled).size === window.handled.length && !window.handled.includes(route.moverId);
}
export function createTurnRoute(routeId: string, actor: Combatant, turn: TurnMovement, path: MovementPath, grid = 51.2): CombatTurnRoute {
  const route: CombatTurnRoute = { id: routeId, moverId: actor.id, origin: Math.round(actor.y / grid) * 30 + Math.round(actor.x / grid), path: [...path.path], stepCosts: [...path.stepCosts], next: 0, spentBefore: turn.spent };
  if (!validTurnRoute(route) || !near(path.cost, path.stepCosts.reduce((sum, cost) => sum + cost, 0))) throw new Error('El trayecto no es válido.');
  const problem = turnRouteProblem(route, actor, turn, path, grid);
  if (problem) throw new Error(problem);
  return route;
}
/** Se vuelve a calcular el sufijo exacto en el tablero privado antes de llamar a esta función. */
export function turnRouteProblem(route: CombatTurnRoute, actor: Combatant, turn: TurnMovement | undefined, live: MovementPath | undefined, grid = 51.2): string | undefined {
  if (!validTurnRoute(route) || !Number.isFinite(grid) || grid <= 0) return 'El trayecto no es válido.';
  if (actor.id !== route.moverId || actor.hp <= 0) return 'Quien se mueve ya no puede continuar.';
  const current = route.next ? route.path[route.next - 1] : route.origin;
  if (!near(actor.x, current % 30 * grid) || !near(actor.y, Math.floor(current / 30) * grid)) return 'La posición ha cambiado; revisa el recorrido.';
  if (!turn || !near(turn.spent, routeSpent(route))) return 'El gasto de movimiento ha cambiado; revisa el recorrido.';
  const speed = effectiveSpeed(actor), remaining = movementRemaining(actor, turn);
  if (speed === undefined || speed <= 0 || remaining === undefined) return 'Falta movimiento disponible para continuar.';
  const path = route.path.slice(route.next), costs = route.stepCosts.slice(route.next);
  if (!live || live.path.length !== path.length || live.stepCosts.length !== costs.length || live.path.some((step, i) => step !== path[i]) || live.stepCosts.some((cost, i) => !Number.isFinite(cost) || !near(cost, costs[i])) || !near(live.cost, costs.reduce((sum, cost) => sum + cost, 0))) return 'El trayecto o su coste ha cambiado; revisa el recorrido.';
  if (live.cost > remaining + .00001) return 'No queda movimiento para completar el recorrido.';
  return undefined;
}
/** El identificador se crea una sola vez y se conserva al recargar. */
export function openRouteWindow(route: CombatTurnRoute, windowId: string): CombatTurnRoute {
  if (!validTurnRoute(route) || !id(windowId)) throw new Error('Ventana de oportunidad inválida.');
  return route.window ? route : { ...route, window: { id: windowId, step: route.next, handled: [] } };
}
/** Solo la coordinación privada puede responder tras comprobar candidato y propiedad. Omitir no gasta reacción. */
export function handleRouteWindow(route: CombatTurnRoute, windowId: string, reactorId: string): CombatTurnRoute {
  if (!validTurnRoute(route) || !route.window || route.window.id !== windowId || route.window.handled.length >= 600 || !id(reactorId) || reactorId === route.moverId || route.window.handled.includes(reactorId)) throw new Error('Esta ventana ya no está disponible.');
  return { ...route, window: { ...route.window, handled: [...route.window.handled, reactorId] } };
}
/** Devuelve un cambio atómico; el llamante guarda posición, gasto, ruta y exploración juntos. No tira dados. */
export function advanceTurnRoute(route: CombatTurnRoute, actor: Combatant, turn: TurnMovement, live: MovementPath | undefined, reactors: readonly string[], grid = 51.2): { route?: CombatTurnRoute; movement: TurnMovement; to: { x: number; y: number }; cost: number } {
  const problem = turnRouteProblem(route, actor, turn, live, grid);
  if (problem) throw new Error(problem);
  if (reactors.some(reactor => !route.window?.handled.includes(reactor))) throw new Error('Resuelve las oportunidades antes de abandonar el alcance.');
  const to = route.path[route.next], cost = route.stepCosts[route.next], next = route.next + 1;
  return { ...(next < route.path.length ? { route: { ...route, next, window: undefined } } : {}), movement: { ...turn, spent: turn.spent + cost }, to: { x: to % 30 * grid, y: Math.floor(to / 30) * grid }, cost };
}
