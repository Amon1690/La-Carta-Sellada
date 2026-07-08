import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { map } from 'rxjs';

import { RuleCreature } from '../../../../core/models/rules';
import { RulesDataService } from '../../../../core/services/rules-data';

@Component({
  selector: 'app-creature-list',
  imports: [AsyncPipe],
  templateUrl: './creature-list.html',
  styleUrl: './creature-list.scss',
})
export class CreatureList {
  protected readonly query = signal('');

  private readonly rulesData = inject(RulesDataService);

  protected readonly creatures$ = this.rulesData
    .getRules()
    .pipe(map((rules) => rules.creatures));

  protected updateQuery(value: string): void {
    this.query.set(value);
  }

  protected filteredCreatures(creatures: RuleCreature[]): RuleCreature[] {
    const query = this.normalize(this.query());
    if (!query) return creatures;

    return creatures.filter((creature) =>
      this.normalize(
        [
          creature.name,
          creature.type,
          creature.challenge,
          creature.skills ?? '',
          creature.senses,
        ].join(' ')
      ).includes(query)
    );
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
