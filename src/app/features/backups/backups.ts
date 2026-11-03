import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ACCESS_CONTEXT, accessError } from '../../core/services/access';
import { CHARACTER_SHEET_STORAGE } from '../../core/services/character-sheets';
import { BackupPreview, CampaignBackups, recoveryKey } from '../../core/services/campaign-backups';
import { BACKUP_MAX_BYTES } from '../../core/services/campaign-backup-format';
import { REMOTE_SHEETS, SheetCollection } from '../../core/services/remote-sheets';
import { CampaignDataService } from '../../core/services/campaign-data';

@Component({selector:'app-backups',imports:[FormsModule],templateUrl:'./backups.html',styleUrl:'./backups.scss'})
export class Backups {
  private readonly http=inject(HttpClient);
  private readonly access=inject(ACCESS_CONTEXT);
  private readonly storage=inject(CHARACTER_SHEET_STORAGE);
  private readonly remote=inject(REMOTE_SHEETS);
  private readonly campaigns=inject(CampaignDataService);
  protected readonly campaignId=inject(ActivatedRoute).snapshot.paramMap.get('campaignId')??'';
  protected readonly busy=signal(false);
  protected readonly error=signal('');
  protected readonly message=signal('');
  protected readonly preview=signal<BackupPreview|undefined>(undefined);
  protected readonly recovery=signal(false);
  protected readonly removedRecovery=signal(false);
  protected confirmRecovery=false;
  protected confirmKeepCurrent=false;
  protected readonly previousDownloaded=signal(false);
  private recoveryIdentity='';
  protected includeGeneric=false;
  protected confirmed=false;
  private raw='';
  private readonly store=this.storage?new CampaignBackups(this.storage,{
    read:async(id)=> {const data=await firstValueFrom(this.http.get<{sheetOverrides:SheetCollection;playerCharacters:{id:string}[];playerOptions:{id:string}[];npcs:{id:string}[]}>(`/api/campaigns/${encodeURIComponent(id)}`));return {...data.sheetOverrides,baseIds:[...data.playerCharacters,...data.playerOptions].map((s)=>s.id),npcIds:data.npcs.map((s)=>s.id)};},
    write:async(id,collection,revision)=>{const saved=await firstValueFrom(this.http.put<SheetCollection>(`/api/campaigns/${encodeURIComponent(id)}/sheets`,{...collection,revision}));this.remote?.hydrate(id,saved);this.campaigns.invalidate(id);return saved;},
  },()=>this.access?.user()??null):undefined;
  constructor(){this.checkRecovery();}
  private checkRecovery():void {try{const raw=this.storage?.getItem(recoveryKey(this.campaignId))??'';if(raw!==this.recoveryIdentity){this.confirmRecovery=false;this.confirmKeepCurrent=false;this.previousDownloaded.set(false);this.recoveryIdentity=raw;}this.recovery.set(this.store?.hasRecovery(this.campaignId)??false);this.removedRecovery.set(this.recovery()&&(this.store?.needsRemovedRecovery(this.campaignId)??false));}catch(e){this.error.set(accessError(e));}}
  protected changedOptions():void {this.preview.set(undefined);this.confirmed=false;}
  protected async exportCopy():Promise<void>{await this.run(async()=>{this.download(await this.required().export(this.campaignId,this.includeGeneric),'copia');this.message.set('Copia descargada. Incluye las fichas compartidas y los guardados de esta campaña en este navegador.');});}
  protected async selectFile(event:Event):Promise<void>{const file=(event.target as HTMLInputElement).files?.[0];this.raw='';this.changedOptions();if(!file)return;await this.run(async()=>{if(file.size>BACKUP_MAX_BYTES)throw new Error('El archivo supera el límite de 8 MiB.');this.raw=await file.text();this.preview.set(await this.required().preview(this.raw,this.campaignId,this.includeGeneric));});}
  protected async reviewFile():Promise<void>{await this.run(async()=>{if(!this.raw)throw new Error('Selecciona primero un archivo de copia.');this.confirmed=false;this.preview.set(await this.required().preview(this.raw,this.campaignId,this.includeGeneric));});}
  protected async restore():Promise<void>{const preview=this.preview();if(!preview||!this.confirmed)return;await this.run(async()=>{await this.required().restore(preview);this.preview.set(undefined);this.raw='';this.confirmed=false;this.campaigns.invalidate(this.campaignId);this.message.set('Copia restaurada. Vuelve a abrir la campaña para cargar la partida recuperada.');});}
  protected async reconcile():Promise<void>{await this.run(async()=>{const result=await this.required().reconcile(this.campaignId,this.confirmRecovery);this.campaigns.invalidate(this.campaignId);this.message.set(result==='restored'?'Restauración confirmada. Vuelve a abrir la campaña.':'La restauración no llegó al servidor y se ha recuperado la partida local anterior.');});}
  protected async previousCopy():Promise<void>{await this.run(async()=>{const copy=this.required().previousCopy(this.campaignId);this.download(copy.raw,'antes-de-restaurar');this.previousDownloaded.set(true);if(!copy.canImport)this.message.set('La copia anterior contenía un guardado ilegible. Se ha descargado su contenido original para recuperarlo; ese archivo necesita reparación antes de importarlo.');});}
  protected async keepCurrent():Promise<void>{await this.run(async()=>{await this.required().keepCurrent(this.campaignId,this.confirmKeepCurrent);this.campaigns.invalidate(this.campaignId);this.message.set('Se conserva la partida actual. La copia anterior queda en el archivo que has descargado.');});}
  private required():CampaignBackups {if(!this.store)throw new Error('El navegador no permite acceder al almacenamiento local.');return this.store;}
  private async run(work:()=>Promise<void>):Promise<void>{if(this.busy())return;this.busy.set(true);this.error.set('');this.message.set('');try{await work();}catch(e){this.error.set(accessError(e));}finally{this.busy.set(false);this.checkRecovery();}}
  private download(raw:string,suffix:string):void {const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`la-carta-sellada-${this.campaignId}-${suffix}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
