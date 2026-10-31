import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export function assertUniqueIds(entries, label) {
  if (!Array.isArray(entries)) throw new Error(`${label}: se esperaba una colección.`);
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) {
      throw new Error(`${label}: identificador vacío o no válido.`);
    }
    if (ids.has(entry.id)) throw new Error(`${label}: identificador duplicado ${entry.id}.`);
    ids.add(entry.id);
  }
  return ids;
}

export function assertLocalResource(publicRoot, reference) {
  if (typeof reference !== 'string') throw new Error('Recurso local: ruta no válida.');
  let relative;
  try {
    relative = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
  } catch {
    throw new Error(`Recurso local: codificación no válida ${reference}.`);
  }
  const segments = relative.split('/');
  if (!relative || segments.some((part) => !part || part === '.' || part === '..') || /[\\:]/.test(relative)) {
    throw new Error(`Recurso local: ruta fuera del directorio permitido ${reference}.`);
  }
  const root = fs.realpathSync(publicRoot);
  let current = root;
  for (const segment of segments) {
    const names = fs.readdirSync(current);
    if (!names.includes(segment)) {
      throw new Error(`Recurso local inexistente o con mayúsculas incorrectas: ${reference}.`);
    }
    current = path.join(current, segment);
  }
  const resolved = fs.realpathSync(current);
  const inside = path.relative(root, resolved);
  if (inside.startsWith(`..${path.sep}`) || inside === '..' || path.isAbsolute(inside)) {
    throw new Error(`Recurso local: ruta fuera del directorio permitido ${reference}.`);
  }
  if (!fs.statSync(resolved).isFile()) throw new Error(`Recurso local no es un archivo: ${reference}.`);
  return resolved;
}

export function validateCampaignRefs(campaign) {
  const collections = ['npcs', 'items', 'locations', 'scenes', 'encounters', 'playerCharacters', 'playerOptions', 'antagonistOptions', 'acts'];
  for (const collection of collections) assertUniqueIds(campaign[collection], `${campaign.id}.${collection}`);
  const labels = new Set(campaign.acts.map((act) => act.label));
  if (labels.size !== campaign.acts.length) throw new Error(`${campaign.id}: etiquetas de acto duplicadas.`);
  for (const entry of [...campaign.scenes, ...campaign.encounters]) {
    if (!labels.has(entry.act)) throw new Error(`${campaign.id}.${entry.id}: acto desconocido ${entry.act}.`);
  }
  // acts.scenes contains narrative titles, not foreign keys into campaign.scenes.
}

function loadCatalogs(root) {
  const ts = require('typescript');
  const previous = Module._extensions['.ts'];
  Module._extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    module._compile(output.outputText, filename);
  };
  try {
    const catalog = (name) => require(path.join(root, 'src/app/core/data', `${name}.ts`));
    return {
      ...catalog('generic-npcs'),
      ...catalog('generic-encounters'),
      ...catalog('travel-events'),
      ...catalog('faerun-locations'),
    };
  } finally {
    if (previous) Module._extensions['.ts'] = previous;
    else delete Module._extensions['.ts'];
  }
}

function scanResources(publicRoot, value) {
  if (typeof value === 'string' && /^(assets|data)\//.test(value)) {
    assertLocalResource(publicRoot, value);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) scanResources(publicRoot, child);
  }
}

export function validateData(root = projectRoot) {
  const publicRoot = path.join(root, 'public');
  const json = (reference) => JSON.parse(fs.readFileSync(assertLocalResource(publicRoot, reference), 'utf8'));
  const index = json('data/campaigns.json');
  assertUniqueIds(index, 'campaigns');
  scanResources(publicRoot, index);
  for (const entry of index) {
    const campaign = json(entry.dataPath);
    if (campaign.id !== entry.id) throw new Error(`Índice de campañas: id distinto para ${entry.id}.`);
    validateCampaignRefs(campaign);
    scanResources(publicRoot, campaign);
    for (const npc of campaign.npcs) {
      for (const group of ['tokens', 'tokens-grid']) assertLocalResource(publicRoot, `assets/${group}/npcs/${npc.id}.png`);
    }
    for (const player of campaign.playerOptions.filter((player) => player.showToken !== false)) {
      for (const group of ['tokens', 'tokens-grid']) assertLocalResource(publicRoot, `assets/${group}/players/${player.id}.png`);
    }
  }
  const rules = json('data/rules.json');
  for (const collection of ['spells', 'feats', 'skills', 'equipment', 'classes', 'creatures']) {
    assertUniqueIds(rules[collection], `rules.${collection}`);
  }
  for (const ruleClass of rules.classes) assertUniqueIds(ruleClass.features, `rules.classes.${ruleClass.id}.features`);
  scanResources(publicRoot, rules);

  const { GENERIC_NPCS, GENERIC_ENCOUNTERS, TRAVEL_EVENTS, FAERUN_LOCATIONS } = loadCatalogs(root);
  const npcIds = assertUniqueIds(GENERIC_NPCS, 'generic-npcs');
  assertUniqueIds(GENERIC_ENCOUNTERS, 'generic-encounters');
  assertUniqueIds(TRAVEL_EVENTS, 'travel-events');
  assertUniqueIds(FAERUN_LOCATIONS, 'faerun-locations');
  for (const npc of GENERIC_NPCS) {
    for (const group of ['tokens', 'tokens-grid']) assertLocalResource(publicRoot, `assets/${group}/generic/${npc.id}.png`);
  }
  for (const encounter of GENERIC_ENCOUNTERS) {
    assertLocalResource(publicRoot, encounter.mapUrl);
    if (!Array.isArray(encounter.tiers) || !encounter.tiers.length) throw new Error(`${encounter.id}: sin tramos de nivel.`);
    let lastLevel = 0;
    for (const tier of encounter.tiers) {
      if (!Number.isInteger(tier.minLevel) || tier.minLevel <= lastLevel || tier.minLevel > 20) {
        throw new Error(`${encounter.id}: tramos de nivel no válidos.`);
      }
      lastLevel = tier.minLevel;
      for (const monster of tier.monsters) {
        if (!npcIds.has(monster.id)) throw new Error(`${encounter.id}: criatura desconocida ${monster.id}.`);
        if (!Number.isInteger(monster.count) || monster.count < 1) throw new Error(`${encounter.id}: número de criaturas no válido.`);
      }
    }
    if (encounter.tiers[0].minLevel !== 1) throw new Error(`${encounter.id}: falta el tramo de nivel 1.`);
  }
  for (const event of TRAVEL_EVENTS) {
    if (!['guide', 'hunter', 'watch'].includes(event.role) || !['positive', 'negative'].includes(event.polarity) ||
        !['survival', 'perception'].includes(event.skill) || !Number.isInteger(event.dc) || event.dc < 1 ||
        !event.title || typeof event.story !== 'string' || event.story.length <= 40 || !event.success || !event.failure || !event.environments?.length ||
        (event.encounterChance !== undefined && !(event.encounterChance >= 0 && event.encounterChance <= 1))) {
      throw new Error(`${event.id}: evento de viaje no válido.`);
    }
  }
  for (const location of FAERUN_LOCATIONS) {
    if (!location.name || !Number.isFinite(location.x) || !Number.isFinite(location.y) ||
        location.x < 0 || location.x > 100 || location.y < 0 || location.y > 100) {
      throw new Error(`${location.id}: localización no válida.`);
    }
  }
  return { campaigns: index.length, genericNpcs: GENERIC_NPCS.length, encounters: GENERIC_ENCOUNTERS.length,
    travelEvents: TRAVEL_EVENTS.length, locations: FAERUN_LOCATIONS.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log('Datos y recursos validados:', validateData());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
