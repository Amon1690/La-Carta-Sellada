import { CharacterBuild } from '../../../../core/models/character-build';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlayerBuilder, PlayerBuilderValue } from './player-builder';
import { rules, warrior } from '../../../../core/services/character-builder.fixture';
import { calculateCharacter } from '../../../../core/services/character-builder';
import { PlayerOption } from '../../../../core/models/campaign';
function oldSheet(): PlayerOption { return { ...calculateCharacter(warrior(), rules).stats, id: 'old', name: 'Ficha antigua', ancestry: 'Enana', className: 'Guerrera', background: 'Soldado', level: 5, subclass: 'Campeón', hook: '', feat: '', hitPoints: 71 }; }
describe('Editor guiado de PJ', () => {
    let fixture: ComponentFixture<PlayerBuilder>, last: PlayerBuilderValue | undefined;
    beforeEach(() => { TestBed.configureTestingModule({ imports: [PlayerBuilder], providers: [provideZonelessChangeDetection()] }); fixture = TestBed.createComponent(PlayerBuilder); fixture.componentRef.setInput('rules', rules); fixture.componentInstance.valueChange.subscribe((value) => last = value); });
    const find = (name: string) => fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLInputElement;
    const change = async (name: string, value: string) => { const el = find(name); el.value = value; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input')); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    it('muestra valores derivados deshabilitados y bloquea la subclase antes del nivel 3', async () => { fixture.detectChanges(); await fixture.whenStable(); expect(find('build-subclass').disabled).toBeTrue(); expect(fixture.nativeElement.querySelector('[aria-label="CA calculada"]').matches(':disabled')).toBeTrue(); expect(fixture.nativeElement.querySelector('[aria-label="PG calculados"]').matches(':disabled')).toBeTrue(); await change('build-class', 'guerrero'); await change('build-level', '3'); expect(find('build-subclass').disabled).toBeFalse(); });
    it('no convierte ni modifica una ficha anterior al abrirla; conserva la copia al convertir', async () => { const sheet = oldSheet(), before = JSON.stringify(sheet); fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges(); await fixture.whenStable(); expect(last).toBeUndefined(); expect(fixture.nativeElement.querySelector('[aria-label="PG calculados"]').value).toBe('71'); (fixture.nativeElement.querySelector('.migration button') as HTMLButtonElement).click(); fixture.detectChanges(); expect(last?.build.legacy?.hitPoints).toBe(71); expect(JSON.stringify(sheet)).toBe(before); });
    it('cambia de ficha sin reutilizar elecciones del editor anterior', async () => { fixture.componentRef.setInput('sheet', { ...oldSheet(), build: warrior() }); fixture.detectChanges(); await fixture.whenStable(); expect(find('build-level').value).toBe('5'); fixture.componentRef.setInput('sheet', undefined); fixture.componentRef.setInput('resetKey', 1); fixture.detectChanges(); await fixture.whenStable(); expect(find('build-level').value).toBe('1'); expect(find('build-class').value).toBe(''); });
    it('recalcula al editar características y deshabilita elecciones durante el guardado', async () => { fixture.componentRef.setInput('sheet', { ...oldSheet(), build: warrior() }); fixture.detectChanges(); await fixture.whenStable(); await change('build-ability-constitution', '18'); expect(last?.calculation.stats.hitPoints).toBe(59); fixture.componentRef.setInput('busy', true); fixture.detectChanges(); expect(find('build-level').matches(':disabled')).toBeTrue(); });
    it('permite retirar los conjuros que dejan de estar disponibles al bajar el nivel', async () => { const build = warrior(); build.classId = 'guerrero'; build.subclass = 'Caballero arcano'; build.level = 3; build.cantripIds = ['luz']; build.preparedIds = ['escudo']; fixture.componentRef.setInput('sheet', { ...oldSheet(), build }); fixture.detectChanges(); await fixture.whenStable(); await change('build-level', '2'); expect(find('build-cantrip-0')).not.toBeNull(); expect(find('build-prepared-0')).not.toBeNull(); await change('build-cantrip-0', ''); await change('build-prepared-0', ''); expect(last?.build.cantripIds).toEqual([]); expect(last?.build.preparedIds).toEqual([]); });
    it('conserva visibles los conjuros del libro que ya no están al alcance y no añade placeholders', async () => { const build = warrior(); build.classId = 'mago'; build.subclass = 'Evocador'; build.spellbookIds = ['bola-de-fuego']; fixture.componentRef.setInput('sheet', { ...oldSheet(), build }); fixture.detectChanges(); await fixture.whenStable(); await change('build-level', '4'); expect(fixture.nativeElement.textContent).toContain('Quitar Bola de fuego'); await change('build-book-add', ''); expect(last?.build.spellbookIds).toEqual(['bola-de-fuego']); const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]; buttons.find((b) => b.textContent?.includes('Quitar Bola de fuego'))!.click(); fixture.detectChanges(); expect(last?.build.spellbookIds).toEqual([]); });
});

describe('Editor de conjuros de la ficha guiada', () => {
  it('libera las casillas cuando la subclase convierte elecciones anteriores en conjuros automáticos', async () => {
    TestBed.configureTestingModule({providers: [provideZonelessChangeDetection()]});
    const build = warrior();
    build.classId = 'paladin'; build.subclass = 'Juramento de gloria';
    build.preparedIds = ['escudo-de-fe', 'auxilio'];
    const sheet = { ...calculateCharacter(build, rules).stats, id:'valian', name:'Valian', ancestry:'Enano', className:'Paladín', subclass:build.subclass, background:'Soldado', level:5, feat:'', hook:'', build } as PlayerOption;
    const fixture = TestBed.createComponent(PlayerBuilder);
    fixture.componentRef.setInput('rules', rules);
    fixture.componentRef.setInput('sheet', sheet);
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance as unknown as {build:CharacterBuild; slotsFilled(cantrip:boolean):number};
    expect(component.slotsFilled(false)).toBe(2);
    const select = fixture.nativeElement.querySelector('select[name="build-subclass"]') as HTMLSelectElement;
    select.value = 'Juramento de entrega'; select.dispatchEvent(new Event('change'));
    await fixture.whenStable(); fixture.detectChanges();
    expect(component.build.preparedIds).toEqual([]);
    expect(component.slotsFilled(false)).toBe(0);
    expect(sheet.build!.preparedIds).toEqual(['escudo-de-fe','auxilio']);
    expect(fixture.nativeElement.textContent).toContain('Siempre preparados por clase o juramento');
  });
});
