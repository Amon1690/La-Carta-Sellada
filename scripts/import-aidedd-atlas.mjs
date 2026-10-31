import { writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://www.aidedd.org/atlas/dataF.js?v=3';
const OUTPUT_URL = new URL('../src/app/core/data/faerun-locations.ts', import.meta.url);
const MAP_WIDTH = 7990;
const MAP_HEIGHT = 5635;

const markerCategoryConfig = {
  City: { id: 'city', label: 'Ciudad', base: 'Gran núcleo urbano de Faerûn' },
  'Town/Village': { id: 'town', label: 'Villa o aldea', base: 'Asentamiento local de Faerûn' },
  'Castle/Fortress': { id: 'fortress', label: 'Castillo o fortaleza', base: 'Posición fortificada de Faerûn' },
  Ruin: { id: 'ruin', label: 'Ruinas', base: 'Vestigio histórico o asentamiento en ruinas' },
  Tower: { id: 'tower', label: 'Torre', base: 'Torre o enclave elevado de Faerûn' },
  'Site/Dungeon': { id: 'site', label: 'Lugar o mazmorra', base: 'Lugar de exploración o aventura' },
  'Area/Isle': { id: 'area', label: 'Región o isla', base: 'Región, territorio o isla de Faerûn' },
  Forests: { id: 'forest', label: 'Bosque', base: 'Bosque o territorio arbolado' },
  Mountainous: { id: 'mountain', label: 'Montaña', base: 'Relieve montañoso o paso elevado' },
  'Waters/Swamp': { id: 'water', label: 'Aguas o pantano', base: 'Masa de agua, costa o humedal' },
};

const zoneCategoryRules = [
  {
    pattern: /\b(sea|ocean|bay|gulf|lake|river|falls|water|waters|marsh|swamp|bog|wetland|sound|strait|channel|reach|mere|loch|lagoon)\b/i,
    config: { id: 'water', label: 'Mar, río o humedal', base: 'Accidente hidrográfico o humedal de Faerûn' },
  },
  {
    pattern: /\b(mount|mounts|mountain|mountains|peak|peaks|ridge|ridges|cliff|cliffs|crag|crags|hills|highlands|plateau|spine|chasm|canyon)\b/i,
    config: { id: 'mountain', label: 'Montes o relieve', base: 'Cordillera, monte o relieve destacado de Faerûn' },
  },
  {
    pattern: /\b(forest|forests|wood|woods|woodland|grove|jungle|thicket|weald)\b/i,
    config: { id: 'forest', label: 'Bosque', base: 'Bosque, selva o territorio arbolado de Faerûn' },
  },
  {
    pattern: /\b(desert|waste|wastes|dunes|sands|badlands)\b/i,
    config: { id: 'desert', label: 'Desierto o yermo', base: 'Desierto, yermo o extensión árida de Faerûn' },
  },
  {
    pattern: /\b(plain|plains|field|fields|grassland|grasslands|prairie|prairies|steppe|savanna|moor|moors|heath|downs|tundra)\b/i,
    config: { id: 'plain', label: 'Pradera o llanura', base: 'Pradera, llanura o extensión abierta de Faerûn' },
  },
];

const defaultZoneConfig = {
  id: 'area',
  label: 'Región o territorio',
  base: 'Región, territorio o accidente geográfico de Faerûn',
};

const traitRules = [
  [/capital|seat of power|seat of government|ruled by|governed by/, 'su importancia política'],
  [/port|harbou?r|dock|shipyard|navy|maritime|seafaring/, 'su actividad portuaria o marítima'],
  [/trade|merchant|commercial|market|caravan|wealth|economic/, 'el comercio y las rutas de intercambio'],
  [/fortress|fortified|walled|citadel|military|army|soldier|garrison/, 'su valor defensivo o militar'],
  [/ruin|abandon|destroy|fallen|lost city|ancient remains/, 'sus vestigios históricos'],
  [/magic|wizard|sorcer|arcane|spell|enchanted/, 'una presencia arcana destacada'],
  [/temple|shrine|church|religio|holy|pilgrim|priest/, 'su relevancia religiosa'],
  [/dwarf|dwarven/, 'sus vínculos con pueblos enanos'],
  [/elf|elven|fey|faerie/, 'sus vínculos élficos o feéricos'],
  [/pirate|smuggl|thieves|crime|criminal|corrupt/, 'la actividad clandestina o criminal'],
  [/mine|mineral|gold|gem|ore|quarr/, 'sus recursos minerales'],
  [/forest|wood|druid|grove|jungle/, 'su entorno boscoso o druídico'],
  [/mountain|peak|cliff|ridge|pass/, 'el terreno montañoso'],
  [/plain|field|grassland|prairie|steppe|savanna|moor|heath|pasture/, 'sus llanuras y tierras abiertas'],
  [/desert|waste|dune|sand|arid/, 'su entorno árido'],
  [/swamp|marsh|bog|wetland/, 'sus humedales y terreno difícil'],
  [/river|lake|sea|bay|coast|island|isle/, 'las rutas fluviales o costeras'],
  [/road|route|trail|crossroad|highway/, 'sus caminos y comunicaciones terrestres'],
  [/farm|agricultur|crop|orchard|vineyard/, 'la agricultura y las tierras de cultivo'],
  [/kingdom|nation|realm|province|territor/, 'su papel dentro de los reinos de la región'],
  [/nomad|tribe|clan|inhabitant|population/, 'sus pueblos y comunidades locales'],
  [/war|battle|conflict|invasion|conquer|centur|history|historical/, 'su historia y sus conflictos'],
  [/dragon|undead|demon|monster|haunt|curse|danger/, 'la presencia de peligros sobrenaturales'],
];

function decodeSource(value = '') {
  return value
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n|\\r|\\t/g, ' ')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    hellip: '…',
    mdash: '—',
    ndash: '–',
    lsquo: '‘',
    rsquo: '’',
    ldquo: '“',
    rdquo: '”',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities[name.toLowerCase()] ?? entity);
}

function plainText(value) {
  return decodeHtmlEntities(decodeSource(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'location';
}

function joinSpanish(items) {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

function summaryFor(config, sourceText) {
  const normalized = sourceText.toLowerCase();
  const traits = [...new Set(
    traitRules
      .filter(([pattern]) => pattern.test(normalized))
      .map(([, label]) => label)
  )].slice(0, 5);
  return traits.length
    ? `${config.base}. La información del atlas destaca ${joinSpanish(traits)}.`
    : `${config.base}. Es una referencia cartográfica útil para planificar rutas, exploración y jornadas.`;
}

function regionFor(x, y) {
  if (x < 2200 && y < 900) return 'El Norte y Valle del Viento Helado';
  if (x < 2100 && y < 3200) return 'Islas y mares occidentales';
  if (x < 2500 && y >= 4200) return 'Chult y el sur occidental';
  if (x < 3500 && y < 2100) return 'Costa de la Espada Norte';
  if (x < 3500 && y < 3400) return 'Costa de la Espada y Tierras Occidentales';
  if (x < 3800) return 'Tierras de Intriga';
  if (x < 5500 && y < 1750) return 'Anauroch y Frontera Salvaje';
  if (x < 5500 && y < 3300) return 'Tierras Centrales';
  if (x < 5500) return 'Sur Brillante';
  if (x < 6800 && y < 1800) return 'Tierras Olvidadas';
  if (x < 6800 && y < 3500) return 'Mar Interior';
  if (x < 6800) return 'Viejos Imperios';
  if (y < 3500) return 'Imperios Arcanos';
  return 'Faerûn oriental';
}

function extractArrayObjects(source, variableName) {
  const declaration = new RegExp(`\\bvar\\s+${variableName}\\s*=`).exec(source);
  if (!declaration) throw new Error(`Collection ${variableName} not found`);
  const arrayStart = source.indexOf('[', declaration.index);
  if (arrayStart < 0) throw new Error(`Collection ${variableName} has no array`);

  const objects = [];
  let objectStart = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '{') {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (character === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(source.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
    if (character === ']' && depth === 0) break;
  }
  return objects;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stringProperty(objectSource, propertyName) {
  const pattern = new RegExp(`(?:^|[,\\s])${escapeRegex(propertyName)}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's');
  return pattern.exec(objectSource)?.[1];
}

function numberProperty(objectSource, propertyName) {
  const pattern = new RegExp(`(?:^|[,\\s])${escapeRegex(propertyName)}\\s*:\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))`);
  const match = pattern.exec(objectSource);
  return match ? Number(match[1]) : Number.NaN;
}

function pathPoints(path) {
  const tokens = path.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?|[a-z]/gi) ?? [];
  const points = [];
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const isCommand = (token) => /^[a-z]$/i.test(token);
  const addPoint = (nextX, nextY) => {
    if (Number.isFinite(nextX) && Number.isFinite(nextY)) points.push({ x: nextX, y: nextY });
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) break;
    const lower = command.toLowerCase();
    const relative = command === lower;

    if (lower === 'z') {
      x = startX;
      y = startY;
      addPoint(x, y);
      command = '';
      continue;
    }

    const argumentCount = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 }[lower];
    if (!argumentCount || index + argumentCount > tokens.length || isCommand(tokens[index])) {
      command = '';
      continue;
    }
    const args = tokens.slice(index, index + argumentCount).map(Number);
    index += argumentCount;

    if (lower === 'h') {
      x = relative ? x + args[0] : args[0];
      addPoint(x, y);
    } else if (lower === 'v') {
      y = relative ? y + args[0] : args[0];
      addPoint(x, y);
    } else if (lower === 'a') {
      x = relative ? x + args[5] : args[5];
      y = relative ? y + args[6] : args[6];
      addPoint(x, y);
    } else {
      const pairs = [];
      for (let pairIndex = 0; pairIndex < args.length; pairIndex += 2) {
        pairs.push({
          x: relative ? x + args[pairIndex] : args[pairIndex],
          y: relative ? y + args[pairIndex + 1] : args[pairIndex + 1],
        });
      }
      for (const point of pairs) addPoint(point.x, point.y);
      const endpoint = pairs.at(-1);
      x = endpoint.x;
      y = endpoint.y;
      if (lower === 'm') {
        startX = x;
        startY = y;
        command = relative ? 'l' : 'L';
      }
    }
  }
  return points;
}

function representativePoint(path) {
  const points = pathPoints(path);
  if (points.length === 0) return undefined;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function geographicConfigFor(name, sourceText = '') {
  const nameMatch = zoneCategoryRules.find((rule) => rule.pattern.test(name));
  if (nameMatch) return nameMatch.config;
  const openingDescription = sourceText.split(/[.!?]/, 1)[0] ?? '';
  return zoneCategoryRules.find((rule) => rule.pattern.test(openingDescription))?.config ?? defaultZoneConfig;
}

function nextId(ids, name) {
  const baseId = slug(name);
  const repetition = (ids.get(baseId) ?? 0) + 1;
  ids.set(baseId, repetition);
  return repetition === 1 ? baseId : `${baseId}-${repetition}`;
}

function toPercent(value, total) {
  return Number(((value / total) * 100).toFixed(4));
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Atlas request failed: ${response.status}`);
const source = await response.text();
const markerObjects = extractArrayObjects(source, 'groupe');
const zoneObjects = extractArrayObjects(source, 'zones');
const ids = new Map();
const locations = [];
let markerCategory = 'Area/Isle';
let importedMarkers = 0;

// Keep point markers first so their established ids remain stable for saved travel plans.
for (const objectSource of markerObjects) {
  const rawName = stringProperty(objectSource, 'name');
  if (rawName === undefined) continue;
  const name = decodeSource(rawName).trim();
  const rawText = stringProperty(objectSource, 'txt') ?? '';
  if (name === 'GROUP') {
    markerCategory = decodeSource(rawText).trim();
    continue;
  }
  const sourceX = numberProperty(objectSource, 'x');
  const sourceY = numberProperty(objectSource, 'y');
  const sourceText = plainText(rawText);
  const config = markerCategory === 'Area/Isle'
    ? geographicConfigFor(name, sourceText)
    : markerCategoryConfig[markerCategory];
  if (!config || !Number.isFinite(sourceX) || !Number.isFinite(sourceY)) continue;
  locations.push({
    id: nextId(ids, name),
    name,
    category: config.id,
    categoryLabel: config.label,
    region: regionFor(sourceX, sourceY),
    x: toPercent(sourceX, MAP_WIDTH),
    y: toPercent(sourceY, MAP_HEIGHT),
    sourceX,
    sourceY,
    sourceKind: 'marker',
    summary: summaryFor(config, sourceText),
  });
  importedMarkers += 1;
}

let importedZones = 0;
for (const objectSource of zoneObjects) {
  const rawName = stringProperty(objectSource, 'name');
  const rawPath = stringProperty(objectSource, 'path');
  if (rawName === undefined || rawPath === undefined) continue;
  const name = decodeSource(rawName).trim();
  const sourceText = plainText(stringProperty(objectSource, 'txt') ?? '');
  const point = representativePoint(decodeSource(rawPath));
  if (!point) continue;
  const sourceX = Number(point.x.toFixed(2));
  const sourceY = Number(point.y.toFixed(2));
  const config = geographicConfigFor(name, sourceText);
  locations.push({
    id: nextId(ids, name),
    name,
    category: config.id,
    categoryLabel: config.label,
    region: regionFor(sourceX, sourceY),
    x: toPercent(sourceX, MAP_WIDTH),
    y: toPercent(sourceY, MAP_HEIGHT),
    sourceX,
    sourceY,
    sourceKind: 'zone',
    summary: summaryFor(config, sourceText),
  });
  importedZones += 1;
}

if (importedMarkers < 1400 || importedZones < 8 || locations.length < 1450) {
  throw new Error(
    `Incomplete atlas import: ${importedMarkers} markers, ${importedZones} zones, ${locations.length} total`
  );
}

const chunks = Array.from(
  { length: Math.ceil(locations.length / 100) },
  (_, index) => locations.slice(index * 100, (index + 1) * 100)
);
const chunkDeclarations = chunks
  .map(
    (chunk, index) =>
      `const FAERUN_LOCATION_CHUNK_${index + 1}: FaerunTravelLocation[] = ${JSON.stringify(chunk, null, 2)};`
  )
  .join('\n\n');
const chunkSpreads = chunks
  .map((_, index) => `  ...FAERUN_LOCATION_CHUNK_${index + 1},`)
  .join('\n');

const output = `// Generated from the public AideDD Faerûn atlas marker and area coordinates.\n` +
  `// Descriptions are original Spanish summaries derived from atlas categories and geographic traits.\n\n` +
  `export type FaerunLocationCategory =\n` +
  `  | 'city'\n  | 'town'\n  | 'fortress'\n  | 'ruin'\n  | 'tower'\n  | 'site'\n` +
  `  | 'area'\n  | 'forest'\n  | 'mountain'\n  | 'water'\n  | 'plain'\n  | 'desert';\n\n` +
  `export interface FaerunTravelLocation {\n` +
  `  id: string;\n  name: string;\n  category: FaerunLocationCategory;\n  categoryLabel: string;\n` +
  `  region: string;\n  x: number;\n  y: number;\n  sourceX: number;\n  sourceY: number;\n` +
  `  sourceKind: 'marker' | 'zone';\n  summary: string;\n}\n\n` +
  `${chunkDeclarations}\n\n` +
  `export const FAERUN_LOCATIONS: readonly FaerunTravelLocation[] = [\n${chunkSpreads}\n];\n`;

await writeFile(OUTPUT_URL, output, 'utf8');
console.log(`Generated ${locations.length} Faerûn locations (${importedMarkers} markers + ${importedZones} geographic areas).`);
