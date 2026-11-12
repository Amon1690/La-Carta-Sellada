import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { BoardVisionState, VisionProfile } from '../models/vision';
import type { Combatant } from '../models/combat';
import { GENERIC_NPCS } from '../data/generic-npcs';
import { deriveCombat } from './combat-rules';
import { attackSituation, normalAttackFacts } from './attack-situation';
import { evaluateVision } from './vision-engine';
import { emptyBoardVision } from './vision-state';
import { endVisionEffect } from './vision-effects';
import { VttCombat } from './vtt-combat';
import { validateBoard } from './campaign-backup-format';
import { VttCombatPanel } from '../../features/vtt/pages/vtt-board/combat-panel';
import { VttAttackPicker } from '../../features/vtt/pages/vtt-board/attack-picker';

const source = { kind: 'director' as const, reference: 'Datos sintéticos de regresión' };
function setup() {
  const npc = GENERIC_NPCS.find(n => n.id === 'guardia-veterano')!;
  const derived = deriveCombat({ ...npc, features: npc.traits });
  const actors: Combatant[] = ['a', 'b', 'ally'].map((id, i) => ({ id, actorId: id, name: id, x: i === 1 ? 51.2 : 0, y: i === 2 ? 51.2 : 0,
    size: 1, hp: 200, maxHp: 200, armorClass: 17, conditions: [], side: i === 1 ? 'enemy' : 'party', ...derived,
    attacksPerTurn: 10, reactions: [], actions: [{ ...derived.actions[0], reviewed: true, range: 30 }] }));
  const world: { state: BoardVisionState } = { state: { ...emptyBoardVision(), enabled: true, obstacles: [],
    environment: { illumination: 'bright', timeOfDay: 'day', weather: 'clear', source }, groups: [{ id: 'shared', name: 'Compartida', observerIds: ['ally'] }], activeGroupId: 'shared' } };
  const profiles = new Map<string, VisionProfile>(actors.map(a => [a.id, { version: 1, senses: [{ sense: 'normal', rangeFeet: null, source }] }]));
  const tokens = () => actors.map(a => ({ ...a, instanceId: a.id, hidden: false }));
  const sight = (a: string, b: string) => evaluateVision(world.state, tokens(), profiles, a, b);
  const die = jasmine.createSpy('die').and.callFake((sides: number) => sides === 20 ? 10 : 5);
  const engine = new VttCombat(() => actors, () => 'a', hp => { if(hp) actors.find(a => a.id === hp.id)!.hp = hp.hp; }, () => {}, die, sight, undefined,
    () => [world.state, [...profiles]]);
  engine.start('a');
  return { actors, world, profiles, sight, engine, die, action: actors[0].actions[0] };
}

describe('Visión personal y vigencia de decisiones del combate', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));
  function pickerFor(engine: VttCombat) {
    const fixture = TestBed.createComponent(VttAttackPicker);
    fixture.componentRef.setInput('combat', engine); fixture.componentRef.setInput('actorId', 'a'); fixture.componentRef.setInput('targetId', 'b'); fixture.detectChanges();
    return { fixture, picker: fixture.componentInstance };
  }
  it('un aliado con visión no presta vista personal al atacante y cambiar observadores no la concede', () => {
    const { world, profiles, actors, sight, action } = setup(); world.state.environment.illumination = 'darkness';
    profiles.set('ally', { version: 1, senses: [{ sense: 'darkvision', rangeFeet: 60, source }] });
    expect(sight('ally', 'b').visible).toBeTrue(); expect(sight('a', 'b').visible).toBeFalse();
    const facts = { ...normalAttackFacts(), reviewed: true };
    const before = attackSituation(actors[0], actors[1], action, actors, facts, sight);
    expect(before.reasons).toContain('No ves al objetivo: desventaja');
    world.state.groups[0].observerIds = ['a', 'ally'];
    expect(attackSituation(actors[0], actors[1], action, actors, facts, sight).context).toEqual(before.context);
  });
  it('una puerta acristalada permite ver pero bloquea el ataque antes de dados o recursos; abrirla despeja efecto', () => {
    const { world, actors, engine, die, action, sight } = setup();
    world.state.obstacles = [{ id: 'door', name: 'Puerta sintética', kind: 'door-window', open: false, start: {x:51.2,y:0}, end:{x:51.2,y:51.2}, blocksSight:false, blocksEffect:true, source }];
    expect(sight('a','b').visible).toBeTrue(); expect(sight('a','b').lineOfEffect).toBeFalse();
    const facts = { ...normalAttackFacts(), reviewed:true };
    expect(attackSituation(actors[0],actors[1],action,actors,facts,sight).blocked).toContain('línea de efecto');
    expect(() => engine.begin(action.source,['b'],{advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true})).toThrowError(/línea de efecto/);
    expect(die).not.toHaveBeenCalled(); expect(engine.state().usedAttacks).toBe(0); expect(engine.state().resources).toEqual({});
    world.state.obstacles[0].open=true;
    expect(attackSituation(actors[0],actors[1],action,actors,facts,sight).blocked).toBeUndefined();
  });
  it('reutiliza la revisión solo sin cambios e invalida luz, puerta no interceptada, efecto y observadores aunque sigan viendo', async () => {
    const { world, engine, action } = setup(), { fixture, picker } = pickerFor(engine);
    const changes = [
      () => world.state.environment.illumination = 'dim' as const,
      () => world.state.obstacles!.push({ id:'far',name:'Puerta lejana',kind:'door',open:false,start:{x:600,y:0},end:{x:600,y:50},blocksSight:true,blocksEffect:true,source }),
      () => world.state.obstacles![0].open=true,
      () => world.state.effects.push({ id:'other',name:'Efecto ajeno',kind:'blinded',scope:{kind:'tokens',tokenIds:['ally']},duration:{kind:'rounds',remaining:1},active:true,source }),
      () => world.state.groups[0].observerIds=['a','ally'],
    ];
    picker.choose(action); await picker.confirm(); const first=engine.state().usedAttacks;
    picker.choose(action); expect(engine.state().usedAttacks).toBe(first+1);
    for (const change of changes) {
      change(); const before=engine.state().usedAttacks; picker.choose(action);
      expect(picker.facts.reviewed).toBeFalse(); expect(engine.state().usedAttacks).toBe(before);
      await picker.confirm(); expect(picker.error()).toBe('');
    }
    fixture.destroy();
  });
  it('movimiento y fin de hechizo no conservan desventaja anterior ni excepciones manuales', async () => {
    const { world, actors, engine, action } = setup(), { fixture, picker } = pickerFor(engine);
    world.state.effects=[{id:'blind',name:'Cegado temporal',kind:'blinded',scope:{kind:'tokens',tokenIds:['a']},duration:{kind:'rounds',remaining:1},active:true,source}];
    picker.choose(action); expect(picker.situation()!.context.disadvantage).toBeTrue(); await picker.confirm();
    world.state=endVisionEffect(world.state,'blind'); picker.choose(action);
    expect(picker.facts.reviewed).toBeFalse(); expect(picker.situation()!.context.disadvantage).toBeFalse(); await picker.confirm();
    actors[1].x+=.1; const attacks=engine.state().usedAttacks; picker.choose(action);
    expect(picker.facts.reviewed).toBeFalse(); expect(engine.state().usedAttacks).toBe(attacks); fixture.destroy();
  });
  it('cambiar el entorno con una decisión abierta invalida sus respuestas antes de gastar el ataque', async () => {
    const { world, engine, action, die } = setup(), { fixture, picker } = pickerFor(engine);
    picker.choose(action); picker.facts.extraAdvantage=true; world.state.environment.weather='rain';
    await picker.confirm(); expect(picker.error()).toContain('han cambiado'); expect(picker.facts.extraAdvantage).toBeFalse();
    expect(engine.state().usedAttacks).toBe(0); expect(die).not.toHaveBeenCalled(); fixture.destroy();
  });
  it('solo pregunta la vista y la línea de efecto desconocidas y exige respuestas explícitas en el formulario', async () => {
    const { world, engine, action, die } = setup(), { fixture, picker } = pickerFor(engine);
    world.state.environment.illumination='unknown'; delete world.state.obstacles;
    picker.choose(action); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('¿El atacante ve personalmente al objetivo?');
    await picker.confirm(); expect(die).not.toHaveBeenCalled(); expect(picker.error()).toContain('dudas');
    fixture.detectChanges();
    const selects=Array.from(fixture.nativeElement.querySelectorAll('.situation select')) as HTMLSelectElement[];
    expect(selects.length).toBe(3);
    for (const select of selects) { select.value=Array.from(select.options).find(o=>o.text==='Sí')!.value; select.dispatchEvent(new Event('change',{bubbles:true})); }
    fixture.detectChanges(); await fixture.whenStable(); await picker.confirm();
    expect(picker.error()).toBe(''); expect(engine.state().usedAttacks).toBe(1); fixture.destroy();
  });
  it('un resultado ya tirado conserva dados, recursos y reacción al cambiar el entorno o restaurar', () => {
    const { world, actors, engine, action, die } = setup(); actors[1].armorClass=12; actors[1].reactions=[{source:'Parada',name:'Parada',trigger:'hit',protectOthers:false,range:0,meleeOnly:true,effect:'armor',amount:2,dice:'',duration:'attack',resourceConfirmed:true,reviewed:true}];
    engine.begin(action.source,['b'],{advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true});
    const pending=structuredClone(engine.state().pending), calls=die.calls.count(); world.state.environment.illumination='darkness';
    const saved=structuredClone(engine.serialized()); engine.restore(saved);
    expect(engine.state().pending).toEqual(pending); expect(die.calls.count()).toBe(calls); expect(engine.reactions().map(r=>r.reaction.source)).toContain('Parada');
  });
  function fullPanel(engine: VttCombat) {
    const fixture=TestBed.createComponent(VttCombatPanel);fixture.componentRef.setInput('combat',engine);fixture.detectChanges();
    const panel=fixture.componentInstance;panel.open('a');return {fixture,panel};
  }
  it('el formulario completo exige cada aclaración desconocida antes de consumir una acción multiobjetivo', async () => {
    const {world,actors,engine,die,action}=setup();world.state.environment.illumination='unknown';delete world.state.obstacles;
    actors[0].actions[0]={...action,targets:2};const {fixture,panel}=fullPanel(engine);panel.choose(actors[0].actions[0]);panel.targetIds=['b','ally'];panel.contextConfirmed=true;
    panel.roll();expect(engine.state().usedAttacks).toBe(0);expect(die).not.toHaveBeenCalled();expect(panel.error()).toContain('Confirma');
    fixture.detectChanges();await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[aria-label="Revisar visión por objetivo"] select').length).toBe(6);
    for(const review of panel.targetReviews())Object.assign(review.facts,{attackerSightConfirmed:true,targetSightConfirmed:true,lineOfEffectConfirmed:true});
    panel.roll();expect(panel.error()).toBe('');expect(engine.state().usedAttacks).toBe(1);fixture.destroy();
  });
  it('contextos diferentes por objetivo sobreviven a recarga y se validan también en las copias', () => {
    const {actors,profiles,engine,action}=setup();actors[0].actions[0]={...action,targets:2};
    profiles.set('a',{version:1,senses:[{sense:'normal',rangeFeet:0,source}]});profiles.set('b',{version:1,senses:[{sense:'normal',rangeFeet:0,source}]});
    const {fixture,panel}=fullPanel(engine);panel.choose(actors[0].actions[0]);panel.targetIds=['b','ally'];panel.contextConfirmed=true;panel.roll();
    expect(panel.error()).toBe('');expect(engine.state().pending!.roll!.dice.length).toBe(1);
    const saved=structuredClone(engine.serialized()) as any;
    expect(saved.queue[0].context.disadvantage).toBeTrue();expect(saved.queue[0].context.advantage).toBeFalse();
    const board={tokens:actors.map(a=>({...a,instanceId:a.id,image:'',hidden:false,initiative:0})),combat:saved};
    expect(()=>validateBoard(board)).not.toThrow();
    const bad=structuredClone(board);bad.combat.queue[0].context.damageFactor=7;expect(()=>validateBoard(bad)).toThrow();
    engine.restore(saved);expect(engine.error()).toBe('');engine.finish(true);expect(engine.state().pending!.targetId).toBe('ally');expect(engine.state().pending!.roll!.disadvantage).toBeTrue();fixture.destroy();
  });
  it('el formulario completo limpia ventajas, cobertura y defensas al elegir otra acción o cambiar el mundo', () => {
    const {world,engine,action,die}=setup(),{fixture,panel}=fullPanel(engine);panel.choose(action);
    panel.advantage=true;panel.disadvantage=true;panel.armorAdjustment=5;panel.damageFactor=.5;panel.choose(action);
    expect([panel.advantage,panel.disadvantage,panel.armorAdjustment,panel.damageFactor]).toEqual([false,false,0,1]);
    panel.targetIds=['b'];panel.contextConfirmed=true;panel.advantage=true;world.state.environment.illumination='dim';panel.roll();
    expect(panel.error()).toContain('ha cambiado');expect(panel.advantage).toBeFalse();expect(engine.state().usedAttacks).toBe(0);expect(die).not.toHaveBeenCalled();fixture.destroy();
  });
  it('cancelar una respuesta conserva la reacción gastada y elimina las aclaraciones para la siguiente', () => {
    const {engine,action}=setup(),{fixture,panel}=fullPanel(engine);
    engine.begin(action.source,['b'],{advantage:false,disadvantage:false,armorAdjustment:0,damageFactor:1,confirmed:true});
    const pending=engine.state().pending!;
    engine.state.update(s=>({...s,reactionUsed:['b'],pending:{...pending,phase:'response',attackerId:'b',targetId:'a',roll:undefined,damage:[]}}));
    panel.responseSituation();Object.assign(panel.responseFacts,{reviewed:true,extraAdvantage:true,attackerSightConfirmed:true});panel.cancelResponse();
    expect(engine.state().reactionUsed).toEqual(['b']);expect(panel.responseFacts.reviewed).toBeFalse();expect(panel.responseFacts.extraAdvantage).toBeFalse();
    engine.state.update(s=>({...s,pending:{...pending,phase:'response',attackerId:'ally',targetId:'a',roll:undefined,damage:[]}}));
    panel.responseSituation();expect(panel.responseFacts.attackerSightConfirmed).toBeUndefined();fixture.destroy();
  });

});
