import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';

import {
  RuleClass,
  RuleClassFeature,
} from '../../../../core/models/rules';
import { RulesDataService } from '../../../../core/services/rules-data';

interface ClassLevel {
  level: number;
  features: RuleClassFeature[];
}

@Component({
  selector: 'app-class-detail',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './class-detail.html',
  styleUrl: './class-detail.scss',
})
export class ClassDetail {
  private readonly rulesData = inject(RulesDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly class$ = combineLatest([
    this.rulesData.getRules(),
    this.route.paramMap,
  ]).pipe(
    map(([rules, params]) =>
      rules.classes.find((entry) => entry.id === params.get('classId'))
    )
  );

  protected levels(characterClass: RuleClass): ClassLevel[] {
    const grouped = new Map<number, RuleClassFeature[]>();

    for (const feature of characterClass.features) {
      grouped.set(feature.level, [
        ...(grouped.get(feature.level) ?? []),
        feature,
      ]);
    }

    return Array.from(grouped, ([level, features]) => ({ level, features })).sort(
      (a, b) => a.level - b.level
    );
  }
}
