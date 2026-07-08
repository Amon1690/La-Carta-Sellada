import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { RulesDataService } from '../../../../core/services/rules-data';

@Component({
  selector: 'app-class-list',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './class-list.html',
  styleUrl: './class-list.scss',
})
export class ClassList {
  private readonly rulesData = inject(RulesDataService);

  protected readonly classes$ = this.rulesData
    .getRules()
    .pipe(map((rules) => rules.classes));
}
