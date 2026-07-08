import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { RulesCompendium } from '../models/rules';

@Injectable({
  providedIn: 'root',
})
export class RulesDataService {
  private readonly http = inject(HttpClient);

  private readonly rules$ = this.http
    .get<RulesCompendium>('data/rules.json')
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));

  getRules(): Observable<RulesCompendium> {
    return this.rules$;
  }
}
