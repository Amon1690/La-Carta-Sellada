import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ACCESS_CONTEXT } from '../../../../core/services/access';
import { emptyTravelNetwork, RoutePoint, TravelNetwork } from '../../../../core/models/travel-network';
import { NETWORK_MAX_BYTES, networkCoversPoint, parseTravelNetwork } from '../../../../core/services/travel-network-format';
import { NetworkSnapshot, TravelNetworkStore } from '../../../../core/services/travel-network-store';

@Component({selector:'app-route-network-editor',imports:[FormsModule],templateUrl:'./route-network-editor.html',styleUrl:'./route-network-editor.scss'})
export class RouteNetworkEditor implements OnChanges, OnDestroy {
  @Input({required:true}) campaignId='';
  @Input() point?:RoutePoint;
  @Output() networkChange=new EventEmitter<TravelNetwork|null>();
  private readonly access=inject(ACCESS_CONTEXT);
  private original:string|null=null;
  private operation=0;
  protected readonly draft=signal('');
  protected readonly saved=signal<TravelNetwork|null>(null);
  protected readonly preview=signal<TravelNetwork|null>(null);
  protected readonly error=signal('');
  protected readonly loadError=signal(false);
  protected readonly busy=signal(false);
  protected readonly message=signal('');
  protected readonly display=computed(()=>this.preview()??this.saved());
  protected readonly maxBytes=NETWORK_MAX_BYTES;
  private store():TravelNetworkStore { return new TravelNetworkStore(localStorage,()=>this.access?.user()??null); }
  ngOnChanges(changes:SimpleChanges):void { if(changes['campaignId'])this.reload(); }
  ngOnDestroy():void { this.operation++; }
  private apply(snapshot:NetworkSnapshot):void {
    this.original=snapshot.raw;this.saved.set(snapshot.network);this.preview.set(null);
    this.loadError.set(!!snapshot.error);this.error.set(snapshot.error??'');
    this.draft.set(snapshot.error?snapshot.raw??'':JSON.stringify(snapshot.network?{...snapshot.network,revision:snapshot.network.revision+1}:emptyTravelNetwork(),null,2));
    this.networkChange.emit(snapshot.network);
  }
  protected reload():void {
    this.operation++;this.busy.set(false);this.message.set('');
    try{this.apply(this.store().read(this.campaignId));}catch(error){this.saved.set(null);this.preview.set(null);this.loadError.set(true);this.original=null;this.draft.set('');this.networkChange.emit(null);this.fail(error);}
  }
  protected edit(value:string):void {this.draft.set(value);this.preview.set(null);this.error.set('');this.message.set('');}
  protected validate():void {try{this.preview.set(parseTravelNetwork(this.draft()));this.error.set('');}catch(error){this.preview.set(null);this.fail(error);}}
  protected covered():boolean {const n=this.display();return !!n&&!!this.point&&networkCoversPoint(n,this.point);}
  protected async importFile(event:Event):Promise<void> {
    const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
    const operation=++this.operation;this.busy.set(true);
    try{if(file.size>NETWORK_MAX_BYTES)throw new Error('El archivo supera 1 MiB.');const raw=await file.text();if(operation!==this.operation)return;this.edit(raw);this.validate();}
    catch(error){if(operation===this.operation)this.fail(error);}finally{if(operation===this.operation)this.busy.set(false);}
  }
  protected async save():Promise<void> {
    if(this.busy()||this.loadError()||!this.preview())return;
    const operation=++this.operation,campaign=this.campaignId;this.busy.set(true);
    try{const snapshot=await this.store().save(campaign,this.draft(),this.original);if(operation!==this.operation)return;this.apply(snapshot);this.message.set('Red guardada en este navegador para esta campaña. Las jornadas existentes se conservan.');}
    catch(error){if(operation===this.operation)this.fail(error);}finally{if(operation===this.operation)this.busy.set(false);}
  }
  protected download(original=false):void {
    try{const raw=original?this.original:JSON.stringify(parseTravelNetwork(this.draft()),null,2);if(raw===null)return;
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${this.campaignId}-red${original?'-original':''}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
    }catch(error){this.fail(error);}
  }
  private fail(error:unknown):void {this.error.set(error instanceof Error?error.message:'No se pudo completar la operación. Se conserva la red anterior.');}
}
