// Separaciones de columnas del manual local español (página PDF = impresa + 2).
// Se conservan las fórmulas del texto local; las fichas de ejemplo no son valores base.
import { cleanRuleDescription } from './rules-source-repairs.mjs';

const wildEffects = [
  'Durante 1 minuto, tira en esta tabla al principio de cada uno de tus turnos; ignora este resultado en esas tiradas.',
  'Aparece una criatura amistosa en un espacio sin ocupar aleatorio a 18 m o menos; la controla el DM y desaparece tras 1 minuto. Tira 1d4: 1, modron duodron; 2, flumph; 3, modron monodron; 4, unicornio.',
  'Durante 1 minuto, recuperas 5 PG al principio de cada uno de tus turnos.',
  'Las criaturas tienen desventaja en sus salvaciones contra el siguiente conjuro con salvación que lances durante el próximo minuto.',
  'Tira 1d8 para un efecto de 1 minuto, salvo duración indicada: 1, música etérea audible a 1,5 m; 2, aumentas una categoría de tamaño; 3, barba de plumas que desaparece al estornudar; 4, gritas al hablar; 5, mariposas ilusorias a 3 m; 6, ojo en la frente y ventaja en Percepción; 7, burbujas rosas al hablar; 8, piel azul durante 24 horas o hasta levantar maldición.',
  'Durante 1 minuto, tus conjuros cuyo lanzamiento es una acción pasan a lanzarse como acción adicional.',
  'Vas al Plano Astral hasta el final de tu siguiente turno; vuelves a tu espacio anterior o al espacio sin ocupar más cercano.',
  'El siguiente conjuro de daño que lances durante 1 minuto usa el resultado máximo de cada dado de daño, sin tirarlos.',
  'Durante 1 minuto, tienes resistencia a todo el daño.',
  'Eres una planta en una maceta hasta el principio de tu siguiente turno: incapacitado y vulnerable a todo el daño. Si llegas a 0 PG, se rompe la maceta y recuperas tu forma.',
  'Durante 1 minuto, puedes teletransportarte hasta 6 m como acción adicional en cada turno.',
  'Tú y hasta tres criaturas que elijas a 9 m o menos sois invisibles durante 1 minuto. Para cada criatura termina tras atacar, causar daño o lanzar un conjuro.',
  'Un escudo espectral te concede +2 CA e inmunidad a Proyectil mágico durante 1 minuto.',
  'Puedes realizar una acción extra este turno.',
  'Lanzas un conjuro aleatorio sin concentración, que dura su duración completa. Tira 1d10, con el orden del manual español: 1, Bola de fuego; 2, Confusión; 3, Grasa; 4, Imagen múltiple; 5, Levitar sobre ti; 6, Nube de oscurecimiento; 7, Polimorfar sobre ti (si fallas la salvación, te conviertes en cabra); 8, Proyectil mágico de nivel 5; 9, Ver invisibilidad; 10, Volar sobre una criatura aleatoria a 18 m o menos.',
  'Durante 1 minuto, los objetos no mágicos inflamables que toques y que nadie lleve se prenden, sufren 1d4 de fuego y arden.',
  'Si mueres durante la próxima hora, vuelves inmediatamente a la vida mediante Reencarnar.',
  'Estás asustado hasta el final de tu siguiente turno; el DM determina el motivo.',
  'Te teletransportas hasta 18 m a un espacio sin ocupar que puedas ver.',
  'Una criatura aleatoria a 18 m o menos queda envenenada durante 1d4 horas.',
  'Durante 1 minuto, emites luz brillante en 9 m. Una criatura que termine su turno a 1,5 m o menos queda cegada hasta el final de su siguiente turno.',
  'Hasta tres criaturas elegidas y visibles a 9 m o menos sufren 1d10 de daño necrótico. Recuperas tantos PG como el daño necrótico causado.',
  'Hasta tres criaturas elegidas y visibles a 9 m o menos sufren 4d10 de daño de relámpago.',
  'Durante 1 minuto, tú y todas las criaturas a 9 m o menos sois vulnerables al daño perforante.',
  'Tira 1d6: 1, recuperas 2d10 PG; 2, un aliado elegido a 90 m o menos recupera 2d10 PG; 3, recuperas tu espacio de conjuro de menor nivel; 4, un aliado elegido a 90 m o menos recupera su espacio de menor nivel; 5, recuperas todos tus puntos de hechicería; 6, se aplican juntos todos los efectos de 17–20.',
];
const beastCommon = 'CA 13 + tu modificador por Sabiduría. Percepción pasiva 12. Entiende tus idiomas; BC igual al tuyo. Vínculo primigenio: suma tu BC a sus pruebas de característica y salvaciones. Los ataques usan tu bonificador de ataque de conjuros y tienen alcance 1,5 m.';
export const confirmedClassReferences = {
  'hechiceria-de-magia-salvaje': [{id:'tabla-de-sobrecarga-de-magia-salvaje',name:'Tabla de sobrecarga de magia salvaje',sourcePage:131,requiresSourceCheck:false,
    description:'Tira 1d100. 00 representa 100.\n'+wildEffects.map((effect,i)=>`${String(i*4+1).padStart(2,'0')}–${i===24?'00':String(i*4+4).padStart(2,'0')}: ${effect}`).join('\n')}],
  'senor-de-las-bestias': [
    {id:'bestia-de-los-mares',name:'Bestia de los mares',sourcePage:111,description:`Bestia Mediana, neutral. ${beastCommon}\nPG 5 + cinco veces tu nivel de explorador; tantos d8 de golpe como niveles de explorador. Velocidad 1,5 m; nadar 18 m. FUE 14, DES 14, CON 15, INT 8, SAB 14, CAR 11. Visión en la oscuridad 27 m.\nAnfibia: respira aire y agua. Golpe de bestia: 1d6 + 2 + tu modificador por Sabiduría de daño contundente o perforante, elegido al invocarla. El objetivo queda agarrado; CD para escapar igual a tu CD de conjuros.`},
    {id:'bestia-del-cielo',name:'Bestia del cielo',sourcePage:111,description:`Bestia Pequeña, neutral. ${beastCommon}\nPG 4 + cuatro veces tu nivel de explorador; tantos d6 de golpe como niveles de explorador. Velocidad 3 m; volar 18 m. FUE 6, DES 16, CON 13, INT 8, SAB 14, CAR 11. Visión en la oscuridad 18 m.\nPasar volando: no provoca ataques de oportunidad al alejarse volando. Golpe de bestia: 1d4 + 3 + tu modificador por Sabiduría de daño cortante.`},
    {id:'bestia-de-tierra-firme',name:'Bestia de tierra firme',sourcePage:111,description:`Bestia Mediana, neutral. ${beastCommon}\nPG 5 + cinco veces tu nivel de explorador; tantos d8 de golpe como niveles de explorador. Velocidad 12 m; trepar 12 m. FUE 14, DES 14, CON 15, INT 8, SAB 14, CAR 11. Visión en la oscuridad 18 m.\nGolpe de bestia: 1d8 + 2 + tu modificador por Sabiduría de daño contundente, cortante o perforante, elegido al invocarla. Si se movió al menos 6 m en línea recta hacia el objetivo antes de acertar, añade 1d6 del mismo tipo y derriba a un objetivo Grande o menor.`},
  ],
};

export function repairSpellContent(spells, pages) {
  const find = (id) => {const s=spells.find((s)=>s.id===id);if(!s)throw new Error(`Falta ${id} en las reparaciones contrastadas.`);return s;};
  const part = (page,from,to) => cleanRuleDescription(pages[page-1].split(/\r?\n/).slice(from-1,to).map((line)=>line.replace(/[|]/g,'').replace(/^\s*(?:l|ll|I|Il)\s+/,'').trim()).join(' ').replace(/\s+/g,' '));
  const set=(id,body)=>{find(id).description=body;};
  set('saber-druidico','Susurras a los espíritus de la naturaleza y produces uno de estos efectos dentro del alcance.\nSensor climático: un efecto sensorial Diminuto e inofensivo predice el clima de tu ubicación durante las próximas 24 horas (orbe dorado para cielo despejado, nube para lluvia, copos para nieve, etc.). Dura 1 asalto.\nFlorecer: haces florecer una flor, abrirse una vaina de semillas o germinar el brote de una hoja al instante.\nEfecto sensorial: creas un efecto inofensivo, como hojas, hadas espectrales, brisa, sonido de animal u olor a mofeta, dentro de un cubo de 1,5 m.\nJugar con fuego: enciendes o apagas una vela, antorcha u hoguera.');
  set('rociada-prismatica','Ocho rayos forman un cono de 18 m desde tu mano. Cada criatura del cono hace una salvación de Destreza; tira 1d8 por objetivo para determinar el rayo.\n1. Rojo: 12d6 de fuego si falla; la mitad si supera la salvación.\n2. Naranja: 12d6 de ácido si falla; la mitad si la supera.\n3. Amarillo: 12d6 de relámpago si falla; la mitad si la supera.\n4. Verde: 12d6 de veneno si falla; la mitad si la supera.\n5. Azul: 12d6 de frío si falla; la mitad si la supera.\n6. Añil: si falla, queda apresado y realiza una salvación de Constitución al final de cada turno. Tres éxitos terminan el estado; tres fallos lo petrifican hasta que un efecto como Restablecimiento mayor lo libere. Los éxitos o fallos no tienen que ser consecutivos.\n7. Violeta: si falla, queda cegado y hace una salvación de Sabiduría al principio de tu siguiente turno. Un éxito termina el estado; un fallo también lo termina y teletransporta a la criatura a un plano elegido por el DM.\n8. Especial: recibe dos rayos; tira dos veces y repite los resultados de 8.');
  set('controlar-el-clima',part(266,35,49)+'\nPrecipitaciones: 1, despejado; 2, nubes escasas; 3, cielo cubierto o niebla de superficie; 4, lluvia, granizo o nieve; 5, lluvia torrencial, tormenta de granizo o ventisca.\nTemperatura: 1, ola de calor; 2, caliente; 3, templado; 4, fresco; 5, frío; 6, frío extremo.\nViento: 1, calmo; 2, viento moderado; 3, viento fuerte; 4, galerna; 5, tempestad.');
  set('antipatia-simpatia',part(245,9,34).replace('o ) ',''));
  set('apariencia',[part(245,56,62),part(245,72,80),part(246,2,5)].join(' ').replace('el ) conjuro','el conjuro'));
  const animated='Objeto animado. Autómata Enorme o más pequeño, sin alineamiento. CA 15. PG 10 (Mediano o menor), 20 (Grande) o 40 (Enorme). Velocidad 9 m. FUE 16, DES 10, CON 10, INT 3, SAB 3, CAR 1. Inmune a daño psíquico y veneno y a asustado, cansancio, envenenado, hechizado y paralizado. Visión ciega 9 m; Percepción pasiva 6. Entiende tus idiomas; BC igual al tuyo.\nGolpe: ataque cuerpo a cuerpo con tu bonificador de ataque de conjuros, alcance 1,5 m. Daño de fuerza: 1d4 + 3 (Mediano o menor); 2d6 + 3 + tu modificador por aptitud mágica (Grande); 2d12 + 3 + tu modificador por aptitud mágica (Enorme).';
  find('animar-objetos').description+='\n'+animated;
  set('invocar-aberracion',part(298,38,53)+'\nEspíritu aberrante. Aberración Mediana, neutral. CA 11 + nivel del conjuro. PG 40 + 10 por cada nivel del conjuro por encima de 4. Velocidad 9 m; volar 9 m (levitar, solo contemplador). FUE 16, DES 10, CON 15, INT 16, SAB 10, CAR 6. Inmune a daño psíquico. Visión en la oscuridad 18 m; Percepción pasiva 10. Habla de las profundidades y entiende tus idiomas; BC igual al tuyo.\nAura susurrante (azotamentes): al comenzar su turno, si no está incapacitado, las criaturas excepto tú a 1,5 m hacen una salvación de Sabiduría contra tu CD de conjuros; si fallan sufren 2d6 psíquico. Regeneración (slaad): recupera 5 PG al inicio de su turno si tiene al menos 1 PG.\nAtaque múltiple: tantos ataques como la mitad del nivel del conjuro, redondeada hacia abajo. Todos usan tu bonificador de ataque de conjuros. Rayo ocular (contemplador): ataque a distancia, alcance 45 m, daño psíquico 1d8 + 3 + nivel del conjuro. Garra (slaad): cuerpo a cuerpo, alcance 1,5 m, daño cortante 1d10 + 3 + nivel del conjuro; impide recuperar PG hasta el principio del siguiente turno del espíritu. Golpe psíquico (azotamentes): cuerpo a cuerpo, alcance 1,5 m, daño psíquico 1d8 + 3 + nivel del conjuro.');
  set('invocar-automata',part(299,51,68)+'\nEspíritu autómata. Autómata Mediano, neutral. CA 13 + nivel del conjuro. PG 40 + 15 por cada nivel del conjuro por encima de 4. Velocidad 9 m. FUE 18, DES 10, CON 18, INT 14, SAB 11, CAR 5. Resiste veneno; inmune a asustado, cansancio, envenenado, hechizado y paralizado. Visión en la oscuridad 18 m; Percepción pasiva 10. Entiende tus idiomas; BC igual al tuyo.\nCuerpo abrasador (metal): una criatura que lo acierte cuerpo a cuerpo o comience su turno en un agarre con él sufre 1d10 de fuego. Letargo pétreo (piedra): al inicio del turno de una criatura visible a 3 m, puede exigir salvación de Sabiduría contra tu CD de conjuros; si falla, no hace ataques de oportunidad y su velocidad se reduce a la mitad hasta el principio de su siguiente turno.\nAtaque múltiple: tantos golpes como la mitad del nivel del conjuro, redondeada hacia abajo. Golpe: tu bonificador de ataque de conjuros, alcance 1,5 m; daño contundente 1d8 + 4 + nivel del conjuro.\nAzote berserk (arcilla), reacción al recibir daño de una criatura: golpea a esa criatura si puede o se mueve hasta la mitad de su velocidad hacia ella sin provocar ataques de oportunidad.');
  set('invocar-celestial',find('invocar-celestial').description.split(' (VENGADOR)')[0]+'\nEspíritu celestial. Celestial Grande, neutral. CA 11 + nivel del conjuro, +2 si es defensor. PG 40 + 10 por cada nivel del conjuro por encima de 5. Velocidad 9 m; volar 12 m. FUE 16, DES 14, CON 16, INT 10, SAB 14, CAR 16. Resiste radiante; inmune a asustado y hechizado. Visión en la oscuridad 18 m; Percepción pasiva 12. Habla celestial y entiende tus idiomas; BC igual al tuyo.\nAtaque múltiple: tantos ataques como la mitad del nivel del conjuro, redondeada hacia abajo. Maza radiante (defensor): tu bonificador de ataque de conjuros, alcance 1,5 m; daño radiante 1d10 + 3 + nivel del conjuro. Él u otra criatura visible a 3 m del objetivo gana 1d10 PG temporales. Arco radiante (vengador): tu bonificador de ataque de conjuros, alcance 180 m; daño radiante 2d6 + 2 + nivel del conjuro.\nToque sanador, una vez al día: otra criatura que toque recupera 2d8 + nivel del conjuro PG.');
  set('invocar-dragon',part(301,8,21)+'\nEspíritu dracónico. Dragón Grande, neutral. CA 14 + nivel del conjuro. PG 50 + 10 por cada nivel del conjuro por encima de 5. Velocidad 9 m; nadar 9 m; volar 18 m. FUE 19, DES 14, CON 17, INT 10, SAB 14, CAR 14. Resiste ácido, frío, fuego, relámpago y veneno; inmune a asustado, envenenado y hechizado. Visión ciega 9 m, visión en la oscuridad 18 m; Percepción pasiva 12. Habla dracónico y entiende tus idiomas; BC igual al tuyo.\nResistencias compartidas: al invocarlo, eliges una de sus resistencias y la recibes hasta que termine el conjuro. Ataque múltiple: tantos desgarros como la mitad del nivel del conjuro, redondeada hacia abajo, y su ataque de aliento. Desgarro: tu bonificador de ataque de conjuros, alcance 3 m, daño perforante 1d6 + 4 + nivel del conjuro. Aliento: todas las criaturas en un cono de 9 m hacen una salvación de Destreza contra tu CD de conjuros; si fallan sufren 2d6 de un tipo al que el espíritu sea resistente, elegido al lanzar el conjuro; si la superan, la mitad.');
  set('invocar-muerto-viviente',find('invocar-muerto-viviente').description.replace('143 + 3','1d8 + 3'));
  set('hallar-corcel',part(292,32,56)+'\nCorcel sobrenatural. Celestial, feérico o infernal Grande, neutral. CA 10 + nivel del conjuro. PG 5 + 10 por nivel del conjuro; tantos d10 de golpe como nivel del conjuro. Velocidad 18 m; volar 18 m si el conjuro es de nivel 4 o superior. FUE 18, DES 12, CON 14, INT 6, SAB 12, CAR 8. Percepción pasiva 11. Telepatía contigo hasta 1,5 km; BC igual al tuyo.\nVínculo vital: si recuperas PG mediante un conjuro de nivel 1 o superior y estás a 1,5 m del corcel, él recupera la misma cantidad.\nGolpetazo sobrenatural: tu bonificador de ataque de conjuros, alcance 1,5 m; daño 1d8 + nivel del conjuro, radiante (celestial), psíquico (feérico) o necrótico (infernal).\nAcciones adicionales, cada una disponible solo para su tipo y recuperada tras descanso largo: Mirada siniestra (infernal): una criatura visible a 18 m hace una salvación de Sabiduría contra tu CD de conjuros; si falla queda asustada hasta el final de tu siguiente turno. Paso feérico (feérico): se teletransporta con su jinete a un espacio sin ocupar elegido a 18 m del corcel. Toque sanador (celestial): una criatura a 1,5 m recupera 2d8 + nivel del conjuro PG.');
  set('insecto-gigante',part(297,7,13)+' '+part(297,50,58)+'\nInsecto gigante. Bestia Grande, sin alineamiento. CA 11 + nivel del conjuro. PG 30 + 10 por cada nivel del conjuro por encima de 4. Velocidad 12 m; trepar 12 m; volar 12 m solo si es avispa. FUE 17 (+3), DES 13 (+1), CON 15 (+2), INT 4 (−3), SAB 14 (+2), CAR 3 (−4); salvaciones con esos mismos modificadores. Visión en la oscuridad 18 m; Percepción pasiva 12. Entiende tus idiomas; BC igual al tuyo.\nTrepar cual arácnido: recorre superficies difíciles y techos sin pruebas. Ataque múltiple: tantos ataques como la mitad del nivel del conjuro, redondeada hacia abajo. Los ataques usan tu bonificador de ataque de conjuros. Punzada venenosa: cuerpo a cuerpo, alcance 3 m, daño perforante 1d6 + 3 + nivel del conjuro más 1d4 de veneno. Proyectil de telarañas (araña): distancia 18 m, daño contundente 1d10 + 3 + nivel del conjuro; velocidad del objetivo 0 hasta el principio del siguiente turno del insecto.\nEscupitajo venenoso (ciempiés), acción adicional: una criatura visible a 3 m hace una salvación de Constitución contra tu CD de conjuros; si falla queda envenenada hasta el principio del siguiente turno del insecto.');
}

// Correcciones puntuales de celdas OCR; no se infieren niveles de texto libre.
export function repairClassContent(result) {
  const feature = (cls, id) => {
    const c=result.classes.find((c)=>c.id===cls);
    const f=[...c.features,...c.subclasses.flatMap((s)=>s.features)].find((f)=>f.id===id);
    if(!f)throw new Error(`Falta el rasgo contrastado ${cls}:${id}.`);
    return f;
  };
  const changes = [
    ['brujo','3-conjuros-del-celestial', [['revivir Guardián','revivir 7 Guardián'],['e) Invocar celestial','9 Invocar celestial']]],
    ['brujo','3-conjuros-del-infernal', [[') Geas','9 Geas']]],
    ['clerigo','3-conjuros-del-dominio-del-engano', [['y Confusión','7 Confusión']]],
    ['druida','3-conjuros-del-circulo-de-la-luna', [['> Conjurar animales','5 Conjurar animales']]],
    ['druida','3-conjuros-del-circulo-de-la-tierra', [['a) Tormenta de hielo Cono','7 Tormenta de hielo 9 Cono'],['2) Agarre','3 Agarre'],['as Relámpago','5 Relámpago']]],
    ['explorador','3-conjuros-de-acechador', [['EN LA PENUMBRA Cuando','Cuando'],['E Terror','9 Terror'],['1 Apariencia','17 Apariencia']]],
    ['explorador','3-conjuros-de-errante-feerico', [['AA Puerta dimensional Engañar','13 Puerta dimensional 17 Engañar']]],
    ['hechicero','3-conjuros-psionicos', [['E Brazos','3 Brazos'],['Y Invocar aberración','7 Invocar aberración']]],
    ['hechicero','3-conjuros-draconicos', [['2 Aliento de dragón','3 Aliento de dragón']]],
    ['paladin','3-conjuros-del-juramento-de-venganza', [['ol Acelerar','9 Acelerar']]],
    ['hechicero','14-trance-de-orden', [['el 420','el d20']]],
    ['bardo','1-inspiracion-bardica', [['al 420','al d20'],['un dl0','un d10']]],
    ['guerrero','10-supremacia-en-combate-mejorada', [['un dl0','un d10']]],
    ['monje','3-artes-sombrias', [['truco ilu:','truco ilusión menor.'],[' n menor.','']]],
  ];
  for(const [cls,id,replacements] of changes) {
    const f=feature(cls,id);
    for(const [from,to] of replacements) {
      if(!f.description.includes(from))throw new Error(`Cambió la celda OCR de ${cls}:${id}: ${from}`);
      f.description=f.description.replace(from,to);
    }
  }
  feature('explorador','3-conjuros-de-acechador').name='Conjuros de acechador en la penumbra';
  const archery=result.feats.find((f)=>f.id==='tiro-con-arco');
  archery.description=archery.description.split(' DOTES DE DON ÉPICO')[0];
}
