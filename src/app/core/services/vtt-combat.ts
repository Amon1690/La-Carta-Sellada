import { signal } from '@angular/core';
import { CombatAction, Combatant, CombatCost, CombatPending, CombatProfile, CombatReaction, CombatResource, CombatRoll, CombatState } from '../models/combat';
import { actionProblem, combatDistance, diceParts, normalizeCombat, reactionProblem, rollDice } from './combat-rules';

const fresh = (): CombatState => ({ version: 1, started: false, round: 1, usedAttacks: 0, spellUsed: false,
  reactionUsed: [], armorEffects: {}, resources: {}, log: [], queue: [], slotsSpent: [] });
export interface AttackContext { advantage: boolean; disadvantage: boolean; armorAdjustment: number; damageFactor: number; confirmed: boolean; rangeResolved?: boolean }

/** Estado independiente por tablero. Los dados pendientes se conservan antes de aplicar daño. */
export class VttCombat {
  readonly state = signal<CombatState>(fresh());
  readonly error = signal('');
  readonly saving = signal(false);
  private invalid?: unknown;
  private context: AttackContext = { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1, confirmed: false };
  constructor(readonly combatants: () => Combatant[], readonly activeId: () => string | undefined,
    private readonly commit: (hp?: { id: string; hp: number }) => void,
    private readonly saveProfile: (id: string, profile: CombatProfile) => void | Promise<void>,
    private readonly die: (sides: number) => number = (sides) => Math.floor(Math.random() * sides) + 1) {}

  find(id: string | undefined): Combatant | undefined { return this.combatants().find((a) => a.id === id); }
  busy(): boolean { return this.saving() || !!this.state().pending || this.invalid !== undefined; }
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
    this.state.set(structuredClone(saved));
    if (saved.context) this.context = { ...saved.context };
  }
  reset(): void { this.invalid = undefined; this.error.set(''); this.state.set(fresh()); this.commit(); }
  end(): void {
    if (this.busy()) throw new Error('Resuelve el ataque pendiente');
    const s = this.state(); this.state.set({ ...fresh(), resources: s.resources, log: this.log('Combate finalizado. PG y recursos se conservan.', s.log) }); this.commit();
  }
  start(id: string): void {
    if (this.busy() || this.state().started || !this.find(id)) throw new Error('Resuelve primero la acción pendiente');
    const resources = this.state().resources;
    this.state.set({ ...fresh(), started: true, turnId: id, resources, log: this.log('Combate iniciado. Los recursos disponibles se conservan.', this.state().log) });
    this.commit();
  }
  turn(id: string, nextRound = false): void {
    if (!this.state().started || (id === this.state().turnId && !nextRound)) return;
    if (this.busy()) throw new Error('Resuelve el ataque pendiente antes de cambiar de turno');
    const s = this.state(), armorEffects = { ...s.armorEffects }; delete armorEffects[id];
    this.state.set({ ...s, turnId: id, round: s.round + (nextRound ? 1 : 0), usedAttacks: 0, spellUsed: false,
      reactionUsed: s.reactionUsed.filter((owner) => owner !== id), armorEffects,
      slotsSpent: [],
      log: this.log(`Turno de ${this.find(id)?.name ?? id}. Recupera su reacción; terminan sus efectos de Escudo.`, s.log) });
    this.commit();
  }
  canAttack(id: string): boolean {
    const actor = this.find(id), s = this.state();
    return !!actor && s.started && s.turnId === id && this.activeId() === id && !this.busy() && actor.hp > 0 && !actor.conditions?.includes('incapacitated') && actor.maxHp > 0 && actor.armorClass !== undefined && !s.spellUsed && s.usedAttacks < actor.attacksPerTurn;
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
  configure(ownerId: string, entry: CombatAction | CombatReaction, resource?: CombatResource, remaining?: number): void | Promise<void> {
    const owner = this.find(ownerId); if (!owner) throw new Error('Ficha no disponible');
    const problem = 'resolution' in entry ? actionProblem(entry) : reactionProblem(entry);
    if (problem) throw new Error(problem);
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
  begin(source: string, targetIds: string[], context: AttackContext): void {
    const actor = this.find(this.activeId());
    if (!actor || !this.canAttack(actor.id)) throw new Error('Solo puede atacar el token del turno activo después de iniciar el combate');
    const action = actor.actions.find((a) => a.source === source);
    if (!action) throw new Error('El ataque ya no figura en la ficha actual');
    const problem = actionProblem(action); if (problem) throw new Error(problem);
    if (!context.confirmed || !Number.isFinite(context.armorAdjustment) || ![0, 0.5, 1, 2].includes(context.damageFactor)) throw new Error('Revisa visibilidad, cobertura, resistencias y efectos de las fichas');
    if (action.kind === 'spell' && this.state().usedAttacks > 0) throw new Error('La acción de este turno ya comenzó con un ataque de arma');
    if (!targetIds.length || targetIds.length > action.targets || (!action.repeatTargets && new Set(targetIds).size !== targetIds.length)) throw new Error('Número de objetivos o impactos inválido');
    const legal = new Set(this.targets(actor, action).map((t) => t.id));
    if (targetIds.some((id) => !legal.has(id))) throw new Error('Algún objetivo no tiene ficha válida o está fuera del alcance');
    if (this.available(actor, action.cost) < (action.cost?.amount ?? 0)) throw new Error('Recursos insuficientes');
    const resourceProblem = this.costProblem(actor, action.cost, action.spellLevel, true); if (resourceProblem) throw new Error(resourceProblem);
    this.context = { ...context };
    this.spend(actor, action.cost);
    this.state.update((s) => ({ ...s, usedAttacks: s.usedAttacks + (action.kind === 'spell' ? 0 : 1), spellUsed: s.spellUsed || action.kind === 'spell',
      context: { ...context }, queue: targetIds.map((targetId, index) => ({ attackerId: actor.id, action: structuredClone(action), targetId, castApproved: index > 0 })) }));
    this.next();
  }
  private next(hp?: { id: string; hp: number }): void {
    const [job, ...queue] = this.state().queue;
    if (!job) { this.state.update((s) => ({ ...s, pending: undefined, queue: [] })); this.commit(hp); return; }
    const actor = this.find(job.attackerId), target = this.find(job.targetId);
    if (!actor || !target || target.armorClass === undefined) throw new Error('Falta la ficha de una acción pendiente');
    const context: Omit<AttackContext, 'confirmed'> = job.reactionAttack ? { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1 } : this.context;
    const long = combatDistance(actor, target) > job.action.range! + 0.001;
    const response = !!job.reactionAttack;
    const casting = response || (job.action.kind === 'spell' && !job.castApproved);
    const roll = !casting && job.action.resolution === 'attack' ? this.attackRoll(job.action.bonus!, context.advantage, context.disadvantage || (!context.rangeResolved && long)) : undefined;
    const save = !casting && job.action.resolution === 'save' ? this.attackRoll(target.saves[job.action.saveAbility!], false, job.action.saveAbility === 'dexterity' && !!target.conditions?.includes('restrained')) : undefined;
    const factor = (save && save.total >= job.action.dc! ? job.action.halfOnSave ? 0.5 : 0 : 1) * context.damageFactor;
    const damage = (casting ? [] : job.action.damage).map((part) => {
      const rolled = rollDice(part.dice, this.die, roll?.natural === 20 && part.critical !== false);
      return { type: part.type, rolled: rolled.total, dice: rolled.dice, bonus: rolled.bonus };
    });
    const pending: CombatPending = { context: { ...context }, phase: response ? 'response' : casting ? 'casting' : 'defense', attackerId: actor.id, targetId: target.id, action: job.action, roll, save,
      baseAc: target.armorClass + context.armorAdjustment, extraAc: 0, damage, factor, reduction: 0,
      cancelled: false, redirected: false, manual: !!job.action.effectOnly || !!job.action.manualEffects, effectsConfirmed: false, reactions: [] };
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
        result.push({ owner, reaction, problem: reactionProblem(reaction) ?? this.costProblem(owner, reaction.cost, reaction.spellLevel) ?? (this.available(owner, reaction.cost) < (reaction.cost?.amount ?? 0) ? 'Recurso agotado' : undefined) });
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
      this.state.update((s) => ({ ...s, pending: this.rollDefense(p, p.context ?? this.context) })); this.commit(); return;
    }
    const manual = p.manual || p.manualRequested || (new Set(p.damage.map((d) => d.type)).size > 1 && (p.factor !== 1 || p.reduction > 0)) || manualDamage !== undefined;
    if (manual && (!Number.isInteger(manualDamage) || manualDamage! < 0 || manualDamage! > 10000 || !manualNote.trim())) throw new Error('Indica el daño final y cómo se resolvieron las defensas o efectos especiales');
    const damage = manual ? manualDamage! : this.damage(p);
    const attack = p.roll ? `d20 [${p.roll.dice.join(', ')}]${signed(p.roll.bonus)} = ${p.roll.total}; CA ${this.armor(p)}${p.roll.natural === 20 ? ' (crítico)' : ''}` : p.save ? `salvación ${p.save.natural}${signed(p.save.bonus)} = ${p.save.total}; CD ${p.action.dc}` : 'impacto automático';
    const dice = p.damage.map((d) => `${d.type}: [${d.dice.join(', ')}]${signed(d.bonus)} = ${d.rolled}`).join('; ');
    const message = `${this.find(p.attackerId)?.name ?? p.attackerId} → ${target.name}, ${p.action.name}: ${attack}. ${this.hit(p) ? 'Impacto' : 'Fallo'}. ${dice}. Daño final ${damage}. ${p.reactions.join(' ')} ${manualNote}`;
    this.state.update((s) => ({ ...s, pending: undefined, log: this.log(message, s.log) }));
    this.next({ id: target.id, hp: Math.max(0, target.hp - damage) });
  }
  private rollDefense(p: CombatPending, context: Omit<AttackContext, 'confirmed'>): CombatPending {
    const actor = this.find(p.attackerId), target = this.find(p.targetId);
    if (!actor || !target) throw new Error('No se encuentran las fichas del ataque');
    const long = combatDistance(actor, target) > p.action.range! + .001;
    const roll = p.action.resolution === 'attack' ? this.attackRoll(p.action.bonus!, context.advantage, context.disadvantage || (!context.rangeResolved && long)) : undefined;
    const save = p.action.resolution === 'save' ? this.attackRoll(target.saves[p.action.saveAbility!], false, p.action.saveAbility === 'dexterity' && !!target.conditions?.includes('restrained')) : undefined;
    const damage = p.action.damage.map((part) => { const d = rollDice(part.dice, this.die, roll?.natural === 20 && part.critical !== false); return { type: part.type, rolled: d.total, dice: d.dice, bonus: d.bonus }; });
    const factor = (save && save.total >= p.action.dc! ? p.action.halfOnSave ? .5 : 0 : 1) * context.damageFactor;
    return { ...p, context: { ...context }, phase: 'defense', roll, save, damage, factor };
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
  requestManualResolution(requested: boolean): void {
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
function signed(value: number): string { return value >= 0 ? ` + ${value}` : ` - ${Math.abs(value)}`; }
function isMagicMissile(action: CombatAction): boolean { return action.resolution === 'automatic' && ['proyectil magico', 'misil magico'].includes(normalizeCombat(action.name)); }
function validState(value: unknown): value is CombatState {
  if (!value || typeof value !== 'object') return false;
  const s = value as CombatState;
  if (!Array.isArray(s.slotsSpent) || s.slotsSpent.some((id) => typeof id !== 'string') || (s.started && typeof s.turnId !== 'string')) return false;
  if (s.context?.rangeResolved !== undefined && typeof s.context.rangeResolved !== 'boolean') return false;
  if (s.context && (typeof s.context.advantage !== 'boolean' || typeof s.context.disadvantage !== 'boolean' || !Number.isFinite(s.context.armorAdjustment) || ![0, .5, 1, 2].includes(s.context.damageFactor))) return false;
  if (s.version !== 1 || typeof s.started !== 'boolean' || !Number.isInteger(s.round) || s.round < 1 || !Number.isInteger(s.usedAttacks) || s.usedAttacks < 0 || typeof s.spellUsed !== 'boolean' || !Array.isArray(s.log) || s.log.some((v) => typeof v !== 'string') || !Array.isArray(s.reactionUsed) || s.reactionUsed.some((v) => typeof v !== 'string') || !Array.isArray(s.queue) || !s.armorEffects || !s.resources) return false;
  if (Object.values(s.armorEffects).some((v) => !Number.isFinite(v) || v < 0) || Object.values(s.resources).some((pool) => !pool || Object.values(pool).some((v) => !Number.isInteger(v) || v < 0 || v > 999))) return false;
  if (s.queue.some((q) => !q || typeof q.attackerId !== 'string' || typeof q.targetId !== 'string' || !q.action || actionProblem(q.action))) return false;
  if (s.queue.length > 400 || s.log.length > 200) return false;
  const p = s.pending;
  if (p && (typeof p.attackerId !== 'string' || typeof p.targetId !== 'string' || !p.action || actionProblem(p.action) || !Number.isFinite(p.baseAc) || !Number.isFinite(p.extraAc) || !Number.isFinite(p.factor) || !Number.isFinite(p.reduction) || !Array.isArray(p.reactions) || !Array.isArray(p.damage) || p.damage.some((d) => !Number.isFinite(d.rolled) || !Number.isFinite(d.bonus) || !Array.isArray(d.dice)) || (p.roll && (!Number.isFinite(p.roll.total) || !Number.isInteger(p.roll.natural) || p.roll.natural < 1 || p.roll.natural > 20 || !Array.isArray(p.roll.dice))) || (p.save && !Number.isFinite(p.save.total)))) return false;
  if (p && p.manualRequested !== undefined && typeof p.manualRequested !== 'boolean') return false;
  if (p && (p.phase !== undefined && !['casting', 'defense', 'response'].includes(p.phase))) return false;
  if (p && ([p.cancelled, p.redirected, p.manual, p.effectsConfirmed].some((v) => typeof v !== 'boolean') || p.factor < 0 || p.factor > 2 || p.reduction < 0 || p.damage.some((d) => d.rolled < 0 || d.dice.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) || p.reactions.some((line) => typeof line !== 'string'))) return false;
  if (p?.context?.rangeResolved !== undefined && typeof p.context.rangeResolved !== 'boolean') return false;
  if (p?.context && (typeof p.context.advantage !== 'boolean' || typeof p.context.disadvantage !== 'boolean' || !Number.isFinite(p.context.armorAdjustment) || ![0, .5, 1, 2].includes(p.context.damageFactor))) return false;
  return true;
}
