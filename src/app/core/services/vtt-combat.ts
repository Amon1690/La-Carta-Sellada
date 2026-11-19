import { unarmedPushProblem, grappleFromDecision, grappleStatus, reconcileGrappleLinks, prepareUnarmedEffect, resolveUnarmedSave, validUnarmedDecision, validGrappleLink } from './combat-unarmed';
import type { GameStatBlock } from '../models/campaign';
import type { UnarmedDecision, UnarmedEffect, UnarmedReview, UnarmedSaveAbility } from '../models/combat';
import { advanceTurnRoute, createTurnRoute, handleRouteWindow, openRouteWindow, routeSpent, turnRouteProblem, validTurnRoute } from './combat-turn-route';
import { OpportunityCause, opportunityCandidates } from './combat-opportunity';
import type { MovementPath } from './combat-movement';
import { effectiveSpeed, freshMovement, movementRemaining, turnActionLabels } from './combat-movement';
import type { CombatTurnRoute, TurnAction } from '../models/combat';
import { AreaPoint, originDistance, tokenCentre, tokensInArea, validArea, validAreaPoint } from './combat-area';
import { signal } from '@angular/core';
import type { SightAssessment } from './vision-preview';
import { CombatAction, Combatant, CombatCost, CombatNarrativeMessage, CombatPending, CombatProfile, CombatReaction, CombatResolution, CombatResource, CombatRoll, CombatState } from '../models/combat';
import { actionProblem, combatDistance, diceParts, normalizeCombat, reactionProblem, rollDice } from './combat-rules';

const fresh = (): CombatState => ({ version: 1, started: false, round: 1, usedAttacks: 0, spellUsed: false,
  movement: freshMovement(), reactionUsed: [], armorEffects: {}, resources: {}, log: [], queue: [], slotsSpent: [] });
export interface AttackContext { advantage: boolean; disadvantage: boolean; armorAdjustment: number; damageFactor: number; confirmed: boolean; rangeResolved?: boolean }

/** Adaptador privado: move aplica posición/exploración juntas o falla sin cambios; devuelve su reversión. */
export interface CombatMovementBoard {
  grid?: number;
  path: (actor: Combatant, suffix: readonly number[], perspective?: 'personal' | 'director') => MovementPath | undefined;
  move: (id: string, to: { x: number; y: number }) => () => void;
  canStop: (actor: Combatant) => boolean;
  unarmed?: (decision: UnarmedDecision, to?: { x: number; y: number }) => () => void;
}

/** Estado independiente por tablero. Los dados pendientes se conservan antes de aplicar daño. */
export class VttCombat {
  readonly state = signal<CombatState>(fresh());
  readonly error = signal('');
  readonly saving = signal(false);
  private invalid?: unknown;
  private context: AttackContext = { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1, confirmed: false };
  constructor(private readonly sourceCombatants: () => Combatant[], readonly activeId: () => string | undefined,
    private readonly commitBoard: (hp?: { id: string; hp: number }) => void,
    private readonly saveProfile: (id: string, profile: CombatProfile) => void | Promise<void>,
    private readonly die: (sides: number) => number = (sides) => Math.floor(Math.random() * sides) + 1,
    readonly sight?: (observerId: string, targetId: string) => SightAssessment | undefined,
    private readonly narrate?: (result: CombatResolution) => CombatNarrativeMessage[],
    readonly situationRevision?: () => unknown,
    readonly areaLineOfEffect?: (from: AreaPoint, to: AreaPoint, space?: Combatant, radius?: number) => boolean | undefined,
    private readonly movementBoard?: CombatMovementBoard) {}

  readonly combatants = (): Combatant[] => {
    const roster = this.sourceCombatants(), links = this.state().grapples;
    if (!links?.length) return roster;
    const effects = new Map<string, { owners: string[]; unknown: boolean }>();
    for (const link of links) {
      const status = grappleStatus(link,roster,this.movementBoard?.grid);
      if (status === 'ended') continue;
      const effect = effects.get(link.targetId) ?? { owners: [], unknown: false };
      if (status === 'active') effect.owners.push(link.ownerId); else effect.unknown = true;
      effects.set(link.targetId,effect);
    }
    return roster.map(actor => {
      const effect = effects.get(actor.id); if (!effect) return actor;
      return { ...actor, grappledBy: effect.owners, grappleUncertain: effect.unknown,
        movement: { ...actor.movement, speed: effect.owners.length ? 0 : undefined, bonusDash: actor.movement?.bonusDash ?? false, bonusDisengage: actor.movement?.bonusDisengage ?? false } };
    });
  };
  reconcileGrapples(hp?: { id: string; hp: number }): void {
    const s = this.state(); if (this.invalid !== undefined || !s.grapples?.length) return;
    const roster = this.sourceCombatants().map(actor => hp?.id === actor.id ? { ...actor, hp: hp.hp } : actor);
    const links = reconcileGrappleLinks(s.grapples,roster,this.movementBoard?.grid);
    if (links.some((link,i)=>link.ended !== s.grapples![i].ended)) this.state.set({...s,grapples:links});
  }
  private commit(hp?: { id: string; hp: number }): void { this.reconcileGrapples(hp); this.commitBoard(hp); }
  find(id: string | undefined): Combatant | undefined { return this.combatants().find((a) => a.id === id); }
  busy(): boolean { return this.saving() || !!this.state().pending || !!this.state().unarmed || !!this.state().route || this.invalid !== undefined; }
  serialized(): unknown { return this.invalid !== undefined ? this.invalid : this.state(); }
  setResource(ownerId: string, resourceId: string, amount: number): void {
    const owner = this.find(ownerId), resource = owner?.resources.find((r) => r.id === resourceId);
    if (!owner || !resource || !Number.isInteger(amount) || amount < 0 || amount > resource.maximum) throw new Error('Disponibilidad de recurso inválida');
    this.state.update((s) => ({ ...s, resources: { ...s.resources, [ownerId]: { ...s.resources[ownerId], [resourceId]: amount } }, log: this.log(`${owner.name}: ${resource.name} ajustado a ${amount}/${resource.maximum}.`, s.log) }));
    this.commit();
  }
  restore(value: unknown): void {
    this.invalid = undefined; this.error.set('');
    if (value === undefined) { this.state.set(fresh()); return; }
    let valid = false;
    try { valid = validState(value); } catch { valid = false; }
    if (!valid) {
      this.invalid = value;
      this.state.set(fresh()); this.error.set('El estado de combate no es válido. Se conserva sin sobrescribir: restaura una copia o restablece el combate explícitamente.'); return;
    }
    const saved = value as CombatState;
    this.state.set(structuredClone(saved)); this.reconcileGrapples();
    if (saved.context) this.context = { ...saved.context };
  }
  reset(): void { this.invalid = undefined; this.error.set(''); this.state.set(fresh()); this.commit(); }
  end(): void {
    if (this.busy()) throw new Error('Resuelve el ataque pendiente');
    const s = this.state(); this.state.set({ ...fresh(), resources: s.resources, grapples: s.grapples, narrative: s.narrative, log: this.log('Combate finalizado. PG y recursos se conservan.', s.log) }); this.commit();
  }
  start(id: string): void {
    if (this.busy() || this.state().started || !this.find(id)) throw new Error('Resuelve primero la acción pendiente');
    const resources = this.state().resources;
    this.state.set({ ...fresh(), started: true, turnId: id, resources, grapples: this.state().grapples, narrative: this.state().narrative, log: this.log('Combate iniciado. Los recursos disponibles se conservan.', this.state().log) });
    this.commit();
  }
  turn(id: string, nextRound = false): void {
    if (!this.state().started || (id === this.state().turnId && !nextRound)) return;
    if (this.busy()) throw new Error('Resuelve el ataque pendiente antes de cambiar de turno');
    const s = this.state(), armorEffects = { ...s.armorEffects }; delete armorEffects[id];
    this.state.set({ ...s, turnId: id, round: s.round + (nextRound ? 1 : 0), usedAttacks: 0, spellUsed: false, movement: freshMovement(),
      reactionUsed: s.reactionUsed.filter((owner) => owner !== id), armorEffects,
      slotsSpent: [],
      log: this.log(`Turno de ${this.find(id)?.name ?? id}. Recupera su reacción; terminan sus efectos de Escudo.`, s.log) });
    this.commit();
  }
  canAttack(id: string): boolean {
    const actor = this.find(id), s = this.state();
    return !!actor && s.started && s.turnId === id && this.activeId() === id && !this.busy() && actor.hp > 0 && !actor.conditions?.includes('incapacitated') && !actor.grappleUncertain && actor.maxHp > 0 && actor.armorClass !== undefined && (!s.movement?.action || s.movement.action === 'attack') && !s.spellUsed && s.usedAttacks < actor.attacksPerTurn;
  }
  movementStatus(id: string) {
    const actor = this.find(id), s = this.state(), isTurn = s.started && s.turnId === id, turn = isTurn ? s.movement : undefined;
    const ownTurn = !!actor && s.started && s.turnId === id && this.activeId() === id && !this.busy() && actor.hp > 0 && !actor.grappleUncertain;
    const remaining = isTurn ? actor && movementRemaining(actor, turn) : 0;
    const options: TurnAction[] = ownTurn ? (['dash', 'disengage', 'bonus-dash', 'bonus-disengage', 'stand'] as TurnAction[]).filter(a => this.canTurnAction(id, a)) : [];
    return { active: ownTurn, speed: actor && effectiveSpeed(actor), spent: turn?.spent ?? 0, remaining,
      actionUsed: isTurn && (!!turn?.action || s.usedAttacks > 0 || s.spellUsed), bonusUsed: !!turn?.bonus, disengaged: turn?.disengaged ?? false, options,
      message: !isTurn ? '' : actor?.grappleUncertain ? 'Confirma los datos del agarre antes de actuar.' : actor?.grappledBy?.length ? 'Agarrado: velocidad 0 mientras continúe el agarre.' : !turn ? 'Turno anterior sin registro de movimiento: avanza al siguiente turno.' : actor?.movement?.speed === undefined ? 'Falta confirmar la velocidad terrestre en la ficha.' : '' };
  }
  canTurnAction(id: string, action: TurnAction): boolean {
    const actor = this.find(id), s = this.state(), turn = s.movement;
    if (!actor || !turn || !s.started || s.turnId !== id || this.activeId() !== id || this.busy() || actor.hp <= 0 || actor.grappleUncertain) return false;
    const speed = effectiveSpeed(actor);
    if (action === 'stand') return !!actor.conditions?.includes('prone') && speed !== undefined && speed > 0 && movementRemaining(actor, turn)! + .00001 >= Math.floor(speed / .3 / 2) * .3;
    if (actor.conditions?.includes('incapacitated')) return false;
    if (action.includes('dash') && (speed === undefined || speed <= 0)) return false;
    if (action.startsWith('bonus-')) return !turn.bonus && !!(action === 'bonus-dash' ? actor.movement?.bonusDash : actor.movement?.bonusDisengage);
    return !turn.action && !s.usedAttacks && !s.spellUsed;
  }
  takeTurnAction(id: string, action: TurnAction, commit = true): void {
    if (!this.canTurnAction(id, action)) throw new Error('Esta acción no está disponible en este turno.');
    const turn = { ...this.state().movement! };
    if (action === 'stand') turn.spent += Math.floor(effectiveSpeed(this.find(id)!)! / .3 / 2) * .3;
    else {
      const kind = action.includes('dash') ? 'dash' : 'disengage';
      if (action.startsWith('bonus-')) turn.bonus = kind; else turn.action = kind;
      if (kind === 'dash') turn.dashes++; else turn.disengaged = true;
    }
    this.state.update(s => ({ ...s, movement: turn, log: this.log(this.find(id)!.name + ': ' + turnActionLabels[action] + '.', s.log) }));
    if (commit) this.commit();
  }
  spendMovement(id: string, cost: number, commit = true): void {
    const status = this.movementStatus(id);
    if (!status.active || status.remaining === undefined || !Number.isFinite(cost) || cost <= 0 || cost > status.remaining + .00001) throw new Error('No queda movimiento suficiente.');
    this.state.update(s => ({ ...s, movement: { ...s.movement!, spent: s.movement!.spent + cost } }));
    if (commit) this.commit();
  }
  /** Solo recibe una ruta comprobada por el tablero privado, nunca datos de geometría del jugador. */
  planMove(path: readonly number[], perspective: 'personal' | 'director' = 'personal'): void {
    const actor = this.find(this.state().turnId), status = actor && this.movementStatus(actor.id);
    if (!actor || !status?.active || !this.state().movement || !this.movementBoard || this.state().queue.length || this.state().areaCast) throw new Error('Este movimiento no está disponible.');
    const checked = this.movementBoard.path(actor, path, perspective);
    if (!checked) throw new Error('Revisa el recorrido.');
    const route = createTurnRoute(crypto.randomUUID(), actor, this.state().movement!, checked, this.movementBoard.grid);
    this.state.update(s => ({ ...s, route: { ...route, perspective } })); this.commit();
  }
  private checkedRoute(): { route: CombatTurnRoute; actor: Combatant; path: MovementPath } {
    const s = this.state(), route = s.route, actor = route && this.find(route.moverId);
    if (!route || !actor || actor.grappleUncertain || !this.movementBoard || this.saving() || this.invalid !== undefined || s.pending || s.unarmed || s.queue.length || !s.started || s.turnId !== route.moverId || this.activeId() !== route.moverId) throw new Error('Resuelve primero la acción pendiente.');
    const path = this.movementBoard.path(actor, route.path.slice(route.next), route.perspective ?? 'personal');
    const problem = turnRouteProblem(route, actor, s.movement, path, this.movementBoard.grid);
    if (problem) throw new Error(problem);
    return { route, actor, path: path! };
  }
  /** Lista privada; la proyección de jugadores filtra propiedad, ventana y visión antes de publicar. */
  routeOpportunities() {
    const { route, actor } = this.checkedRoute(), next = route.path[route.next], grid = this.movementBoard!.grid ?? 51.2;
    return opportunityCandidates(actor, { x: next % 30 * grid, y: Math.floor(next / 30) * grid }, this.combatants(), {
      cause: 'speed', disengaged: !!this.state().movement?.disengaged, reactionUsed: new Set(this.state().reactionUsed),
      sight: (observer, target) => this.sight?.(observer, target), available: (owner, action) => this.available(owner, action.cost), grid,
    }).filter(candidate => !route.window?.handled.includes(candidate.reactorId));
  }
  /** Confirma como máximo un paso. Nunca avanza mientras hay una respuesta o reacción pendiente. */
  continueMove(): 'window' | 'moved' | 'complete' {
    const { route, actor, path } = this.checkedRoute(), candidates = this.routeOpportunities();
    if (candidates.length) {
      if (!route.window) { this.state.update(s => ({ ...s, route: openRouteWindow(route, crypto.randomUUID()) })); this.commit(); }
      return 'window';
    }
    const previous = this.state(), step = advanceTurnRoute(route, actor, previous.movement!, path, [], this.movementBoard!.grid);
    let undo: (() => void) | undefined;
    try {
      this.state.set({ ...previous, route: step.route, movement: step.movement });
      undo = this.movementBoard!.move(actor.id, step.to); this.commit();
    } catch (error) { this.state.set(previous); undo?.(); throw error; }
    return step.route ? 'moved' : 'complete';
  }
  skipOpportunity(windowId: string, reactorId: string): void {
    const { route } = this.checkedRoute();
    if (!this.routeOpportunities().some(candidate => candidate.reactorId === reactorId)) throw new Error('Esta oportunidad ya no está disponible.');
    const handled = handleRouteWindow(route, windowId, reactorId);
    this.state.update(s => ({ ...s, route: handled })); this.commit();
  }
  cancelMove(): void {
    const s = this.state(), actor = s.route && this.find(s.route.moverId);
    if (!s.route || this.saving() || this.invalid !== undefined || s.pending || s.unarmed || s.queue.length) throw new Error('Resuelve primero la acción pendiente.');
    if (!actor || !this.movementBoard?.canStop(actor)) throw new Error('No se puede terminar en una casilla ocupada; dirección debe resolver la posición.');
    this.state.set({ ...s, route: undefined }); this.commit();
  }
  available(owner: Combatant, cost: CombatCost | undefined): number {
    if (!cost) return Infinity;
    const resource = owner.resources.find((r) => r.id === cost.resourceId);
    if (!resource) return 0;
    if (resource.kind === 'slot' && this.state().slotsSpent.includes(owner.id)) return 0;
    return Math.min(resource.maximum, this.state().resources[owner.id]?.[resource.id] ?? resource.maximum);
  }
  resourceStatus(owner: Combatant, cost: CombatCost | undefined): string {
    if (!cost) return 'Sin gasto adicional';
    return `${owner.resources.find((r) => r.id === cost.resourceId)?.name ?? 'Recurso sin configurar'}: ${this.available(owner, cost)} disponibles; coste ${cost.amount}`;
  }
  setAttacksPerTurn(ownerId: string, amount: number): void | Promise<void> {
    const owner = this.find(ownerId);
    if (!owner || !Number.isInteger(amount) || amount < 1 || amount > 10) throw new Error('Indica entre 1 y 10 ataques de arma por acción según la ficha');
    return this.persistProfile(ownerId, { ...owner.profile, attacksPerTurn: amount });
  }
  targets(actor: Combatant, action: CombatAction): Combatant[] {
    const max = action.longRange ?? action.range ?? -1;
    return this.combatants().filter((t) => t.id !== actor.id && t.maxHp > 0 && t.armorClass !== undefined && combatDistance(actor, t) <= max + 0.001);
  }
  areaTargets(action: CombatAction, origin: AreaPoint): Combatant[] {
    return action.area ? tokensInArea(this.combatants(), origin, action.area.radius).filter(t => this.areaLineOfEffect?.(origin, tokenCentre(t), t, action.area!.radius) !== false) : [];
  }
  areaProblem(actor: Combatant, action: CombatAction, origin: AreaPoint): string | undefined {
    if (!validAreaPoint(origin) || !validArea(action.area)) return 'Indica una casilla y un radio válido.';
    if (originDistance(actor, origin) > (action.range ?? -1) + .001) return 'La casilla está fuera del alcance del lanzamiento.';
    if (this.areaLineOfEffect?.(tokenCentre(actor), origin) === false) return 'Un obstáculo bloquea el lanzamiento hasta esa casilla.';
    const targets = this.areaTargets(action, origin);
    if (!targets.length) return 'No hay tokens afectados en esta área.';
    if (targets.length > 400) return 'El área supera el límite de 400 tokens.';
    if (targets.some(t => t.armorClass === undefined || t.maxHp <= 0)) return 'Completa las fichas de todos los tokens afectados antes de lanzar.';
    return undefined;
  }
  configure(ownerId: string, entry: CombatAction | CombatReaction, resource?: CombatResource, remaining?: number): void | Promise<void> {
    const owner = this.find(ownerId); if (!owner) throw new Error('Ficha no disponible');
    const problem = 'resolution' in entry ? actionProblem(entry) : reactionProblem(entry);
    if (problem) throw new Error(problem);
    if ('effect' in entry && entry.effect === 'counter' && owner.actions.find(a=>a.source===entry.actionSource)?.area) throw new Error('Elige una respuesta sin área; las áreas requieren señalar su origen.');
    if (resource && (!resource.id || !resource.name.trim() || !Number.isInteger(resource.maximum) || resource.maximum < 1 || resource.maximum > 999 || !Number.isInteger(remaining) || remaining! < 0 || remaining! > resource.maximum)) throw new Error('Completa capacidad y disponibilidad del recurso');
    const profile = structuredClone(owner.profile);
    profile.resources = resource ? [...profile.resources.filter((r) => r.id !== resource.id), resource] : profile.resources;
    if (entry.cost && !profile.resources.some((r) => r.id === entry.cost!.resourceId)) throw new Error('El recurso no existe en esta ficha');
    const pool = profile.resources.find((r) => r.id === entry.cost?.resourceId);
    if (pool?.kind === 'slot' && (entry.cost?.amount !== 1 || !Number.isInteger(pool.level) || pool.level! < (entry.spellLevel ?? 1) || ('resolution' in entry && entry.kind === 'spell' && pool.level !== entry.spellLevel) || pool.level! < 1 || pool.level! > 9)) throw new Error('Elige un espacio del nivel del conjuro o superior y coste de un espacio');
    if ('resolution' in entry) profile.actions = [...profile.actions.filter((a) => a.source !== entry.source), entry];
    else profile.reactions = [...profile.reactions.filter((r) => r.source !== entry.source), entry];
    return this.persistProfile(ownerId, profile, () => {
    if (resource) this.state.update((s) => ({ ...s, resources: { ...s.resources, [ownerId]: { ...s.resources[ownerId], [resource.id]: remaining! } },
      log: this.log(`${owner.name}: disponibilidad de ${resource.name} establecida en ${remaining}/${resource.maximum}.`, s.log) }));
    });
  }
  private persistProfile(ownerId: string, profile: CombatProfile, apply?: () => void): void | Promise<void> {
    if (this.saving()) throw new Error('Espera a que se guarde la preparación');
    this.saving.set(true);
    const finish = () => { apply?.(); this.commit(); };
    try {
      const saved = this.saveProfile(ownerId, profile);
      if (saved) return saved.then(finish).finally(() => this.saving.set(false));
      finish(); this.saving.set(false);
    } catch (error) { this.saving.set(false); throw error; }
  }
  begin(source: string, targetIds: string[], context: AttackContext, contexts?: ReadonlyMap<string, AttackContext>, origin?: AreaPoint): void {
    const actor = this.find(this.activeId());
    if (!actor || !this.canAttack(actor.id)) throw new Error('Solo puede atacar el token del turno activo después de iniciar el combate');
    const action = actor.actions.find((a) => a.source === source);
    if (!action) throw new Error('El ataque ya no figura en la ficha actual');
    const problem = actionProblem(action); if (problem) throw new Error(problem);
    if (!context.confirmed || !Number.isFinite(context.armorAdjustment) || ![0, 0.5, 1, 2].includes(context.damageFactor)) throw new Error('Revisa visibilidad, cobertura, resistencias y efectos de las fichas');
    if (action.kind === 'spell' && this.state().usedAttacks > 0) throw new Error('La acción de este turno ya comenzó con un ataque de arma');
    if (action.area) {
      if (!origin) throw new Error('Señala la casilla de origen del área.');
      const problem = this.areaProblem(actor, action, origin); if (problem) throw new Error(problem);
      const expected = this.areaTargets(action, origin).map(t => t.id);
      if (expected.length !== targetIds.length || expected.some(id => !targetIds.includes(id))) throw new Error('Han cambiado los tokens del área; vuelve a revisarla.');
    } else if (origin) throw new Error('La acción no tiene un área configurada.');
    if (!targetIds.length || targetIds.length > (action.area ? 400 : action.targets) || (!action.repeatTargets && new Set(targetIds).size !== targetIds.length)) throw new Error('Número de objetivos o impactos inválido');
    const legal = new Set((action.area ? this.areaTargets(action, origin!) : this.targets(actor, action)).map((t) => t.id));
    if (targetIds.some((id) => !legal.has(id))) throw new Error('Algún objetivo no tiene ficha válida o está fuera del alcance');
    if (!action.area && targetIds.some((id) => this.sight?.(actor.id, id)?.lineOfEffect === false)) throw new Error('Un obstáculo confirmado bloquea la línea de efecto; no se han gastado recursos.');
    if (this.available(actor, action.cost) < (action.cost?.amount ?? 0)) throw new Error('Recursos insuficientes');
    const resourceProblem = this.costProblem(actor, action.cost, action.spellLevel, true); if (resourceProblem) throw new Error(resourceProblem);
    if (contexts && targetIds.some(id => !validTargetContext(contexts.get(id)))) throw new Error('Falta un contexto revisado por objetivo');
    this.context = { ...context, ...(action.area ? { rangeResolved: true } : {}) };
    this.spend(actor, action.cost);
    this.state.update((s) => ({ ...s, movement: s.movement ? { ...s.movement, action: action.kind === 'spell' ? 'spell' : 'attack' } : undefined, usedAttacks: s.usedAttacks + (action.kind === 'spell' ? 0 : 1), spellUsed: s.spellUsed || action.kind === 'spell',
      areaCast: action.area ? { origin: { ...origin! } } : undefined,
      context: { ...this.context }, queue: targetIds.map((targetId, index) => ({ attackerId: actor.id, action: structuredClone(action), targetId, castApproved: index > 0, ...(contexts ? { context: { ...contexts.get(targetId)! } } : {}) })) }));
    this.next();
  }
  /** Se invoca solo para una salida confirmada; la coordinación persistente de la ruta controla la ventana. */
  beginOpportunity(ownerId: string, source: string, moverId: string, to: { x: number; y: number }, cause: OpportunityCause = 'speed', review: { canSee?: boolean; lineOfEffect?: boolean } = {}, windowId?: string): void {
    const s = this.state(), mover = this.find(moverId), owner = this.find(ownerId);
    if (!s.started || this.saving() || this.invalid !== undefined || s.pending || s.unarmed || s.queue.length || s.areaCast || !mover || !owner || mover.hp <= 0) throw new Error('Resuelve primero la acción pendiente.');
    if (!Number.isFinite(mover.armorClass) || mover.maxHp <= 0) throw new Error('Completa la ficha del objetivo antes de reaccionar.');
    let handled: CombatTurnRoute | undefined;
    if (s.route) {
      const { route } = this.checkedRoute(), next = route.path[route.next], grid = this.movementBoard!.grid ?? 51.2;
      if (route.moverId !== moverId || cause !== 'speed' || !windowId || Math.abs(to.x - next % 30 * grid) > .00001 || Math.abs(to.y - Math.floor(next / 30) * grid) > .00001) throw new Error('Esta ventana ya no está disponible.');
      handled = handleRouteWindow(route, windowId, ownerId);
    } else if (windowId !== undefined) throw new Error('Esta ventana ya no está disponible.');
    const candidates = opportunityCandidates(mover, to, this.combatants(), { cause, grid: this.movementBoard?.grid,
      disengaged: s.turnId === moverId && !!s.movement?.disengaged, reactionUsed: new Set(s.reactionUsed),
      sight: (observer, target) => { const sight = this.sight?.(observer, target); return { visible: sight?.visible ?? (review.canSee ? true : undefined), lineOfEffect: sight?.lineOfEffect ?? (review.lineOfEffect ? true : undefined), perception: sight?.perception ?? 'unknown', reasons: sight?.reasons ?? [] }; },
      available: (actor, action) => this.available(actor, action.cost) });
    const candidate = candidates.find(c => c.reactorId === ownerId), entry = candidate?.attacks.find(a => a.action.source === source);
    if (!candidate || candidate.doubts.length || !entry || entry.problem) throw new Error(entry?.problem || candidate?.doubts.join(' ') || 'Esta oportunidad no está disponible.');
    if (!owner.actions.some(a => a.source === source) && owner.unarmed?.source !== source) throw new Error('El ataque ya no está preparado.');
    this.spend(owner, entry.action.cost);
    this.state.update(state => ({ ...state, ...(handled ? { route: handled } : {}), reactionUsed: [...state.reactionUsed, ownerId],
      queue: [{ attackerId: ownerId, targetId: moverId, action: entry.action, reactionAttack: true, opportunity: true }] }));
    this.next();
  }
  /** Entrada exclusiva de dirección; no es una orden de jugador ni aplica efectos al tablero. */
  declareUnarmedOpportunity(ownerId: string, option: UnarmedEffect, stats: GameStatBlock | undefined,
    review: UnarmedReview & { canSee?: boolean; lineOfEffect?: boolean }, windowId: string): void {
    const { route, actor: target } = this.checkedRoute(), owner = this.find(ownerId), s = this.state(), grid = this.movementBoard?.grid ?? 51.2;
    if (!owner?.unarmed || !recordedUnarmedSpace(owner) || !recordedUnarmedSpace(target) || !Number.isFinite(grid) || grid <= 0 || owner.unarmed.source !== 'rule:basic-unarmed-2024' || !Number.isFinite(owner.hp) || owner.hp <= 0 || !Number.isFinite(target.hp) || target.hp <= 0 || owner.conditions?.includes('incapacitated') || owner.grappleUncertain || s.reactionUsed.includes(ownerId) || s.movement?.disengaged) throw new Error('Esta oportunidad sin armas no está disponible.');
    const distance = combatDistance(owner,target,grid), next = route.path[route.next];
    if (combatDistance(owner,{...target,x:next%30*grid,y:Math.floor(next/30)*grid},grid) <= 1.50001) throw new Error('El siguiente paso no abandona el alcance sin armas.');
    const sight = this.sight?.(ownerId,target.id);
    if (sight?.visible === false || sight?.lineOfEffect === false || sight?.visible !== true && review.canSee !== true || sight?.lineOfEffect !== true && review.lineOfEffect !== true) throw new Error('Confirma la visión personal y la línea de efecto.');
    const declaration = prepareUnarmedEffect(option,stats,ownerId,target.id,{ownerSize:review.ownerSize,targetSize:review.targetSize,freeHand:review.freeHand,distance});
    if (owner.unarmed.bonus !== declaration.dc - 8) throw new Error('Las estadísticas de la ficha han cambiado.');
    const handled = handleRouteWindow(route,windowId,ownerId);
    this.state.set({...s,route:handled,unarmed:declaration,reactionUsed:[...s.reactionUsed,ownerId]}); this.commit();
  }
  private unarmedSituation(review: { canSee?: boolean; lineOfEffect?: boolean }) {
    const s = this.state(), declaration = s.unarmed, owner = declaration && this.find(declaration.ownerId), target = declaration && this.find(declaration.targetId), grid = this.movementBoard?.grid ?? 51.2;
    if (!declaration || s.pending || s.queue.length || this.saving() || this.invalid !== undefined || !owner || !target || !recordedUnarmedSpace(owner) || !recordedUnarmedSpace(target) || !Number.isFinite(grid) || grid <= 0 || !Number.isFinite(owner.hp) || !Number.isFinite(target.hp) || owner.hp <= 0 || target.hp <= 0 || owner.conditions?.includes('incapacitated') || owner.grappleUncertain || owner.unarmed?.source !== 'rule:basic-unarmed-2024' || owner.unarmed.bonus !== declaration.dc - 8 || combatDistance(owner,target,grid) > declaration.range + .00001) throw new Error('La situación del efecto ha cambiado; revísala o cancela sin recuperar la reacción.');
    const route = s.route, current = route && (route.next ? route.path[route.next-1] : route.origin);
    if (!route?.window || route.window.step !== route.next || !s.started || route.moverId !== declaration.targetId || s.turnId !== route.moverId || this.activeId() !== route.moverId || !route.window.handled.includes(owner.id) || !s.reactionUsed.includes(owner.id) || current === undefined || Math.abs(target.x-current%30*grid)>.00001 || Math.abs(target.y-Math.floor(current/30)*grid)>.00001) throw new Error('La ventana o posición del efecto ha cambiado.');
    const next = route.path[route.next];
    if (combatDistance(owner,{...target,x:next%30*grid,y:Math.floor(next/30)*grid},grid) <= declaration.range + .00001) throw new Error('El siguiente paso ya no abandona el alcance; revisa o cancela la decisión.');
    const sight = this.sight?.(owner.id,target.id);
    if (sight?.visible === false || sight?.lineOfEffect === false || sight?.visible !== true && review.canSee !== true || sight?.lineOfEffect !== true && review.lineOfEffect !== true) throw new Error('Confirma de nuevo la visión personal y la línea de efecto.');
    return { s, declaration, owner, target, route };
  }
  rollUnarmedOpportunity(ability: UnarmedSaveAbility, modifier: number | undefined,
    facts: { restrained: boolean; advantage: boolean; disadvantage: boolean }, review: { canSee?: boolean; lineOfEffect?: boolean } = {}): void {
    const { s, declaration, target } = this.unarmedSituation(review);
    if (target.conditions?.includes('restrained') && !facts.restrained) throw new Error('El objetivo está restringido: revisa la salvación.');
    const resolved = resolveUnarmedSave(declaration,ability,modifier,this.die,facts);
    this.state.set({...s,unarmed:resolved}); this.commit();
  }
  finishUnarmedGrapple(effectsConfirmed: boolean, review: { canSee?: boolean; lineOfEffect?: boolean } = {}): void {
    if (this.state().unarmed?.effect !== 'grapple') throw new Error('Esta decisión no es un agarre.');
    this.finishUnarmedOpportunity(effectsConfirmed,undefined,review);
  }
  /** Guarda posición/condición/vínculo y decisión juntos; una salvación superada no aplica efecto. */
  finishUnarmedOpportunity(effectsConfirmed: boolean, to?: { x: number; y: number }, review: { canSee?: boolean; lineOfEffect?: boolean } = {}): void {
    const { s, declaration, owner, target } = this.unarmedSituation(review);
    if (!effectsConfirmed || !declaration.save) throw new Error('Confirma la salvación y los efectos sin armas.');
    const failed = !declaration.save.success;
    if (failed && declaration.effect === 'grapple' && (s.grapples?.length ?? 0) >= 500) throw new Error('Se alcanzó la capacidad de agarres guardados; conserva una copia y revisa su historial antes de aplicar otro.');
    if (failed && declaration.effect === 'push') { const problem = unarmedPushProblem(owner,target,to,this.movementBoard?.grid); if (problem) throw new Error(problem); }
    if (failed && declaration.effect !== 'grapple' && !this.movementBoard?.unarmed) throw new Error('El tablero debe confirmar el efecto y su geometría antes de aplicarlo.');
    const link = failed && declaration.effect === 'grapple' ? grappleFromDecision(declaration,crypto.randomUUID()) : undefined;
    if (link && s.grapples?.some(existing=>existing.id===link.id)) throw new Error('Identificador de agarre ya usado.');
    let undo: (()=>void) | undefined;
    try {
      this.state.set({...s,unarmed:undefined,...(failed && declaration.effect === 'push'?{route:undefined}:{}),...(link?{grapples:[...(s.grapples??[]),link]}:{}),
        log:this.log(declaration.save.success?'Salvación superada: el efecto sin armas no se aplica.':declaration.effect==='grapple'?'Agarre aplicado: velocidad 0 y desventaja al atacar a otras criaturas.':declaration.effect==='push'?'Empujón aplicado sin gastar movimiento ni provocar oportunidades; se interrumpe el recorrido anterior.':'Objetivo tumbado; revisa el coste del recorrido antes de continuar.',s.log)});
      if (failed && declaration.effect !== 'grapple') undo = this.movementBoard!.unarmed!(declaration,to);
      this.commit();
    } catch(error) { this.state.set(s); undo?.(); throw error; }
  }
  releaseGrapple(id: string): void {
    const s = this.state(), link = s.grapples?.find(link=>link.id===id);
    if (!link || link.ended || s.pending || s.unarmed || s.queue.length || this.saving() || this.invalid !== undefined) throw new Error('Resuelve primero las decisiones pendientes.');
    this.state.set({...s,grapples:s.grapples!.map(link=>link.id===id?{...link,ended:true}:link),log:this.log('Dirección confirma el fin del agarre; se conserva el gasto del turno.',s.log)}); this.commit();
  }
  cancelUnarmedOpportunity(): void {
    const s = this.state();
    if (!s.unarmed || this.saving() || this.invalid !== undefined || s.pending || s.queue.length) throw new Error('No hay una decisión sin armas que cancelar.');
    this.state.set({...s,unarmed:undefined,log:this.log('Decisión sin armas cancelada por dirección; la reacción gastada se conserva.',s.log)}); this.commit();
  }
  private next(hp?: { id: string; hp: number }): void {
    const [job, ...queue] = this.state().queue;
    if (!job) { this.state.update((s) => ({ ...s, pending: undefined, queue: [], areaCast: undefined })); this.commit(hp); return; }
    const actor = this.find(job.attackerId), target = this.find(job.targetId);
    if (!actor || !target || target.armorClass === undefined) throw new Error('Falta la ficha de una acción pendiente');
    let context: Omit<AttackContext, 'confirmed'> = job.reactionAttack ? { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1 } : job.context ?? this.context;
    if (!context.rangeResolved && job.action.resolution === 'attack' && this.sight) context = { ...context,
      disadvantage: context.disadvantage || this.sight(actor.id, target.id)?.visible === false,
      advantage: context.advantage || this.sight(target.id, actor.id)?.visible === false };
    const long = combatDistance(actor, target) > job.action.range! + 0.001;
    const response = !!job.reactionAttack;
    const casting = response || (job.action.kind === 'spell' && !job.castApproved);
    const roll = !casting && job.action.resolution === 'attack' ? this.attackRoll(job.action.bonus!, context.advantage, context.disadvantage || (!context.rangeResolved && long)) : undefined;
    const save = !casting && job.action.resolution === 'save' ? this.attackRoll(target.saves[job.action.saveAbility!], false, job.action.saveAbility === 'dexterity' && !!target.conditions?.includes('restrained')) : undefined;
    const factor = (save && save.total >= job.action.dc! ? job.action.halfOnSave ? 0.5 : 0 : 1) * context.damageFactor;
    const damage = casting ? [] : this.rollDamage(job.action, roll);
    const pending: CombatPending = { ...(job.opportunity ? { opportunity: true } : {}), context: { ...context }, phase: response ? 'response' : casting ? 'casting' : 'defense', attackerId: actor.id, targetId: target.id, action: job.action, roll, save,
      baseAc: target.armorClass + context.armorAdjustment, extraAc: 0, damage, factor, reduction: 0,
      cancelled: false, redirected: false, manual: !!job.action.effectOnly || !!job.action.manualEffects || !!this.state().areaCast?.manual, effectsConfirmed: false, reactions: [] };
    this.state.update((s) => ({ ...s, pending, queue })); this.commit(hp);
  }
  armor(p = this.state().pending): number { return p ? p.baseAc + p.extraAc + (this.state().armorEffects[p.targetId] ?? 0) : 0; }
  hit(p = this.state().pending): boolean {
    if (!p || p.cancelled) return false;
    if (p.phase === 'casting' || p.phase === 'response') return false;
    if (isMagicMissile(p.action) && (this.state().armorEffects[p.targetId] ?? 0) >= 5) return false;
    return !p.roll || (p.roll.natural !== 1 && (p.roll.natural === 20 || p.roll.total >= this.armor(p)));
  }
  damage(p = this.state().pending): number {
    if (!p || !this.hit(p)) return 0;
    return Math.floor(Math.max(0, p.damage.reduce((sum, d) => sum + d.rolled, 0) - p.reduction) * p.factor);
  }
  reactions(): { owner: Combatant; reaction: CombatReaction; problem?: string }[] {
    const p = this.state().pending; if (!p || p.phase === 'response') return [];
    const target = this.find(p.targetId); if (!target) return [];
    const result: ReturnType<VttCombat['reactions']> = [];
    for (const owner of this.combatants()) {
      if (owner.hp <= 0 || owner.conditions?.includes('incapacitated') || this.state().reactionUsed.includes(owner.id)) continue;
      for (const reaction of owner.reactions) {
        if (p.phase === 'casting' ? reaction.trigger !== 'spell' : reaction.trigger === 'spell') continue;
        if (reaction.trigger === 'spell') {
          const caster = this.find(p.attackerId); if (!caster || caster.id === owner.id || combatDistance(owner, caster) > reaction.range + 0.001) continue;
        } else {
          if (!reaction.protectOthers && owner.id !== target.id) continue;
          if (reaction.protectOthers && (owner.id === target.id || combatDistance(owner, target) > reaction.range + 0.001)) continue;
        }
        if (reaction.meleeOnly && p.action.kind !== 'melee') continue;
        if (reaction.trigger === 'spell' && p.action.kind !== 'spell') continue;
        if (reaction.trigger === 'hit' && ((!p.roll && !isMagicMissile(p.action)) || !this.hit(p))) continue;
        if (reaction.trigger === 'damage' && this.damage(p) <= 0) continue;
        if (reaction.trigger === 'miss' && (!p.roll || this.hit(p))) continue;
        if (normalizeCombat(reaction.name) === 'escudo' && (this.state().armorEffects[target.id] ?? 0) >= 5) continue;
        result.push({ owner, reaction, problem: (owner.grappleUncertain && reaction.effect === 'counter' ? 'Confirma el agarre del reactor antes de gastar una respuesta ofensiva.' : undefined) ?? reactionProblem(reaction) ?? this.costProblem(owner, reaction.cost, reaction.spellLevel) ?? (this.available(owner, reaction.cost) < (reaction.cost?.amount ?? 0) ? 'Recurso agotado' : undefined) });
      }
    }
    return result;
  }
  useReaction(ownerId: string, source: string, redirectId?: string): void {
    const candidate = this.reactions().find((c) => c.owner.id === ownerId && c.reaction.source === source);
    if (!candidate || candidate.problem) throw new Error(candidate?.problem ?? 'Esta reacción no está disponible');
    const { owner, reaction: r } = candidate;
    const p = structuredClone(this.state().pending!);
    const attacker = this.find(p.attackerId)!;
    const redirected = r.effect === 'redirect' ? this.find(redirectId) : undefined;
    const counter = r.effect === 'counter' ? owner.actions.find((a) => a.source === r.actionSource) : undefined;
    if (r.effect === 'redirect' && (!redirected || redirected.id === p.targetId || redirected.armorClass === undefined || combatDistance(owner, redirected) > r.range + 0.001)) throw new Error('Elige un objetivo válido para redirigir');
    if (r.effect === 'counter' && counter?.area) throw new Error('Un ataque de respuesta de área necesita elegir un origen; no se han gastado recursos.');
    if (r.effect === 'counter' && (!counter || actionProblem(counter) || !this.targets(owner, counter).some((t) => t.id === attacker.id) || this.available(owner, counter.cost) < (counter.cost?.amount ?? 0))) throw new Error('Configura un ataque de respuesta válido, con alcance y recursos disponibles');
    this.checkCombinedCosts(owner, [r.cost, counter?.cost]);
    this.spend(owner, r.cost);
    this.state.update((s) => ({ ...s, reactionUsed: [...s.reactionUsed, owner.id] }));
    let effectApplies = true;
    if (r.saveAbility && r.dc) {
      const save = this.attackRoll(attacker.saves[r.saveAbility], false, r.saveAbility === 'dexterity' && !!attacker.conditions?.includes('restrained'));
      effectApplies = save.total < r.dc;
      p.reactions.push(`${attacker.name}: salvación ${save.natural}${signed(save.bonus)} = ${save.total} contra CD ${r.dc}.`);
    }
    if (effectApplies) {
      if (r.effect === 'armor') {
        if (r.duration === 'next-turn') this.state.update((s) => ({ ...s, armorEffects: { ...s.armorEffects, [p.targetId]: (s.armorEffects[p.targetId] ?? 0) + r.amount } }));
        else p.extraAc += r.amount;
      } else if (r.effect === 'reduce') { const rolled = r.dice ? rollDice(r.dice, this.die) : { dice: [], bonus: 0, total: 0 }; const reduction = r.amount + rolled.total; p.reduction += reduction; p.reactions.push(`${r.name}: reducción [${rolled.dice.join(', ')}] + ${rolled.bonus} + ${r.amount} = ${reduction}.`); }
      else if (r.effect === 'half') p.factor *= 0.5;
      else if (r.effect === 'disadvantage' && p.roll && !p.roll.disadvantage) {
        const dice = p.roll.advantage ? [p.roll.dice[0]] : [p.roll.natural, this.die(20)];
        const natural = Math.min(...dice);
        p.roll = { dice, natural, bonus: p.roll.bonus, total: natural + p.roll.bonus, disadvantage: true };
        // Si desaparece el crítico no se reutilizan dados duplicados.
        if (natural !== 20 && p.damage.some((d, i) => d.dice.length > (p.action.damage[i].dice.match(/^(\d+)/)?.[1] ? Number(p.action.damage[i].dice.match(/^(\d+)/)![1]) : 0))) {
          p.damage = p.damage.map((part, i) => { const dice = part.dice.slice(0, diceParts(p.action.damage[i].dice)!.count); return { ...part, dice, rolled: Math.max(0, dice.reduce((sum, n) => sum + n, part.bonus)) }; });
        }
      } else if (r.effect === 'cancel') {
        p.cancelled = true;
        if (p.action.kind === 'spell') this.state.update((s) => ({ ...s, queue: [] }));
        if (r.refundSpell && p.action.kind === 'spell' && p.action.cost) this.refund(attacker, p.action.cost);
      } else if (redirected) {
        p.targetId = redirected.id; p.baseAc = redirected.armorClass!; p.extraAc = 0; p.redirected = true;
      } else if (counter) {
        this.spend(owner, counter.cost);
        const action = structuredClone(counter);
        if (r.dice) action.damage.push({ dice: r.dice, type: action.damage[0].type });
        this.state.update((s) => ({ ...s, queue: [...s.queue, { attackerId: owner.id, targetId: attacker.id, action, reactionAttack: true }] }));
      } else if (r.effect === 'manual') p.manual = true;
    }
    p.reactions.push(`${owner.name} usa ${r.name}${effectApplies ? '' : ' (salvación superada)'}; ${r.cost ? `${r.cost.amount} uso(s) consumido(s)` : 'reacción consumida'}.`);
    this.state.update((s) => ({ ...s, pending: p })); this.commit();
  }
  finish(effectsConfirmed: boolean, manualDamage?: number, manualNote = ''): void {
    const p = this.state().pending, target = p && this.find(p.targetId);
    if (!p || !target) throw new Error('No hay un resultado pendiente válido');
    if (p.phase === 'response') throw new Error('Revisa la situación antes de lanzar el ataque de respuesta');
    if (!effectsConfirmed) throw new Error('Confirma los efectos adicionales de las fichas antes de aplicar el resultado');
    if (p.phase === 'casting' && !p.cancelled) {
      const actor = this.find(p.attackerId); if (!actor) throw new Error('No se encuentra al lanzador');
      const rolled = this.rollDefense(p, p.context ?? this.context);
      this.state.update((s) => ({ ...s, pending: rolled })); this.commit(); return;
    }
    const manual = p.manual || p.manualRequested || (new Set(p.damage.map((d) => d.type)).size > 1 && (p.factor !== 1 || p.reduction > 0)) || manualDamage !== undefined;
    if (manual && (!Number.isInteger(manualDamage) || manualDamage! < 0 || manualDamage! > 10000 || !manualNote.trim())) throw new Error('Indica el daño final y cómo se resolvieron las defensas o efectos especiales');
    const damage = manual ? manualDamage! : this.damage(p);
    const attack = p.roll ? `d20 [${p.roll.dice.join(', ')}]${signed(p.roll.bonus)} = ${p.roll.total}; CA ${this.armor(p)}${p.roll.natural === 20 ? ' (crítico)' : ''}` : p.save ? `salvación ${p.save.natural}${signed(p.save.bonus)} = ${p.save.total}; CD ${p.action.dc}` : 'impacto automático';
    const dice = p.damage.map((d) => `${d.type}: [${d.dice.join(', ')}]${signed(d.bonus)} = ${d.rolled}`).join('; ');
    const message = `${p.opportunity ? 'Oportunidad · ' : ''}${this.find(p.attackerId)?.name ?? p.attackerId} → ${target.name}, ${p.action.name}: ${attack}. ${this.hit(p) ? 'Impacto' : 'Fallo'}. ${dice}. Daño final ${damage}. ${p.reactions.join(' ')} ${manualNote}`;
    const messages = this.narrate?.({ attackerId: p.attackerId, targetId: p.targetId, hit: this.hit(p), damage }) ?? [];
    this.state.update((s) => ({ ...s, pending: undefined, log: this.log(message, s.log),
      ...(messages.length ? { narrative: [...(s.narrative ?? []), { id: crypto.randomUUID(), messages }].slice(-200) } : {}) }));
    this.next({ id: target.id, hp: Math.max(0, target.hp - damage) });
  }
  private rollDefense(p: CombatPending, context: Omit<AttackContext, 'confirmed'>): CombatPending {
    const actor = this.find(p.attackerId), target = this.find(p.targetId);
    if (!actor || !target) throw new Error('No se encuentran las fichas del ataque');
    const long = combatDistance(actor, target) > p.action.range! + .001;
    const roll = p.action.resolution === 'attack' ? this.attackRoll(p.action.bonus!, context.advantage, context.disadvantage || (!context.rangeResolved && long)) : undefined;
    const save = p.action.resolution === 'save' ? this.attackRoll(target.saves[p.action.saveAbility!], false, p.action.saveAbility === 'dexterity' && !!target.conditions?.includes('restrained')) : undefined;
    const damage = this.rollDamage(p.action, roll);
    const factor = (save && save.total >= p.action.dc! ? p.action.halfOnSave ? .5 : 0 : 1) * context.damageFactor;
    return { ...p, context: { ...context }, phase: 'defense', roll, save, damage, factor };
  }
  private rollDamage(action: CombatAction, roll?: CombatRoll): CombatPending['damage'] {
    const previous = action.area && this.state().areaCast?.damage;
    if (previous) return structuredClone(previous);
    const damage = action.damage.map(part => { const d = rollDice(part.dice, this.die, roll?.natural === 20 && part.critical !== false); return { type: part.type, rolled: d.total, dice: d.dice, bonus: d.bonus }; });
    if (action.area && this.state().areaCast) this.state.update(s => ({ ...s, areaCast: { ...s.areaCast!, damage: structuredClone(damage) } }));
    return damage;
  }
  cancelResponse(): void {
    const p = this.state().pending; if (!p || p.phase !== 'response') return;
    this.state.update((s) => ({ ...s, pending: { ...p, phase: 'defense', cancelled: true, manual: false, manualRequested: false, damage: [], reactions: [...p.reactions, 'Ataque de respuesta omitido; la reacción gastada se conserva.'] } }));
    this.finish(true);
  }
  resolveResponse(context: AttackContext): void {
    const p = this.state().pending;
    if (!p || p.phase !== 'response' || !context.confirmed || !Number.isFinite(context.armorAdjustment) || ![0, .5, 1, 2].includes(context.damageFactor)) throw new Error('Confirma la situación del ataque de respuesta');
    const target = this.find(p.targetId); if (!target || target.armorClass === undefined) throw new Error('Falta la ficha del objetivo');
    const reviewed = { ...p, context: { ...context }, baseAc: target.armorClass + context.armorAdjustment };
    this.state.update((s) => ({ ...s, pending: p.action.kind === 'spell' ? { ...reviewed, phase: 'casting' } : this.rollDefense(reviewed, context) })); this.commit();
  }
  requestManualResolution(requested: boolean, entireArea = false): void {
    if (entireArea && this.state().areaCast) this.state.update(s=>({...s,areaCast:{...s.areaCast!,manual:requested}}));
    if (!this.state().pending) return;
    this.state.update((s) => ({ ...s, pending: { ...s.pending!, manualRequested: requested } })); this.commit();
  }
  /** Solo avanza cuando no existe una decisión de reacción o efecto pendiente. */
  settleAutomatic(): void {
    while (this.state().pending) {
      const p = this.state().pending!;
      if (p.phase === 'response') {
        const responder = this.find(p.attackerId);
        if (!responder || responder.hp <= 0 || responder.conditions?.includes('incapacitated')) { this.cancelResponse(); continue; }
        return;
      }
      const mixed = new Set(p.damage.map((part) => part.type)).size > 1 && (p.factor !== 1 || p.reduction > 0);
      if ((p.phase !== 'casting' && (p.manual || p.manualRequested || mixed)) || this.reactions().some((candidate) => candidate.problem !== 'Recurso agotado')) return;
      this.finish(true);
    }
  }
  private spend(owner: Combatant, cost: CombatCost | undefined): void {
    if (!cost) return;
    const available = this.available(owner, cost);
    if (available < cost.amount) throw new Error('No quedan recursos suficientes');
    const pool = owner.resources.find((r) => r.id === cost.resourceId);
    this.state.update((s) => ({ ...s, slotsSpent: pool?.kind === 'slot' ? [...s.slotsSpent, owner.id] : s.slotsSpent,
      resources: { ...s.resources, [owner.id]: { ...s.resources[owner.id], [cost.resourceId]: available - cost.amount } } }));
  }
  private refund(owner: Combatant, cost: CombatCost): void {
    const maximum = owner.resources.find((r) => r.id === cost.resourceId)?.maximum ?? 0;
    this.state.update((s) => ({ ...s, slotsSpent: owner.resources.find((r) => r.id === cost.resourceId)?.kind === 'slot' ? s.slotsSpent.filter((id) => id !== owner.id) : s.slotsSpent,
      resources: { ...s.resources, [owner.id]: { ...s.resources[owner.id], [cost.resourceId]: Math.min(maximum, (s.resources[owner.id]?.[cost.resourceId] ?? 0) + cost.amount) } } }));
  }
  private checkCombinedCosts(owner: Combatant, costs: (CombatCost | undefined)[]): void {
    const totals = new Map<string, number>(); let slots = 0;
    for (const cost of costs) if (cost) { totals.set(cost.resourceId, (totals.get(cost.resourceId) ?? 0) + cost.amount); if (owner.resources.find((r) => r.id === cost.resourceId)?.kind === 'slot') slots++; }
    if (slots > 1) throw new Error('No se pueden gastar dos espacios de conjuro en el mismo turno');
    for (const [resourceId, amount] of totals) if (this.available(owner, { resourceId, amount }) < amount) throw new Error('No hay recursos para el coste conjunto de reacción y respuesta');
  }
  private costProblem(owner: Combatant, cost: CombatCost | undefined, level?: number, exactLevel = false): string | undefined {
    if (!cost) return undefined;
    const resource = owner.resources.find((r) => r.id === cost.resourceId);
    if (!resource) return 'Falta la reserva del recurso';
    if (resource.kind === 'slot' && (cost.amount !== 1 || !Number.isInteger(resource.level) || resource.level! < Math.max(1, level ?? 1) || (exactLevel && resource.level !== level) || resource.level! > 9)) return 'El espacio no corresponde al nivel preparado del conjuro';
    return undefined;
  }
  private attackRoll(bonus: number, advantage: boolean, disadvantage: boolean): CombatRoll {
    const dice = [this.die(20)]; if (advantage !== disadvantage) dice.push(this.die(20));
    const natural = advantage === disadvantage ? dice[0] : advantage ? Math.max(...dice) : Math.min(...dice);
    return { dice, bonus, natural, total: natural + bonus, advantage, disadvantage };
  }
  private log(text: string, previous: string[]): string[] { return [...previous, text].slice(-200); }
}
function recordedUnarmedSpace(actor: Combatant): boolean { return [actor.x,actor.y,actor.size].every(Number.isFinite) && actor.size > 0; }
function signed(value: number): string { return value >= 0 ? ` + ${value}` : ` - ${Math.abs(value)}`; }
function isMagicMissile(action: CombatAction): boolean { return action.resolution === 'automatic' && ['proyectil magico', 'misil magico'].includes(normalizeCombat(action.name)); }
export function validState(value: unknown): value is CombatState {
  if (!value || typeof value !== 'object') return false;
  const s = value as CombatState;
  if (s.movement !== undefined && (!s.movement || !Number.isFinite(s.movement.spent) || s.movement.spent < 0 || s.movement.spent > 100000 || !Number.isInteger(s.movement.dashes) || s.movement.dashes < 0 || s.movement.dashes > 2 || typeof s.movement.disengaged !== 'boolean' || (s.movement.action !== undefined && !['attack', 'spell', 'dash', 'disengage'].includes(s.movement.action)) || (s.movement.bonus !== undefined && !['dash', 'disengage'].includes(s.movement.bonus)) || s.movement.dashes !== Number(s.movement.action === 'dash') + Number(s.movement.bonus === 'dash') || s.movement.disengaged !== (s.movement.action === 'disengage' || s.movement.bonus === 'disengage'))) return false;
  if (s.route !== undefined && (!validTurnRoute(s.route) || !s.started || s.turnId !== s.route.moverId || !s.movement || Math.abs(s.movement.spent - routeSpent(s.route)) > .00001 || !!s.areaCast)) return false;
  if (s.narrative !== undefined && (!Array.isArray(s.narrative) || s.narrative.length > 200 || s.narrative.some((event) =>
    !event || typeof event.id !== 'string' || !Array.isArray(event.messages) || event.messages.some((message) =>
      !message || typeof message.observerId !== 'string' || !Array.isArray(message.audience) || message.audience.some((id) => typeof id !== 'string') ||
      typeof message.text !== 'string' || message.text.length > 2000)))) return false;
  if (!Array.isArray(s.slotsSpent) || s.slotsSpent.some((id) => typeof id !== 'string') || (s.started && typeof s.turnId !== 'string')) return false;
  if (s.context?.rangeResolved !== undefined && typeof s.context.rangeResolved !== 'boolean') return false;
  if (s.context && (typeof s.context.advantage !== 'boolean' || typeof s.context.disadvantage !== 'boolean' || !Number.isFinite(s.context.armorAdjustment) || ![0, .5, 1, 2].includes(s.context.damageFactor))) return false;
  if (s.version !== 1 || typeof s.started !== 'boolean' || !Number.isInteger(s.round) || s.round < 1 || !Number.isInteger(s.usedAttacks) || s.usedAttacks < 0 || typeof s.spellUsed !== 'boolean' || !Array.isArray(s.log) || s.log.some((v) => typeof v !== 'string') || !Array.isArray(s.reactionUsed) || s.reactionUsed.some((v) => typeof v !== 'string') || !Array.isArray(s.queue) || !s.armorEffects || !s.resources) return false;
  if (Object.values(s.armorEffects).some((v) => !Number.isFinite(v) || v < 0) || Object.values(s.resources).some((pool) => !pool || Object.values(pool).some((v) => !Number.isInteger(v) || v < 0 || v > 999))) return false;
  if (s.queue.some((q) => !q || typeof q.attackerId !== 'string' || typeof q.targetId !== 'string' || !q.action || actionProblem(q.action) || q.context !== undefined && !validTargetContext(q.context))) return false;
  if (s.queue.length > 400 || s.log.length > 200) return false;
  if (s.unarmed !== undefined && (!validUnarmedDecision(s.unarmed) || !s.started || !s.route?.window || s.route.moverId !== s.unarmed.targetId || s.route.window.step !== s.route.next || !s.route.window.handled.includes(s.unarmed.ownerId) || !s.reactionUsed.includes(s.unarmed.ownerId) || !!s.pending || !!s.areaCast || s.queue.length > 0)) return false;
  if (s.grapples !== undefined && (!Array.isArray(s.grapples) || s.grapples.length > 500 || !Array.from(s.grapples).every(validGrappleLink) || new Set(s.grapples.map(link=>link.id)).size !== s.grapples.length)) return false;
  if (s.areaCast !== undefined && (!s.areaCast || !validAreaPoint(s.areaCast.origin) || (s.areaCast.manual !== undefined && typeof s.areaCast.manual !== 'boolean') || (s.areaCast.damage !== undefined && (!Array.isArray(s.areaCast.damage) || s.areaCast.damage.some(d => !d || typeof d.type !== 'string' || !Number.isFinite(d.rolled) || d.rolled < 0 || !Number.isFinite(d.bonus) || !Array.isArray(d.dice) || d.dice.some(n => !Number.isInteger(n) || n < 1 || n > 100)))))) return false;
  if (s.queue.some(q => q.opportunity !== undefined && (typeof q.opportunity !== 'boolean' || q.opportunity && (!q.reactionAttack || q.action.kind !== 'melee' || q.action.resolution !== 'attack' || q.action.area || q.action.targets !== 1)))) return false;
  const p = s.pending;
  if (p?.opportunity !== undefined && (typeof p.opportunity !== 'boolean' || p.opportunity && (p.action?.kind !== 'melee' || p.action?.resolution !== 'attack' || p.action.area || p.action.targets !== 1))) return false;
  if ((p?.action?.area || s.queue.some(q => q.action?.area)) && !s.areaCast) return false;
  if (p && (typeof p.attackerId !== 'string' || typeof p.targetId !== 'string' || !p.action || actionProblem(p.action) || !Number.isFinite(p.baseAc) || !Number.isFinite(p.extraAc) || !Number.isFinite(p.factor) || !Number.isFinite(p.reduction) || !Array.isArray(p.reactions) || !Array.isArray(p.damage) || p.damage.some((d) => !Number.isFinite(d.rolled) || !Number.isFinite(d.bonus) || !Array.isArray(d.dice)) || (p.roll && (!Number.isFinite(p.roll.total) || !Number.isInteger(p.roll.natural) || p.roll.natural < 1 || p.roll.natural > 20 || !Array.isArray(p.roll.dice))) || (p.save && !Number.isFinite(p.save.total)))) return false;
  if (p && p.manualRequested !== undefined && typeof p.manualRequested !== 'boolean') return false;
  if (p && (p.phase !== undefined && !['casting', 'defense', 'response'].includes(p.phase))) return false;
  if (p && ([p.cancelled, p.redirected, p.manual, p.effectsConfirmed].some((v) => typeof v !== 'boolean') || p.factor < 0 || p.factor > 2 || p.reduction < 0 || p.damage.some((d) => d.rolled < 0 || d.dice.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) || p.reactions.some((line) => typeof line !== 'string'))) return false;
  if (p?.context?.rangeResolved !== undefined && typeof p.context.rangeResolved !== 'boolean') return false;
  if (p?.context && (typeof p.context.advantage !== 'boolean' || typeof p.context.disadvantage !== 'boolean' || !Number.isFinite(p.context.armorAdjustment) || ![0, .5, 1, 2].includes(p.context.damageFactor))) return false;
  return true;
}

function validTargetContext(value: unknown): value is AttackContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v=value as Record<string,unknown>;
  return v['confirmed'] === true && typeof v['advantage'] === 'boolean' && typeof v['disadvantage'] === 'boolean' &&
    typeof v['armorAdjustment'] === 'number' && Number.isFinite(v['armorAdjustment']) && [0,.5,1,2].includes(v['damageFactor'] as number) &&
    (v['rangeResolved'] === undefined || typeof v['rangeResolved'] === 'boolean');
}
