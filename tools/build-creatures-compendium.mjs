import fs from 'node:fs';

const input = process.argv[2] ?? '.tmp/appendix-b-layout.txt';
const output = process.argv[3] ?? 'public/data/rules.json';
const pages = fs.readFileSync(input, 'utf8').split('\f');

const namesByPage = {
  346: [['Alce', 'Araña'], ['Araña gigante']],
  347: [
    ['Búho', 'Caballito de mar gigante'],
    ['Caballo de guerra', 'Caballo de monta', 'Caballo de tiro'],
  ],
  348: [
    ['Cabra', 'Cabra gigante', 'Camello'],
    ['Cangrejo', 'Cangrejo gigante'],
  ],
  349: [['Cocodrilo', 'Comadreja'], ['Comadreja gigante', 'Cuervo']],
  350: [['Diablillo'], ['Duende', 'Elefante']],
  351: [['Escorpión'], ['Esfinge de las maravillas']],
  352: [['Esqueleto', 'Gato'], ['Halcón', 'Jabalí']],
  353: [['Lagarto', 'León'], ['Lobo', 'Lobo terrible']],
  354: [['Mastín', 'Mula'], ['Murciélago', 'Oso negro']],
  355: [['Oso pardo', 'Pantera'], ['Poni', 'Pseudodragón']],
  356: [['Pulpo'], ['Quasit']],
  357: [['Rana'], ['Rata', 'Renacuajo slaad']],
  358: [['Serpiente constrictora', 'Serpiente venenosa'], ['Simio', 'Tejón']],
  359: [['Tejón gigante', 'Tiburón de arrecife'], ['Tigre', 'Zombi']],
};

const typePattern =
  /(Aberración|Autómata|Bestia|Celestial|Dragón|Elemental|Feérico|Gigante|Humanoide|Infernal|Monstruosidad|Muerto viviente|Planta)\s+(Diminut[oa]|Pequeñ[oa]|Median[oa]|Grande|Enorme|Gargantuesc[oa])/gi;
const sectionNames = new Map([
  ['ATRIBUTOS', 'traits'],
  ['ACCIONES ADICIONALES', 'bonusActions'],
  ['ACCIONES', 'actions'],
  ['REACCIONES', 'reactions'],
]);

const clean = (value) =>
  value
    .replace(/^[\s|\[\]{}()]+/, '')
    .replace(/[|\[\]{}]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const slug = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function rightColumnStart(lines) {
  const positions = [];
  for (const line of lines) {
    typePattern.lastIndex = 0;
    let match;
    while ((match = typePattern.exec(line))) {
      if (match.index > 40) positions.push(match.index);
    }
  }
  return positions.length ? Math.min(...positions) : 80;
}

function creatureStarts(lines) {
  return lines
    .map((line, index) => {
      typePattern.lastIndex = 0;
      return typePattern.test(clean(line)) ? index : -1;
    })
    .filter((index) => index >= 0);
}

function extractSimple(flat, pattern, fallback = '—') {
  return clean(flat.match(pattern)?.[1] ?? fallback);
}

function extractField(lines, label, fallback = '') {
  const index = lines.findIndex((line) =>
    clean(line).toLocaleLowerCase('es').startsWith(`${label.toLocaleLowerCase('es')}:`)
  );
  if (index < 0) return fallback;

  const values = [clean(lines[index]).slice(label.length + 1).trim()];
  const stopPattern = /^(Habilidades|Resistencias|Inmunidades|Equipo|Sentidos|Idiomas|VD|ATRIBUTOS|ACCIONES|REACCIONES|CA:|PG:|Velocidad:|MOD\.|Fue\b|FUE\b|Des\b|DES\b|Con\b|CON\b|Int\b|INT\b|Sab\b|SAB\b|Car\b|CAR\b)/i;

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = clean(lines[cursor]);
    if (stopPattern.test(line)) break;
    values.push(line);
  }

  return clean(values.join(' ')) || fallback;
}

function parseAbilities(flat) {
  const normalized = flat
    .replace(/\bIn[Trv]+/gi, 'Int')
    .replace(/\bSa[mBp]/gi, 'Sab')
    .replace(/\bCoN/gi, 'Con');
  const labels = [
    ['Fue', 'FUE'],
    ['Des', 'DES'],
    ['Con', 'CON'],
    ['Int', 'INT'],
    ['Sab', 'SAB'],
    ['Car', 'CAR'],
  ];

  return labels.map(([key, label]) => {
    const match = normalized.match(new RegExp(`\\b${key}\\s*([0-9Il]+)`, 'i'));
    return {
      label,
      score: match?.[1].replace(/[Il]/g, '1') ?? '—',
    };
  });
}

function parseSections(lines) {
  const result = {
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
  };
  let active;

  for (const rawLine of lines) {
    const line = clean(rawLine);
    const section = Array.from(sectionNames).find(([heading]) =>
      line.startsWith(heading)
    );
    if (section) {
      active = section[1];
      const remainder = clean(line.slice(section[0].length));
      if (remainder) result[active].push(remainder);
      continue;
    }
    if (active && !line.startsWith('APÉNDICE B')) {
      result[active].push(line);
    }
  }

  for (const key of Object.keys(result)) {
    const text = clean(result[key].join(' '));
    result[key] = text ? [text] : [];
  }
  return result;
}

function parseCreature(name, type, lines, sourcePage) {
  const cleanedLines = lines.map(clean).filter(Boolean);
  const flat = clean(cleanedLines.join(' '));
  const sections = parseSections(cleanedLines);

  return {
    id: slug(name),
    name,
    type: clean(type),
    armorClass: extractSimple(flat, /\bCA:\s*(.+?)(?=\s+Iniciativa:|\s+PG:)/i),
    initiative: extractSimple(flat, /\bIniciativa:\s*(.+?)(?=\s+PG:|\s+Velocidad:|\s+MOD\.)/i),
    hitPoints: extractSimple(flat, /\bPG:\s*(.+?)(?=\s+Velocidad:|\s+MOD\.)/i),
    speed: extractSimple(
      flat,
      /\bVelocidad:\s*(.+?)(?=\s+MOD\.|\s+Fue\b|\s+FUE\b|\s+Des\b|\s+DES\b|\s+Con\b|\s+CON\b)/i
    ),
    abilityScores: parseAbilities(flat),
    ...(extractField(cleanedLines, 'Habilidades')
      ? { skills: extractField(cleanedLines, 'Habilidades') }
      : {}),
    ...(extractField(cleanedLines, 'Resistencias')
      ? { resistances: extractField(cleanedLines, 'Resistencias') }
      : {}),
    ...(extractField(cleanedLines, 'Inmunidades')
      ? { immunities: extractField(cleanedLines, 'Inmunidades') }
      : {}),
    ...(extractField(cleanedLines, 'Equipo')
      ? { equipment: extractField(cleanedLines, 'Equipo') }
      : {}),
    senses: extractField(cleanedLines, 'Sentidos', '—'),
    languages: extractField(cleanedLines, 'Idiomas', 'ninguno'),
    challenge: extractSimple(
      flat,
      /\bVD:\s*(.+?)(?=\s+ATRIBUTOS|\s+ACCIONES|\s+REACCIONES|$)/i
    ),
    ...sections,
    sourcePage,
  };
}

const creatures = [];

const profileOverrides = {
  alce: {
    speed: '15 m',
  },
  'cocodrilo': {
    armorClass: '12',
    initiative: '+0 (10)',
    hitPoints: '13 (2d10 + 2)',
    speed: '6 m, nadar 9 m',
    challenge: '1/2 (100 PX; BC +2)',
    traits: ['Aguantar la respiración. El cocodrilo puede aguantar la respiración durante 1 hora.'],
    actions: ['Mordisco. Tirada de ataque cuerpo a cuerpo: +4, alcance 1,5 m. Acierto: 6 (1d8 + 2) de daño perforante. Si el objetivo es Mediano o más pequeño, tendrá el estado de agarrado (CD 12 para escapar) y, mientras esté agarrado, tendrá el estado de apresado.'],
  },
  'comadreja-gigante': {
    challenge: '1/8 (25 PX; BC +2)',
  },
  comadreja: {
    speed: '9 m, trepar 9 m',
  },
  camello: {
    hitPoints: '17 (2d10 + 6)',
    challenge: '1/8 (25 PX; BC +2)',
  },
  'caballito-de-mar-gigante': {
    hitPoints: '16 (3d10)',
  },
  diablillo: {
    speed: '6 m, volar 12 m',
  },
  duende: {
    hitPoints: '10 (4d4)',
    speed: '3 m, volar 12 m',
    challenge: '1/4 (50 PX; BC +2)',
  },
  elefante: {
    challenge: '4 (1100 PX; BC +2)',
    actions: ['Ataque múltiple. El elefante realiza dos ataques con sus colmillos. Colmillos. Tirada de ataque cuerpo a cuerpo: +8, alcance 1,5 m. Acierto: 15 (2d8 + 6) de daño perforante. Si el objetivo es una criatura Enorme o más pequeña y el elefante recorre al menos 6 m en línea recta hacia él justo antes de acertarle, el objetivo tendrá el estado de derribado.'],
    bonusActions: ['Arrollar. Tirada de salvación de Destreza: CD 16, una criatura a 1,5 m o menos que tenga el estado de derribada. Fallo: 17 (2d10 + 6) de daño contundente. Éxito: la mitad del daño.'],
  },
  escorpion: {
    armorClass: '11',
    initiative: '+0 (10)',
    hitPoints: '1 (1d4 - 1)',
    speed: '3 m',
    senses: 'visión ciega 3 m, Percepción pasiva 9',
    languages: 'ninguno',
    challenge: '0 (10 PX; BC +2)',
    actions: ['Aguijón. Tirada de ataque cuerpo a cuerpo: +2, alcance 1,5 m. Acierto: 1 de daño perforante más 3 (1d6) de daño de veneno.'],
  },
  'esfinge-de-las-maravillas': {
    armorClass: '13',
    initiative: '+3 (13)',
    hitPoints: '24 (7d4 + 7)',
    speed: '6 m, volar 12 m',
    languages: 'celestial, común',
    challenge: '1 (200 PX; BC +2)',
    traits: ['Resistencia mágica. La esfinge tiene ventaja en las tiradas de salvación contra conjuros y otros efectos mágicos.'],
    actions: ['Desgarro. Tirada de ataque cuerpo a cuerpo: +5, alcance 1,5 m. Acierto: 5 (1d4 + 3) de daño cortante más 7 (2d6) de daño radiante.'],
    reactions: ['Arranque de ingenio (2/día). Detonante: la esfinge u otra criatura a 9 m o menos hace una prueba de característica o una tirada de salvación. Respuesta: la esfinge suma 2 a la tirada.'],
  },
  gato: {
    armorClass: '12',
    initiative: '+2 (12)',
    speed: '12 m, trepar 12 m',
  },
  halcon: {
    armorClass: '13',
    initiative: '+3 (13)',
    hitPoints: '1 (1d4 - 1)',
    speed: '3 m, volar 18 m',
    senses: 'Percepción pasiva 16',
    languages: 'ninguno',
    challenge: '0 (10 PX; BC +2)',
    actions: ['Garras. Tirada de ataque cuerpo a cuerpo: +5, alcance 1,5 m. Acierto: 1 de daño cortante.'],
  },
  jabali: {
    armorClass: '11',
    initiative: '+0 (10)',
    hitPoints: '13 (2d8 + 4)',
    speed: '12 m',
    senses: 'Percepción pasiva 9',
    languages: 'ninguno',
    challenge: '1/4 (50 PX; BC +2)',
  },
  lobo: {
    actions: ['Mordisco. Tirada de ataque cuerpo a cuerpo: +4, alcance 1,5 m. Acierto: 5 (1d6 + 2) de daño perforante. Si el objetivo es una criatura Mediana o más pequeña, tendrá el estado de derribado.'],
  },
  'lobo-terrible': {
    speed: '15 m',
  },
  mastin: {
    hitPoints: '5 (1d8 + 1)',
    speed: '12 m',
  },
  murcielago: {
    armorClass: '12',
    initiative: '+2 (12)',
    hitPoints: '1 (1d4 - 1)',
    speed: '1,5 m, volar 9 m',
    senses: 'visión ciega 18 m, Percepción pasiva 11',
    languages: 'ninguno',
    challenge: '0 (10 PX; BC +2)',
    actions: ['Mordisco. Tirada de ataque cuerpo a cuerpo: +4, alcance 1,5 m. Acierto: 1 de daño perforante.'],
  },
  quasit: {
    languages: 'abisal, común',
    challenge: '1 (200 PX; BC +2)',
  },
  'oso-negro': {
    armorClass: '11',
    hitPoints: '19 (3d8 + 6)',
  },
  'oso-pardo': {
    hitPoints: '22 (3d10 + 6)',
  },
  pseudodragon: {
    hitPoints: '10 (3d4 + 3)',
  },
  pulpo: {
    challenge: '0 (10 PX; BC +2)',
  },
  rata: {
    senses: 'visión en la oscuridad 9 m, Percepción pasiva 12',
    challenge: '0 (10 PX; BC +2)',
  },
  'renacuajo-slaad': {
    challenge: '1/8 (25 PX; BC +2)',
  },
  'serpiente-constrictora': {
    hitPoints: '13 (2d10 + 2)',
  },
  simio: {
    hitPoints: '19 (3d8 + 6)',
  },
  esqueleto: {
    speed: '9 m',
  },
  'tiburon-de-arrecife': {
    hitPoints: '22 (4d8 + 4)',
    speed: '1,5 m, nadar 9 m',
  },
};

const abilityOverrides = {
  arana: { INT: '1' },
  cangrejo: { SAB: '8' },
  duende: { FUE: '3', SAB: '13' },
  elefante: { INT: '3', SAB: '11' },
  'esfinge-de-las-maravillas': { INT: '15' },
  esqueleto: { INT: '6', SAB: '8', CAR: '5' },
  gato: { SAB: '12' },
  halcon: { FUE: '5', CAR: '6' },
  jabali: { INT: '2', SAB: '9' },
  mastin: { INT: '3', SAB: '12', CAR: '7' },
  murcielago: { INT: '2', SAB: '12', CAR: '4' },
  pseudodragon: { CON: '13' },
  pulpo: { CON: '11', SAB: '10' },
  simio: { CON: '14' },
  'tiburon-de-arrecife': { SAB: '10' },
};

for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
  const sourcePage = 346 + pageIndex;
  const expectedColumns = namesByPage[sourcePage];
  if (!expectedColumns) continue;

  const physicalLines = pages[pageIndex].split(/\r?\n/);
  const splitAt = rightColumnStart(physicalLines);
  const columns = [
    physicalLines.map((line) => line.slice(0, splitAt)),
    physicalLines.map((line) => line.slice(splitAt)),
  ];

  columns.forEach((column, columnIndex) => {
    const lines = column.map(clean).filter(Boolean);
    const starts = creatureStarts(lines);
    const expectedNames = expectedColumns[columnIndex];

    if (starts.length !== expectedNames.length) {
      throw new Error(
        `La página ${sourcePage}, columna ${columnIndex + 1}, contiene ${starts.length} perfiles; se esperaban ${expectedNames.length}.`
      );
    }

    starts.forEach((start, creatureIndex) => {
      let end = starts[creatureIndex + 1] ?? lines.length;
      if (creatureIndex + 1 < starts.length) {
        for (let count = 0; count < 2 && end > start + 1; count += 1) {
          const previous = clean(lines[end - 1]);
          if (previous.includes(':') || previous.length > 45) break;
          end -= 1;
        }
      }
      const type = lines[start];
      const body = lines.slice(start + 1, end);
      const creature = parseCreature(
        expectedNames[creatureIndex],
        type,
        body,
        sourcePage
      );
      Object.assign(creature, profileOverrides[creature.id] ?? {});
      for (const ability of creature.abilityScores) {
        ability.score =
          abilityOverrides[creature.id]?.[ability.label] ?? ability.score;
      }
      creatures.push(creature);
    });
  });
}

creatures.sort((a, b) => a.name.localeCompare(b.name, 'es'));

if (creatures.length !== 51) {
  throw new Error(`Se esperaban 51 criaturas y se encontraron ${creatures.length}.`);
}

const rules = JSON.parse(fs.readFileSync(output, 'utf8'));
rules.creatures = creatures;
fs.writeFileSync(output, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');
console.log(`Generadas ${creatures.length} criaturas en ${output}.`);
