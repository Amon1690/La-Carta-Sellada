import { CombatAction, Combatant, CombatReaction, CombatState } from '../models/combat';
import { GENERIC_NPCS } from '../data/generic-npcs';
import { actionProblem, combatDistance, deriveCombat, diceParts, reactionProblem, rollDice } from './combat-rules';
import { AttackContext, VttCombat } from './vtt-combat';
const context: AttackContext = { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1, confirmed: true };
function actor(id: string, sourceId: string, x: number): Combatant {
  const npc = GENERIC_NPCS.find((n) => n.id === sourceId)!;
  const derived = deriveCombat({ ...npc, features: npc.traits });
  return { id, actorId: `generic:${sourceId}`, name: npc.name, x, y: 0, size: 1, hp: npc.hitPoints, maxHp: npc.hitPoints, armorClass: npc.armorClass,
    ...derived, actions: derived.actions.map((a) => ({ ...a, reviewed: true })) };
}
describe('Combate VTT, reglas y recuperación', () => {
  let actors: Combatant[]; let active: string; let engine: VttCombat; let saved: unknown;
  let sequence: number[]; let die: jasmine.Spy;
  const guard = () => actors[0], learner = () => actors[1];
  const sword = () => guard().actions.find((a) => a.name === 'Espada larga')!;
  function shield(): CombatReaction {
    const reaction = learner().reactions.find((r) => r.name === 'Escudo')!;
    Object.assign(reaction, { reviewed: true, resourceConfirmed: true, cost: { resourceId: 'magic', amount: 1 } });
    learner().resources = [{ id: 'magic', name: 'Usos de magia confirmados', maximum: 3 }];
    return reaction;
  }
  function make(): VttCombat {
    const e = new VttCombat(() => actors, () => active, (hp) => {
      if (hp) actors = actors.map((a) => a.id === hp.id ? { ...a, hp: hp.hp } : a);
      saved = structuredClone(e.serialized());
    }, (id, profile) => {
      const owner = actors.find((a) => a.id === id)!;
      owner.profile = profile; owner.resources = profile.resources;
      owner.actions = owner.actions.map((a) => profile.actions.find((p) => p.source === a.source) ?? a);
      owner.reactions = owner.reactions.map((r) => profile.reactions.find((p) => p.source === r.source) ?? r);
      owner.attacksPerTurn = profile.attacksPerTurn ?? owner.attacksPerTurn;
    }, die);
    return e;
  }
  beforeEach(() => {
    actors = [actor('guard', 'guardia-veterano', 0), actor('apprentice', 'aprendiz-arcano', 51.2)]; active = 'guard'; sequence = [9, 5];
    die = jasmine.createSpy('die').and.callFake((sides: number) => Math.min(sides, sequence.shift() ?? 1));
    engine = make(); saved = undefined;
  });
  function start(): void { engine.start(active); }
  function attack(): void { engine.begin(sword().source, [learner().id], context); }

  it('audita datos reales sin inventar rangos de ballesta o usos de Escudo', () => {
    expect(guard().armorClass).toBe(17); expect(learner().armorClass).toBe(12);
    expect(guard().attacksPerTurn).toBe(2);
    expect(sword().bonus).toBe(4); expect(sword().damage).toEqual([{ dice: '1d8+2', type: 'cortante' }]);
    expect(guard().actions.find((a) => a.name === 'Ballesta pesada')?.range).toBeUndefined();
    expect(reactionProblem(learner().reactions.find((r) => r.name === 'Escudo')!)).toContain('Configura');
    expect(deriveCombat(undefined).actions).toEqual([]);
  });
  it('mide casillas diagonales, tamaños y rechaza objetivos fuera de alcance antes de tirar', () => {
    expect(combatDistance(guard(), { ...learner(), y: 51.2 })).toBeCloseTo(1.5);
    expect(combatDistance({ ...guard(), size: 2 }, { ...learner(), x: 102.4 })).toBeCloseTo(1.5);
    learner().x = 102.4; start();
    expect(() => attack()).toThrowError(/alcance/); expect(die).not.toHaveBeenCalled();
  });
  it('exige combate iniciado y turno activo', () => {
    expect(() => attack()).toThrowError(/turno activo/); start(); active = learner().id;
    expect(() => attack()).toThrowError(/turno activo/); expect(die).not.toHaveBeenCalled();
  });
  it('resuelve el ejemplo 9+4=13, Escudo CA12→17 evita daño y consume una reacción y un uso', () => {
    const reaction = shield(); start(); attack();
    expect(engine.state().pending?.roll?.total).toBe(13); expect(engine.hit()).toBeTrue(); expect(learner().hp).toBe(14);
    engine.useReaction(learner().id, reaction.source);
    expect(engine.armor()).toBe(17); expect(engine.hit()).toBeFalse(); expect(learner().hp).toBe(14);
    expect(engine.state().resources['apprentice']['magic']).toBe(2);
    engine.finish(true); expect(learner().hp).toBe(14); expect(engine.state().reactionUsed).toContain('apprentice');
    expect(engine.state().log.join(' ')).toContain('Daño final 0');
  });
  it('permite declinar la reacción y aplica daño una sola vez', () => {
    shield(); start(); attack(); engine.finish(true);
    expect(learner().hp).toBe(7); expect(engine.state().reactionUsed).toEqual([]);
    expect(() => engine.finish(true)).toThrowError(); expect(learner().hp).toBe(7);
  });
  it('respeta 20 crítico aunque se use Escudo y duplica dados, sin duplicar el modificador', () => {
    sequence = [20, 3, 4]; const r = shield(); start(); attack();
    engine.useReaction('apprentice', r.source); expect(engine.hit()).toBeTrue();
    expect(engine.state().pending?.damage[0]).toEqual({ type: 'cortante', dice: [3, 4], bonus: 2, rolled: 9 });
    engine.finish(true); expect(learner().hp).toBe(5);
  });
  it('un 1 natural falla y no ofrece Escudo aunque el modificador fuera suficiente', () => {
    sword().bonus = 100; sequence = [1, 5]; shield(); start(); attack();
    expect(engine.hit()).toBeFalse(); expect(engine.reactions()).toEqual([]); engine.finish(true); expect(learner().hp).toBe(14);
  });
  it('Escudo sigue activo hasta el próximo turno propio y no recupera sus usos', () => {
    const r = shield(); start(); attack(); engine.useReaction('apprentice', r.source); engine.finish(true);
    actors.push(actor('other', 'guardia', 153.6)); active = 'other'; engine.turn(active);
    expect(engine.state().armorEffects['apprentice']).toBe(5);
    active = 'apprentice'; engine.turn(active);
    expect(engine.state().armorEffects['apprentice']).toBeUndefined(); expect(engine.state().reactionUsed).not.toContain('apprentice');
    expect(engine.available(learner(), r.cost)).toBe(2);
  });
  it('no gasta un recurso desconocido, agotado ni un espacio de nivel inferior', () => {
    start(); attack(); const r = learner().reactions.find((x) => x.name === 'Escudo')!;
    expect(() => engine.useReaction('apprentice', r.source)).toThrowError();
    shield(); engine.setResource('apprentice', 'magic', 0);
    expect(() => engine.useReaction('apprentice', r.source)).toThrowError(/agotado/);
    const action = { ...sword(), kind: 'spell' as const, spellLevel: 2, cost: { resourceId: 'slot1', amount: 1 } };
    guard().resources = [{ id: 'slot1', name: 'Nivel1', maximum: 2, kind: 'slot', level: 1 }];
    expect(() => engine.configure('guard', action, guard().resources[0], 2)).toThrowError(/nivel/);
  });
  it('persistir y recuperar una decisión no vuelve a tirar ni aplica daño antes de decidir', () => {
    shield(); start(); attack(); const calls = die.calls.count(); const restored = make(); restored.restore(saved);
    expect(restored.state().pending?.roll?.total).toBe(13); expect(die.calls.count()).toBe(calls); expect(learner().hp).toBe(14);
    restored.finish(true); expect(learner().hp).toBe(7); expect(die.calls.count()).toBe(calls);
    const again = make(); again.restore(saved); expect(again.state().pending).toBeUndefined(); expect(learner().hp).toBe(7);
  });
  it('guarda el daño aplicado y la siguiente tirada juntos, incluso sobre el mismo objetivo', () => {
    const action = sword(); action.targets = 2; action.repeatTargets = true; sequence = [9, 3, 10, 2]; start();
    engine.begin(action.source, ['apprentice', 'apprentice'], context); engine.finish(true);
    expect(learner().hp).toBe(9); const restored = make(); restored.restore(saved);
    expect(restored.state().pending?.roll?.natural).toBe(10); const calls = die.calls.count(); restored.finish(true);
    expect(learner().hp).toBe(5); expect(die.calls.count()).toBe(calls);
  });
  it('las salvaciones no usan CA ni ofrecen Escudo y las interrupciones van antes de los dados', () => {
    shield(); const spell: CombatAction = { ...sword(), name: 'Onda', kind: 'spell', spellLevel: 0, resolution: 'save', saveAbility: 'constitution', dc: 12, halfOnSave: true, damage: [{ dice: '1d8', type: 'fuego' }] };
    guard().actions = [spell]; sequence = [12, 7]; start(); engine.begin(spell.source, ['apprentice'], context);
    expect(engine.state().pending?.phase).toBe('casting'); expect(die).not.toHaveBeenCalled(); engine.finish(true);
    expect(engine.state().pending?.save?.total).toBe(12); expect(engine.reactions()).toEqual([]); expect(engine.damage()).toBe(3);
    engine.finish(true); expect(learner().hp).toBe(11);
  });
  it('Escudo bloquea Proyectil mágico y se anuncia el conjuro solo una vez por lanzamiento', () => {
    const r = shield(); const action: CombatAction = { ...sword(), name: 'Proyectil mágico', kind: 'spell', spellLevel: 1, resolution: 'automatic', targets: 3, repeatTargets: true, damage: [{ dice: '1d4+1', type: 'fuerza' }], cost: { resourceId: 'magic', amount: 1 } };
    guard().actions = [action]; guard().resources = [{ id: 'magic', name: 'Usos', maximum: 3 }]; sequence = [2, 3, 4]; start(); engine.begin(action.source, ['apprentice', 'apprentice', 'apprentice'], context);
    engine.finish(true); engine.useReaction('apprentice', r.source);
    for (let i = 0; i < 3; i++) { expect(engine.state().pending?.phase).toBe('defense'); expect(engine.damage()).toBe(0); engine.finish(true); }
    expect(learner().hp).toBe(14); expect(engine.state().resources['guard']['magic']).toBe(2); expect(engine.state().resources['apprentice']['magic']).toBe(2);
  });
  it('rechaza costes conjuntos de respuesta sin gastar parcialmente usos ni reacción', () => {
    learner().resources = [{ id: 'uses', name: 'Usos', maximum: 1 }]; learner().actions[0].cost = { resourceId: 'uses', amount: 1 };
    learner().reactions = [{ source: 'Respuesta', name: 'Respuesta', trigger: 'hit', protectOthers: false, range: 1.5, meleeOnly: true, effect: 'counter', amount: 0, dice: '', duration: 'attack', actionSource: learner().actions[0].source, cost: { resourceId: 'uses', amount: 1 }, resourceConfirmed: true, reviewed: true }];
    start(); attack(); const before = structuredClone(engine.state());
    expect(() => engine.useReaction('apprentice', 'Respuesta')).toThrowError(/coste conjunto/); expect(engine.state()).toEqual(before);
  });
  it('rechaza CD de reacción ausente, fraccionaria o fuera de límites', () => {
    const r = { ...shield(), saveAbility: 'constitution' as const, dc: undefined };
    for (const dc of [undefined, 0, -1, 41, 12.5]) expect(reactionProblem({ ...r, dc })).toContain('CD');
    expect(reactionProblem({ ...r, dc: 12 })).toBeUndefined();
  });
  it('admite ataques solo de efecto sin inventar daño y exige registrar el resultado', () => {
    sword().effectOnly = true; sword().damage = []; start(); engine.begin(sword().source, ['apprentice'], context);
    expect(actionProblem(sword())).toBeUndefined(); expect(() => engine.finish(true)).toThrowError(/daño final/);
    engine.finish(true, 0, 'Apresado aplicado en la mesa'); expect(learner().hp).toBe(14); expect(engine.state().log.join(' ')).toContain('Apresado');
  });
  it('conserva enteros y límites de dados y no ejecuta fórmulas arbitrarias', () => {
    expect(diceParts('1d8 + 2')).toEqual({ count: 1, sides: 8, bonus: 2 }); expect(diceParts('144+1')).toBeUndefined();
    expect(diceParts('41d6')).toBeUndefined(); expect(diceParts('2d999')).toBeUndefined(); expect(diceParts('alert(1)')).toBeUndefined();
    expect(rollDice('1d6-4', () => 1).total).toBe(0);
  });
  it('conserva el estado de combate corrupto sin lanzar ni sobrescribir la partida', () => {
    start(); attack(); const bad = structuredClone(saved) as CombatState; (bad.pending!.action as unknown as { damage?: unknown }).damage = undefined;
    const restored = make(); expect(() => restored.restore(bad)).not.toThrow(); expect(restored.error()).toContain('no es válido'); expect(restored.serialized()).toEqual(bad);
    expect(restored.canAttack('guard')).toBeFalse();
  });
  it('acepta partidas antiguas y terminar/reiniciar no repone recursos', () => {
    engine.restore(undefined); expect(engine.state().started).toBeFalse(); shield(); start(); attack(); engine.useReaction('apprentice', learner().reactions[0].source); engine.finish(true);
    engine.end(); engine.start('guard'); expect(engine.available(learner(), learner().reactions[0].cost)).toBe(2);
  });
  it('permite completar multiataques de PJ y no reinicia su gasto al marcar el mismo turno', () => {
    start(); engine.setAttacksPerTurn('guard', 3); attack(); engine.finish(true); engine.turn('guard');
    expect(guard().attacksPerTurn).toBe(3); expect(engine.state().usedAttacks).toBe(1);
  });

  it('preserva null y contextos o fases corruptos sin lanzar', () => {
    const copy = make(); copy.restore(null); expect(copy.serialized()).toBeNull(); expect(copy.busy()).toBeTrue();
    start(); attack(); const bad = structuredClone(saved) as CombatState;
    (bad.pending as unknown as { phase: string }).phase = 'inventada'; copy.restore(bad); expect(copy.error()).toContain('no es válido'); expect(copy.serialized()).toEqual(bad);
  });
  it('Contrahechizo se decide antes de tirar y devuelve el espacio, sin bloquearlo como gastado', () => {
    active = 'guard'; const spell: CombatAction = { ...sword(), kind: 'spell', spellLevel: 1, cost: { resourceId: 'slot', amount: 1 } };
    guard().actions = [spell]; guard().resources = [{ id: 'slot', name: 'Espacio1', maximum: 2, kind: 'slot', level: 1 }];
    const counter: CombatReaction = { source: 'Contrahechizo', name: 'Contrahechizo', trigger: 'spell', protectOthers: false, range: 18, meleeOnly: false, effect: 'cancel', amount: 0, dice: '', duration: 'attack', resourceConfirmed: true, reviewed: true, refundSpell: true, saveAbility: 'constitution', dc: 20 };
    learner().reactions = [counter]; sequence = [1]; start(); engine.begin(spell.source, ['apprentice'], context);
    expect(die).not.toHaveBeenCalled(); expect(engine.reactions().length).toBe(1);
    engine.useReaction('apprentice', counter.source); expect(engine.state().pending?.cancelled).toBeTrue();
    expect(engine.state().resources['guard']['slot']).toBe(2); expect(engine.state().slotsSpent).not.toContain('guard');
    engine.finish(true); expect(learner().hp).toBe(14); expect(die.calls.count()).toBe(1);
  });
  it('un espacio por turno es compartido entre acción y reacción, sin reponer cantidades al cambiar turno', () => {
    const r = shield(); learner().resources[0] = { id: 'magic', name: 'Espacios1', maximum: 3, kind: 'slot', level: 1 };
    start(); attack(); engine.useReaction('apprentice', r.source); engine.finish(true);
    expect(engine.available(learner(), r.cost)).toBe(0);
    active = 'apprentice'; engine.turn(active); expect(engine.available(learner(), r.cost)).toBe(2);
  });
  it('el mismo token recupera reacción y expira Escudo al iniciar su siguiente ronda', () => {
    actors = [guard()]; start(); engine.state.update((s) => ({ ...s, armorEffects: { guard: 5 }, reactionUsed: ['guard'], usedAttacks: 1 }));
    engine.turn('guard', true); expect(engine.state().round).toBe(2); expect(engine.state().usedAttacks).toBe(0); expect(engine.state().armorEffects['guard']).toBeUndefined();
  });
  it('la reducción precede a resistencia y una decisión manual necesita explicación', () => {
    sequence = [9, 8]; start(); engine.begin(sword().source, ['apprentice'], { ...context, damageFactor: .5 });
    engine.state.update((s) => ({ ...s, pending: { ...s.pending!, reduction: 3 } }));
    expect(engine.damage()).toBe(3);
    expect(() => engine.finish(true, 2)).toThrowError(); engine.finish(true, 2, 'Defensa especial revisada'); expect(learner().hp).toBe(12);
  });
});
