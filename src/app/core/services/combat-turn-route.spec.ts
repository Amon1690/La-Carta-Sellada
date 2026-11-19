import type { CombatAction, Combatant, CombatTurnRoute } from '../models/combat';
import type { VisionObstacle } from '../models/vision';
import { freshMovement, movementPath, movementRoutes } from './combat-movement';
import { advanceTurnRoute, createTurnRoute, handleRouteWindow, openRouteWindow, routeSpent, turnRouteProblem, validTurnRoute } from './combat-turn-route';
import { VttCombat, validState } from './vtt-combat';
const grid = 51.2, allowed = Array.from({ length: 600 }, (_, i) => i);
function hero(id = 'a', x = 0): Combatant {
  return { id, actorId: 'player:' + id, name: id, x, y: 0, size: 1, side: 'party', hp: 20, maxHp: 20, armorClass: 12,
    saves: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 }, actions: [], reactions: [], resources: [], attacksPerTurn: 2, notes: [], profile: { actions: [], reactions: [], resources: [] }, movement: { speed: 9, bonusDash: true, bonusDisengage: true } };
}
function obstacle(open = false): VisionObstacle { return { id: 'wall', name: 'Puerta', kind: 'door', start: { x: grid, y: 0 }, end: { x: grid, y: grid }, blocksSight: true, blocksEffect: true, open, source: { kind: 'director', reference: 'Prueba' } }; }
describe('Trayecto privado por pasos y ventanas persistentes', () => {
  let actor: Combatant;
  const path = () => movementPath(actor, [actor], [], [1, 2, 3], allowed)!;
  const route = () => createTurnRoute('route', actor, freshMovement(), path());
  beforeEach(() => { actor = hero(); });
  it('valida el trayecto exacto y coincide con los costes de rutas alcanzables', () => {
    const routes = movementRoutes(actor, [actor], [], allowed, 9);
    for (const target of routes) expect(movementPath(actor, [actor], [], target.path, allowed)?.cost).withContext(String(target.cell)).toBe(target.cost);
    expect(path()).toEqual({ path: [1, 2, 3], stepCosts: [1.5, 1.5, 1.5], cost: 4.5 });
  });
  it('atraviesa un aliado sin permitir detenerse voluntariamente en su casilla', () => {
    const ally = hero('b', grid);
    expect(movementPath(actor, [actor, ally], [], [1, 2], allowed)?.stepCosts).toEqual([1.5, 1.5]);
    expect(movementPath(actor, [actor, ally], [], [1], allowed)).toBeUndefined();
    expect(movementRoutes(actor, [actor, ally], [], allowed, 3).find(r => r.cell === 2)?.path).toEqual([1, 2]);
  });
  it('un ocupante enemigo bloquea; incapacitado cuesta más y no se puede acabar encima', () => {
    const enemy = { ...hero('b', grid), side: 'enemy' as const };
    expect(movementPath(actor, [actor, enemy], [], [1, 2], allowed)).toBeUndefined();
    enemy.conditions = ['incapacitated']; actor.conditions = ['prone'];
    expect(movementPath(actor, [actor, enemy], [], [1, 2], allowed)?.stepCosts).toEqual([4.5, 3]);
    expect(movementPath(actor, [actor, enemy], [], [1], allowed)).toBeUndefined();
  });
  it('revisa obstáculos físicos y no presume geometría si falta', () => {
    expect(movementPath(actor, [actor], undefined, [1], allowed)).toBeUndefined();
    expect(movementPath(actor, [actor], [obstacle()], [1], allowed)).toBeUndefined();
    expect(movementPath(actor, [actor], [obstacle(true)], [1], allowed)?.cost).toBe(1.5);
  });
  it('rechaza diagonales, saltos, borde de fila y casillas no permitidas', () => {
    for (const steps of [[31], [2], [-1], [600], [1.5]]) expect(movementPath(actor, [actor], [], steps, allowed)).toBeUndefined();
    expect(movementPath(actor, [actor], [], [1], [])).toBeUndefined();
    actor.x = 29 * grid; expect(movementPath(actor, [actor], [], [30], allowed)).toBeUndefined();
    actor.x = 1; expect(movementPath(actor, [actor], [], [1], allowed)).toBeUndefined();
  });
  it('mantiene la huella completa de tokens grandes', () => {
    actor.size = 2; actor.x = 28 * grid;
    expect(movementPath(actor, [actor], [], [29], allowed)).toBeUndefined();
    expect(movementPath(actor, [actor], [], [58], allowed)?.cost).toBe(1.5);
  });
  it('preparar la ruta no mueve ni consume; exige presupuesto confirmado para todo el sufijo', () => {
    const turn = freshMovement(), original = structuredClone(turn);
    expect(routeSpent(createTurnRoute('route', actor, turn, path()))).toBe(0);
    expect(turn).toEqual(original); expect(actor.x).toBe(0);
    actor.movement!.speed = 3; expect(() => createTurnRoute('route', actor, turn, path())).toThrow();
    actor.movement!.speed = undefined; expect(() => createTurnRoute('route', actor, turn, path())).toThrow();
  });
  it('pausa antes de gastar y conserva la misma ventana al recargar', () => {
    const initial = route(), paused = openRouteWindow(initial, 'window');
    expect(() => advanceTurnRoute(paused, actor, freshMovement(), path(), ['enemy'])).toThrow();
    expect(paused.next).toBe(0); expect(routeSpent(paused)).toBe(0); expect(actor.x).toBe(0);
    expect(openRouteWindow(structuredClone(paused), 'another')).toEqual(paused);
    expect(initial.window).toBeUndefined();
  });
  it('omitir se conserva sin gastar reacción y un segundo reactor sigue pendiente', () => {
    let paused = handleRouteWindow(openRouteWindow(route(), 'window'), 'window', 'enemy');
    expect(paused.window?.handled).toEqual(['enemy']); expect(routeSpent(paused)).toBe(0);
    expect(() => advanceTurnRoute(paused, actor, freshMovement(), path(), ['enemy', 'other'])).toThrow();
    paused = handleRouteWindow(paused, 'window', 'other');
    expect(advanceTurnRoute(paused, actor, freshMovement(), path(), ['enemy', 'other']).cost).toBe(1.5);
    expect(() => handleRouteWindow(paused, 'window', 'enemy')).toThrow();
    expect(() => handleRouteWindow(paused, 'obsolete', 'new')).toThrow();
  });
  it('confirma un paso atómico y no vuelve a cobrarlo después de restaurar', () => {
    const first = advanceTurnRoute(route(), actor, freshMovement(), path(), []);
    expect(first.movement.spent).toBe(1.5); expect(first.to).toEqual({ x: grid, y: 0 }); expect(actor.x).toBe(0);
    Object.assign(actor, first.to);
    const saved = structuredClone(first.route!);
    expect(validTurnRoute(saved)).toBeTrue();
    const live = movementPath(actor, [actor], [], saved.path.slice(saved.next), allowed)!;
    const second = advanceTurnRoute(saved, actor, first.movement, live, []);
    expect(second.movement.spent).toBe(3); expect(second.route?.next).toBe(2);
    expect(() => advanceTurnRoute(routeWithOrigin(), actor, first.movement, live, [])).toThrow();
    function routeWithOrigin(): CombatTurnRoute { return { ...saved, next: 0 }; }
  });
  it('completar elimina la ruta sin tocar la acción, Correr ni Destrabarse', () => {
    let current = route(), turn = { ...freshMovement(), dashes: 1, action: 'dash' as const, bonus: 'disengage' as const, disengaged: true };
    for (let i = 0; i < 3; i++) {
      const live = movementPath(actor, [actor], [], current.path.slice(current.next), allowed);
      const step = advanceTurnRoute(current, actor, turn, live, []);
      Object.assign(actor, step.to); turn = step.movement as typeof turn;
      if (step.route) current = step.route; else expect(i).toBe(2);
    }
    expect(turn.spent).toBe(4.5); expect(turn.action).toBe('dash'); expect(turn.bonus).toBe('disengage');
  });
  it('detiene el recorrido por muerte, velocidad cero, nueva posición o nuevo gasto', () => {
    const planned = route(), turn = freshMovement(), live = path();
    actor.hp = 0; expect(turnRouteProblem(planned, actor, turn, live)).toBeDefined(); actor.hp = 20;
    actor.conditions = ['restrained']; expect(turnRouteProblem(planned, actor, turn, live)).toBeDefined(); actor.conditions = [];
    actor.x = grid; expect(turnRouteProblem(planned, actor, turn, live)).toBeDefined(); actor.x = 0;
    expect(turnRouteProblem(planned, actor, { ...turn, spent: 1.5 }, live)).toBeDefined();
  });
  it('revalida costes, ocupantes y ruta exacta antes de continuar', () => {
    const planned = route(), turn = freshMovement(); actor.conditions = ['prone'];
    expect(turnRouteProblem(planned, actor, turn, path())).toBeDefined(); actor.conditions = [];
    const hidden = { ...hero('hidden', grid), side: 'enemy' as const };
    expect(turnRouteProblem(planned, actor, turn, movementPath(actor, [actor, hidden], [], planned.path, allowed))).toBeDefined();
    expect(turnRouteProblem(planned, actor, turn, { path: [30, 31, 1], stepCosts: [1.5, 1.5, 1.5], cost: 4.5 })).toBeDefined();
  });
  it('recalcula un cambio positivo de velocidad y detiene si el presupuesto ya no cubre el sufijo', () => {
    const planned = route(), live = path(); actor.movement!.speed = 6;
    expect(turnRouteProblem(planned, actor, freshMovement(), live)).toBeUndefined();
    actor.movement!.speed = 3; expect(turnRouteProblem(planned, actor, freshMovement(), live)).toBeDefined();
  });
  it('rechaza tamaños o costes ausentes, incluidos huecos en arrays recibidos', () => {
    const planned = route();
    expect(validTurnRoute({ ...planned, stepCosts: new Array(3) })).toBeFalse();
    expect(validTurnRoute({ ...planned, window: { id: 'window', step: 0, handled: new Array(1) } })).toBeFalse();
    actor.size = NaN; expect(movementPath(actor, [actor], [], [1], allowed)).toBeUndefined();
    actor.size = 0; expect(movementPath(actor, [actor], [], [1], allowed)).toBeUndefined();
  });
  it('cada nuevo paso necesita su propia ventana y vuelve a contrastar los reactores', () => {
    const paused = handleRouteWindow(openRouteWindow(route(), 'first'), 'first', 'enemy');
    const step = advanceTurnRoute(paused, actor, freshMovement(), path(), ['enemy']); Object.assign(actor, step.to);
    expect(step.route?.window).toBeUndefined();
    const live = movementPath(actor, [actor], [], step.route!.path.slice(step.route!.next), allowed);
    expect(() => advanceTurnRoute(step.route!, actor, step.movement, live, ['enemy'])).toThrow();
    expect(openRouteWindow(step.route!, 'second').window?.step).toBe(1);
  });
  it('conserva guardados antiguos y bloquea operaciones ordinarias durante una ruta restaurada', () => {
    const combat = new VttCombat(() => [actor], () => actor.id, () => {}, () => {}); combat.start(actor.id);
    const old = structuredClone(combat.state()); expect(validState(old)).toBeTrue();
    combat.restore({ ...old, route: openRouteWindow(route(), 'window') });
    expect(combat.error()).toBe(''); expect(combat.busy()).toBeTrue(); expect(combat.canAttack(actor.id)).toBeFalse();
    expect(() => combat.spendMovement(actor.id, 1.5)).toThrow(); expect(() => combat.end()).toThrow();
    expect((combat.serialized() as { route: CombatTurnRoute }).route.window?.id).toBe('window');
  });
  it('preserva sin sobrescribir una ruta corrupta o de otro turno', () => {
    const combat = new VttCombat(() => [actor], () => actor.id, () => {}, () => {}); combat.start(actor.id); const state = structuredClone(combat.state());
    for (const invalid of [{ ...route(), path: [31] }, { ...route(), next: 3 }, { ...route(), stepCosts: [NaN, 1.5, 1.5] }, { ...route(), moverId: 'another' }, { ...route(), window: { id: 'window', step: 1, handled: [] } }, { ...route(), window: { id: 'window', step: 0, handled: ['enemy', 'enemy'] } }]) {
      const saved = { ...state, route: invalid }; combat.restore(saved); expect(combat.error()).not.toBe(''); expect(combat.serialized()).toEqual(saved);
    }
  });
});

describe('Coordinación privada del motor de movimiento y oportunidades', () => {
  const normal = { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1, confirmed: true };
  const strike: CombatAction = { source: 'weapon', name: 'Arma confirmada', kind: 'melee', resolution: 'attack', bonus: 4, range: 1.5, targets: 1, repeatTargets: false, damage: [{ dice: '2', type: 'contundente' }], halfOnSave: false, reviewed: true, resourceConfirmed: true, notes: '' };
  let actors: Combatant[], engine: VttCombat, saved: unknown, die: jasmine.Spy, commitFailure: boolean, stopAllowed: boolean;
  function make(): VttCombat {
    const e = new VttCombat(() => actors, () => 'a', hp => {
      if (commitFailure) throw new Error('No se pudo guardar');
      if (hp) actors = actors.map(actor => actor.id === hp.id ? { ...actor, hp: hp.hp } : actor);
      saved = structuredClone(e.serialized());
    }, () => {}, die, () => ({ visible: true, lineOfEffect: true, perception: 'normal', reasons: [] }), undefined, undefined, undefined, {
      path: (actor, suffix) => movementPath(actor, actors, [], suffix, allowed),
      move: (id, to) => { const previous = actors; actors = actors.map(actor => actor.id === id ? { ...actor, ...to } : actor); return () => { actors = previous; }; },
      canStop: () => stopAllowed,
    }); return e;
  }
  beforeEach(() => {
    actors = [hero('a', grid), { ...hero('b'), side: 'enemy', actions: [structuredClone(strike)] }];
    die = jasmine.createSpy('die').and.returnValue(10); commitFailure = false; stopAllowed = true; engine = make(); engine.start('a');
  });
  it('abre una ventana antes de salir y bloquea ataques, turno y movimiento ordinarios', () => {
    engine.planMove([2, 3]); expect(engine.continueMove()).toBe('window');
    expect(actors[0].x).toBe(grid); expect(engine.state().movement?.spent).toBe(0); expect(die).not.toHaveBeenCalled();
    expect(engine.state().route?.window?.step).toBe(0); expect(engine.canAttack('a')).toBeFalse();
    expect(() => engine.turn('b')).toThrow(); expect(() => engine.spendMovement('a', 1.5)).toThrow();
  });
  it('aceptar conserva la ventana, gasta una reacción y espera la resolución antes del paso', () => {
    engine.planMove([2, 3]); engine.continueMove(); const window = engine.state().route!.window!.id;
    engine.beginOpportunity('b', strike.source, 'a', { x: 2 * grid, y: 0 }, 'speed', {}, window);
    expect(engine.state().reactionUsed).toEqual(['b']); expect(engine.state().route?.window?.handled).toEqual(['b']);
    expect(engine.state().usedAttacks).toBe(0); expect(engine.state().movement?.spent).toBe(0); expect(die).not.toHaveBeenCalled();
    const restored = make(); restored.restore(saved); engine = restored;
    expect(() => engine.continueMove()).toThrow(); expect(die).not.toHaveBeenCalled();
    engine.resolveResponse(normal); engine.finish(true); expect(actors[0].hp).toBe(18);
    expect(engine.continueMove()).toBe('moved'); expect(engine.state().movement?.spent).toBe(1.5);
    expect(engine.continueMove()).toBe('complete'); expect(engine.state().route).toBeUndefined(); expect(actors[0].x).toBe(3 * grid);
    expect(engine.state().movement?.spent).toBe(3); expect(engine.state().reactionUsed).toEqual(['b']);
  });
  it('omitir persiste sin gastar reacción y no se admite responder dos veces', () => {
    engine.planMove([2]); engine.continueMove(); const window = engine.state().route!.window!.id;
    engine.skipOpportunity(window, 'b'); expect(engine.state().reactionUsed).toEqual([]);
    expect(() => engine.skipOpportunity(window, 'b')).toThrow();
    engine = make(); engine.restore(saved); expect(engine.continueMove()).toBe('complete'); expect(die).not.toHaveBeenCalled();
  });
  it('rechaza ventana, destino o ataque obsoletos antes de gastar recursos', () => {
    engine.planMove([2]); engine.continueMove(); const window = engine.state().route!.window!.id;
    expect(() => engine.beginOpportunity('b', strike.source, 'a', { x: 2 * grid, y: 0 }, 'speed', {}, 'old')).toThrow();
    expect(() => engine.beginOpportunity('b', strike.source, 'a', { x: 3 * grid, y: 0 }, 'speed', {}, window)).toThrow();
    actors[1].actions = [];
    expect(() => engine.beginOpportunity('b', strike.source, 'a', { x: 2 * grid, y: 0 }, 'speed', {}, window)).toThrow();
    expect(engine.state().reactionUsed).toEqual([]); expect(engine.state().route?.window?.handled).toEqual([]); expect(die).not.toHaveBeenCalled();
  });
  it('mantiene oportunidades de varios reactores hasta resolverlas individualmente', () => {
    actors.push({ ...hero('c'), y: grid, side: 'enemy', actions: [structuredClone(strike)] });
    engine.planMove([2]); engine.continueMove(); const window = engine.state().route!.window!.id;
    expect(engine.routeOpportunities().map(candidate => candidate.reactorId)).toEqual(['b', 'c']);
    engine.skipOpportunity(window, 'b'); expect(engine.continueMove()).toBe('window');
    expect(engine.routeOpportunities().map(candidate => candidate.reactorId)).toEqual(['c']);
    engine.skipOpportunity(window, 'c'); expect(engine.continueMove()).toBe('complete');
  });
  it('Destrabarse evita las oportunidades; Correr conserva sus provocaciones', () => {
    engine.takeTurnAction('a', 'disengage'); engine.planMove([2]); expect(engine.continueMove()).toBe('complete');
    expect(engine.state().reactionUsed).toEqual([]); expect(engine.state().movement?.action).toBe('disengage');
    actors[0].x = grid; engine.turn('a', true); engine.takeTurnAction('a', 'dash'); engine.planMove([2]);
    expect(engine.continueMove()).toBe('window'); expect(engine.state().movement?.action).toBe('dash');
  });
  it('el daño o una posición/coste distintos interrumpen sin regalar ni repetir pasos', () => {
    engine.planMove([2, 3]); engine.continueMove(); engine.skipOpportunity(engine.state().route!.window!.id, 'b');
    expect(engine.continueMove()).toBe('moved'); const spent = engine.state().movement!.spent;
    actors[0].hp = 0; expect(() => engine.continueMove()).toThrow(); expect(engine.state().movement!.spent).toBe(spent);
    actors[0].hp = 20; actors[0].conditions = ['prone']; expect(() => engine.continueMove()).toThrow();
    actors[0].conditions = []; actors[0].x = 4 * grid; expect(() => engine.continueMove()).toThrow();
    engine.cancelMove(); expect(engine.state().route).toBeUndefined(); expect(engine.state().movement!.spent).toBe(spent);
  });
  it('revierte posición, gasto y cursor juntos si guardar el paso falla', () => {
    engine.takeTurnAction('a', 'disengage'); engine.planMove([2]); const previous = structuredClone(engine.serialized());
    commitFailure = true; expect(() => engine.continueMove()).toThrowError('No se pudo guardar');
    expect(actors[0].x).toBe(grid); expect(engine.serialized()).toEqual(previous);
    commitFailure = false; expect(engine.continueMove()).toBe('complete'); expect(engine.state().movement?.spent).toBe(1.5);
  });
  it('no permite cancelar sobre un ocupante ni durante la resolución de una reacción', () => {
    engine.planMove([2]); engine.continueMove(); stopAllowed = false; expect(() => engine.cancelMove()).toThrow(); stopAllowed = true;
    const window = engine.state().route!.window!.id; engine.beginOpportunity('b', strike.source, 'a', { x: 2 * grid, y: 0 }, 'speed', {}, window);
    expect(() => engine.cancelMove()).toThrow(); expect(engine.state().route).toBeDefined();
  });
});
