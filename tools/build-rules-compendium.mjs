import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2] ?? '.tmp/manual-raw.txt';
const output = process.argv[3] ?? 'public/data/rules.json';
const pages = fs.readFileSync(input, 'utf8').split('\f');

const clean = (value) => value.replace(/\s+/g, ' ').trim();
const title = (value) => {
  const lower = value.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
};
const slug = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function previousHeading(lines, index) {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 4); cursor -= 1) {
    const candidate = clean(lines[cursor]);
    if (
      candidate &&
      candidate.length < 70 &&
      !candidate.startsWith('CAPÍTULO') &&
      !/^\d+$/.test(candidate)
    ) {
      return title(candidate.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/, ''));
    }
  }
  return '';
}

function field(lines, start, label) {
  for (let index = start; index < Math.min(lines.length, start + 14); index += 1) {
    const line = clean(lines[index]);
    if (line.startsWith(label)) {
      return clean(line.slice(label.length));
    }
  }
  return '—';
}

function extractDescriptions(startPage, endPage, metadata, maxJoin, marker) {
  const lines = pages
    .slice(startPage - 1, endPage)
    .flatMap((page) => page.split(/\r?\n/));
  const starts = [];

  for (let index = 0; index < lines.length; index += 1) {
    let match;
    let consumed = 1;

    for (let length = 1; length <= maxJoin; length += 1) {
      const candidate = clean(lines.slice(index, index + length).join(' '));
      match = metadata
        .map((pattern) => candidate.match(pattern))
        .find(Boolean);
      if (match) {
        consumed = length;
        break;
      }
    }

    if (!match) continue;
    const name = previousHeading(lines, index);
    if (!name || starts.some((entry) => entry.id === slug(name))) continue;

    starts.push({
      id: slug(name),
      headingIndex: Math.max(0, index - 1),
      metadataIndex: index,
      bodyStart: index + consumed,
    });
  }

  return new Map(
    starts.map((entry, index) => {
      const end = starts[index + 1]?.headingIndex ?? lines.length;
      let bodyStart = entry.bodyStart;

      if (marker) {
        const markerIndex = lines
          .slice(entry.metadataIndex, Math.min(end, entry.metadataIndex + 24))
          .findIndex((line) => clean(line).startsWith(marker));
        if (markerIndex >= 0) {
          bodyStart = entry.metadataIndex + markerIndex + 1;
        }
      }

      const description = lines
        .slice(bodyStart, end)
        .map(clean)
        .filter(Boolean)
        .filter((line) => !line.startsWith('CAPÍTULO '))
        .filter((line) => !/^\d+\s+CAPÍTULO /.test(line))
        .filter((line) => !/^\d+$/.test(line))
        .join(' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim();

      return [entry.id, description];
    })
  );
}

function parseSpells() {
  const spells = [];
  const descriptionOverrides = new Map([
    [
      'castigo-atronador',
      'Tu golpe resuena con un trueno audible a 90 m de ti y el objetivo sufre 2d6 de daño de trueno adicional del ataque. Además, si el objetivo es una criatura, deberá superar una tirada de salvación de Fuerza o la empujarás 3 m respecto a ti y tendrá el estado de derribada. Con un espacio de conjuro de nivel superior, el daño aumenta en 1d6 por cada nivel por encima de 1 que tenga el espacio.',
    ],
  ]);
  const metadata = [
    /^(?<school>Abjuración|Adivinación|Conjuración|Encantamiento|Evocación|Ilusión|Ilusionismo|Nigromancia|Transmutación) de nivel (?<level>\d+) \((?<classes>[^)]+)\)$/i,
    /^Truco de (?<school>abjuración|adivinación|conjuración|encantamiento|evocación|ilusión|ilusionismo|nigromancia|transmutación) \((?<classes>[^)]+)\)$/i,
  ];

  for (let pageNumber = 241; pageNumber <= 345; pageNumber += 1) {
    const lines = pages[pageNumber - 1].split(/\r?\n/);
    lines.forEach((rawLine, index) => {
      const line = clean(rawLine);
      const joined = clean(`${rawLine} ${lines[index + 1] ?? ''}`);
      const match =
        line.match(metadata[0]) ??
        line.match(metadata[1]) ??
        joined.match(metadata[0]) ??
        joined.match(metadata[1]);
      if (!match?.groups) return;

      const name = previousHeading(lines, index);
      if (!name || spells.some((spell) => spell.name === name)) return;

      const level = match.groups.level ? Number(match.groups.level) : 0;
      const school =
        title(match.groups.school) === 'Ilusionismo'
          ? 'Ilusión'
          : title(match.groups.school);
      const classes = match.groups.classes.split(',').map((entry) => title(clean(entry)));
      spells.push({
        id: slug(name),
        name,
        summary:
          level === 0
            ? `Truco de ${school.toLocaleLowerCase('es')} disponible para ${classes.join(', ')}.`
            : `Conjuro de ${school.toLocaleLowerCase('es')} de nivel ${level} disponible para ${classes.join(', ')}.`,
        tags: ['Hechizo', level === 0 ? 'Truco' : `Nivel ${level}`, school, ...classes],
        sourcePage: pageNumber - 2,
        level,
        school,
        classes,
        castingTime: field(lines, index + 1, 'Tiempo de lanzamiento:'),
        range: field(lines, index + 1, 'Alcance:'),
        components: field(lines, index + 1, 'Componentes:'),
        duration: field(lines, index + 1, 'Duración:'),
      });
    });
  }

  const descriptions = extractDescriptions(
    241,
    345,
    metadata,
    2,
    'Duración:'
  );

  for (const spell of spells) {
    spell.description =
      descriptionOverrides.get(spell.id) ??
      descriptions.get(spell.id) ??
      'Consulta la pagina indicada para la descripcion completa del conjuro.';
  }

  return spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'));
}

function parseFeats() {
  const feats = [];
  const metadata = /^(Dote de origen|Dote general|Dote de estilo de combate|Dote de don épico|Don épico)(?: \((?:requisitos?|requisito): (.+)\))?$/i;
  const repeatable = new Set([
    'Habilidoso',
    'Iniciado en la magia',
    'Mejora de característica',
    'Versado en un elemento',
  ]);

  for (let pageNumber = 202; pageNumber <= 213; pageNumber += 1) {
    const lines = pages[pageNumber - 1].split(/\r?\n/);
    lines.forEach((rawLine, index) => {
      const line = clean(rawLine);
      const candidates = [
        line,
        clean(`${rawLine} ${lines[index + 1] ?? ''}`),
        clean(
          `${rawLine} ${lines[index + 1] ?? ''} ${lines[index + 2] ?? ''}`
        ),
      ];
      const match = candidates.map((candidate) => candidate.match(metadata)).find(Boolean);
      if (!match) return;

      const name = previousHeading(lines, index);
      if (!name || feats.some((feat) => feat.name === name)) return;

      let category = title(match[1]);
      if (category === 'Don épico') category = 'Dote de don épico';
      feats.push({
        id: slug(name),
        name,
        summary: `${category} para personalizar las capacidades del personaje. Consulta sus beneficios en la pagina indicada.`,
        tags: ['Dote', category],
        sourcePage: pageNumber - 2,
        category,
        ...(match[2] ? { requirements: clean(match[2]) } : {}),
        repeatable: repeatable.has(name),
      });
    });
  }

  const descriptions = extractDescriptions(
    202,
    213,
    [metadata],
    3
  );

  for (const feat of feats) {
    feat.description =
      descriptions.get(feat.id) ??
      'Consulta la pagina indicada para la descripcion completa de la dote.';
  }

  return feats.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

const skillRows = [
  ['Acrobacias', 'Destreza', 'Mantener el equilibrio', 'Realizar maniobras acrobaticas'],
  ['Atletismo', 'Fuerza', 'Trepar, saltar o nadar', 'Forzar movimiento fisico'],
  ['Conocimiento arcano', 'Inteligencia', 'Recordar saber magico', 'Identificar efectos arcanos'],
  ['Engaño', 'Carisma', 'Ocultar la verdad', 'Mantener una identidad falsa'],
  ['Historia', 'Inteligencia', 'Recordar hechos historicos', 'Reconocer culturas y conflictos'],
  ['Interpretación', 'Carisma', 'Actuar ante un publico', 'Entretener o emocionar'],
  ['Intimidación', 'Carisma', 'Presionar mediante amenazas', 'Forzar una concesion'],
  ['Investigación', 'Inteligencia', 'Deducir a partir de pistas', 'Registrar una escena'],
  ['Juego de Manos', 'Destreza', 'Manipular objetos discretamente', 'Robar o esconder algo'],
  ['Medicina', 'Sabiduría', 'Estabilizar a una criatura', 'Diagnosticar heridas o enfermedades'],
  ['Naturaleza', 'Inteligencia', 'Recordar saber natural', 'Reconocer fauna, flora y terreno'],
  ['Percepción', 'Sabiduría', 'Advertir detalles del entorno', 'Detectar una presencia oculta'],
  ['Perspicacia', 'Sabiduría', 'Leer intenciones', 'Reconocer mentiras o cambios de animo'],
  ['Persuasión', 'Carisma', 'Influir con buena fe', 'Negociar o solicitar ayuda'],
  ['Religión', 'Inteligencia', 'Recordar saber religioso', 'Reconocer ritos, dioses y simbolos'],
  ['Sigilo', 'Destreza', 'Moverse sin ser detectado', 'Ocultarse'],
  ['Supervivencia', 'Sabiduría', 'Seguir rastros', 'Orientarse y buscar recursos'],
  ['Trato con Animales', 'Sabiduría', 'Calmar o guiar animales', 'Interpretar su conducta'],
];

const skills = skillRows.map(([name, ability, ...uses]) => ({
  id: slug(name),
  name,
  summary: `Habilidad de ${ability} para ${uses[0].toLocaleLowerCase('es')}.`,
  tags: ['Habilidad', ability],
  sourcePage: 14,
  ability,
  uses,
  description: `${name} representa la capacidad de ${uses[0].toLocaleLowerCase('es')} y de ${uses[1].toLocaleLowerCase('es')}. El DM puede pedir una prueba de ${ability} (${name}) cuando el resultado sea incierto y exista una consecuencia relevante.`,
}));

const weaponRows = [
  ['Bastón', 'Sencilla cuerpo a cuerpo', '2 pp', '2 kg', '1d6 contundente', 'Versatil (1d8)'],
  ['Daga', 'Sencilla cuerpo a cuerpo', '2 po', '0,5 kg', '1d4 perforante', 'Arrojadiza, ligera, sutil'],
  ['Garrote', 'Sencilla cuerpo a cuerpo', '1 pp', '1 kg', '1d4 contundente', 'Ligera'],
  ['Garrote grande', 'Sencilla cuerpo a cuerpo', '2 pp', '5 kg', '1d8 contundente', 'A dos manos'],
  ['Hacha de mano', 'Sencilla cuerpo a cuerpo', '5 po', '1 kg', '1d6 cortante', 'Arrojadiza, ligera'],
  ['Hoz', 'Sencilla cuerpo a cuerpo', '1 po', '1 kg', '1d4 cortante', 'Ligera'],
  ['Jabalina', 'Sencilla cuerpo a cuerpo', '5 pp', '1 kg', '1d6 perforante', 'Arrojadiza'],
  ['Lanza', 'Sencilla cuerpo a cuerpo', '1 po', '1,5 kg', '1d6 perforante', 'Arrojadiza, versatil (1d8)'],
  ['Martillo ligero', 'Sencilla cuerpo a cuerpo', '2 po', '1 kg', '1d4 contundente', 'Arrojadiza, ligera'],
  ['Maza', 'Sencilla cuerpo a cuerpo', '5 po', '2 kg', '1d6 contundente', 'Debilitar'],
  ['Arco corto', 'Sencilla a distancia', '25 po', '1 kg', '1d6 perforante', 'Municion, a dos manos'],
  ['Ballesta ligera', 'Sencilla a distancia', '25 po', '2,5 kg', '1d8 perforante', 'Municion, recarga, a dos manos'],
  ['Dardo', 'Sencilla a distancia', '5 pc', '0,125 kg', '1d4 perforante', 'Arrojadizo, sutil'],
  ['Honda', 'Sencilla a distancia', '1 pp', '', '1d4 contundente', 'Municion'],
  ['Alabarda', 'Marcial cuerpo a cuerpo', '20 po', '3 kg', '1d10 cortante', 'Pesada, gran alcance, a dos manos'],
  ['Cimitarra', 'Marcial cuerpo a cuerpo', '25 po', '1,5 kg', '1d6 cortante', 'Ligera, sutil'],
  ['Espada corta', 'Marcial cuerpo a cuerpo', '10 po', '1 kg', '1d6 perforante', 'Ligera, sutil'],
  ['Espada larga', 'Marcial cuerpo a cuerpo', '15 po', '1,5 kg', '1d8 cortante', 'Versatil (1d10)'],
  ['Espadón', 'Marcial cuerpo a cuerpo', '50 po', '3 kg', '2d6 cortante', 'Pesada, a dos manos'],
  ['Estoque', 'Marcial cuerpo a cuerpo', '25 po', '1 kg', '1d8 perforante', 'Sutil'],
  ['Guja', 'Marcial cuerpo a cuerpo', '20 po', '3 kg', '1d10 cortante', 'Pesada, gran alcance, a dos manos'],
  ['Hacha a dos manos', 'Marcial cuerpo a cuerpo', '30 po', '3,5 kg', '1d12 cortante', 'Pesada, a dos manos'],
  ['Hacha de guerra', 'Marcial cuerpo a cuerpo', '10 po', '2 kg', '1d8 cortante', 'Versatil (1d10)'],
  ['Lanza de caballería', 'Marcial cuerpo a cuerpo', '10 po', '3 kg', '1d10 perforante', 'Pesada, gran alcance'],
  ['Látigo', 'Marcial cuerpo a cuerpo', '2 po', '1,5 kg', '1d4 cortante', 'Gran alcance, sutil'],
  ['Lucero del alba', 'Marcial cuerpo a cuerpo', '15 po', '2 kg', '1d8 perforante', 'Debilitar'],
  ['Mangual', 'Marcial cuerpo a cuerpo', '10 po', '1 kg', '1d8 contundente', 'Debilitar'],
  ['Martillo de guerra', 'Marcial cuerpo a cuerpo', '15 po', '2,5 kg', '1d8 contundente', 'Versatil (1d10)'],
  ['Maza a dos manos', 'Marcial cuerpo a cuerpo', '10 po', '5 kg', '2d6 contundente', 'Pesada, a dos manos'],
  ['Pica', 'Marcial cuerpo a cuerpo', '5 po', '9 kg', '1d10 perforante', 'Pesada, gran alcance, a dos manos'],
  ['Pico de guerra', 'Marcial cuerpo a cuerpo', '5 po', '1 kg', '1d8 perforante', 'Debilitar'],
  ['Tridente', 'Marcial cuerpo a cuerpo', '5 po', '2 kg', '1d8 perforante', 'Arrojadizo, versatil (1d10)'],
  ['Arco largo', 'Marcial a distancia', '50 po', '1 kg', '1d8 perforante', 'Municion, pesada, a dos manos'],
  ['Ballesta de mano', 'Marcial a distancia', '75 po', '1,5 kg', '1d6 perforante', 'Ligera, municion, recarga'],
  ['Ballesta pesada', 'Marcial a distancia', '50 po', '9 kg', '1d10 perforante', 'Municion, pesada, recarga, a dos manos'],
  ['Cerbatana', 'Marcial a distancia', '10 po', '0,5 kg', '1 perforante', 'Municion, recarga'],
  ['Mosquete', 'Marcial a distancia', '500 po', '5 kg', '1d12 perforante', 'Municion, recarga, a dos manos'],
  ['Pistola', 'Marcial a distancia', '250 po', '1,5 kg', '1d10 perforante', 'Municion, recarga'],
];

const armorRows = [
  ['Armadura acolchada', 'Armadura ligera', '5 po', '4 kg', 'CA 11 + Des', 'Desventaja en Sigilo'],
  ['Armadura de cuero', 'Armadura ligera', '10 po', '5 kg', 'CA 11 + Des', ''],
  ['Armadura de cuero tachonado', 'Armadura ligera', '45 po', '6,5 kg', 'CA 12 + Des', ''],
  ['Armadura de pieles', 'Armadura media', '10 po', '6 kg', 'CA 12 + Des (max. 2)', ''],
  ['Camisa de malla', 'Armadura media', '50 po', '10 kg', 'CA 13 + Des (max. 2)', ''],
  ['Cota de escamas', 'Armadura media', '50 po', '22,5 kg', 'CA 14 + Des (max. 2)', 'Desventaja en Sigilo'],
  ['Coraza', 'Armadura media', '400 po', '10 kg', 'CA 14 + Des (max. 2)', ''],
  ['Media armadura', 'Armadura media', '750 po', '20 kg', 'CA 15 + Des (max. 2)', 'Desventaja en Sigilo'],
  ['Cota guarnecida', 'Armadura pesada', '30 po', '20 kg', 'CA 14', 'Desventaja en Sigilo'],
  ['Cota de malla', 'Armadura pesada', '75 po', '27,5 kg', 'CA 16', 'Fue 13; desventaja en Sigilo'],
  ['Armadura de bandas', 'Armadura pesada', '200 po', '30 kg', 'CA 17', 'Fue 15; desventaja en Sigilo'],
  ['Armadura de placas', 'Armadura pesada', '1500 po', '32,5 kg', 'CA 18', 'Fue 15; desventaja en Sigilo'],
  ['Escudo', 'Escudo', '10 po', '3 kg', '+2 a la CA', 'Requiere entrenamiento con escudos'],
];

const adventureRows = [
  ['Abrojos', 'Equipo de aventura', '1 po', '1 kg', 'Controlan una casilla y pueden reducir el movimiento'],
  ['Antorcha', 'Equipo de aventura', '1 pc', '0,5 kg', 'Ilumina y puede usarse como arma improvisada'],
  ['Cuerda', 'Equipo de aventura', '1 po', '5 kg', '15 m de cuerda'],
  ['Mochila', 'Equipo de aventura', '2 po', '2,5 kg', 'Contenedor para provisiones'],
  ['Petate', 'Equipo de aventura', '1 po', '3,5 kg', 'Equipo para descansar durante un viaje'],
  ['Raciones', 'Equipo de aventura', '5 pp', '1 kg', 'Alimento para un dia'],
  ['Tienda', 'Equipo de aventura', '2 po', '10 kg', 'Refugio para dos criaturas'],
  ['Yesca', 'Equipo de aventura', '5 pp', '0,5 kg', 'Permite encender fuego'],
  ['Cantimplora', 'Equipo de aventura', '2 pp', '2,5 kg', 'Transporta agua'],
  ['Garfio de escalada', 'Equipo de aventura', '2 po', '2 kg', 'Ayuda a fijar una cuerda'],
  ['Palanca', 'Equipo de aventura', '2 po', '2,5 kg', 'Ayuda a forzar objetos'],
  ['Linterna', 'Equipo de aventura', '5 po', '1 kg', 'Proporciona iluminacion dirigida'],
  ['Aceite', 'Equipo de aventura', '1 pp', '0,5 kg', 'Combustible inflamable'],
  ['Esposas', 'Equipo de aventura', '2 po', '3 kg', 'Restringen a una criatura Pequeña o Mediana'],
  ['Útiles de sanador', 'Equipo de aventura', '5 po', '1,5 kg', 'Diez usos para estabilizar o aplicar la dote Sanador'],
  ['Agua bendita', 'Equipo de aventura', '25 po', '0,5 kg', 'Daña a ciertos infernales y muertos vivientes'],
  ['Símbolo sagrado', 'Canalizador mágico', '5 po', '0,5 kg', 'Canalizador para conjuros divinos'],
  ['Foco arcano', 'Canalizador mágico', '10 po', '0,5 kg', 'Canalizador para conjuros arcanos'],
  ['Foco druídico', 'Canalizador mágico', '5 po', '0,5 kg', 'Canalizador para conjuros primigenios'],
  ['Libro de conjuros', 'Equipo de aventura', '50 po', '1,5 kg', 'Contiene los conjuros de un mago'],
  ['Saquito de componentes', 'Canalizador mágico', '25 po', '1 kg', 'Sustituye componentes materiales sin coste indicado'],
  ['Mapa', 'Equipo de aventura', '1 po', '', 'Representacion de una zona o ruta'],
  ['Papel', 'Equipo de aventura', '2 pp', '', 'Hoja para notas y documentos'],
  ['Tinta', 'Equipo de aventura', '10 po', '', 'Frasco para escritura'],
  ['Campana', 'Equipo de aventura', '1 po', '', 'Produce una señal audible'],
];

const toolRows = [
  ['Herramientas de ladrón', 'Herramienta', '25 po', '0,5 kg', 'Abrir cerraduras y desactivar trampas'],
  ['Kit de disfraz', 'Herramienta', '25 po', '1,5 kg', 'Crear o aplicar un disfraz'],
  ['Kit de falsificación', 'Herramienta', '15 po', '2,5 kg', 'Imitar documentos y sellos'],
  ['Kit de herboristería', 'Herramienta', '5 po', '1,5 kg', 'Identificar y preparar plantas'],
  ['Kit de venenos', 'Herramienta', '50 po', '1 kg', 'Crear y manipular venenos'],
  ['Herramientas de herrero', 'Herramienta de artesano', '20 po', '4 kg', 'Trabajar y reparar metal'],
  ['Herramientas de carpintero', 'Herramienta de artesano', '8 po', '3 kg', 'Construir y reparar objetos de madera'],
  ['Herramientas de cartógrafo', 'Herramienta de artesano', '15 po', '3 kg', 'Crear y estudiar mapas'],
  ['Instrumento musical', 'Instrumento', 'Variable', '', 'Interpretar musica'],
  ['Útiles de navegante', 'Herramienta', '25 po', '1 kg', 'Orientarse y trazar rutas'],
];

const equipment = [...weaponRows, ...armorRows, ...adventureRows, ...toolRows].map(
  ([name, category, cost, weight, ...properties]) => ({
    id: slug(name),
    name,
    summary: `${category} del Manual del Jugador 2024.`,
    tags: ['Equipo', category],
    sourcePage: category.includes('Arma') || category.includes('Sencilla') || category.includes('Marcial') ? 215 : category.includes('Armadura') || category === 'Escudo' ? 219 : category.includes('Herramienta') || category === 'Instrumento' ? 220 : 224,
    category,
    cost,
    ...(weight ? { weight } : {}),
    properties: properties.filter(Boolean),
    description: `${name} es ${category.toLocaleLowerCase('es')}. ${properties.filter(Boolean).join('. ')}. Precio habitual: ${cost}${weight ? `; peso: ${weight}` : ''}.`,
  })
);

const classDefinitions = [
  {
    name: 'Bárbaro',
    primaryAbility: 'Fuerza',
    hitDie: 'd12',
    summary: 'Combatiente primigenio que convierte su furia en resistencia, movilidad y fuerza devastadora.',
  },
  {
    name: 'Bardo',
    primaryAbility: 'Carisma',
    hitDie: 'd8',
    summary: 'Artista mágico que inspira a sus aliados y domina conjuros, habilidades y secretos de otras tradiciones.',
  },
  {
    name: 'Brujo',
    primaryAbility: 'Carisma',
    hitDie: 'd8',
    summary: 'Portador de magia pactada que combina invocaciones sobrenaturales con espacios de conjuro recuperables.',
  },
  {
    name: 'Clérigo',
    primaryAbility: 'Sabiduría',
    hitDie: 'd8',
    summary: 'Canalizador de poder divino capaz de sanar, proteger y expulsar a los muertos vivientes.',
  },
  {
    name: 'Druida',
    primaryAbility: 'Sabiduría',
    hitDie: 'd8',
    summary: 'Guardián de la naturaleza que emplea magia primigenia y adopta formas salvajes.',
  },
  {
    name: 'Explorador',
    primaryAbility: 'Destreza y Sabiduría',
    hitDie: 'd10',
    summary: 'Cazador y superviviente que une destreza marcial, rastreo y magia de la naturaleza.',
  },
  {
    name: 'Guerrero',
    primaryAbility: 'Fuerza o Destreza',
    hitDie: 'd10',
    summary: 'Especialista marcial versátil con gran dominio de armas, tácticas y ataques sucesivos.',
  },
  {
    name: 'Hechicero',
    primaryAbility: 'Carisma',
    hitDie: 'd6',
    summary: 'Lanzador cuya magia innata puede transformarse mediante puntos de hechicería y metamagia.',
  },
  {
    name: 'Mago',
    primaryAbility: 'Inteligencia',
    hitDie: 'd6',
    summary: 'Erudito de la magia arcana con un amplio libro de conjuros y una preparación flexible.',
  },
  {
    name: 'Monje',
    primaryAbility: 'Destreza y Sabiduría',
    hitDie: 'd8',
    summary: 'Artista marcial que concentra su energía para atacar, desplazarse y defenderse de forma extraordinaria.',
  },
  {
    name: 'Paladín',
    primaryAbility: 'Fuerza y Carisma',
    hitDie: 'd10',
    summary: 'Guerrero sagrado que combina armas, auras protectoras, curación y castigos divinos.',
  },
  {
    name: 'Pícaro',
    primaryAbility: 'Destreza',
    hitDie: 'd8',
    summary: 'Especialista preciso y escurridizo que explota aperturas mediante su ataque furtivo.',
  },
];

function normalizedSource(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function classFeatureHeading(line) {
  const normalized = normalizedSource(line);
  const match = normalized.match(/^N[A-Z1]{1,5}EL\s+([0-9LI]+):\s*(.+)$/);
  if (!match) return undefined;

  const level = Number(match[1].replace(/[LI]/g, '1'));
  if (!Number.isInteger(level) || level < 1 || level > 20) return undefined;

  const rawTail = clean(line.slice(line.indexOf(':') + 1));
  const descriptionStart = rawTail.search(
    /\s(?=(?:Has|Puedes|Cuando|Tu|Tus|Obtienes|Aprendes|Desentierra|Consigues|Eres|Ganas)\b)/
  );
  const name = clean(
    descriptionStart < 0 ? rawTail : rawTail.slice(0, descriptionStart)
  );

  return {
    level,
    name: title(name),
    inlineDescription:
      descriptionStart < 0 ? '' : clean(rawTail.slice(descriptionStart)),
  };
}

function shortenDescription(value, maxLength = 1800) {
  const description = clean(value);
  if (description.length <= maxLength) return description;

  const sentenceEnd = Math.max(
    description.lastIndexOf('. ', maxLength),
    description.lastIndexOf(': ', maxLength)
  );
  const end = sentenceEnd > maxLength * 0.65 ? sentenceEnd + 1 : maxLength;
  return `${description.slice(0, end).trim()}…`;
}

function parseClasses() {
  const records = pages.flatMap((page, pageIndex) =>
    page.split(/\r?\n/).map((line) => ({
      line,
      page: pageIndex + 1,
    }))
  );

  return classDefinitions.map((definition) => {
    const className = normalizedSource(definition.name);
    const start = records.findIndex((record) => {
      const line = normalizedSource(record.line);
      return line.includes('RASGOS DE CLASE') && line.includes(className);
    });
    const end = records.findIndex((record, index) => {
      if (index <= start) return false;
      return normalizedSource(record.line).includes(`SUBCLASES DE ${className}`);
    });

    if (start < 0 || end < 0) {
      throw new Error(`No se pudo localizar la sección de ${definition.name}.`);
    }

    const segment = records.slice(start, end);
    const headings = segment
      .map((record, index) => ({
        ...classFeatureHeading(record.line),
        index,
        page: record.page,
      }))
      .filter((entry) => entry.name);
    const seen = new Set();
    const features = headings
      .map((heading, index) => {
        const next = headings[index + 1]?.index ?? segment.length;
        const body = segment
          .slice(heading.index + 1, next)
          .map((record) => clean(record.line))
          .filter(Boolean)
          .filter((line) => !line.startsWith('CAPÍTULO '))
          .filter((line) => !/^\d+$/.test(line))
          .join(' ');
        const key = `${heading.level}:${slug(heading.name)}`;
        if (seen.has(key)) return undefined;
        seen.add(key);

        return {
          id: `${heading.level}-${slug(heading.name)}`,
          name: heading.name,
          level: heading.level,
          description: shortenDescription(
            [heading.inlineDescription, body].filter(Boolean).join(' ') ||
              `Rasgo de ${definition.name} obtenido a nivel ${heading.level}.`
          ),
          sourcePage: Math.max(1, heading.page - 2),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'));

    if (definition.name === 'Druida') {
      const druidic = features.find((feature) => feature.name === 'Druípico');
      if (druidic) {
        druidic.id = '1-druidico';
        druidic.name = 'Druídico';
      }
    }

    const supplements = {
      Explorador: [
        {
          id: '1-lanzamiento-de-conjuros',
          name: 'Lanzamiento de conjuros',
          level: 1,
          description:
            'Has aprendido a canalizar la esencia mágica de la naturaleza para lanzar conjuros. Preparas conjuros de la lista de explorador, recuperas los espacios gastados tras un descanso largo y utilizas Sabiduría como aptitud mágica. Puedes emplear un canalizador druídico como canalizador para estos conjuros.',
        },
      ],
      Hechicero: [
        {
          id: '2-fuente-de-magia',
          name: 'Fuente de magia',
          level: 2,
          description:
            'Accedes a una fuente interior representada por puntos de hechicería. Recuperas todos los puntos gastados tras un descanso largo y puedes convertir espacios de conjuro en puntos o transformar puntos sin gastar en espacios de conjuro de hasta nivel 5.',
        },
      ],
    }[definition.name] ?? [];

    for (const feature of supplements) {
      features.push({
        ...feature,
        sourcePage: Math.max(1, records[start].page - 2),
      });
    }
    features.sort(
      (a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es')
    );

    return {
      id: slug(definition.name),
      ...definition,
      sourcePage: Math.max(1, records[start].page - 2),
      features,
    };
  });
}

const result = {
  source: 'Manual del Jugador 2024 (edicion en espanol)',
  edition: 'D&D 5.5 (2024)',
  spells: parseSpells(),
  feats: parseFeats(),
  skills,
  equipment,
  classes: parseClasses(),
  creatures: fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output, 'utf8')).creatures ?? []
    : [],
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(
  `Generado ${output}: ${result.spells.length} hechizos, ${result.feats.length} dotes, ${skills.length} habilidades, ${equipment.length} objetos y ${result.classes.length} clases.`
);
