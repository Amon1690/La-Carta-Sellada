import { EncounterEnvironment } from './generic-encounters';
import { GENERATED_TRAVEL_EVENTS } from './travel-event-catalog';

export type TravelRole = 'guide' | 'hunter' | 'watch';
export type TravelEventPolarity = 'positive' | 'negative';
export type TravelEventSkill = 'survival' | 'perception';
export type TravelEncounterTrigger = 'success' | 'failure' | 'always';

export interface TravelEventEffect {
  foodKg?: number;
  foodPerTraveler?: number;
  waterLiters?: number;
  waterPerTraveler?: number;
  gold?: number;
  fatigue?: number;
  distancePercent?: number;
  distanceKm?: number;
}

export interface TravelEventDefinition {
  id: string;
  role: TravelRole;
  title: string;
  polarity: TravelEventPolarity;
  skill: TravelEventSkill;
  dc: number;
  environments: EncounterEnvironment[];
  story: string;
  success: string;
  failure: string;
  effect?: TravelEventEffect;
  encounterTrigger?: TravelEncounterTrigger;
  encounterChance?: number;
  campaignHook?: string;
  weight?: number;
}

const CURATED_TRAVEL_EVENTS: TravelEventDefinition[] = [
  {
    id: 'guide-old-milestone',
    role: 'guide',
    title: 'El mojón cubierto de hiedra',
    polarity: 'positive',
    skill: 'survival',
    dc: 12,
    environments: ['road', 'forest', 'plains', 'farmland'],
    story:
      'Bajo la hiedra aparece un mojón anterior al camino moderno. Sus marcas describen una senda de postas que atraviesa las colinas sin seguir cada curva del valle.',
    success: 'El grupo recupera la antigua senda y gana terreno antes del anochecer.',
    failure: 'Las marcas resultan demasiado erosionadas y el grupo conserva la ruta conocida.',
    effect: { distancePercent: 0.2 },
    weight: 5,
  },
  {
    id: 'guide-wind-window',
    role: 'guide',
    title: 'Una ventana entre las nubes',
    polarity: 'positive',
    skill: 'perception',
    dc: 13,
    environments: ['mountain', 'coast', 'sea', 'plains', 'wild'],
    story:
      'Las nubes se abren por el oeste y el viento cambia de dirección. Durante unas horas existe una franja de calma que solo reconocerá quien lea bien el horizonte.',
    success: 'La marcha aprovecha la calma y avanza más de lo previsto.',
    failure: 'El grupo mantiene el horario normal y la ventana se cierra a su espalda.',
    effect: { distancePercent: 0.15 },
    weight: 4,
  },
  {
    id: 'guide-sheltered-camp',
    role: 'guide',
    title: 'El refugio de los tres tejos',
    polarity: 'positive',
    skill: 'survival',
    dc: 12,
    environments: ['forest', 'mountain', 'wild', 'jungle'],
    story:
      'Tres árboles antiguos crecen alrededor de una hondonada seca. El suelo conserva restos de hogares bien drenados y piedras colocadas contra el viento.',
    success: 'El campamento permite un descanso reparador y reduce la fatiga acumulada.',
    failure: 'El lugar parece útil, pero no ofrece ninguna ventaja real sobre otro campamento.',
    effect: { fatigue: -1 },
    weight: 5,
  },
  {
    id: 'guide-hidden-spring',
    role: 'guide',
    title: 'Agua bajo la piedra blanca',
    polarity: 'positive',
    skill: 'perception',
    dc: 13,
    environments: ['mountain', 'desert', 'plains', 'road'],
    story:
      'Una línea de insectos y musgo conduce hasta una laja pálida. Bajo ella se oye el murmullo de un manantial protegido del sol y de los animales.',
    success: 'El grupo repone agua limpia antes de continuar.',
    failure: 'El indicio se pierde entre grietas y no se dedica más tiempo a la búsqueda.',
    effect: { waterPerTraveler: 2.5 },
    weight: 4,
  },
  {
    id: 'guide-forgotten-toll',
    role: 'guide',
    title: 'La caseta sin bandera',
    polarity: 'positive',
    skill: 'perception',
    dc: 14,
    environments: ['road', 'urban', 'village'],
    story:
      'Una caseta de peaje abandonada conserva un doble fondo en la mesa del recaudador. Las monedas llevan décadas esperando a alguien que reconozca el mecanismo.',
    success: 'El escondrijo aporta monedas y documentos de una ruta comercial olvidada.',
    failure: 'La caseta parece saqueada y el grupo prosigue sin descubrir el compartimento.',
    effect: { gold: 14 },
    weight: 3,
  },
  {
    id: 'guide-favorable-current',
    role: 'guide',
    title: 'La corriente favorable',
    polarity: 'positive',
    skill: 'survival',
    dc: 13,
    environments: ['river', 'sea', 'coast', 'swamp'],
    story:
      'Restos de espuma dibujan una corriente lateral más rápida. Tomarla exige abandonar durante un tramo la ruta más evidente.',
    success: 'La corriente segura acorta la jornada y aumenta el recorrido.',
    failure: 'El grupo no arriesga las embarcaciones y mantiene el rumbo previsto.',
    effect: { distancePercent: 0.18 },
    weight: 4,
  },
  {
    id: 'guide-storm-front',
    role: 'guide',
    title: 'El frente que no figuraba en el cielo',
    polarity: 'negative',
    skill: 'perception',
    dc: 14,
    environments: ['mountain', 'coast', 'sea', 'plains', 'wild'],
    story:
      'Una franja oscura crece tras el grupo sin truenos ni relámpagos. Cuando el aire adquiere olor metálico, apenas queda tiempo para elegir terreno.',
    success: 'La ruta cambia a tiempo y el peor tramo de la tormenta pasa lejos.',
    failure: 'La marcha queda atrapada en el temporal, pierde horas y termina exhausta.',
    effect: { distancePercent: -0.25, fatigue: 1 },
    weight: 5,
  },
  {
    id: 'guide-false-cairns',
    role: 'guide',
    title: 'Los hitos que miran al norte',
    polarity: 'negative',
    skill: 'survival',
    dc: 13,
    environments: ['mountain', 'desert', 'wild', 'plains'],
    story:
      'Una sucesión de pequeños montones de piedra parece marcar el camino. Todos tienen una cara limpia, como si alguien los hubiese girado recientemente.',
    success: 'El engaño se detecta antes de abandonar la ruta verdadera.',
    failure: 'Los falsos hitos conducen al grupo por un desvío largo y sin salida.',
    effect: { distancePercent: -0.3 },
    weight: 5,
  },
  {
    id: 'guide-bad-camp',
    role: 'guide',
    title: 'La hondonada silenciosa',
    polarity: 'negative',
    skill: 'survival',
    dc: 12,
    environments: ['forest', 'swamp', 'jungle', 'wild'],
    story:
      'El terreno parece seco y protegido, pero no hay insectos, pájaros ni huellas alrededor. La calma puede ser una bendición o una advertencia.',
    success: 'El guía reconoce las señales y busca otro lugar antes de descargar el equipo.',
    failure: 'Durante la noche, humedad y vapores malsanos impiden descansar.',
    effect: { fatigue: 1 },
    weight: 4,
  },
  {
    id: 'guide-broken-supply-cart',
    role: 'guide',
    title: 'El paso de las raíces negras',
    polarity: 'negative',
    skill: 'perception',
    dc: 13,
    environments: ['road', 'forest', 'farmland', 'village'],
    story:
      'Raíces endurecidas cruzan el camino bajo una capa fina de barro. Una rueda o una bestia de carga mal dirigida puede abrir todos los fardos de provisiones.',
    success: 'El obstáculo se señaliza y la caravana lo supera sin daños.',
    failure: 'Un carro vuelca y parte de la comida queda esparcida y arruinada.',
    effect: { foodKg: -4 },
    weight: 4,
  },
  {
    id: 'guide-unlicensed-crossing',
    role: 'guide',
    title: 'El puente de la compañía gris',
    polarity: 'negative',
    skill: 'perception',
    dc: 15,
    environments: ['road', 'river', 'urban'],
    story:
      'Una cuadrilla uniformada cobra un suplemento por cruzar. Los sellos parecen legítimos, salvo por una fecha raspada en la orden.',
    success: 'La falsificación queda al descubierto y los recaudadores permiten el paso.',
    failure: 'El grupo paga el arancel para no perder la jornada.',
    effect: { gold: -18 },
    encounterTrigger: 'failure',
    encounterChance: 0.2,
    weight: 3,
  },
  {
    id: 'guide-road-without-shadow',
    role: 'guide',
    title: 'El camino que no proyecta sombra',
    polarity: 'negative',
    skill: 'perception',
    dc: 17,
    environments: ['ruins', 'desert', 'forest', 'wild'],
    story:
      'Durante un instante, las piedras de la calzada dejan de proyectar sombra. Más adelante hay huellas de viajeros que comienzan en ambos sentidos y terminan en el mismo punto.',
    success: 'El guía aparta al grupo de la calzada antes de que el fenómeno se cierre.',
    failure: 'La anomalía roba varias horas y deja una marca idéntica en todos los mapas.',
    effect: { distancePercent: -0.35 },
    campaignHook:
      'La marca pertenece a una red de caminos imposibles que puede continuar en otra campaña.',
    weight: 1,
  },
  {
    id: 'hunter-game-trail',
    role: 'hunter',
    title: 'El rastro del venado blanco',
    polarity: 'positive',
    skill: 'survival',
    dc: 12,
    environments: ['forest', 'plains', 'farmland', 'wild'],
    story:
      'Un rastro reciente cruza el barro junto a pelos completamente blancos. La pieza evita las zonas abiertas y conduce hacia un valle fértil.',
    success: 'La caza aporta carne limpia y revela un buen terreno de forrajeo.',
    failure: 'El rastro se pierde sin consumir más tiempo de la jornada.',
    effect: { foodPerTraveler: 0.8 },
    weight: 5,
  },
  {
    id: 'hunter-clean-water',
    role: 'hunter',
    title: 'Juncos de agua dulce',
    polarity: 'positive',
    skill: 'survival',
    dc: 11,
    environments: ['river', 'swamp', 'plains', 'forest', 'jungle'],
    story:
      'Entre charcos turbios crece una variedad de junco que solo prospera donde el agua circula bajo tierra.',
    success: 'Los cazadores excavan un pequeño pozo filtrante y llenan los recipientes.',
    failure: 'La veta está demasiado profunda y se abandona antes de retrasar la marcha.',
    effect: { waterPerTraveler: 3 },
    weight: 5,
  },
  {
    id: 'hunter-herbalist-cache',
    role: 'hunter',
    title: 'El jardín del herbolario ausente',
    polarity: 'positive',
    skill: 'survival',
    dc: 14,
    environments: ['forest', 'jungle', 'swamp', 'farmland'],
    story:
      'Un cercado casi devorado por la maleza protege plantas medicinales ordenadas por color. Nadie ha cuidado el lugar en meses.',
    success: 'Se recogen remedios útiles que alivian el cansancio y pueden venderse.',
    failure: 'Las variedades no se identifican con seguridad y se dejan intactas.',
    effect: { fatigue: -1, gold: 8 },
    weight: 3,
  },
  {
    id: 'hunter-shellfish-bank',
    role: 'hunter',
    title: 'El banco que descubre la marea',
    polarity: 'positive',
    skill: 'survival',
    dc: 12,
    environments: ['coast', 'sea', 'islands', 'river'],
    story:
      'La marea descubre una lengua de piedra cubierta de moluscos y algas comestibles. Solo permanecerá accesible unos minutos.',
    success: 'El grupo recoge alimento suficiente sin alterar el horario.',
    failure: 'La marea cubre el banco antes de reunir una cantidad aprovechable.',
    effect: { foodPerTraveler: 0.7 },
    weight: 4,
  },
  {
    id: 'hunter-tainted-pool',
    role: 'hunter',
    title: 'El agua inmóvil',
    polarity: 'negative',
    skill: 'survival',
    dc: 13,
    environments: ['swamp', 'jungle', 'forest', 'wild'],
    story:
      'Un estanque claro parece perfecto para rellenar odres, pero las hojas flotan sin pudrirse y los animales beben en otro lugar.',
    success: 'La contaminación se reconoce y nadie toca el agua.',
    failure: 'Parte de las reservas queda mezclada con agua tóxica y debe desecharse.',
    effect: { waterPerTraveler: -2, fatigue: 1 },
    weight: 5,
  },
  {
    id: 'hunter-poisoned-fruit',
    role: 'hunter',
    title: 'Frutos con una sola picadura',
    polarity: 'negative',
    skill: 'survival',
    dc: 14,
    environments: ['jungle', 'forest', 'swamp', 'farmland'],
    story:
      'Un árbol está cargado de frutos maduros. Cada uno presenta una diminuta perforación junto al tallo y ningún pájaro se acerca a las ramas.',
    success: 'La puesta de insectos venenosos se detecta antes de recoger los frutos.',
    failure: 'La comida recolectada contamina parte de las provisiones y enferma a varios viajeros.',
    effect: { foodKg: -3, fatigue: 1 },
    weight: 4,
  },
  {
    id: 'hunter-predator-circle',
    role: 'hunter',
    title: 'Huellas alrededor del campamento',
    polarity: 'negative',
    skill: 'survival',
    dc: 14,
    environments: ['forest', 'mountain', 'jungle', 'swamp', 'wild'],
    story:
      'Las huellas de un gran depredador no se acercan al campamento: lo rodean. El animal está estudiando turnos, olores y rutas de salida.',
    success: 'Los cazadores cambian las señales del campamento y alejan a la bestia.',
    failure: 'El depredador elige el momento de atacar.',
    encounterTrigger: 'failure',
    encounterChance: 1,
    weight: 4,
  },
  {
    id: 'hunter-poachers',
    role: 'hunter',
    title: 'Las trampas marcadas',
    polarity: 'negative',
    skill: 'survival',
    dc: 13,
    environments: ['forest', 'plains', 'farmland', 'road'],
    story:
      'Varias trampas llevan la marca de un señor local, pero las presas han sido retiradas por manos distintas. Alguien sigue la misma línea de caza.',
    success: 'El grupo evita la zona y conserva sus suministros.',
    failure: 'Los furtivos se llevan una bolsa de comida y dejan una advertencia.',
    effect: { foodKg: -3 },
    encounterTrigger: 'failure',
    encounterChance: 0.35,
    weight: 3,
  },
  {
    id: 'hunter-wounded-messenger',
    role: 'hunter',
    title: 'La flecha con plumas azules',
    polarity: 'positive',
    skill: 'survival',
    dc: 15,
    environments: ['forest', 'road', 'plains', 'mountain'],
    story:
      'Un rastro de sangre conduce a un mensajero herido que protege una flecha de señal con plumas azules. Insiste en que no pertenece a esta región.',
    success: 'El mensajero es localizado a tiempo y ofrece una recompensa por completar su entrega.',
    failure: 'La lluvia borra el rastro; solo queda la extraña flecha como indicio.',
    effect: { gold: 12 },
    campaignHook:
      'El mensaje está dirigido a una fortaleza que no aparece en los mapas actuales.',
    weight: 1,
  },
  {
    id: 'watch-distant-smoke',
    role: 'watch',
    title: 'Tres columnas de humo',
    polarity: 'positive',
    skill: 'perception',
    dc: 12,
    environments: ['plains', 'road', 'farmland', 'mountain'],
    story:
      'Tres columnas de humo se elevan a intervalos regulares. No son un incendio: alguien está respondiendo a señales desde el otro lado del valle.',
    success: 'Los vigías identifican una caravana amistosa y acuerdan compartir noticias y suministros.',
    failure: 'Las señales cesan antes de determinar su origen.',
    effect: { gold: 6, foodKg: 2 },
    weight: 4,
  },
  {
    id: 'watch-lantern-shelter',
    role: 'watch',
    title: 'La linterna en la torre baja',
    polarity: 'positive',
    skill: 'perception',
    dc: 13,
    environments: ['road', 'mountain', 'forest', 'ruins'],
    story:
      'Una luz aparece dos veces entre los árboles y después permanece fija. Procede de una vieja torre usada como refugio por viajeros.',
    success: 'El contacto es pacífico y el grupo descansa bajo techo.',
    failure: 'No se localiza la torre y se mantiene el campamento previsto.',
    effect: { fatigue: -1 },
    weight: 4,
  },
  {
    id: 'watch-abandoned-cache',
    role: 'watch',
    title: 'El brillo bajo la lona',
    polarity: 'positive',
    skill: 'perception',
    dc: 14,
    environments: ['road', 'ruins', 'wild', 'desert'],
    story:
      'La luna se refleja en una hebilla bajo una lona cubierta de polvo. El pequeño depósito parece abandonado con demasiada prisa.',
    success: 'Los vigías encuentran provisiones todavía útiles y anotaciones sobre la ruta.',
    failure: 'El reflejo desaparece y nadie abandona su puesto para buscarlo.',
    effect: { foodKg: 3, waterLiters: 6 },
    weight: 3,
  },
  {
    id: 'watch-friendly-pilgrims',
    role: 'watch',
    title: 'Cantos antes del alba',
    polarity: 'positive',
    skill: 'perception',
    dc: 11,
    environments: ['road', 'village', 'urban', 'plains'],
    story:
      'Un canto bajo precede a una columna de peregrinos. Sus faroles están cubiertos para no despertar a los campamentos del camino.',
    success: 'El primer contacto evita alarmas y los peregrinos comparten una variante más corta de la ruta.',
    failure: 'Ambos grupos se observan a distancia y continúan por separado.',
    effect: { distanceKm: 5 },
    weight: 4,
  },
  {
    id: 'watch-ambush-sign',
    role: 'watch',
    title: 'El pájaro que repite su vuelo',
    polarity: 'negative',
    skill: 'perception',
    dc: 14,
    environments: ['forest', 'road', 'jungle', 'mountain', 'wild'],
    story:
      'Un pájaro cruza tres veces el mismo claro con idéntico batir de alas. Tras la tercera pasada, una cuerda se tensa entre dos árboles.',
    success: 'La señal preparada se descubre y la emboscada queda sin sorpresa.',
    failure: 'Los atacantes reciben la señal y cierran sus posiciones.',
    encounterTrigger: 'failure',
    encounterChance: 1,
    weight: 5,
  },
  {
    id: 'watch-night-thieves',
    role: 'watch',
    title: 'Pasos entre las monturas',
    polarity: 'negative',
    skill: 'perception',
    dc: 13,
    environments: ['road', 'urban', 'village', 'farmland'],
    story:
      'Un roce de cuero se confunde con el movimiento de las monturas. Alguien avanza agachado hacia las alforjas sin tocar una sola campanilla.',
    success: 'Los ladrones son descubiertos y huyen sin llevarse nada.',
    failure: 'Al amanecer faltan monedas y una bolsa de raciones.',
    effect: { gold: -10, foodKg: -2 },
    encounterTrigger: 'failure',
    encounterChance: 0.25,
    weight: 5,
  },
  {
    id: 'watch-following-scouts',
    role: 'watch',
    title: 'Siluetas sobre la cresta',
    polarity: 'negative',
    skill: 'perception',
    dc: 15,
    environments: ['plains', 'mountain', 'desert', 'wild'],
    story:
      'Dos siluetas aparecen en una cresta y desaparecen cuando cambia la guardia. Una tercera espera mucho más lejos, junto a algo que refleja la luna.',
    success: 'Los exploradores son detectados y el grupo cambia su disposición antes del contacto.',
    failure: 'Los observadores transmiten la posición exacta del campamento.',
    encounterTrigger: 'failure',
    encounterChance: 0.7,
    weight: 4,
  },
  {
    id: 'watch-stranger-fire',
    role: 'watch',
    title: 'Un fuego que pide permiso',
    polarity: 'negative',
    skill: 'perception',
    dc: 12,
    environments: ['road', 'forest', 'plains', 'wild'],
    story:
      'Un viajero enciende un fuego pequeño justo fuera del círculo de luz del campamento. No se acerca, pero coloca una taza vacía mirando hacia el grupo.',
    success: 'El vigía inicia el contacto desde una posición segura y descubre a un informador asustado.',
    failure: 'El desconocido se marcha con una descripción precisa del grupo.',
    encounterTrigger: 'failure',
    encounterChance: 0.15,
    weight: 3,
  },
  {
    id: 'watch-star-door',
    role: 'watch',
    title: 'La estrella bajo el horizonte',
    polarity: 'positive',
    skill: 'perception',
    dc: 17,
    environments: ['desert', 'sea', 'mountain', 'plains'],
    story:
      'Una estrella aparece por debajo del horizonte y asciende en dirección contraria al cielo. Durante un latido ilumina una puerta solitaria a gran distancia.',
    success: 'El vigía fija la posición y dibuja un símbolo que no pertenece a ningún calendario conocido.',
    failure: 'La luz desaparece antes de poder demostrar que no fue un sueño.',
    campaignHook:
      'La puerta puede conectar con un escenario o campaña situada fuera de Faerûn.',
    weight: 1,
  },
  {
    id: 'watch-river-lights',
    role: 'watch',
    title: 'Luces bajo la corriente',
    polarity: 'negative',
    skill: 'perception',
    dc: 14,
    environments: ['river', 'swamp', 'coast', 'sea'],
    story:
      'Varias luces azuladas avanzan contra la corriente. Se detienen bajo el campamento y comienzan a separarse, como si contaran a los durmientes.',
    success: 'El vigía despierta al grupo y las luces se dispersan antes de rodearlo.',
    failure: 'Las luces alcanzan la orilla y algo emerge con ellas.',
    encounterTrigger: 'failure',
    encounterChance: 0.8,
    weight: 3,
  },
];

export const TRAVEL_EVENTS: TravelEventDefinition[] = [
  ...CURATED_TRAVEL_EVENTS,
  ...GENERATED_TRAVEL_EVENTS,
];

export interface TravelEventCatalogStats {
  total: number;
  guide: number;
  hunter: number;
  watch: number;
  encounters: number;
  encounterRatio: number;
}

export const TRAVEL_EVENT_CATALOG_STATS: TravelEventCatalogStats =
  validateTravelEventCatalog(TRAVEL_EVENTS);

function validateTravelEventCatalog(
  events: TravelEventDefinition[]
): TravelEventCatalogStats {
  const ids = new Set(events.map((event) => event.id));
  if (ids.size !== events.length) {
    throw new Error('El catálogo de viajes contiene identificadores de evento duplicados.');
  }

  const stats: TravelEventCatalogStats = {
    total: events.length,
    guide: events.filter((event) => event.role === 'guide').length,
    hunter: events.filter((event) => event.role === 'hunter').length,
    watch: events.filter((event) => event.role === 'watch').length,
    encounters: events.filter((event) => Boolean(event.encounterTrigger)).length,
    encounterRatio: 0,
  };
  stats.encounterRatio = stats.encounters / stats.total;

  if (stats.guide < 300 || stats.hunter < 100 || stats.watch < 100) {
    throw new Error(
      `Catálogo de viajes incompleto: ${stats.guide} de guía, ${stats.hunter} de cazador y ${stats.watch} de vigía.`
    );
  }
  if (stats.encounterRatio < 0.1) {
    throw new Error(
      `El catálogo de viajes solo incluye un ${(stats.encounterRatio * 100).toFixed(1)}% de encuentros.`
    );
  }

  return stats;
}
