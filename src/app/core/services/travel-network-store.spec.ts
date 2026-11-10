import { TravelNetworkStore, networkStorageKey } from './travel-network-store';
import { recoveryKey } from './campaign-backups';
import { syntheticNetwork } from './travel-network.fixture';
import type { AccessUser } from './access';
class StorageFixture implements Storage {
  values=new Map<string,string>();writes=0;fail=false;
  get length(){return this.values.size;}key(i:number){return [...this.values.keys()][i]??null;}
  getItem(k:string){return this.values.get(k)??null;}clear(){this.values.clear();}removeItem(k:string){this.values.delete(k);}
  setItem(k:string,v:string){if(this.fail)throw new Error('QuotaExceededError');this.writes++;this.values.set(k,v);}
}
describe('Guardado de redes por campaña',()=>{
  let storage:StorageFixture,user:AccessUser,store:TravelNetworkStore;
  beforeEach(()=>{storage=new StorageFixture();user={id:'dm',username:'Prueba',role:'director',campaigns:['one','two']};store=new TravelNetworkStore(storage,()=>user);});
  it('guarda y recarga solo la red de la campaña elegida sin tocar jornadas',async()=>{
    storage.setItem('viaje-existente','intacto');const raw=JSON.stringify(syntheticNetwork());await store.save('one',raw,null);
    expect(new TravelNetworkStore(storage,()=>user).read('one').network).toEqual(syntheticNetwork());expect(store.read('two').network).toBeNull();expect(storage.getItem('viaje-existente')).toBe('intacto');
  });
  it('rechaza importaciones inválidas y conserva un original ilegible o futuro',async()=>{
    const key=networkStorageKey('one');for(const raw of ['{',JSON.stringify({...syntheticNetwork(),version:2})]){
      storage.setItem(key,raw);const before=storage.writes;expect(store.read('one').error).toBeTruthy();
      await expectAsync(store.save('one',JSON.stringify(syntheticNetwork()),raw)).toBeRejected();expect(storage.getItem(key)).toBe(raw);expect(storage.writes).toBe(before);
    }
  });
  it('no pisa cambios de otra pestaña ni reutiliza la revisión anterior',async()=>{
    const first=JSON.stringify(syntheticNetwork());await store.save('one',first,null);const before=store.read('one').raw;
    const next={...syntheticNetwork(),revision:2};await store.save('one',JSON.stringify(next),before);
    await expectAsync(store.save('one',JSON.stringify({...next,revision:3}),before)).toBeRejected();
    await expectAsync(store.save('one',JSON.stringify(next),store.read('one').raw)).toBeRejected();expect(store.read('one').network!.revision).toBe(2);
  });
  it('bloquea jugadores, campañas ajenas y restauraciones pendientes sin escribir',async()=>{
    user.role='jugador';expect(()=>store.read('one')).toThrow();await expectAsync(store.save('one',JSON.stringify(syntheticNetwork()),null)).toBeRejected();
    user.role='director';await expectAsync(store.save('other',JSON.stringify(syntheticNetwork()),null)).toBeRejected();
    storage.setItem(recoveryKey('one'),'pendiente');const before=storage.writes;await expectAsync(store.save('one',JSON.stringify(syntheticNetwork()),null)).toBeRejected();expect(storage.writes).toBe(before);
  });
  it('un fallo de almacenamiento conserva la red anterior',async()=>{
    await store.save('one',JSON.stringify(syntheticNetwork()),null);const before=store.read('one').raw;storage.fail=true;
    await expectAsync(store.save('one',JSON.stringify({...syntheticNetwork(),revision:2}),before)).toBeRejected();expect(store.read('one').raw).toBe(before);
  });
});
