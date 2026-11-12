import { Component, computed, input, OnChanges, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatAction, Combatant } from '../../../../core/models/combat';
import { actionProblem, combatDistance } from '../../../../core/services/combat-rules';
import { AttackFacts, attackSituation, normalAttackFacts, quickAction } from '../../../../core/services/attack-situation';
import { VttCombat } from '../../../../core/services/vtt-combat';

@Component({ selector: 'app-vtt-attack', imports: [FormsModule], templateUrl: './attack-picker.html', styleUrl: './attack-picker.scss' })
export class VttAttackPicker implements OnChanges {
  readonly combat = input.required<VttCombat>();
  readonly actorId = input<string>();
  readonly targetId = input<string>();
  readonly multiple = output<{ owner: Combatant; action: CombatAction }>();
  forceReview = false;
  readonly cancel = output<void>();
  readonly decision = output<void>();
  readonly rolled = output<void>();
  readonly prepare = output<{ owner: Combatant; action: CombatAction }>();
  readonly source = signal('');
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly customizing = signal(false);
  facts: AttackFacts = normalAttackFacts();
  count = 1;
  private selectedSignature?: string;
  private readonly remembered = new Map<string, AttackFacts>();
  readonly actor = computed(() => this.combat().find(this.actorId()));
  readonly target = computed(() => this.combat().find(this.targetId()));
  readonly choices = computed(() => this.actor()?.actions.map(quickAction) ?? []);
  label(action: CombatAction): string {
    if (action.resolution === 'attack') return action.bonus === undefined ? 'Bonificador por completar' : `${action.bonus >= 0 ? '+' : ''}${action.bonus}`;
    return action.resolution === 'save' ? action.dc === undefined ? 'CD por completar' : `CD ${action.dc}` : 'Automático';
  }
  resourceLabel(action: CombatAction, owner: Combatant): string {
    return !action.resourceConfirmed || (action.kind === 'spell' && action.spellLevel !== 0 && !action.cost) ? 'Recursos por completar' : this.combat().resourceStatus(owner, action.cost);
  }
  selected(): CombatAction | undefined { return this.choices().find((a) => a.source === this.source()); }
  readonly distance = combatDistance;
  ngOnChanges(): void { this.source.set(''); this.error.set(''); this.customizing.set(false); this.facts = normalAttackFacts(); this.count = 1; }
  problem(action: CombatAction): string | undefined {
    const actor = this.actor(), target = this.target();
    if (!actor || !target) return 'Elige un objetivo en el mapa';
    const invalid = actionProblem(action); if (invalid) return invalid;
    if (!this.combat().targets(actor, action).some((t) => t.id === target.id)) return 'Fuera de alcance';
    if (this.combat().available(actor, action.cost) < (action.cost?.amount ?? 0)) return 'Recurso agotado';
    return undefined;
  }
  situation() {
    const actor = this.actor(), target = this.target(), action = this.selected();
    return actor && target && action ? attackSituation(actor, target, action, this.combat().combatants(), this.facts, this.combat().sight) : undefined;
  }
  private sightSignature(): unknown {
    const sight = this.combat().sight;
    return sight ? this.combat().combatants().map((actor) => [actor.id, sight(actor.id, this.actorId() ?? ''), sight(this.actorId() ?? '', actor.id), sight(actor.id, this.targetId() ?? '')]) : undefined;
  }
  private signature(): string {
    return JSON.stringify([this.actorId(), this.targetId(), this.selected(), this.combat().situationRevision?.(), this.sightSignature(), this.combat().combatants().map((a) => [a.id, a.x, a.y, a.size, a.hp > 0, a.hp * 2 <= a.maxHp, a.armorClass, a.side, a.conditions, a.notes, a.actions, a.reactions])]);
  }
  choose(action: CombatAction): void {
    if (this.submitting()) return;
    this.error.set(''); this.source.set(action.source); this.count = 1; this.customizing.set(false);
    this.selectedSignature = this.signature();
    this.facts = { ...((!this.forceReview ? this.remembered.get(this.signature()) : undefined) ?? normalAttackFacts()) };
    if (this.facts.reviewed && action.targets === 1) this.attack();
  }
  confirm(): Promise<void> { this.facts.reviewed = true; return this.attack(); }
  async attack(): Promise<void> {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      const actor = this.actor(), target = this.target(), action = this.selected(), situation = this.situation();
      if (!actor || !target || !action || !situation) throw new Error('Elige objetivo y arma');
      const currentSignature = this.signature();
      if (this.selectedSignature !== currentSignature) {
        this.selectedSignature = currentSignature; this.facts = normalAttackFacts();
        throw new Error('La luz, el plano, las fichas o los observadores han cambiado. Revisa de nuevo la situación.');
      }
      const problem = this.problem(action); if (problem) throw new Error(problem);
      if (situation.doubts.length || !this.facts.reviewed || (situation.threatUnknown && this.facts.nearbyThreat === undefined) || situation.spellTypeUnknown) throw new Error('Resuelve las dudas indicadas antes de lanzar');
      if (situation.blocked) throw new Error(situation.blocked);
      if (!Number.isInteger(this.count) || this.count < 1 || this.count > action.targets || (this.count > 1 && !action.repeatTargets)) throw new Error('Este ataque no permite ese número de impactos en el mismo objetivo');
      const world = () => JSON.stringify([this.combat().situationRevision?.(), this.sightSignature(), this.combat().combatants().map((a) => [a.id, a.x, a.y, a.hp, a.maxHp, a.armorClass, a.conditions, a.side])]);
      const initialWorld = world(), initialFacts = JSON.stringify(this.facts), count = this.count;
      if (!actor.actions.find((a) => a.source === action.source)?.reviewed) {
        const saved = this.combat().configure(actor.id, action); if (saved) await saved;
      }
      if (this.actorId() !== actor.id || this.targetId() !== target.id || this.source() !== action.source || this.count !== count || world() !== initialWorld || JSON.stringify(this.facts) !== initialFacts) throw new Error('La selección o la situación ha cambiado. Elige el ataque de nuevo.');
      // Configurar puede actualizar las fichas compartidas: recordar la firma definitiva.
      const signature = this.signature();
      this.combat().begin(action.source, Array.from({ length: this.count }, () => target.id), situation.context);
      if (!this.facts.attackerSightConfirmed && !this.facts.targetSightConfirmed && !this.facts.lineOfEffectConfirmed && !this.facts.finalRoll && !this.facts.manualEffects && !this.facts.extraAdvantage && !this.facts.extraDisadvantage && this.facts.attackerSeesTarget && this.facts.targetSeesAttacker && this.facts.canTarget && this.facts.armorAdjustment === 0 && this.facts.damageFactor === 1 && this.facts.nearbyThreat === undefined) this.remembered.set(signature, { ...this.facts });
      else this.remembered.delete(signature);
      if (this.remembered.size > 64) this.remembered.delete(this.remembered.keys().next().value!);
      if (this.facts.manualEffects) this.combat().requestManualResolution(true);
      this.combat().settleAutomatic();
      if (this.combat().state().pending) this.decision.emit();
      this.rolled.emit(); this.forceReview = false; this.source.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo realizar el ataque'); } finally { this.submitting.set(false); }
  }
}
