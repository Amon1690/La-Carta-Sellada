import { GENERIC_NPCS } from '../data/generic-npcs';
import { AccessUser } from './access';
import { SheetCollection } from './remote-sheets';
import { BACKUP_FORMAT, CampaignBackup, GENERIC_SHEETS_KEY, localBackupKind, parseCampaignBackup, validateSheetCollection, withoutAssociations } from './campaign-backup-format';
import { parseTravelNetwork } from './travel-network-format';

export interface BackupSnapshot extends SheetCollection { baseIds: string[]; npcIds: string[]; }
export interface BackupTransport {
  read(campaignId:string):Promise<BackupSnapshot>;
  write(campaignId:string,collection:SheetCollection,revision:number):Promise<SheetCollection>;
}
export interface BackupPreview {
  campaignId:string; sheets:number; localStates:number; boards:number; includesGeneric:boolean;
}
interface Plan { file:CampaignBackup; before:Record<string,string|null>; sheets:SheetCollection; userId:string; }
interface Recovery {
  version:1; operationId:string; campaignId:string; userId:string; phase:'local'|'request'|'committed'|'rollback';
  before:Record<string,string|null>; after:Record<string,string>;
  sheetsBefore:SheetCollection; sheetsAfter:SheetCollection;
}
const canonical = (value:unknown):string => {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')}}`;
  return JSON.stringify(value)??'null';
};
const content = (s:SheetCollection):string => canonical({edited:s.edited,created:s.created});
export const recoveryKey=(id:string):string=>`la-carta-sellada:backup-recovery:${id}`;

/** A restore never writes server data until every local write has succeeded.
 * A durable journal covers interruption and ambiguous network responses. */
export class CampaignBackups {
  private readonly plans=new WeakMap<BackupPreview,Plan>();
  private readonly downloadedRecovery=new Map<string,string>();
  constructor(private readonly storage:Storage,private readonly transport:BackupTransport,private readonly user:()=>AccessUser|null){}
  private access(campaignId:string,expected?:string):AccessUser {
    const user=this.user();
    if(!/^[a-zA-Z0-9_-]{1,120}$/.test(campaignId)||!user||user.role!=='director'||!user.campaigns.includes(campaignId)||expected&&user.id!==expected)throw new Error('Solo el director puede gestionar copias de sus campañas.');
    return user;
  }
  private readLocal(campaignId:string,includeGeneric:boolean):Record<string,string> {
    const result:Record<string,string>={};
    for(let i=0;i<this.storage.length;i++){
      const key=this.storage.key(i);if(!key||!localBackupKind(key,campaignId)||key===GENERIC_SHEETS_KEY&&!includeGeneric)continue;
      const raw=this.storage.getItem(key);if(raw!==null)result[key]=raw;
    }
    return result;
  }
  private classification(file:CampaignBackup,snapshot:BackupSnapshot):void {
    const validate=(collection:SheetCollection,baseIds:string[])=>{if(Object.keys(collection.edited).some((id)=>!baseIds.includes(id))||collection.created.some((s)=>baseIds.includes(s.id)||!s.id.startsWith('custom-')))throw new Error('La copia contiene fichas fuera del catálogo o clasificadas como creación/edición de forma incompatible. No se han cambiado datos.');};
    validate(file.sheets,snapshot.baseIds);
    for(const [key,data] of Object.entries(file.local)){const kind=localBackupKind(key,file.campaignId);if(kind==='npc')validate(data as SheetCollection,snapshot.npcIds);if(kind==='generic')validate(data as SheetCollection,GENERIC_NPCS.map((n)=>n.id));}
  }
  async export(campaignId:string,includeGeneric=false):Promise<string> {
    const work=()=>this.exportSnapshot(campaignId,includeGeneric);
    return typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('la-carta-sellada:backup-import',work):work();
  }
  private async exportSnapshot(campaignId:string,includeGeneric:boolean):Promise<string> {
    const user=this.access(campaignId);if(this.storage.getItem(recoveryKey(campaignId)))throw new Error('Comprueba primero la restauración pendiente.');const before=this.readLocal(campaignId,includeGeneric),sheets=await this.transport.read(campaignId);this.access(campaignId,user.id);
    if(canonical(before)!==canonical(this.readLocal(campaignId,includeGeneric)))throw new Error('La partida cambió mientras se preparaba la copia. Vuelve a exportarla.');
    validateSheetCollection(sheets,'player',true);
    const local=Object.fromEntries(Object.entries(before).map(([key,raw])=>{
      try{return [key,JSON.parse(raw)];}catch{throw new Error('Hay un guardado local ilegible. Se conserva; recupéralo antes de exportar.');}
    }));
    const raw=JSON.stringify({format:BACKUP_FORMAT,version:1,campaignId,createdAt:new Date().toISOString(),sheets:withoutAssociations(sheets),local} satisfies CampaignBackup,null,2);
    const file=parseCampaignBackup(raw,campaignId);this.classification(file,sheets);return raw;
  }
  async preview(raw:string,campaignId:string,restoreGeneric=false):Promise<BackupPreview> {
    const user=this.access(campaignId),file=parseCampaignBackup(raw,campaignId);
    if(this.storage.getItem(recoveryKey(campaignId)))throw new Error('Existe una restauración pendiente de comprobar. Resuélvela antes de importar otra copia.');
    const sheets=await this.transport.read(campaignId);this.access(campaignId,user.id);validateSheetCollection(sheets,'player',true);
    this.classification(file,sheets);
    const before:Record<string,string|null>={};
    for(const key of Object.keys(file.local))if(key!==GENERIC_SHEETS_KEY||restoreGeneric){
      const previous=this.storage.getItem(key);
      // Tampoco la restauración puede borrar un original ilegible o de una versión futura.
      if(localBackupKind(key,campaignId)==='network'&&previous!==null)parseTravelNetwork(previous);
      before[key]=previous;
    }
    const preview:BackupPreview={campaignId,sheets:Object.keys(file.sheets.edited).length+file.sheets.created.length,localStates:Object.keys(before).length,boards:Object.keys(before).filter((k)=>localBackupKind(k,campaignId)==='board').length,includesGeneric:Object.hasOwn(before,GENERIC_SHEETS_KEY)};
    this.plans.set(preview,{file,before,sheets,userId:user.id});return preview;
  }
  async restore(preview:BackupPreview):Promise<void> {
    if(typeof navigator==='undefined'||!navigator.locks)throw new Error('Este navegador no permite bloquear una restauración de forma segura. Utiliza una versión actual de Chrome o Edge.');
    return navigator.locks.request('la-carta-sellada:backup-import',()=>this.restoreLocked(preview));
  }
  private async restoreLocked(preview:BackupPreview):Promise<void> {
    const plan=this.plans.get(preview);if(!plan)throw new Error('Vuelve a revisar el archivo antes de restaurarlo.');
    const id=plan.file.campaignId;this.access(id,plan.userId);
    if(this.storage.getItem(recoveryKey(id)))throw new Error('Hay otra restauración pendiente de comprobar.');
    const latest=await this.transport.read(id);this.access(id,plan.userId);
    if(latest.revision!==plan.sheets.revision||content(latest)!==content(plan.sheets))throw new Error('Las fichas han cambiado desde la vista previa. Vuelve a revisar el archivo.');
    for(const [key,old] of Object.entries(plan.before))if(this.storage.getItem(key)!==old)throw new Error('La partida local ha cambiado desde la vista previa. Vuelve a revisar el archivo.');
    const oldById=new Map([...Object.values(latest.edited),...latest.created].map((s)=>[s.id,s as {id:string;playerIds?:string[]}]));
    const linked=(s:{id:string}):{id:string;playerIds:string[]}=>({...structuredClone(s),playerIds:[...(oldById.get(s.id)?.playerIds??[])]});
    const sheetsAfter:SheetCollection={edited:Object.fromEntries(Object.entries(plan.file.sheets.edited).map(([key,s])=>[key,linked(s)])),created:plan.file.sheets.created.map(linked)};
    const after=Object.fromEntries(Object.keys(plan.before).map((key)=>[key,JSON.stringify(plan.file.local[key])]));
    const journal:Recovery={version:1,operationId:crypto.randomUUID(),campaignId:id,userId:plan.userId,phase:'local',before:plan.before,after,sheetsBefore:latest,sheetsAfter};
    // If there is no room for the recovery copy, no game data has been changed.
    this.storage.setItem(recoveryKey(id),JSON.stringify(journal));this.plans.delete(preview);
    try {
      for(const [key,value] of Object.entries(after)){if(this.storage.getItem(key)!==plan.before[key])throw new Error('Otro tablero ha cambiado durante la restauración.');this.storage.setItem(key,value);}
      journal.phase='request';this.storage.setItem(recoveryKey(id),JSON.stringify(journal));
    }catch(error){this.rollbackLocal(journal);throw new Error('No se pudo guardar la copia local. Las fichas del servidor no se han modificado. '+(error instanceof Error?error.message:''));}
    try {
      this.access(id,plan.userId);
      await this.transport.write(id,sheetsAfter,latest.revision??0);
      journal.phase='committed';
      for(const [key,value] of Object.entries(after))if(this.storage.getItem(key)!==value)throw new Error('La partida local cambió mientras se guardaban las fichas.');
      this.storage.removeItem(recoveryKey(id));
    }catch(error){
      const status=(error as {status?:number})?.status;
      if(journal.phase==='request'&&status&&status>=400&&status<500){this.rollbackLocal(journal);throw error;}
      // A lost response may follow a committed PUT. Never repeat it blindly.
      throw new Error('No se puede confirmar si la restauración terminó. Se conserva la copia anterior. Pulsa «Comprobar restauración pendiente» antes de repetir la operación.');
    }
  }
  private rollbackLocal(journal:Recovery,allowRemoved=false):void {
    try {
      for(const [key,after] of Object.entries(journal.after)){
        const current=this.storage.getItem(key),before=journal.before[key];
        if(current!==before&&current!==after&&!(journal.phase==='rollback'&&allowRemoved&&current===null))throw new Error('Otro tablero ha cambiado; no se sobrescribirá.');
      }
      journal.phase='rollback';this.storage.setItem(recoveryKey(journal.campaignId),JSON.stringify(journal));
      // Free imported values first, so restoring a previous value does not need extra quota.
      for(const key of Object.keys(journal.after))if(this.storage.getItem(key)!==journal.before[key])this.storage.removeItem(key);
      for(const [key,before] of Object.entries(journal.before))if(before!==null)this.storage.setItem(key,before);
      this.storage.removeItem(recoveryKey(journal.campaignId));this.downloadedRecovery.delete(journal.campaignId);
    }catch{throw new Error('No se pudo completar la reversión local. Se conserva la copia anterior para recuperarla; no importes otra partida todavía.');}
  }
  hasRecovery(campaignId:string):boolean {this.access(campaignId);return this.storage.getItem(recoveryKey(campaignId))!==null;}
  private recovery(campaignId:string):Recovery {
    this.access(campaignId);const raw=this.storage.getItem(recoveryKey(campaignId));if(!raw)throw new Error('No hay una restauración pendiente.');
    const r=JSON.parse(raw) as Recovery;
    if(r.version!==1||typeof r.operationId!=='string'||!r.operationId||r.campaignId!==campaignId||!['local','request','committed','rollback'].includes(r.phase)||!r.before||!r.after||typeof r.before!=='object'||typeof r.after!=='object'||Array.isArray(r.before)||Array.isArray(r.after))throw new Error('La copia de recuperación no es legible. Conserva el almacenamiento del navegador.');
    for(const [key,value] of Object.entries(r.before))if(!localBackupKind(key,campaignId)||value!==null&&typeof value!=='string')throw new Error('Copia de recuperación no válida.');
    if(Object.keys(r.before).length!==Object.keys(r.after).length)throw new Error('Copia de recuperación no válida.');
    for(const [key,value] of Object.entries(r.after))if(!Object.hasOwn(r.before,key)||typeof value!=='string')throw new Error('Copia de recuperación no válida.');
    validateSheetCollection(r.sheetsBefore,'player',true);validateSheetCollection(r.sheetsAfter,'player',true);return r;
  }
  previousCopy(campaignId:string):{raw:string;canImport:boolean} {
    const r=this.recovery(campaignId);this.downloadedRecovery.set(campaignId,r.operationId);
    try {
      const local=Object.fromEntries(Object.entries(r.before).filter(([,v])=>v!==null).map(([k,v])=>[k,JSON.parse(v!)]));
      const raw=JSON.stringify({format:BACKUP_FORMAT,version:1,campaignId,createdAt:new Date().toISOString(),sheets:withoutAssociations(r.sheetsBefore),local} satisfies CampaignBackup,null,2);
      parseCampaignBackup(raw,campaignId);return {raw,canImport:true};
    }catch{
      return {raw:JSON.stringify({format:'la-carta-sellada:recovery-raw',version:1,campaignId,sheets:withoutAssociations(r.sheetsBefore),localRaw:r.before},null,2),canImport:false};
    }
  }
  async keepCurrent(campaignId:string,confirmed:boolean):Promise<void> {
    if(typeof navigator==='undefined'||!navigator.locks)throw new Error('Se necesita un navegador con bloqueo seguro.');
    return navigator.locks.request('la-carta-sellada:backup-import',async()=>{
      const r=this.recovery(campaignId);
      if(!confirmed||this.downloadedRecovery.get(campaignId)!==r.operationId)throw new Error('Descarga la copia anterior de esta incidencia y confirma que deseas conservar la partida actual.');
      this.storage.removeItem(recoveryKey(campaignId));this.downloadedRecovery.delete(campaignId);
    });
  }
  needsRemovedRecovery(campaignId:string):boolean {const r=this.recovery(campaignId);return r.phase==='rollback'&&Object.entries(r.before).some(([key,value])=>value!==null&&this.storage.getItem(key)===null);}
  async reconcile(campaignId:string,allowRemoved=false):Promise<'restored'|'reverted'> {
    if(typeof navigator==='undefined'||!navigator.locks)throw new Error('Se necesita un navegador con bloqueo seguro.');
    return navigator.locks.request('la-carta-sellada:backup-import',async()=>{
      const r=this.recovery(campaignId),user=this.access(campaignId),current=await this.transport.read(campaignId);this.access(campaignId,user.id);
      if(current.revision===r.sheetsBefore.revision&&content(current)===content(r.sheetsBefore)){this.rollbackLocal(r,allowRemoved);return 'reverted';}
      if(current.revision===(r.sheetsBefore.revision??0)+1&&content(current)===content(r.sheetsAfter)){
        if(Object.entries(r.after).some(([key,value])=>this.storage.getItem(key)!==value))throw new Error('Las partidas locales han cambiado. Descarga la copia anterior y revisa qué partida deseas conservar.');
        this.storage.removeItem(recoveryKey(campaignId));this.downloadedRecovery.delete(campaignId);return 'restored';
      }
      throw new Error('Otra persona ha modificado las fichas. Descarga la copia anterior para conservarla; no se sobrescribirán sus cambios.');
    });
  }
}
