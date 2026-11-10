import { CombatAction, Combatant } from '../models/combat';
import { GENERIC_NPCS } from '../data/generic-npcs';
import { deriveCombat } from './combat-rules';
import { attackSituation, normalAttackFacts, quickAction } from './attack-situation';
const actor = (id: string, x: number, side: Combatant['side']): Combatant => {
  const npc = GENERIC_NPCS.find((n) => n.id === 'guardia-veterano')!;
  return { id, actorId: id, name: id, x, y: 0, size: 1, hp: 32, maxHp: 32, armorClass: 17, conditions: [], side, ...deriveCombat({ ...npc, features: npc.traits }) };
};
describe('Situación automática de un ataque en el mapa', () => {
  let a: Combatant, b: Combatant, action: CombatAction;
  beforeEach(() => { a = actor('A', 0, 'party'); b = actor('B', 51.2, 'enemy'); action = quickAction(a.actions[0]); });
  const facts = () => ({ ...normalAttackFacts(), reviewed: true });
  it('usa datos completos de la espada sin inventar alcance o recursos de la ballesta', () => {
    expect(action.reviewed).toBeTrue(); expect(action.range).toBe(1.5);
    expect(quickAction(a.actions[1]).reviewed).toBeFalse(); expect(quickAction(a.actions[1]).range).toBeUndefined();
  });
  it('aplica alcance largo y respeta el límite exacto sin falsos positivos decimales', () => {
    action = { ...action, kind: 'ranged', range: 9, longRange: 36 }; b.x = 51.2 * 6;
    expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeFalse();
    b.x += 51.2; expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeTrue();
  });
  it('distingue enemigo próximo, aliado, cegado e incapacitado al disparar', () => {
    action = { ...action, kind: 'ranged', range: 30 };
    expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeTrue();
    b.side = 'party'; expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeFalse();
    b.side = 'enemy'; b.conditions = ['blinded']; expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeFalse();
    b.conditions = ['incapacitated']; expect(attackSituation(a, b, action, [a, b], facts()).context.disadvantage).toBeFalse();
  });
  it('no confunde el objetivo aliado con otros enemigos que amenazan al atacante', () => {
    action = { ...action, kind: 'ranged', range: 30 }; const enemy = actor('C', -51.2, 'enemy'); b.side = 'party'; b.x = 51.2 * 5;
    expect(attackSituation(a, b, action, [a, b, enemy], facts()).context.disadvantage).toBeTrue();
  });
  it('calcula condiciones y su anulación, incluida la distancia a un objetivo tumbado', () => {
    b.conditions = ['prone']; expect(attackSituation(a, b, action, [a, b], facts()).context.advantage).toBeTrue();
    a.conditions = ['poisoned']; const result = attackSituation(a, b, action, [a, b], facts());
    expect(result.context.advantage).toBeTrue(); expect(result.context.disadvantage).toBeTrue();
    a.conditions = []; b.x = 102.4; expect(attackSituation(a, b, { ...action, range: 3 }, [a, b], facts()).context.disadvantage).toBeTrue();
  });
  it('pregunta ante bandos, condiciones o tipo de conjuro desconocidos', () => {
    action = { ...action, kind: 'ranged', range: 30 }; delete b.side;
    expect(attackSituation(a, b, action, [a, b], facts()).threatUnknown).toBeTrue();
    expect(attackSituation(a, b, action, [a, b], { ...facts(), nearbyThreat: false }).doubts.length).toBe(0);
    expect(attackSituation(a, b, { ...action, kind: 'spell' }, [a, b], facts()).spellTypeUnknown).toBeTrue();
    delete a.conditions; expect(attackSituation(a, b, action, [a, b], normalAttackFacts()).doubts.length).toBeGreaterThan(0);
  });
  it('respeta la visión declarada, bloquea cobertura total y al atacante incapacitado', () => {
    expect(attackSituation(a, b, action, [a, b], { ...facts(), targetSeesAttacker: false }).context.advantage).toBeTrue();
    expect(attackSituation(a, b, action, [a, b], { ...facts(), attackerSeesTarget: false }).context.disadvantage).toBeTrue();
    expect(attackSituation(a, b, action, [a, b], { ...facts(), canTarget: false }).blocked).toBeTruthy();
    a.conditions = ['incapacitated']; expect(attackSituation(a, b, action, [a, b], facts()).blocked).toBeTruthy();
  });
  it('no aplica ventaja de ataques a una salvación o impacto automático', () => {
    a.conditions = ['poisoned']; b.conditions = ['prone'];
    const result = attackSituation(a, b, { ...action, resolution: 'save' }, [a, b], facts());
    expect(result.context.advantage).toBeFalse(); expect(result.context.disadvantage).toBeFalse();
  });
  it('usa visión personal para ataques sin convertir penumbra en desventaja de ataque', () => {
    const visible = { visible: true, perception: 'disadvantage' as const, reasons: [] };
    const result = attackSituation(a, b, action, [a, b], facts(), () => visible);
    expect(result.context.advantage).toBeFalse(); expect(result.context.disadvantage).toBeFalse();
    const hidden = { visible: false, perception: 'automatic-failure' as const, reasons: [] };
    expect(attackSituation(a, b, action, [a, b], facts(), (id) => id === a.id ? hidden : visible).context.disadvantage).toBeTrue();
    const both = attackSituation(a, b, action, [a, b], facts(), () => hidden);
    expect(both.context.advantage).toBeTrue(); expect(both.context.disadvantage).toBeTrue();
  });
  it('un adversario cercano cegado que ve con visión ciega sigue amenazando un ataque a distancia', () => {
    b.conditions = ['blinded']; action = { ...action, kind: 'ranged', range: 30 };
    const result = attackSituation(a, b, action, [a, b], facts(), () => ({ visible: true, perception: 'normal', reasons: [] }));
    expect(result.reasons).toContain('Enemigo próximo que puede verte y actuar: desventaja');
    expect(result.context.disadvantage).toBeTrue();
  });
});
