import type { AccessUser } from './access';
import { recoveryKey } from './campaign-backups';
import { parseTravelNetwork } from './travel-network-format';
import { networkStorageKey, type TravelNetwork } from '../models/travel-network';

export { networkStorageKey } from '../models/travel-network';
export interface NetworkSnapshot { raw: string | null; network: TravelNetwork | null; error?: string; }
/** Red local del director, independiente de grupos, jornadas y rutas ya empezadas. */
export class TravelNetworkStore {
  constructor(private readonly storage:Storage,private readonly user:()=>AccessUser|null) {}
  private access(campaign:string):AccessUser {
    const user=this.user();
    if(!/^[a-zA-Z0-9_-]{1,120}$/.test(campaign)||!user||user.role!=='director'||!user.campaigns.includes(campaign))throw new Error('Solo el director puede gestionar redes de sus campañas.');
    return user;
  }
  read(campaign:string):NetworkSnapshot {
    this.access(campaign);const raw=this.storage.getItem(networkStorageKey(campaign));
    if(raw===null)return {raw,network:null};
    try{return {raw,network:parseTravelNetwork(raw)};}catch(error){return {raw,network:null,error:error instanceof Error?error.message:'Red guardada ilegible; se conserva el original.'};}
  }
  async save(campaign:string,raw:string,expected:string|null):Promise<NetworkSnapshot> {
    const user=this.access(campaign),network=parseTravelNetwork(raw);
    if(typeof navigator==='undefined'||!navigator.locks)throw new Error('El navegador no permite bloquear el guardado de forma segura.');
    return navigator.locks.request('la-carta-sellada:backup-import',()=>{
      if(this.access(campaign).id!==user.id)throw new Error('La sesión ha cambiado. Vuelve a abrir la red.');
      if(this.storage.getItem(recoveryKey(campaign)))throw new Error('Resuelve primero la restauración pendiente de esta campaña.');
      const current=this.storage.getItem(networkStorageKey(campaign));
      if(current!==expected)throw new Error('La red ha cambiado en otra pestaña. Conserva tu texto y vuelve a cargarla.');
      const previous:TravelNetwork|null=current!==null?parseTravelNetwork(current):null;
      if(previous?.id===network.id&&network.revision<=previous.revision)throw new Error('Incrementa la revisión de la red para conservar la identidad de sus versiones.');
      this.storage.setItem(networkStorageKey(campaign),JSON.stringify(network));return this.read(campaign);
    });
  }
}
