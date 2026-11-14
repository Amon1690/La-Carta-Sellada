import { assertEncounterWorldContext, findEncounterWorld, snapshotEncounterWorld, unknownWorldEnvironment } from './encounter-environment';

describe('Contexto del mundo por encuentro', () => {
  const context=(groupId='norte',illumination:'dim'|'darkness'='dim')=>({version:1 as const,campaignId:'prueba',groupId,runId:'mismo-run',encounterId:'emboscada-camino',environment:{...unknownWorldEnvironment(),illumination,weather:'fog' as const,gameTime:{day:7,minuteOfDay:450,second:0},source:{kind:'director' as const,reference:'Prueba sintética'}}});
  const expected=(groupId='norte')=>({campaignId:'prueba',groupId,runId:'mismo-run',encounterId:'emboscada-camino'});
  it('congela los valores explícitos sin consultar el reloj ni convertir noche en oscuridad',()=>{
    const original=context(),saved=snapshotEncounterWorld(original);original.environment.illumination='darkness';
    expect(saved.environment.illumination).toBe('dim');expect(saved.environment.gameTime).toEqual({day:7,minuteOfDay:450,second:0});expect(saved.environment.timeOfDay).toBe('unknown');
  });
  it('separa grupos con el mismo run, campañas y encuentros y conserva un encuentro ya jugado en el registro',()=>{
    const north=context(),south=context('sur','darkness');const travel={version:2,journeys:{norte:{logs:[{weather:'Lluvia narrativa',context:north}]},sur:{logs:[],pendingEncounter:{context:south}}}};
    expect(findEncounterWorld(travel,expected())?.environment.illumination).toBe('dim');expect(findEncounterWorld(travel,expected('sur'))?.environment.illumination).toBe('darkness');
    expect(findEncounterWorld(travel,{...expected(),campaignId:'otra'})).toBeUndefined();expect(findEncounterWorld(travel,{...expected(),encounterId:'otra'})).toBeUndefined();
    const found=findEncounterWorld(travel,expected())!;found.environment.illumination='darkness';expect(north.environment.illumination).toBe('dim');
  });
  it('no interpreta horas o clima dentro de textos antiguos',()=>{
    expect(findEncounterWorld({version:2,journeys:{norte:{logs:[{weather:'Noche cerrada a las 23:45',day:123}]}}},expected())).toBeUndefined();
    expect(findEncounterWorld({logs:[{context:context()}]},expected())).toBeUndefined();
  });
  it('rechaza referencias, versiones, rangos y procedencia corruptos sin normalizarlos',()=>{
    for(const value of [{...context(),version:2},{...context(),groupId:'../otro'},{...context(),environment:{...context().environment,gameTime:{day:7,minuteOfDay:1440}}},{...context(),environment:{...context().environment,source:undefined}},{...context(),environment:{...context().environment,obscurement:'tormenta'}}])expect(()=>assertEncounterWorldContext(value)).toThrow();
    expect(()=>assertEncounterWorldContext(context())).not.toThrow();expect(()=>assertEncounterWorldContext({...context(),environment:unknownWorldEnvironment()})).not.toThrow();
  });
});
