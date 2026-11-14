import { Component, effect, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VisionEnvironment } from '../../../core/models/vision';
import { assertWorldEnvironment, unknownWorldEnvironment } from '../../../core/services/encounter-environment';

@Component({
  selector: 'app-journey-environment', standalone: true, imports: [FormsModule],
  templateUrl: './journey-environment.html',
  styles: [`:host{display:block}details{margin:1rem 0;padding:.75rem;border:1px solid #77633f;border-radius:.4rem}summary{cursor:pointer;font-weight:700}label{display:block;margin:.65rem 0}input,select{display:block;box-sizing:border-box;width:100%;min-width:0;padding:.45rem;background:#171c21;color:inherit;border:1px solid #68635a;border-radius:.25rem}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem}button{padding:.55rem;width:100%}p{font-size:.9rem}`],
})
export class JourneyEnvironment {
  readonly value = input.required<VisionEnvironment>();
  readonly saved = output<VisionEnvironment>();
  protected draft = unknownWorldEnvironment();
  protected day: string | number | null = ''; protected time = ''; protected reference = ''; protected message = '';
  constructor() { effect(() => { const value = this.value(); this.draft = structuredClone(value); this.day = value.gameTime?.day.toString() ?? ''; this.time = value.gameTime ? `${Math.floor(value.gameTime.minuteOfDay / 60).toString().padStart(2,'0')}:${(value.gameTime.minuteOfDay % 60).toString().padStart(2,'0')}` : ''; this.reference = value.source?.reference ?? 'Decisión del director en Viajes'; }); }
  protected save(): void {
    try {
      const environment = structuredClone(this.draft); delete environment.gameTime;
      const day = this.day == null ? '' : String(this.day).trim();
      if (day !== '' || this.time !== '') {
        if (!/^\d+$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.time)) throw new Error();
        environment.gameTime = { day: Number(day), minuteOfDay: Number(this.time.slice(0,2)) * 60 + Number(this.time.slice(3)), second: 0 };
      }
      environment.source = { kind: 'director', reference: this.reference.trim() };
      assertWorldEnvironment(environment); this.saved.emit(environment); this.message = 'Condiciones guardadas para futuros encuentros de este grupo.';
    } catch { this.message = 'Revisa el día, la hora del mundo y la procedencia. Puedes dejar día y hora vacíos para indicar que no se conocen.'; }
  }
}
