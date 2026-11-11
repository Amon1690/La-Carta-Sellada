import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardVisionState, VisionProfile } from '../models/vision';
import { PreviewFog, PreviewToken, previewSight, previewTokenVisible } from './vision-preview';
import { isVisionDoor } from './vision-geometry';
import { REMOTE_SHEETS, SheetCollection } from './remote-sheets';
import { CommandReceipt, DirectorEncounter, LiveBoardState, PlayerControls } from '../models/encounter-live';

export interface SharedCharacter { instanceId: string; name: string; }
export interface SharedEncounter { id: string; title: string; updatedAt: string; characters: SharedCharacter[]; }
export interface EncounterView extends SharedEncounter {
  combatLog?: { id: string; text: string }[];
  observerId: string; image: string; pending: boolean; revision?: number; unchanged?: boolean;
  controls?: PlayerControls; weather?: BoardVisionState['environment']['weather']; directorOnline?: boolean; actionPending?: boolean; receipt?: CommandReceipt;
}
export interface SharingToken extends PreviewToken { actorId: string; image: string; name: string; }
export interface SharingSnapshot {
  sheetRevision: number;
  revision?: number; state?: LiveBoardState; controls?: Record<string, PlayerControls>; ack?: CommandReceipt;
  title: string; mapUrl: string; tokens: SharingToken[]; fog: PreviewFog[]; vision: BoardVisionState;
  profiles: Map<string, VisionProfile | undefined>; actors: string[];
}
export const ENCOUNTER_PUBLISHER = new InjectionToken<EncounterSharingService | undefined>('Encounter publisher', {
  providedIn: 'root', factory: () => undefined,
});

/** El mapa y las fichas ocultas se descartan antes de enviar la imagen al servidor. */
export async function renderPersonalView(snapshot: SharingSnapshot, observerId: string,
  load: (url: string) => Promise<CanvasImageSource> = loadImage
): Promise<{ image: string; pending: boolean }> {
  const width = 1536, height = 1024, grid = 51.2;
  const vision = { ...snapshot.vision, groups: [{ id: 'personal', name: 'Personal', observerIds: [observerId] }], activeGroupId: 'personal' };
  const geometry = snapshot.tokens.find((token) => token.instanceId === observerId)?.hidden
    ? { circles: [], pending: true } : previewSight(vision, snapshot.tokens, snapshot.profiles, grid, width, height);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se puede componer la vista del personaje.');
  ctx.fillStyle = '#090c10'; ctx.fillRect(0, 0, width, height);
  if (geometry.circles.length) {
    const map = await load(snapshot.mapUrl);
    for (const circle of geometry.circles) {
      ctx.save(); ctx.beginPath(); ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI); ctx.clip();
      if (circle.clip) { ctx.beginPath(); ctx.arc(circle.clip.x, circle.clip.y, circle.clip.radius, 0, 2 * Math.PI); ctx.clip(); }
      for (const excluded of circle.exclude ?? []) {
        ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.arc(excluded.x, excluded.y, excluded.radius, 0, 2 * Math.PI); ctx.clip('evenodd');
      }
      for (const polygon of circle.shadows ?? []) {
        ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.moveTo(polygon[0].x, polygon[0].y);
        for (const point of polygon.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath(); ctx.clip('evenodd');
      }
      ctx.drawImage(map, 0, 0, width, height);
      // Solo puertas y solo dentro del mismo recorte personal del mapa. Nunca
      // enviar coordenadas ni dibujar paredes/ventanas en la imagen del jugador.
      ctx.strokeStyle = '#e9bd66'; ctx.lineWidth = 6;
      for (const door of (snapshot.vision.obstacles ?? []).filter(isVisionDoor)) {
        ctx.setLineDash(door.open ? [12, 8] : []);
        ctx.beginPath(); ctx.moveTo(door.start.x, door.start.y); ctx.lineTo(door.end.x, door.end.y); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#090c10';
    for (const fog of snapshot.fog) ctx.fillRect(fog.x, fog.y, fog.width, fog.height);
    for (const token of snapshot.tokens.filter((item) => previewTokenVisible(item, geometry.circles, snapshot.fog, grid))) {
      const size = token.size * grid;
      ctx.save(); ctx.beginPath(); ctx.arc(token.x + size / 2, token.y + size / 2, size / 2, 0, 2 * Math.PI); ctx.clip();
      ctx.fillStyle = '#b68a3b'; ctx.fillRect(token.x, token.y, size, size);
      try { ctx.drawImage(await load(token.image), token.x, token.y, size, size); } catch { /* Silueta sin recursos privados. */ }
      ctx.restore(); ctx.font = '14px sans-serif';
      const labelWidth = Math.min(ctx.measureText(token.name).width + 12, 220);
      ctx.fillStyle = '#090c10'; ctx.fillRect(token.x, token.y + size, labelWidth, 21);
      ctx.fillStyle = '#f4f0e7'; ctx.fillText(token.name, token.x + 6, token.y + size + 15, labelWidth - 12);
    }
  }
  return { image: canvas.toDataURL('image/png'), pending: geometry.pending };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const parsed = new URL(url, document.baseURI);
  if (parsed.origin !== location.origin && !url.startsWith('data:image/')) throw new Error('Recurso de imagen no disponible.');
  const image = new Image(); image.src = url; await image.decode(); return image;
}

@Injectable({ providedIn: 'root' })
export class EncounterSharingService {
  private readonly http = inject(HttpClient);
  private readonly sheets = inject(REMOTE_SHEETS);
  url(campaign: string, board?: string): string { return `/api/campaigns/${encodeURIComponent(campaign)}/encounters${board ? '/' + encodeURIComponent(board) : ''}`; }
  status(campaign: string, board: string, revision?: number): Promise<DirectorEncounter> {
    return firstValueFrom(this.http.get<DirectorEncounter>(this.url(campaign, board) + (revision === undefined ? '' : `?after=${revision}`)));
  }
  unshare(campaign: string, board: string, revision?: number): Promise<unknown> { return firstValueFrom(this.http.delete(this.url(campaign, board) + (revision === undefined ? '' : `?revision=${revision}`))); }
  sheetRevision(campaign: string): number { return this.sheets?.read(campaign).revision ?? 0; }
  async refreshSheets(campaign: string): Promise<void> {
    const response = await firstValueFrom(this.http.get<{ sheetOverrides: SheetCollection }>(`/api/campaigns/${encodeURIComponent(campaign)}`));
    if (response.sheetOverrides) this.sheets?.hydrate(campaign, response.sheetOverrides);
  }
  async publish(campaign: string, board: string, snapshot: SharingSnapshot, current: () => boolean): Promise<{ revision: number } | undefined> {
    const views = [];
    for (const token of snapshot.tokens.filter((item) => item.actorId.startsWith('player:') && snapshot.actors.includes(item.actorId.slice(7)))) {
      views.push({ instanceId: token.instanceId, actorId: token.actorId.slice(7), ...await renderPersonalView(snapshot, token.instanceId),
        ...(snapshot.state ? { controls: snapshot.controls?.[token.instanceId] ?? { position: { x: token.x, y: token.y, size: token.size }, canMove: false, canAttack: false, cells: [], targets: [], attacks: [] } } : {}) });
    }
    if (current()) return firstValueFrom(this.http.put<{ revision: number }>(this.url(campaign, board), {
      title: snapshot.title, sheetRevision: snapshot.sheetRevision, views,
      ...(snapshot.state ? { revision: snapshot.revision ?? 0, state: snapshot.state, weather: snapshot.vision.environment.weather, ack: snapshot.ack } : {}),
    }));
    return undefined;
  }
}
