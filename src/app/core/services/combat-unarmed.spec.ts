import { GENERIC_NPCS } from '../data/generic-npcs';
import type { Combatant } from '../models/combat';
import { grappleCarryExtra, grappleConsequences, grappleFromDecision, grappleStatus, reconcileGrappleLinks, prepareUnarmedEffect, resolveUnarmedSave, validGrappleLink, validUnarmedDecision } from './combat-unarmed';
const normal = { restrained: false, advantage: false, disadvantage: false };
function actor(id: string, x = 0): Combatant {
  return { id, actorId: 'player:' + id, name: id, x, y: 0, size: 1, hp: 20, maxHp: 20, armorClass: 12, conditions: [], saves: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 }, actions: [], reactions: [], resources: [], attacksPerTurn: 1, notes: [], profile: { actions: [], reactions: [], resources: [] } };
}
const stats = () => ({ ...structuredClone(GENERIC_NPCS[0]), abilities: { ...GENERIC_NPCS[0].abilities, strength: 16 }, proficiencyBonus: 2 });
const review = () => ({ ownerSize: 'medium' as const, targetSize: 'medium' as const, distance: 1.5, freeHand: true });
const declaration = () => prepareUnarmedEffect('grapple', stats(), 'a', 'b', review());
const link = () => ({ id: 'grapple', ownerId: 'a', targetId: 'b', range: 1.5, escapeDc: 13 });
describe('Opciones sin armas2024, decisiones privadas y agarres', () => {
  it('la base de Fuerza obtiene una CD confirmada y no inventa una mejora de clase', () => {
    const d = declaration(); expect(d.dc).toBe(13); expect(d.range).toBe(1.5); expect(d.rule).toBe('2024-strength-basic');
    const higher = stats(); higher.abilities.strength = 20; higher.proficiencyBonus = 4;
    expect(prepareUnarmedEffect('push',higher,'a','b',review()).dc).toBe(17);
    expect(d.save).toBeUndefined(); expect(validUnarmedDecision(d)).toBeTrue();
  });
  it('no usa Fuerza, competencia, distancia ni tamaño ausentes como valores por defecto', () => {
    expect(()=>prepareUnarmedEffect('grapple',undefined,'a','b',review())).toThrow();
    for(const missing of [{...review(),ownerSize:undefined},{...review(),targetSize:undefined},{...review(),distance:undefined},{...review(),distance:NaN},{...review(),distance:1.6}])expect(()=>prepareUnarmedEffect('grapple',stats(),'a','b',missing)).toThrow();
    const invalid=stats();invalid.proficiencyBonus=2.5;expect(()=>prepareUnarmedEffect('push',invalid,'a','b',review())).toThrow();invalid.proficiencyBonus=2;invalid.abilities.strength=0;expect(()=>prepareUnarmedEffect('push',invalid,'a','b',review())).toThrow();
  });
  it('el tamaño se confirma por categoría aunque dos tokens tengan la misma huella', () => {
    expect(()=>prepareUnarmedEffect('push',stats(),'a','b',{ownerSize:'small',targetSize:'large',distance:1.5})).toThrow();
    expect(prepareUnarmedEffect('push',stats(),'a','b',{ownerSize:'medium',targetSize:'large',distance:1.5}).effect).toBe('push');
    expect(()=>prepareUnarmedEffect('prone',stats(),'a','b',{ownerSize:'medium',targetSize:'huge',distance:1.5})).toThrow();
    expect(prepareUnarmedEffect('prone',stats(),'a','b',{ownerSize:'tiny',targetSize:'small',distance:1.5}).effect).toBe('prone');
  });
  it('Agarre exige mano libre; Empujón y derribo no la inventan ni la exigen', () => {
    for(const freeHand of [false,undefined])expect(()=>prepareUnarmedEffect('grapple',stats(),'a','b',{...review(),freeHand})).toThrow();
    for(const option of ['push','prone'] as const)expect(prepareUnarmedEffect(option,stats(),'a','b',{...review(),freeHand:false}).effect).toBe(option);
  });
  it('rechaza autoobjetivo y opciones ajenas a este contrato', () => {
    expect(()=>prepareUnarmedEffect('push',stats(),'a','a',review())).toThrow();
    expect(validUnarmedDecision({...declaration(),effect:'automatic'})).toBeFalse();
    expect(validUnarmedDecision({...declaration(),rule:'inferred-class-feature'})).toBeFalse();
  });
  it('el objetivo elige FUE o DES con su bonificador confirmado y sin tirar ataque contra CA', () => {
    const die=jasmine.createSpy().and.returnValue(10),d=declaration();
    expect(resolveUnarmedSave(d,'strength',3,die,normal).save?.success).toBeTrue();
    expect(resolveUnarmedSave(d,'dexterity',-1,die,normal).save?.success).toBeFalse();
    expect(d.save).toBeUndefined(); expect(die.calls.allArgs()).toEqual([[20],[20]]);
    expect(()=>resolveUnarmedSave(d,'strength',undefined,die,normal)).toThrow();
  });
  it('resuelve DES de Restringido con desventaja y FUE con normalidad', () => {
    let dice=[18,4];const die=jasmine.createSpy().and.callFake(()=>dice.shift()!);
    const dex=resolveUnarmedSave(declaration(),'dexterity',0,die,{...normal,restrained:true});expect(dex.save?.roll.dice).toEqual([18,4]);expect(dex.save?.roll.total).toBe(4);
    dice=[18,4];const str=resolveUnarmedSave(declaration(),'strength',0,die,{...normal,restrained:true});expect(str.save?.roll.dice).toEqual([18]);expect(str.save?.success).toBeTrue();
    expect(validUnarmedDecision(dex)).toBeTrue();expect(validUnarmedDecision(str)).toBeTrue();
  });
  it('ventaja y desventaja se cancelan sin una segunda tirada', () => {
    const die=jasmine.createSpy().and.returnValue(14),d=resolveUnarmedSave(declaration(),'dexterity',0,die,{...normal,restrained:true,advantage:true});
    expect(die).toHaveBeenCalledTimes(1);expect(d.save?.roll.dice).toEqual([14]);expect(validUnarmedDecision(d)).toBeTrue();
  });
  it('20 y1 naturales no cambian por sí solos el resultado de una salvación', () => {
    const high=stats();high.abilities.strength=30;high.proficiencyBonus=7;
    const difficult=prepareUnarmedEffect('prone',high,'a','b',review());expect(difficult.dc).toBe(25);
    expect(resolveUnarmedSave(difficult,'strength',0,()=>20,normal).save?.success).toBeFalse();
    expect(resolveUnarmedSave(declaration(),'strength',20,()=>1,normal).save?.success).toBeTrue();
  });
  it('recargar conserva elección/dados y una resolución no se vuelve a tirar', () => {
    const original=resolveUnarmedSave(declaration(),'dexterity',1,()=>8,normal),saved=JSON.parse(JSON.stringify(original));
    expect(validUnarmedDecision(saved)).toBeTrue();expect(saved.save.ability).toBe('dexterity');expect(saved.save.roll.dice).toEqual([8]);
    const die=jasmine.createSpy().and.returnValue(20);expect(()=>resolveUnarmedSave(saved,'strength',10,die,normal)).toThrow();expect(die).not.toHaveBeenCalled();
  });
  it('un guardado manipulado no cambia CD, opción o salvación silenciosamente', () => {
    const d=resolveUnarmedSave(declaration(),'strength',0,()=>8,normal);
    for(const bad of [{...d,dc:1},{...d,review:{...d.review,freeHand:false}},{...d,save:{...d.save,success:true}},{...d,save:{...d.save,ability:'wisdom'}},{...d,save:{...d.save,roll:{...d.save!.roll,total:20}}},{...d,save:{...d.save,roll:{...d.save!.roll,dice:new Array(1)}}}])expect(validUnarmedDecision(bad)).toBeFalse();
  });
  it('rechaza un bonificador que pudiera desbordar el guardado antes de tirar', () => {
    const die=jasmine.createSpy().and.returnValue(20);
    for(const modifier of [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER-19])expect(()=>resolveUnarmedSave(declaration(),'strength',modifier,die,normal)).toThrow();
    expect(die).not.toHaveBeenCalled();const boundary=resolveUnarmedSave(declaration(),'strength',Number.MAX_SAFE_INTEGER-20,die,normal);
    expect(boundary.save?.roll.total).toBe(Number.MAX_SAFE_INTEGER);expect(validUnarmedDecision(boundary)).toBeTrue();
  });
  it('no admite dados inválidos y conserva intacta la declaración', () => {
    const d=declaration(),before=structuredClone(d);
    for(const value of [0,21,NaN,2.5])expect(()=>resolveUnarmedSave(d,'strength',0,()=>value,normal)).toThrow();expect(d).toEqual(before);
  });
  it('solo una salvación fallida de Agarre crea un vínculo con CD de escape', () => {
    const failed=resolveUnarmedSave(declaration(),'strength',0,()=>3,normal),passed=resolveUnarmedSave(declaration(),'dexterity',0,()=>18,normal);
    expect(grappleFromDecision(failed,'link')).toEqual({...link(),id:'link'});expect(grappleFromDecision(passed,'link')).toBeUndefined();
    const pushed=prepareUnarmedEffect('push',stats(),'a','b',review());expect(()=>grappleFromDecision(resolveUnarmedSave(pushed,'strength',0,()=>3,normal),'link')).toThrow();
    expect(()=>grappleFromDecision(declaration(),'link')).toThrow();expect(validGrappleLink(link())).toBeTrue();
  });
  it('termina un agarre por incapacidad,0PG del agarrador o salida real de alcance', () => {
    const a=actor('a'),b=actor('b',51.2);expect(grappleStatus(link(),[a,b])).toBe('active');
    a.conditions=['incapacitated'];expect(grappleStatus(link(),[a,b])).toBe('ended');a.conditions=[];
    a.hp=0;expect(grappleStatus(link(),[a,b])).toBe('ended');a.hp=20;
    b.x=102.4;expect(grappleStatus(link(),[a,b])).toBe('ended');
  });
  it('no elimina agarres guardados por participantes, posiciones o condiciones desconocidos', () => {
    const a=actor('a'),b=actor('b',51.2);a.conditions=undefined;
    expect(grappleStatus(link(),[a,b])).toBe('unknown');expect(grappleStatus(link(),[a])).toBe('unknown');
    a.conditions=[];b.x=NaN;expect(grappleStatus(link(),[a,b])).toBe('unknown');
    b.x=51.2;expect(grappleStatus(link(),[a,b,{...a}])).toBe('unknown');expect(grappleStatus({...link(),range:-1},[a,b])).toBe('unknown');
  });
  it('no convierte PG nulos, no finitos o ausentes en fin o actividad confirmados', () => {
    const a=actor('a'),b=actor('b',51.2);
    for(const hp of [null,undefined,NaN,Infinity,-1,'0']){
      const malformed={...a,hp} as unknown as Combatant;expect(grappleStatus(link(),[malformed,b])).toBe('unknown');
      expect(grappleConsequences('b','other',[link()],[malformed,b]).unknown).toBeTrue();
    }
    const malformed={...a,hp:null,conditions:['incapacitated']} as unknown as Combatant;expect(grappleStatus(link(),[malformed,b])).toBe('ended');
    const noConditions={...a,conditions:{}} as unknown as Combatant;expect(grappleStatus(link(),[noConditions,b])).toBe('unknown');
  });
  it('Atrapado detiene velocidad y perjudica ataques a otros, sin confundirse con Restringido', () => {
    const a=actor('a'),b=actor('b',51.2);
    expect(grappleConsequences('b','a',[link()],[a,b])).toEqual({speedZero:true,disadvantage:false,unknown:false});
    expect(grappleConsequences('b','other',[link()],[a,b])).toEqual({speedZero:true,disadvantage:true,unknown:false});
    expect(grappleConsequences('b',undefined,[link()],[a,b]).disadvantage).toBeFalse();expect(b.conditions).toEqual([]);
  });
  it('cada agarrador conserva su efecto aunque el objetivo ataque a otro agarrador', () => {
    const a=actor('a'),b=actor('b',51.2),c=actor('c');
    const links=[link(),{...link(),id:'second',ownerId:'c'}];
    expect(grappleConsequences('b','a',links,[a,b,c]).disadvantage).toBeTrue();
    c.conditions=['incapacitated'];expect(grappleConsequences('b','a',links,[a,b,c]).disadvantage).toBeFalse();
    a.conditions=['incapacitated'];expect(grappleConsequences('b','other',links,[a,b,c]).speedZero).toBeFalse();
  });
  it('un vínculo incierto pide revisión y no se presenta como agarre terminado', () => {
    const b=actor('b',51.2),saved=structuredClone(link());
    expect(grappleConsequences('b','other',[saved],[b])).toEqual({speedZero:false,disadvantage:false,unknown:true});expect(saved).toEqual(link());
  });
  it('un fin confirmado se conserva al volver al alcance; la incertidumbre no termina el vínculo', () => {
    const a=actor('a'),b=actor('b',102.4),original=link();const ended=reconcileGrappleLinks([original],[a,b]);
    expect(ended[0].ended).toBeTrue();expect((original as typeof original & {ended?:boolean}).ended).toBeUndefined();b.x=51.2;
    expect(grappleStatus(ended[0],[a,b])).toBe('ended');expect(reconcileGrappleLinks(ended,[a,b])).toEqual(ended);
    expect(reconcileGrappleLinks([original],[b])[0].ended).toBeUndefined();expect(validGrappleLink({...original,ended:'yes'})).toBeFalse();
  });
  it('arrastrar suma un pie por pie salvo Tiny o dos categorías menores, sin adivinar tamaños', () => {
    expect(grappleCarryExtra('medium','medium')).toBe(1);expect(grappleCarryExtra('medium','small')).toBe(1);expect(grappleCarryExtra('large','small')).toBe(0);
    expect(grappleCarryExtra(undefined,'tiny')).toBe(0);expect(grappleCarryExtra(undefined,'small')).toBeUndefined();expect(grappleCarryExtra('large',undefined)).toBeUndefined();
  });
});
