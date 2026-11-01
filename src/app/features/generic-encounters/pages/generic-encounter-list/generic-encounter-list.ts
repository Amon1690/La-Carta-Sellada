import { Component, signal } from '@angular/core';

import {
  GENERIC_ENCOUNTERS,
  GenericEncounter,
  encounterTier,
  scaledEncounterMonsters,
} from '../../../../core/data/generic-encounters';
import { GENERIC_NPCS } from '../../../../core/data/generic-npcs';

@Component({
  selector: 'app-generic-encounter-list',
  templateUrl: './generic-encounter-list.html',
  styleUrl: './generic-encounter-list.scss',
})
export class GenericEncounterList {
  protected readonly encounters = GENERIC_ENCOUNTERS;
  protected readonly level = signal(5);
  protected readonly partySize = signal(4);

  private readonly monsterNames = new Map(
    GENERIC_NPCS.map((npc) => [npc.id, npc.name])
  );

  protected updateLevel(value: string): void {
    this.level.set(this.clamp(Number(value), 1, 20));
  }

  protected updatePartySize(value: string): void {
    this.partySize.set(this.clamp(Number(value), 1, 10));
  }

  protected difficulty(encounter: GenericEncounter): string {
    return encounterTier(encounter, this.level()).difficulty;
  }

  protected roster(encounter: GenericEncounter): string {
    const roster = scaledEncounterMonsters(
      encounter,
      this.level(),
      this.partySize()
    )
      .map(
        (monster) =>
          `${monster.count} × ${this.monsterNames.get(monster.id) ?? monster.id}`
      )
      .join(' · ');
    return roster || 'Sin adversarios automáticos';
  }

  protected vttUrl(encounter: GenericEncounter): string {
    const params = new URLSearchParams({
      level: String(this.level()),
      partySize: String(this.partySize()),
      run: `library-${encounter.id}-${this.level()}-${this.partySize()}`,
    });
    return `/vtt/la-carta-sellada/generic/${encounter.id}?${params.toString()}`;
  }

  private clamp(value: number, min: number, max: number): number {
    const safeValue = Number.isFinite(value) ? Math.round(value) : min;
    return Math.min(max, Math.max(min, safeValue));
  }
}
