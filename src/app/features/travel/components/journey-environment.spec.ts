import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { JourneyEnvironment } from './journey-environment';
import { unknownWorldEnvironment } from '../../../core/services/encounter-environment';

describe('Editor de entorno del viaje',()=>{
 it('valida una hora del mundo explícita y conserva desconocidos sin elegir clima por el texto',async()=>{
  TestBed.configureTestingModule({imports:[JourneyEnvironment],providers:[provideZonelessChangeDetection()]});
  const f=TestBed.createComponent(JourneyEnvironment);f.componentRef.setInput('value',unknownWorldEnvironment());f.detectChanges();await f.whenStable();
  const view=f.componentInstance as any,save=jasmine.createSpy('saved');f.componentInstance.saved.subscribe(save);
  view.day='3';view.time='25:00';view.save();expect(save).not.toHaveBeenCalled();
  view.time='04:35';view.save();expect(save.calls.mostRecent().args[0].gameTime).toEqual({day:3,minuteOfDay:275,second:0});expect(save.calls.mostRecent().args[0].weather).toBe('unknown');
  f.componentRef.setInput('value',{...unknownWorldEnvironment(),gameTime:{day:9,minuteOfDay:1439}});f.detectChanges();await f.whenStable();expect(view.day).toBe('9');expect(view.time).toBe('23:59');
  view.day=null;view.time='';view.save();expect(save.calls.mostRecent().args[0].gameTime).toBeUndefined();
 });
});
