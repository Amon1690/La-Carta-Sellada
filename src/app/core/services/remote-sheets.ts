import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
export interface SheetCollection { edited: Record<string, { id: string }>; created: { id: string }[]; revision?: number; }
export interface RemoteSheetStore { error?: () => string; hydrate(campaignId: string, collection: SheetCollection): void; read(campaignId: string): SheetCollection; save(campaignId: string, collection: SheetCollection): Promise<void>; }
export const REMOTE_SHEETS = new InjectionToken<RemoteSheetStore | undefined>('Remote sheets', { providedIn: 'root', factory: () => undefined });
@Injectable({ providedIn: 'root' })
export class RemoteSheetsService implements RemoteSheetStore {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, SheetCollection>();
  readonly error = signal('');
  hydrate(id: string, data: SheetCollection): void { this.cache.set(id, structuredClone(data)); }
  read(id: string): SheetCollection { return structuredClone(this.cache.get(id) ?? { edited: {}, created: [], revision: 0 }); }
  async save(id: string, collection: SheetCollection): Promise<void> {
    try {
      const saved = await firstValueFrom(this.http.put<SheetCollection>(`/api/campaigns/${encodeURIComponent(id)}/sheets`, { ...collection, revision: this.read(id).revision }));
      this.hydrate(id, saved); this.error.set('');
    } catch (error) { this.error.set('No se pudo guardar la ficha en el servidor. Conserva el editor abierto; recarga si otro director la ha cambiado.'); throw error; }
  }
}
