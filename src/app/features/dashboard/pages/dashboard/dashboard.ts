import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CampaignDataService } from '../../../../core/services/campaign-data';

const CAMPAIGN_INTRODUCTION = `La Costa de la Espada no recibe su nombre por casualidad.

Allí, al oeste de Faerûn, la tierra se rompe contra un mar gris y tempestuoso. Acantilados, puertos, caminos embarrados, bosques antiguos y ciudades orgullosas se extienden como cicatrices sobre un mundo viejo, un mundo donde los dioses aún escuchan, donde los muertos no siempre descansan y donde una simple carta puede pesar más que una corona.

Faerûn es una tierra de maravillas y peligros. Los bardos cantan sobre dragones que duermen bajo montañas, magos capaces de torcer el tejido mismo de la realidad, dioses que bendicen a sus fieles y sombras que se arrastran desde tumbas olvidadas. Pero para la mayoría de la gente, la vida es más sencilla y más dura: sembrar antes de las lluvias, mantener el fuego encendido durante el invierno, cerrar la puerta cuando cae la noche y rezar para que los monstruos, los bandidos o los poderosos pasen de largo.

En esa tierra se alzan grandes ciudades como Aguas Profundas, la Ciudad de los Esplendores, un puerto inmenso de torres, templos, mercados y secretos. Allí se comercia con mercancías de todo el mundo conocido, se firman pactos entre nobles y mercaderes, y en sus callejones una moneda de oro puede comprar tanto una canción como una traición.

También existen lugares de luz y conocimiento como Lunaplateada, joya del norte, donde sabios, magos y guardianes trabajan para mantener viva la esperanza frente a la oscuridad. Pero incluso las ciudades más brillantes proyectan sombras.

Porque en Faerûn la paz nunca es un regalo.
La paz se vigila.
Se defiende.
Se paga.

Para eso existen órdenes, alianzas y juramentos.

Una de ellas es la Liga de los Lores, una alianza de ciudades, nobles y líderes que intentan mantener cierta estabilidad en una región donde cada camino puede esconder una emboscada y cada frontera puede convertirse en campo de batalla. La Liga no gobierna toda la Costa de la Espada, pero sus agentes, emisarios y aliados trabajan para evitar que las pequeñas amenazas se conviertan en guerras abiertas.

Y entre los dioses venerados por mortales, pocos inspiran tanta seriedad como Helm, el Vigilante. Dios de la guardia, la protección y el deber, Helm no promete gloria fácil ni placeres mundanos. Sus fieles creen en mantenerse firmes cuando todos retroceden, en custodiar aquello que debe ser protegido y en cumplir la palabra dada aunque nadie más esté mirando.

Por eso, cuando una carta sellada con magia divina parte del Templo de Helm en Aguas Profundas, no es un simple mensaje.

Es una responsabilidad.

La carta debía llegar a manos de un clérigo de Helm. Un hombre de fe, disciplina y honor, enviado a recogerla en la mansión de un noble aliado de la Liga de los Lores. El noble no conoce su contenido. No sabe qué secreto duerme bajo el sello sagrado. Solo sabe una cosa: la carta debe ser entregada al clérigo, y nadie más debe abrirla.

Pero el clérigo nunca llega.

Los días pasan.
El camino permanece vacío.
Y el silencio empieza a pesar más que cualquier noticia.

En la mansión de Lord Edric Hawkwinter, las velas arden hasta consumirse. Los criados hablan en susurros. Los guardias observan el camino con más atención de la habitual. El noble, hombre acostumbrado a la política, a los juramentos y a los peligros discretos, comprende que algo ha salido mal.

Muy mal.

Una carta que no puede abrirse.
Un clérigo desaparecido.
Un camino donde las huellas se pierden.
Y una sombra que empieza a moverse antes de que nadie conozca su nombre.

Es entonces cuando llegan los héroes.

No todos vienen por la misma razón.

Algunos han sido enviados por la Liga de los Lores.
Otros han seguido una visión, un presagio o una deuda.
Algunos buscan justicia.
Otros, quizá, una oportunidad de redimirse.
Hay quienes creen en los dioses, quienes creen en la magia, quienes creen en el acero, y quienes solo confían en lo que pueden ver con sus propios ojos.

Pero el destino rara vez reúne a personas tan distintas por casualidad.

Un paladín noble, marcado por un juramento de protección.
Una barda mediana cuya alegría puede iluminar incluso los días más grises.
Una investigadora élfica enviada desde Lunaplateada, capaz de percibir peligros que otros aún no comprenden.
Una asesina al servicio de los Arpistas, tan esbelta como letal, dispuesta a hacer el trabajo que nadie más quiere hacer.
Un bárbaro enano de la Liga, más cómodo con un hacha que con las palabras, pero firme como la piedra cuando se trata de proteger a los inocentes.

Y quizá otros más. Aventureros de sangre extraña, linajes antiguos, dones arcanos o pasados difíciles.

Todos ellos llegan a la casa de Lord Edric sin saber que ese día no comienza solo una misión.

Comienza una prueba.

Porque hay verdades que no desean ser descubiertas.
Hay muertos que no permanecen en sus tumbas.
Hay manos invisibles que mueven a bandidos, nobles y monstruos como piezas sobre un tablero.
Y hay cartas que permanecen selladas no para ocultar un mensaje, sino para impedir que el mundo despierte demasiado pronto a aquello que acecha bajo la superficie.

La Costa de la Espada ha visto muchas historias de héroes.

Algunas terminan en canciones.
Otras, en tumbas sin nombre.
Y unas pocas, las más peligrosas, empiezan con algo tan pequeño como un sobre cerrado.

Esta es una de esas historias.

Y antes de que termine, los aventureros deberán descubrir qué vale más:
el oro, la gloria, la verdad…
o la promesa de proteger a quienes no pueden protegerse solos.`;

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly campaignData = inject(CampaignDataService);
  private readonly route = inject(ActivatedRoute);

  protected readonly campaign$ = this.campaignData.getCampaign();
  protected readonly campaignId =
    this.route.snapshot.paramMap.get('campaignId') ?? '';
  protected readonly introductionBlocks = CAMPAIGN_INTRODUCTION
    .split(/\r?\n\r?\n/)
    .map((text, index, blocks) => ({
      text,
      stanza: text.includes('\n'),
      lead: index === 0,
      closing: index === blocks.length - 1,
    }));

  protected campaignPath(path: string): string[] {
    return ['/campanas', this.campaignId, path];
  }
}
