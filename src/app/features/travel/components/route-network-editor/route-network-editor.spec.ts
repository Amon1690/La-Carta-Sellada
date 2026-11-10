import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ACCESS_CONTEXT } from '../../../../core/services/access';
import { networkStorageKey } from '../../../../core/models/travel-network';
import { syntheticNetwork } from '../../../../core/services/travel-network.fixture';
import { RouteNetworkEditor } from './route-network-editor';

describe('Editor de redes propias',()=>{
  let values:Map<string,string>,write:jasmine.Spy;
  beforeEach(()=>{
    values=new Map();spyOn(Storage.prototype,'getItem').and.callFake((key)=>values.get(key)??null);
    write=spyOn(Storage.prototype,'setItem').and.callFake((key,value)=>{values.set(key,value);});
    TestBed.configureTestingModule({imports:[RouteNetworkEditor],providers:[provideZonelessChangeDetection(),{provide:ACCESS_CONTEXT,useValue:{user:()=>({id:'dm',username:'Prueba',role:'director',campaigns:['one','two']})}}]});
  });
  async function editor(){const fixture=TestBed.createComponent(RouteNetworkEditor);fixture.componentRef.setInput('campaignId','one');fixture.componentRef.setInput('point',{x:50,y:50});fixture.detectChanges();await fixture.whenStable();return fixture;}
  it('valida una vista previa sin guardar, conserva el borrador al seleccionar un lugar y guarda por campaña',async()=>{
    const fixture=await editor(),view=fixture.componentInstance as any,network=syntheticNetwork();view.edit(JSON.stringify(network));view.validate();fixture.detectChanges();await fixture.whenStable();
    expect(write).not.toHaveBeenCalled();expect(fixture.nativeElement.textContent).toContain('Datos sintéticos');expect(fixture.nativeElement.textContent).toContain('sin cobertura de red');
    const draft=view.draft();fixture.componentRef.setInput('point',{x:2,y:1});fixture.detectChanges();await fixture.whenStable();expect(view.draft()).toBe(draft);expect(fixture.nativeElement.textContent).toContain('dentro de la cobertura declarada');
    await view.save();fixture.detectChanges();expect(JSON.parse(values.get(networkStorageKey('one'))!)).toEqual(network);expect(values.has(networkStorageKey('two'))).toBeFalse();expect(fixture.nativeElement.textContent).toContain('Red guardada en este navegador');
  });
  it('bloquea un original futuro e ilegible y no escribe al validar un documento nuevo',async()=>{
    const raw=JSON.stringify({...syntheticNetwork(),version:99});values.set(networkStorageKey('one'),raw);
    const fixture=await editor(),view=fixture.componentInstance as any;expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();
    view.edit(JSON.stringify(syntheticNetwork()));view.validate();await view.save();expect(values.get(networkStorageKey('one'))).toBe(raw);expect(write).not.toHaveBeenCalled();
  });
  it('una lectura de archivo iniciada en otra campaña no cambia el nuevo borrador',async()=>{
    const fixture=await editor(),view=fixture.componentInstance as any;let finish!:(text:string)=>void;
    const file=new File(['red'],'red.json');Object.defineProperty(file,'text',{value:()=>new Promise<string>((resolve)=>finish=resolve)});
    const input=fixture.nativeElement.querySelector('input[type=file]');Object.defineProperty(input,'files',{configurable:true,value:[file]});
    const pending=view.importFile({target:input});fixture.componentRef.setInput('campaignId','two');fixture.detectChanges();await fixture.whenStable();const before=view.draft();
    finish(JSON.stringify(syntheticNetwork()));await pending;fixture.detectChanges();expect(view.draft()).toBe(before);expect(view.preview()).toBeNull();expect(write).not.toHaveBeenCalled();
  });
  it('presenta un conflicto sin sobrescribir la revisión de otra pestaña',async()=>{
    const network=syntheticNetwork();values.set(networkStorageKey('one'),JSON.stringify(network));const fixture=await editor(),view=fixture.componentInstance as any;
    view.validate();const concurrent=JSON.stringify({...network,revision:3});values.set(networkStorageKey('one'),concurrent);await view.save();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('otra pestaña');expect(values.get(networkStorageKey('one'))).toBe(concurrent);expect(view.busy()).toBeFalse();expect(write).not.toHaveBeenCalled();
  });
});
