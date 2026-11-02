import { AfterViewInit, Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatAction, Combatant, CombatReaction, CombatResource } from '../../../../core/models/combat';
import { actionProblem, combatDistance, reactionProblem, SAVE_LABELS } from '../../../../core/services/combat-rules';
import { attackSituation, normalAttackFacts } from '../../../../core/services/attack-situation';
import { VttCombat } from '../../../../core/services/vtt-combat';

@Component({ selector: 'app-vtt-combat', imports: [FormsModule], templateUrl: './combat-panel.html', styleUrl: './combat-panel.scss' })
export class VttCombatPanel implements AfterViewInit {
  readonly combat = input.required<VttCombat>();
  readonly resolved = output<void>();
  @ViewChild('dialog') private dialog?: ElementRef<HTMLDialogElement>;
  responseFacts = normalAttackFacts();
  quick = false;
  private closeAfterSave = false;
  readonly ownerId = signal('');
  readonly error = signal('');
  readonly actionSource = signal('');
  readonly editingOwnerId = signal('');
  actionDraft?: CombatAction;
  reactionDraft?: CombatReaction;
  damageText = '';
  resourceId = 'free'; resourceName = ''; resourceMaximum?: number; resourceRemaining?: number;
  resourceKind: 'slot' | 'uses' | 'charges' = 'uses'; resourceLevel = 1; resourceAmount = 1;
  resourceConfirmed = false; dataConfirmed = false;
  targetIds: string[] = [];
  advantage = false; disadvantage = false; armorAdjustment = 0; damageFactor = 1; contextConfirmed = false;
  effectsConfirmed = false; manualResolution = false; manualDamage?: number; manualNote = ''; redirectId = '';
  readonly saveOptions = Object.entries(SAVE_LABELS);
  readonly problem = actionProblem;
  readonly reactionProblem = reactionProblem;
  readonly distance = combatDistance;
  get isOpen(): boolean { return this.dialog?.nativeElement.open ?? false; }
  owner(): Combatant | undefined { return this.combat().find(this.ownerId()); }
  editingOwner(): Combatant | undefined { return this.combat().find(this.editingOwnerId()); }
  selectedAction(): CombatAction | undefined { return this.owner()?.actions.find((a) => a.source === this.actionSource()); }
  ngAfterViewInit(): void { if (this.combat().state().pending) this.dialog?.nativeElement.showModal(); }
  open(ownerId: string): void { this.quick = false; this.closeAfterSave = false; this.ownerId.set(ownerId); this.actionSource.set(''); this.actionDraft = this.reactionDraft = undefined; this.error.set(''); this.show(); }
  resume(quick = false): void { this.quick = quick; this.closeAfterSave = false; this.actionDraft = this.reactionDraft = undefined; this.error.set(''); this.show(); }
  prepareEntry(owner: Combatant, action: CombatAction): void { this.open(owner.id); this.edit(owner, action); this.closeAfterSave = true; }
  private settleQuick(): void { if (this.quick && !this.manualResolution) { this.combat().settleAutomatic(); if (!this.combat().state().pending) { this.close(); this.resolved.emit(); } } }
  close(): void { this.dialog?.nativeElement.close(); }
  private show(): void { if (!this.isOpen) this.dialog?.nativeElement.showModal(); }
  choose(action: CombatAction): void { this.actionSource.set(action.source); this.targetIds = Array.from({ length: action.targets }, () => ''); this.contextConfirmed = false; }
  edit(owner: Combatant, entry: CombatAction | CombatReaction): void {
    this.editingOwnerId.set(owner.id); this.error.set(''); this.actionSource.set('');
    this.actionDraft = 'resolution' in entry ? structuredClone(entry) : undefined;
    this.reactionDraft = 'effect' in entry ? structuredClone(entry) : undefined;
    this.damageText = this.actionDraft?.damage.map((d) => `${d.dice} | ${d.type}${d.critical === false ? ' | no' : ''}`).join('\n') ?? '';
    this.resourceId = entry.cost?.resourceId ?? 'free'; this.resourceAmount = entry.cost?.amount ?? 1;
    this.resourceConfirmed = entry.resourceConfirmed; this.dataConfirmed = entry.reviewed;
    this.resourceChanged();
  }
  resourceChanged(): void {
    const owner = this.editingOwner(), resource = owner?.resources.find((r) => r.id === this.resourceId);
    this.resourceName = resource?.name ?? ''; this.resourceMaximum = resource?.maximum;
    this.resourceRemaining = resource && owner ? this.balance(owner, resource) : undefined;
    this.resourceKind = resource?.kind ?? 'uses'; this.resourceLevel = resource?.level ?? 1;
  }
  balance(owner: Combatant, resource: CombatResource): number { return Math.min(resource.maximum, this.combat().state().resources[owner.id]?.[resource.id] ?? resource.maximum); }
  adjustResource(owner: Combatant, id: string, value: string): void { this.attempt(() => this.combat().setResource(owner.id, id, Number(value))); }
  adjustAttacks(owner: Combatant, value: string): void { this.attempt(() => this.combat().setAttacksPerTurn(owner.id, Number(value))); }
  save(): void {
    this.attempt(() => {
      const entry = this.actionDraft ?? this.reactionDraft; if (!entry) return;
      let resource: CombatResource | undefined;
      if (this.resourceId !== 'free') {
        resource = { id: this.resourceId === 'new' ? `pool-${Date.now()}` : this.resourceId, name: this.resourceName.trim(), maximum: Number(this.resourceMaximum), kind: this.resourceKind,
          ...(this.resourceKind === 'slot' ? { level: this.resourceLevel } : {}) };
        entry.cost = { resourceId: resource.id, amount: Number(this.resourceAmount) };
      } else delete entry.cost;
      entry.reviewed = this.dataConfirmed; entry.resourceConfirmed = this.resourceConfirmed;
      if (this.actionDraft?.longRange === null) delete this.actionDraft.longRange;
      if (this.actionDraft) this.actionDraft.damage = this.damageText.split('\n').filter((s) => s.trim()).map((s) => { const [dice, type, critical] = s.split('|'); if (critical && !['si', 'sí', 'no'].includes(critical.trim().toLowerCase())) throw new Error('El tercer campo debe ser sí o no'); return { dice: dice?.trim() ?? '', type: type?.trim() ?? '', critical: critical?.trim().toLowerCase() !== 'no' }; });
      this.combat().configure(this.editingOwnerId(), entry, resource, this.resourceRemaining);
      this.actionDraft = this.reactionDraft = undefined;
      if (this.closeAfterSave) { this.closeAfterSave = false; this.close(); }
    });
  }
  roll(): void { this.attempt(() => {
    this.combat().begin(this.actionSource(), this.targetIds.filter(Boolean), { advantage: this.advantage, disadvantage: this.disadvantage,
      armorAdjustment: Number(this.armorAdjustment), damageFactor: Number(this.damageFactor), confirmed: this.contextConfirmed });
    this.effectsConfirmed = false; this.manualResolution = false; this.manualDamage = undefined; this.manualNote = '';
  }); }
  responseSituation() {
    const p = this.combat().state().pending, actor = this.combat().find(p?.attackerId), target = this.combat().find(p?.targetId);
    return p && actor && target ? attackSituation(actor, target, p.action, this.combat().combatants(), this.responseFacts) : undefined;
  }
  cancelResponse(): void { this.attempt(() => { this.combat().cancelResponse(); this.settleQuick(); }); }
  resolveResponse(): void { this.attempt(() => {
    const info = this.responseSituation();
    if (!info || info.blocked || !this.responseFacts.reviewed || (info.threatUnknown && this.responseFacts.nearbyThreat === undefined) || info.spellTypeUnknown) throw new Error(info?.blocked ?? 'Resuelve las dudas del ataque de respuesta');
    this.combat().resolveResponse(info.context); if (this.responseFacts.manualEffects) this.combat().requestManualResolution(true); this.responseFacts = normalAttackFacts(); this.settleQuick();
  }); }
  requestManual(requested: boolean): void { this.manualResolution = requested; this.combat().requestManualResolution(requested); }
  react(ownerId: string, source: string): void { this.attempt(() => { this.combat().useReaction(ownerId, source, this.redirectId); this.settleQuick(); }); }
  finish(): void { this.attempt(() => {
    this.combat().finish(this.quick || this.effectsConfirmed, this.manualResolution || this.combat().state().pending?.manual || this.combat().state().pending?.manualRequested ? Number(this.manualDamage) : undefined, this.manualNote);
    this.effectsConfirmed = false; this.manualResolution = false; this.manualDamage = undefined; this.manualNote = '';
    if (!this.combat().state().pending) this.actionSource.set('');
    this.settleQuick();
  }); }
  private attempt(action: () => void): void { this.error.set(''); try { action(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción'); } }
}
