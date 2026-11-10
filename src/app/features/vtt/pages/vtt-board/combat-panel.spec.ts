import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Combatant } from '../../../../core/models/combat';
import { GENERIC_NPCS } from '../../../../core/data/generic-npcs';
import { deriveCombat } from '../../../../core/services/combat-rules';
import { VttCombat } from '../../../../core/services/vtt-combat';
import { VttCombatPanel } from './combat-panel';
import { VttAttackPicker } from './attack-picker';

function setup() {
  let actors: Combatant[] = ['guardia-veterano', 'aprendiz-arcano'].map((id, i) => {
    const npc = GENERIC_NPCS.find((n) => n.id === id)!;
    const derived = deriveCombat({ ...npc, features: npc.traits });
    return { id, actorId: id, name: npc.name, x: i * 51.2, y: 0, size: 1, hp: npc.hitPoints, maxHp: npc.hitPoints, armorClass: npc.armorClass, conditions: [], side: i === 0 ? 'party' : 'enemy', ...derived,
      actions: derived.actions.map((a) => ({ ...a, reviewed: true })) };
  });
  const engine = new VttCombat(() => actors, () => actors[0].id, (hp) => { if (hp) actors = actors.map((a) => a.id === hp.id ? { ...a, hp: hp.hp } : a); }, () => {}, (sides) => sides === 20 ? 9 : 5);
  return { engine, actor: () => actors[0], target: () => actors[1] };
}
describe('Ventanas de decisión y aclaraciones del VTT', () => {
  it('no muestra el registro privado al preparar ficha y recursos', () => {
    const { engine, actor } = setup();
    engine.state.update((state) => ({ ...state, log: ['Capacidad privada del PNJ: CA 19, Escudo, 3 usos'] }));
    const fixture = TestBed.createComponent(VttCombatPanel); fixture.componentRef.setInput('combat', engine); fixture.detectChanges();
    fixture.componentInstance.open(actor().id); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Registro de combate');
    expect(fixture.nativeElement.textContent).not.toContain('Capacidad privada del PNJ'); fixture.destroy();
  });
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] }));
  it('usar una reacción no aplica PG ni cierra una resolución manual elegida en el formulario', async () => {
    const { engine, actor, target } = setup(); target().resources = [{ id: 'magic', name: 'Magia', maximum: 3 }];
    Object.assign(target().reactions[0], { reviewed: true, resourceConfirmed: true, cost: { resourceId: 'magic', amount: 1 } });
    engine.start(actor().id); engine.begin(actor().actions[0].source, [target().id], { advantage: false, disadvantage: false, armorAdjustment: 0, damageFactor: 1, confirmed: true });
    const fixture = TestBed.createComponent(VttCombatPanel); fixture.componentRef.setInput('combat', engine); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.resume(true); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const manual = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).find((el) => el.parentElement?.textContent?.includes('Resolver otro efecto'))!;
    manual.click(); fixture.detectChanges(); await fixture.whenStable();
    const damage = dialog.querySelector<HTMLInputElement>('input[type=number]')!; damage.value = '0'; damage.dispatchEvent(new Event('input', { bubbles: true }));
    const note = dialog.querySelector('textarea')!; note.value = 'Efecto adicional comprobado'; note.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.includes('Usar Escudo'))!.click(); fixture.detectChanges();
    expect(engine.state().pending?.manualRequested).toBeTrue(); expect(target().hp).toBe(14); expect(dialog.open).toBeTrue();
    Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.includes('Aplicar resultado'))!.click(); fixture.detectChanges();
    expect(engine.state().pending).toBeUndefined(); expect(target().hp).toBe(14); expect(dialog.open).toBeFalse(); fixture.destroy();
  });
  it('no reutiliza una excepción de visión ni una ventaja de un solo ataque', () => {
    const { engine, actor, target } = setup(); target().reactions = []; target().hp = target().maxHp = 200;
    engine.start(actor().id);
    const fixture = TestBed.createComponent(VttAttackPicker); fixture.componentRef.setInput('combat', engine); fixture.componentRef.setInput('actorId', actor().id); fixture.componentRef.setInput('targetId', target().id); fixture.detectChanges();
    const picker = fixture.componentInstance; picker.choose(actor().actions[0]); picker.facts.targetSeesAttacker = false; picker.confirm();
    expect(engine.state().usedAttacks).toBe(1);
    picker.choose(actor().actions[0]); expect(picker.facts.reviewed).toBeFalse(); expect(engine.state().usedAttacks).toBe(1);
    fixture.destroy();
  });

  function remoteSetup() {
    const original = setup(); const actors = [original.actor(), original.target()];
    actors[0].actions[0].reviewed = false; actors[1].reactions = [];
    const http = TestBed.inject(HttpClient);
    const engine = new VttCombat(() => actors, () => actors[0].id, (hp) => { if (hp) actors.find((a) => a.id === hp.id)!.hp = hp.hp; }, (id, profile) => firstValueFrom(http.put('/api/save-profile', profile)).then(() => {
      const owner = actors.find((a) => a.id === id)!; owner.profile = profile; owner.resources = profile.resources;
      owner.actions = owner.actions.map((action) => profile.actions.find((a) => a.source === action.source) ?? action);
    }), (sides) => sides === 20 ? 9 : 5);
    engine.start(actors[0].id);
    return { engine, actors, http: TestBed.inject(HttpTestingController) };
  }
  it('el primer ataque de un PJ espera el HTTP de preparación antes de tirar o aplicar daño', async () => {
    const { engine, actors, http } = remoteSetup();
    const fixture = TestBed.createComponent(VttAttackPicker); fixture.componentRef.setInput('combat', engine); fixture.componentRef.setInput('actorId', actors[0].id); fixture.componentRef.setInput('targetId', actors[1].id); fixture.detectChanges();
    const picker = fixture.componentInstance; picker.choose(actors[0].actions[0]); const attack = picker.confirm();
    const request = http.expectOne('/api/save-profile');
    expect(engine.saving()).toBeTrue(); expect(actors[1].hp).toBe(14); expect(engine.state().usedAttacks).toBe(0);
    await picker.attack(); http.expectNone('/api/save-profile');
    request.flush({}); await attack;
    expect(engine.saving()).toBeFalse(); expect(picker.error()).toBe(''); expect(engine.state().usedAttacks).toBe(1); expect(actors[1].hp).toBe(7); // 5 en 1d8 + 2 de la espada del Guardia veterano.
    http.verify(); fixture.destroy();
  });
  it('un rechazo HTTP no tira dados ni consume el ataque y conserva la selección del PJ', async () => {
    const { engine, actors, http } = remoteSetup();
    const fixture = TestBed.createComponent(VttAttackPicker); fixture.componentRef.setInput('combat', engine); fixture.componentRef.setInput('actorId', actors[0].id); fixture.componentRef.setInput('targetId', actors[1].id); fixture.detectChanges();
    const picker = fixture.componentInstance; picker.choose(actors[0].actions[0]); const attack = picker.confirm();
    http.expectOne('/api/save-profile').flush({ message: 'Conflicto' }, { status: 409, statusText: 'Conflict' }); await attack;
    expect(picker.error()).not.toBe(''); expect(picker.source()).toBe(actors[0].actions[0].source); expect(engine.state().usedAttacks).toBe(0); expect(actors[1].hp).toBe(14); expect(engine.saving()).toBeFalse();
    http.verify(); fixture.destroy();
  });
  it('preparar una ficha mantiene el diálogo y el borrador si falla el guardado remoto', async () => {
    const { engine, actors, http } = remoteSetup();
    const fixture = TestBed.createComponent(VttCombatPanel); fixture.componentRef.setInput('combat', engine); fixture.detectChanges(); await fixture.whenStable();
    const panel = fixture.componentInstance; panel.prepareEntry(actors[0], actors[0].actions[0]); panel.dataConfirmed = true; panel.resourceConfirmed = true;
    const saved = panel.save(); const request = http.expectOne('/api/save-profile');
    expect(panel.saving()).toBeTrue(); expect(panel.actionDraft).toBeDefined(); expect(panel.isOpen).toBeTrue();
    request.flush({}, { status: 503, statusText: 'Service Unavailable' }); await saved;
    expect(panel.saving()).toBeFalse(); expect(panel.actionDraft).toBeDefined(); expect(panel.isOpen).toBeTrue(); expect(panel.error()).not.toBe('');
    http.verify(); fixture.destroy();
  });
});
