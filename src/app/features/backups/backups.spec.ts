import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ACCESS_CONTEXT } from '../../core/services/access';
import { CHARACTER_SHEET_STORAGE } from '../../core/services/character-sheets';
import { CampaignDataService } from '../../core/services/campaign-data';
import { BACKUP_FORMAT, withoutAssociations } from '../../core/services/campaign-backup-format';
import { recoveryKey } from '../../core/services/campaign-backups';
import { Backups } from './backups';

class MemoryStorage implements Storage {
 values=new Map<string,string>();get length(){return this.values.size;}key(i:number){return [...this.values.keys()][i]??null;}
 getItem(k:string){return this.values.get(k)??null;}setItem(k:string,v:string){this.values.set(k,v);}removeItem(k:string){this.values.delete(k);}clear(){this.values.clear();}
}
const id='component-backup',url=`/api/campaigns/${id}`;
const sheet={id:'custom-test',name:'Personaje de prueba',ancestry:'Enano',className:'Guerrero',subclass:'Campeón',background:'Soldado',hook:'',feat:'',level:5,armorClass:16,hitPoints:40,speed:'9 m',initiative:'+1',proficiencyBonus:3,abilities:{strength:16,dexterity:12,constitution:14,intelligence:10,wisdom:10,charisma:10},saves:[],skills:[],attacks:[],features:[],spells:[],equipment:[],playerIds:['actual']};
const serverData=()=>({sheetOverrides:{edited:{},created:[sheet],revision:1},playerCharacters:[],playerOptions:[],npcs:[]});
const rawFile=(version=1)=>JSON.stringify({format:BACKUP_FORMAT,version,campaignId:id,createdAt:'2026-11-03T00:00:00Z',sheets:withoutAssociations(serverData().sheetOverrides),local:{}});
interface Actions {selectFile(e:Event):Promise<void>;restore():Promise<void>;reviewFile():Promise<void>;previousCopy():Promise<void>;}
const fileEvent=(raw:string):Event=>({target:{files:[{size:raw.length,text:async()=>raw}]}} as unknown as Event);

describe('Pantalla de copias de seguridad',()=>{
 let fixture:ComponentFixture<Backups>,http:HttpTestingController,storage:MemoryStorage,actions:Actions;
 beforeEach(()=>{
  storage=new MemoryStorage();
  TestBed.configureTestingModule({imports:[Backups],providers:[provideZonelessChangeDetection(),provideHttpClient(),provideHttpClientTesting(),{provide:ACCESS_CONTEXT,useValue:{user:()=>({id:'director',username:'Prueba',role:'director',campaigns:[id]})}},{provide:CHARACTER_SHEET_STORAGE,useValue:storage},{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({campaignId:id})}}},{provide:CampaignDataService,useValue:{invalidate:jasmine.createSpy('invalidate')}}]});
  spyOn(navigator.locks,'request').and.callFake(((_name:string,callback:any)=>Promise.resolve(callback({name:_name}))) as any);
  fixture=TestBed.createComponent(Backups);http=TestBed.inject(HttpTestingController);actions=fixture.componentInstance as unknown as Actions;fixture.detectChanges();
 });
 afterEach(()=>http.verify());
 const checkbox=(text:string):HTMLInputElement=>Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('label')).find((e:any)=>e.textContent.includes(text))!.querySelector('input') as HTMLInputElement;
 it('muestra la vista previa, exige confirmación y envía las asociaciones actuales por HTTP',async()=>{
  const read=actions.selectFile(fileEvent(rawFile()));await Promise.resolve();http.expectOne(url).flush(serverData());await read;fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Qué se sustituirá');let button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((e:any)=>e.textContent.includes('Restaurar los datos')) as HTMLButtonElement;expect(button.disabled).toBeTrue();
  const accepted=checkbox('He revisado');accepted.checked=true;accepted.dispatchEvent(new Event('change'));fixture.detectChanges();await fixture.whenStable();expect(button.disabled).toBeFalse();
  const restoring=actions.restore();http.expectOne(url).flush(serverData());await Promise.resolve();await Promise.resolve();
  const put=http.expectOne(url+'/sheets');expect(put.request.method).toBe('PUT');expect(put.request.body.revision).toBe(1);expect(put.request.body.created[0].playerIds).toEqual(['actual']);put.flush({...put.request.body,revision:2});await restoring;fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Copia restaurada');expect(storage.getItem(recoveryKey(id))).toBeNull();
 });
 it('muestra rechazo de una versión desconocida sin peticiones ni escrituras',async()=>{await actions.selectFile(fileEvent(rawFile(99)));fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('versión no admitidos');http.expectNone(url);expect(storage.length).toBe(0);});
 it('pide nuevas confirmaciones cuando cambia la incidencia de recuperación',async()=>{
  spyOn(URL,'createObjectURL').and.returnValue('blob:test');spyOn(URL,'revokeObjectURL');spyOn(HTMLAnchorElement.prototype,'click');
  const journal={version:1,operationId:'first',campaignId:id,userId:'director',phase:'rollback',before:{[`la-carta-sellada:vtt:${id}:scene:a`]:'{}'},after:{[`la-carta-sellada:vtt:${id}:scene:a`]:'{}'},sheetsBefore:serverData().sheetOverrides,sheetsAfter:serverData().sheetOverrides};
  storage.setItem(recoveryKey(id),JSON.stringify(journal));await actions.reviewFile();await actions.previousCopy();fixture.detectChanges();await fixture.whenStable();
  const accepted=checkbox('Recuperar los valores');accepted.checked=true;accepted.dispatchEvent(new Event('change'));const keep=checkbox('He guardado la copia');keep.checked=true;keep.dispatchEvent(new Event('change'));fixture.detectChanges();await fixture.whenStable();expect(accepted.checked).toBeTrue();
  storage.setItem(recoveryKey(id),JSON.stringify({...journal,operationId:'second'}));await actions.reviewFile();fixture.detectChanges();await fixture.whenStable();expect(checkbox('Recuperar los valores').checked).toBeFalse();expect(checkbox('He guardado la copia').checked).toBeFalse();
 });
});
