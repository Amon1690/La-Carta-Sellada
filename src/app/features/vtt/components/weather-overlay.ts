import { Component, input } from '@angular/core';
import { VisionEnvironment } from '../../../core/models/vision';

@Component({
  selector: 'app-weather-overlay',
  template: `
    <div aria-hidden="true" class="weather" [class.fog]="weather() === 'fog'" [class.rain]="weather() === 'rain'" [class.snow]="weather() === 'snow'">
      @if (weather() === 'fog') { <i class="cloud near"></i><i class="cloud middle"></i><i class="cloud far"></i> }
      @if (weather() === 'rain' || weather() === 'snow') {
        @for (particle of particles; track $index) {
          <i class="particle" [style.--x]="particle.x" [style.--y]="particle.y" [style.--depth]="particle.depth"
            [style.--delay]="particle.delay + 's'" [style.--speed]="(weather() === 'rain' ? particle.speed : particle.speed * 13) + 's'"
            [style.--length]="particle.length + 'px'" [style.--wind]="particle.wind + 'px'"></i>
        }
      }
    </div>`,
  styles: `
    :host { position: absolute; inset: 0; display: block; pointer-events: none; z-index: 15; overflow: hidden; contain: layout paint; }
    .weather { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    i { display: block; position: absolute; pointer-events: none; }
    .particle { left: calc(var(--x) * 1%); top: -25%; opacity: calc(.15 + var(--depth) * .35); animation: fall var(--speed) linear var(--delay) infinite; }
    .rain .particle { width: 1px; height: var(--length); background: linear-gradient(transparent, #d7e7f4); border-radius: 1px; }
    .snow .particle { width: calc(1px + var(--depth) * 3px); height: calc(1px + var(--depth) * 3px); border-radius: 50%; background: #f4f8fb; filter: blur(.2px); animation-name: snowfall; }
    .cloud { inset: -35%; filter: blur(22px); opacity: .2; background: radial-gradient(ellipse at 25% 40%, #b4c6d5, transparent 38%), radial-gradient(ellipse at 70% 65%, #d5e0e8, transparent 42%); animation: drift 31s ease-in-out infinite alternate; }
    .middle { opacity: .13; animation-duration: 47s; animation-delay: -19s; transform: rotate(180deg); }
    .far { opacity: .09; animation-duration: 61s; animation-delay: -37s; background-position: 90px 50px; }
    @keyframes drift { from { translate: -8% -3%; } to { translate: 8% 4%; } }
    @keyframes fall { to { transform: translate3d(var(--wind), 1450px, 0) rotate(12deg); } }
    @keyframes snowfall { 50% { translate: 18px 0; } to { transform: translate3d(var(--wind), 1450px, 0); translate: -15px 0; } }
    @media (prefers-reduced-motion: reduce) { .cloud, .particle { animation: none; } .particle { top: calc(var(--y) * 1%); } }
  `,
})
export class WeatherOverlay {
  readonly weather = input<VisionEnvironment['weather']>('unknown');
  protected readonly particles = Array.from({ length: 96 }, (_, i) => ({
    x: (i * 61.8034) % 100, y: (i * 37.271) % 100, depth: .2 + (i * .173) % .8,
    speed: .65 + (i * .137) % .7, delay: -(i * 1.731) % 30, length: 11 + (i * 13) % 23, wind: -25 - (i * 19) % 160,
  }));
}
