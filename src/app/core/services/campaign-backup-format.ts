import { GENERIC_ENCOUNTERS } from '../data/generic-encounters';
import { SheetCollection } from './remote-sheets';
import { validState } from './vtt-combat';
import { assertVisionProfile, assertBoardVision } from './vision-state';

export const BACKUP_FORMAT = 'la-carta-sellada:campaign-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_MAX_BYTES = 8 * 1024 * 1024;
export const GENERIC_SHEETS_KEY = 'la-carta-sellada:editable:fichas-genericas';
export interface CampaignBackup {
  format: typeof BACKUP_FORMAT; version: 1; campaignId: string; createdAt: string;
  sheets: SheetCollection; local: Record<string, unknown>;
}
// Validators operate on JSON only. Every object is checked before its fields are inspected.
type Data = Record<string, any>;
const fail = (label: string): never => { throw new Error(`Copia no válida: ${label}. No se ha escrito ningún dato.`); };
const object = (value: unknown, label: string): Data => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Data : fail(label);
const text = (value: unknown, maximum = 20000): boolean => typeof value === 'string' && value.length <= maximum;
const number = (value: unknown, min = -1e9, max = 1e9): boolean => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min = 0, max = 1e9): boolean => number(value, min, max) && Number.isInteger(value);
const strings = (value: unknown, maximum = 1000): value is string[] => Array.isArray(value) && value.length <= maximum && value.every((v) => text(v));
const array = (value: unknown, label: string, maximum = 10000): any[] => Array.isArray(value) && value.length <= maximum ? value : fail(label);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const abilities = ['strength','dexterity','constitution','intelligence','wisdom','charisma'];
function tree(value: unknown, depth = 0, count = { value: 0 }): void {
  if (depth > 60 || ++count.value > 300000) fail('archivo demasiado complejo');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') { if (!text(value, 250000)) fail('texto demasiado largo'); return; }
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('número no finito'); return; }
  if (Array.isArray(value)) { if(value.length > 100000) fail('lista demasiado larga'); value.forEach((v) => tree(v, depth+1, count)); return; }
  const data = object(value, 'estructura JSON');
  for (const [key, child] of Object.entries(data)) {
    if (['__proto__','constructor','prototype'].includes(key)) fail('campo reservado');
    tree(child, depth+1, count);
  }
}
function image(value: unknown): boolean {
  return value === undefined || value === '' || text(value,250000) && (/^https?:\/\//i.test(value as string) || /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value as string) || /^\/?assets\/[a-zA-Z0-9_./-]+$/.test(value as string) && !(value as string).split('/').includes('..'));
}
function combatProfile(value: unknown): void {
  const data=object(value,'perfil de combate');
  for (const action of array(data['actions'],'acciones',1000)) {
    const a=object(action,'acción');
    if(!text(a['source'])||!text(a['name'])||!['melee','ranged','spell'].includes(a['kind'])||!['attack','save','automatic'].includes(a['resolution'])||typeof a['reviewed']!=='boolean'||typeof a['resourceConfirmed']!=='boolean'||typeof a['halfOnSave']!=='boolean'||!integer(a['targets'],1,20)||typeof a['repeatTargets']!=='boolean'||!text(a['notes']))fail('datos de acción');
    for(const d of array(a['damage'],'daño',20)){if(!text(d?.dice)||!text(d?.type))fail('daño de acción');}
    for(const key of ['bonus','range','longRange','dc','spellLevel'])if(a[key]!==undefined&&!number(a[key],-1000,10000))fail('valor de acción');
    if(a['saveAbility']!==undefined&&!abilities.includes(a['saveAbility']))fail('característica de salvación');
    if(a['cost']!==undefined)cost(a['cost']);
  }
  for(const reaction of array(data['reactions'],'reacciones',1000)){
    const r=object(reaction,'reacción');
    if(!text(r['source'])||!text(r['name'])||!['hit','damage','miss','spell'].includes(r['trigger'])||!['armor','reduce','half','disadvantage','cancel','redirect','counter','manual'].includes(r['effect'])||!['attack','next-turn'].includes(r['duration'])||!number(r['range'],0,10000)||!number(r['amount'],0,10000)||!text(r['dice'])||typeof r['reviewed']!=='boolean'||typeof r['resourceConfirmed']!=='boolean')fail('datos de reacción');
    if(r['saveAbility']!==undefined&&!abilities.includes(r['saveAbility']))fail('característica de reacción');
    if(r['cost']!==undefined)cost(r['cost']);
  }
  const resources=array(data['resources'],'recursos',1000);
  const ids=new Set<string>();
  for(const resource of resources){const r=object(resource,'recurso');if(!text(r['id'])||!text(r['name'])||!integer(r['maximum'],1,999)||ids.has(r['id']))fail('recurso de combate');ids.add(r['id']);}
  if(data['attacksPerTurn']!==undefined&&!integer(data['attacksPerTurn'],1,20))fail('ataques por turno');
}
function cost(value:unknown):void {const c=object(value,'coste');if(!text(c['resourceId'])||!integer(c['amount'],1,999))fail('coste de recurso');}
function stats(value:unknown, featureKey='features'):void {
  const data=object(value,'estadísticas');
  for(const key of ['armorClass','hitPoints','proficiencyBonus'])if(!number(data[key],0,100000))fail(`estadística ${key}`);
  if(!text(data['speed'])||!text(data['initiative']))fail('velocidad o iniciativa');
  const scores=object(data['abilities'],'características');
  if(abilities.some((key)=>!integer(scores[key],0,30)))fail('características');
  for(const key of ['saves','skills','attacks',featureKey,'spells','equipment'])if(!strings(data[key]))fail(`lista de ficha ${key}`);
  if(data['combat']!==undefined)combatProfile(data['combat']);
  if(data['vision']!==undefined)assertVisionProfile(data['vision']);
}
function build(value:unknown):void {
  const b=object(value,'configuración guiada');if(b['version']!==1)fail('versión de ficha guiada no admitida');
  for(const key of ['ancestryId','variantId','backgroundId','classId','subclass','humanFeatId','fightingStyle','divineOrder','primalOrder'])if(!text(b[key]))fail('elecciones de ficha guiada');
  if(!integer(b['level'],1,20)||typeof b['scoresIncludeBonuses']!=='boolean'||!['fixed','rolled'].includes(b['hpMethod'])||!abilities.includes(b['magicAbility'])||!abilities.includes(b['resilientAbility']))fail('progresión guiada');
  const scores=object(b['scores'],'puntuaciones guiadas');if(abilities.some((key)=>!integer(scores[key],1,30)))fail('puntuaciones guiadas');
  const boosts=object(b['backgroundBoosts'],'aumentos de trasfondo');for(const [key,v] of Object.entries(boosts))if(!abilities.includes(key)||!integer(v,0,2))fail('aumentos de trasfondo');
  for(const key of ['classSkills','extraSkills','expertise','spellbookIds'])if(!strings(b[key]))fail('elecciones de ficha guiada');
  for(const key of ['featIds','cantripIds','preparedIds','originCantripIds'])if(!array(b[key],'elecciones posicionales',1000).every((v)=>v===null||text(v)))fail('elecciones posicionales de ficha guiada');
  if(!array(b['hpRolls'],'dados de PG',20).every((v)=>v===null||integer(v,1,20)))fail('dados de PG');
  for(const entry of array(b['equipment'],'inventario',1000)){const e=object(entry,'objeto');if(!text(e['id'])||!integer(e['quantity'],1,999)||typeof e['equipped']!=='boolean'||typeof e['twoHanded']!=='boolean')fail('objeto de inventario');}
  for(const choice of Object.values(object(b['magicChoices'],'elecciones mágicas'))){const c=object(choice,'magia de origen');if(!text(c['classId'])||!abilities.includes(c['ability'])||!strings(c['cantripIds'],10)||!text(c['spellId']))fail('magia de origen');}
  if(b['legacy']!==undefined)stats(b['legacy']);
}
export function validateSheetCollection(value:unknown, kind:'player'|'npc'|'generic'='player', allowAssociations=false):SheetCollection {
  const data=object(value,'colección de fichas');if(data['revision']!==undefined&&!integer(data['revision']))fail('revisión de fichas');const edited=object(data['edited'],'fichas editadas'), created=array(data['created'],'fichas creadas',1000);
  const ids=new Set<string>();
  for(const [key,raw] of [...Object.entries(edited),...created.map((entry):[string,unknown]=>[object(entry,'ficha')['id'],entry])]){
    const sheet=object(raw,'ficha');if(!identifier(key)||key!==sheet['id']||!text(sheet['name'])||!sheet['name'].trim()||ids.has(key))fail('identificador o nombre de ficha');ids.add(key);
    if(JSON.stringify(sheet).length>250000)fail('ficha demasiado grande');
    if(kind==='player'){
      if(!allowAssociations&&Object.hasOwn(sheet,'playerIds'))fail('el archivo no puede restaurar asociaciones de usuarios');
      if(allowAssociations&&sheet['playerIds']!==undefined&&!strings(sheet['playerIds']))fail('asociaciones de usuarios');
      for(const field of ['ancestry','className','subclass','background','hook','feat'])if(!text(sheet[field]))fail('identidad de PJ');
      if(!integer(sheet['level'],0,20)||!image(sheet['tokenUrl'])||!image(sheet['gridTokenUrl']))fail('nivel o imagen de PJ');
      stats(sheet);if(sheet['build']!==undefined)build(sheet['build']);
    }else if(kind==='generic') {stats(sheet,'traits');for(const field of ['category','role','lineage','summary','challenge'])if(!text(sheet[field]))fail('ficha genérica');if(!strings(sheet['tags'])||!strings(sheet['personality']))fail('ficha genérica');}
    else {for(const field of ['summary','role','faction','motivation'])if(!text(sheet[field]))fail('identidad de PNJ');if(!strings(sheet['tags']))fail('etiquetas de PNJ');for(const field of ['personality','knowledge','reactions'])if(sheet[field]!==undefined&&!strings(sheet[field]))fail('detalle de PNJ');if(sheet['statBlock']!==undefined)stats(sheet['statBlock']);}
  }
  return data as unknown as SheetCollection;
}
function point(value:unknown):void {const p=object(value,'punto de mapa');if(!number(p['x'],-100000,100000)||!number(p['y'],-100000,100000))fail('coordenadas');}
function pendingEncounter(value:unknown):void {const p=object(value,'encuentro pendiente');if(!GENERIC_ENCOUNTERS.some((e)=>e.id===p['encounterId']))fail('el encuentro pendiente no existe en el catálogo');for(const key of ['encounterId','runId','region','position'])if(!text(p[key]))fail('encuentro pendiente');if(!integer(p['day'],1)||!integer(p['level'],1,20)||!integer(p['partySize'],1,1000)||!strings(p['memberActorIds']))fail('encuentro pendiente');}
function journey(value:unknown, legacy=false):void {
  const j=object(value,'viaje');for(const p of array(j['route']??[],'ruta'))point(p);
  const plan=object(j['plan']??{},'plan de viaje');
  for(const key of ['hours','mountBoostHours','foodKg','waterLiters','gold','fatigue'])if((!legacy||plan[key]!==undefined)&&!number(plan[key],0,1e9))fail('recursos o tiempos del viaje');
  for(const key of ['originId','destinationId','season','guideId','marchOrder','activities','preparedEncounters','dmSecrets'])if((!legacy||plan[key]!==undefined)&&!text(plan[key]))fail('plan del viaje');
  if((!legacy||plan['pace']!==undefined)&&!['fast','normal','slow'].includes(plan['pace']))fail('ritmo del viaje');
  if((!legacy||plan['danger']!==undefined)&&!['safe','road','wild','hostile','extreme'].includes(plan['danger']))fail('peligro del viaje');
  if((!legacy||plan['difficultTerrain']!==undefined)&&typeof plan['difficultTerrain']!=='boolean')fail('terreno del viaje');
  for(const key of ['hunterIds','watcherIds'])if((!legacy||plan[key]!==undefined)&&!strings(plan[key]))fail('roles del viaje');
  for(const log of array(j['logs']??[],'jornadas')){
    const l=object(log,'jornada');for(const key of ['day','distance','totalDistance'])if(!number(l[key],0))fail('jornada');
    for(const key of ['weather','encounter','resources','position'])if(!text(l[key]))fail('detalle de jornada');if(typeof l['pendingDecision']!=='boolean')fail('decisión de jornada');
    for(const event of array(l['events']??[],'eventos')){const e=object(event,'evento');for(const key of ['id','role','title','polarity','story','actorId','actorName','skill','outcome','effectSummary'])if(!text(e[key]))fail('evento de jornada');for(const key of ['roll','bonus','total','dc'])if(!number(e[key]))fail('tirada de jornada');if(typeof e['success']!=='boolean'||typeof e['encounterTriggered']!=='boolean'||!['guide','hunter','watch'].includes(e['role'])||!['positive','negative'].includes(e['polarity'])||!['survival','perception'].includes(e['skill']))fail('resultado de jornada');
      if(e['effect']!==undefined)for(const [key,v] of Object.entries(object(e['effect'],'efecto de jornada')))if(!['foodKg','foodPerTraveler','waterLiters','waterPerTraveler','gold','fatigue','distancePercent','distanceKm'].includes(key)||!number(v))fail('efecto de jornada');}
  }
  if(j['pendingEncounter']!==undefined)pendingEncounter(j['pendingEncounter']);
}
export function validateTravel(value:unknown):void {
  const s=object(value,'partida de viaje');if(s['version']!==undefined&&s['version']!==2)fail('versión del viaje');
  const groups=array(s['groups']??[],'grupos',1000), ids=new Set<string>();
  for(const group of groups){const g=object(group,'grupo');point(g);if(!identifier(g['id'])||ids.has(g['id'])||!text(g['name'])||!text(g['color'])||!strings(g['memberIds']))fail('grupo de viaje');ids.add(g['id']);}
  if(s['selectedGroupId']!==undefined&&!ids.has(s['selectedGroupId']))fail('grupo seleccionado');
  if(s['zoom']!==undefined&&!number(s['zoom'],0.08,5))fail('escala del mapa');
  if(s['version']===2){for(const [id,j] of Object.entries(object(s['journeys'],'viajes por grupo'))){if(!ids.has(id))fail('viaje de grupo inexistente');journey(j);}if(s['unassignedJourney']!==undefined)journey(s['unassignedJourney']);journey(s);}
  else journey(s,true);
}
export function validateBoard(value:unknown):void {
  const s=object(value,'tablero'), ids=new Set<string>();
  for(const token of array(s['tokens']??[],'tokens',10000)){
    const t=object(token,'token');point(t);if(!text(t['instanceId'])||ids.has(t['instanceId'])||!text(t['actorId'])||!text(t['name'])||!image(t['image'])||!number(t['size'],0.1,100)||!number(t['hp'],0,100000)||!number(t['maxHp'],0,100000)||!number(t['initiative'])||typeof t['hidden']!=='boolean')fail('token');ids.add(t['instanceId']);
    if(t['conditions']!==undefined&&(!strings(t['conditions'])||t['conditions'].some((c:string)=>!['prone','blinded','restrained','poisoned','incapacitated'].includes(c))))fail('estados de token');
    if(t['side']!==undefined&&!['party','enemy','neutral'].includes(t['side']))fail('bando de token');
  }
  for(const rect of array(s['fogRects']??[],'niebla',10000)){const r=object(rect,'niebla');point(r);if(!text(r['id'])||!number(r['width'],0,100000)||!number(r['height'],0,100000))fail('rectángulo de niebla');}
  if(s['layers']!==undefined){const layers=object(s['layers'],'capas');if(['grid','fog','tokens','labels'].some((k)=>typeof layers[k]!=='boolean'))fail('capas del tablero');}
  if(s['zoom']!==undefined&&!number(s['zoom'],0.2,2))fail('escala del tablero');
  if(s['activeTurnId']!==undefined&&!ids.has(s['activeTurnId']))fail('turno activo');
  if(s['vision']!==undefined)assertBoardVision(s['vision'],ids);
  if(s['combat']!==undefined){
    if(!validState(s['combat']))fail('estado de combate');
    const combat=s['combat'];
    object(combat.resources,'reservas de combate');object(combat.armorEffects,'efectos de armadura');
    for(const pool of Object.values(combat.resources))object(pool,'reserva de combate');
    for(const action of [...combat.queue.map((q:any)=>q.action),...(combat.pending?[combat.pending.action]:[])]){if(action.saveAbility!==undefined&&!abilities.includes(action.saveAbility))fail('salvación de combate');}
    if(combat.pending){
      for(const roll of [combat.pending.roll,combat.pending.save].filter(Boolean)){if(!number(roll.bonus)||!number(roll.total)||!integer(roll.natural,1,20)||!array(roll.dice,'dados de combate',100).every((d)=>integer(d,1,20)))fail('tirada de combate');}
      for(const part of combat.pending.damage)if(!text(part.type)||!number(part.bonus)||!array(part.dice,'dados de daño',100).every((d)=>integer(d,1,100)))fail('daño pendiente');
    }
    if(combat.started&&!ids.has(combat.turnId))fail('turno de combate sin token');
    if(combat.pending&&(!ids.has(combat.pending.attackerId)||!ids.has(combat.pending.targetId)))fail('participante de combate pendiente sin token');
    if(combat.queue.some((q:any)=>!ids.has(q.attackerId)||!ids.has(q.targetId)))fail('participante de cola sin token');
  }
}
export const travelStorageKey = (campaignId:string):string => `la-carta-sellada:travel-map:faerun-atlas-v3:campaign:${campaignId}`;
export function localBackupKind(key:string,campaignId:string):'npc'|'generic'|'travel'|'board'|undefined {
  if(key===`la-carta-sellada:editable:${campaignId}:pnjs`)return 'npc';
  if(key===GENERIC_SHEETS_KEY)return 'generic';
  if(key===travelStorageKey(campaignId))return 'travel';
  if(key.startsWith(`la-carta-sellada:vtt:${campaignId}:`)&&key.length<=500&&/^la-carta-sellada:vtt:[a-zA-Z0-9_:-]+$/.test(key))return 'board';
  return undefined;
}
export function parseCampaignBackup(raw:string,campaignId:string):CampaignBackup {
  if(new TextEncoder().encode(raw).byteLength>BACKUP_MAX_BYTES)fail('archivo mayor de 8 MiB');
  let value:unknown;try{value=JSON.parse(raw);}catch{fail('JSON ilegible');}
  tree(value);const b=object(value,'archivo');
  if(b['format']!==BACKUP_FORMAT||b['version']!==BACKUP_VERSION)fail('formato o versión no admitidos');
  if(!identifier(campaignId)||b['campaignId']!==campaignId)fail('la copia pertenece a otra campaña');
  if(!text(b['createdAt'])||!Number.isFinite(Date.parse(b['createdAt'])))fail('fecha de la copia');
  for(const key of Object.keys(b))if(!['format','version','campaignId','createdAt','sheets','local'].includes(key))fail('campo desconocido en la copia');
  validateSheetCollection(b['sheets']);
  if(new TextEncoder().encode(JSON.stringify(b['sheets'])).byteLength>3*1024*1024)fail('colección de fichas demasiado grande');
  for(const [key,data] of Object.entries(object(b['local'],'datos locales'))){const kind=localBackupKind(key,campaignId);if(kind==='npc'||kind==='generic')validateSheetCollection(data,kind);else if(kind==='travel')validateTravel(data);else if(kind==='board')validateBoard(data);else fail('clave fuera de la campaña');}
  return b as unknown as CampaignBackup;
}
export function withoutAssociations(collection:SheetCollection):SheetCollection {
  const strip=(value:{id:string})=>{const entry=structuredClone(value) as Data;delete entry['playerIds'];return entry as {id:string};};
  return {edited:Object.fromEntries(Object.entries(collection.edited).map(([id,s])=>[id,strip(s)])),created:collection.created.map(strip)};
}
