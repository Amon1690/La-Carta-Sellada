import fs from 'node:fs';
import { parseTree } from 'jsonc-parser';

const technicalKeys = new Set([
  'id',
  'mapUrl',
  'tokenUrl',
  'gridTokenUrl',
  'dataPath',
  'coverImage',
  'coverPosition',
  'coverSize',
]);

const contextSensitiveWords = new Set(['perdida', 'quedaran']);

const manualPhrases = new Map(
  Object.entries({
    'buen terminó': 'buen término',
    'pierna pérdida': 'pierna perdida',
    'quedarán impunes': 'quedaran impunes',
    'su retiró': 'su retiro',
    'marco el límite': 'marcó el límite',
    'que pago por adelantado': 'que pagó por adelantado',
    'sabe que eran sus guerreros': 'sabe qué eran sus guerreros',
    'exactamente cuando llegaría': 'exactamente cuándo llegaría',
    'y pago en oro': 'y pagó en oro',
    'que contrato bandidos': 'que contrató bandidos',
    'descubrir como fue': 'descubrir cómo fue',
    'Sabe donde esta': 'Sabe dónde está',
    'Dar testimonio de como': 'Dar testimonio de cómo',
    'ya esta conmigo': 'ya está conmigo',
    'Helm aún vela por mi': 'Helm aún vela por mí',
    'El carro de Alaric esta': 'El carro de Alaric está',
    'Edric esta asustado': 'Edric está asustado',
    'Esta convencido': 'Está convencido',
    'El cliente pago': 'El cliente pagó',
    'ya no esta en la cantera': 'ya no está en la cantera',
    'elija como iniciar': 'elija cómo iniciar',
    'La pasarela esta': 'La pasarela está',
    'esta decidida': 'está decidida',
    'averiguar que fuerza': 'averiguar qué fuerza',
    'descubrir quien filtró': 'descubrir quién filtró',
    'Elian Auriel': 'Elián Auriel',
    'Nimra Musgorrio': 'Nimra Musgorrío',
    'pero si por': 'pero sí por',
  })
);

const manualWords = new Map(
  Object.entries({
    acudio: 'acudió',
    acepto: 'aceptó',
    advirtio: 'advirtió',
    aprendio: 'aprendió',
    alquimico: 'alquímico',
    aparto: 'apartó',
    aproximacion: 'aproximación',
    area: 'área',
    ardia: 'ardía',
    botin: 'botín',
    brujula: 'brújula',
    capitan: 'capitán',
    celebracion: 'celebración',
    comio: 'comió',
    comodo: 'cómodo',
    comprendio: 'comprendió',
    conocio: 'conoció',
    convirtio: 'convirtió',
    confirmo: 'confirmó',
    contamino: 'contaminó',
    conto: 'contó',
    corrupcion: 'corrupción',
    crecio: 'creció',
    debia: 'debía',
    debio: 'debió',
    decidio: 'decidió',
    decision: 'decisión',
    detecto: 'detectó',
    descubrio: 'descubrió',
    dirigia: 'dirigía',
    durmio: 'durmió',
    destruyo: 'destruyó',
    desvio: 'desvío',
    desprendia: 'desprendía',
    economico: 'económico',
    elian: 'elián',
    entendio: 'entendió',
    escondio: 'escondió',
    escolto: 'escoltó',
    examino: 'examinó',
    expedicion: 'expedición',
    exploracion: 'exploración',
    filtro: 'filtró',
    envio: 'envió',
    formulas: 'fórmulas',
    formula: 'fórmula',
    habia: 'había',
    interes: 'interés',
    incumplia: 'incumplía',
    insistio: 'insistió',
    jamas: 'jamás',
    jugaria: 'jugaría',
    juro: 'juró',
    leido: 'leído',
    llegaria: 'llegaría',
    logro: 'logró',
    levanto: 'levantó',
    llevo: 'llevó',
    magico: 'mágico',
    magica: 'mágica',
    mercancia: 'mercancía',
    medica: 'médica',
    medico: 'médico',
    miopia: 'miopía',
    nacio: 'nació',
    necrotica: 'necrótica',
    numero: 'número',
    ordenes: 'órdenes',
    oyo: 'oyó',
    paso: 'pasó',
    persecucion: 'persecución',
    picara: 'pícara',
    pidio: 'pidió',
    permitio: 'permitió',
    permitiria: 'permitiría',
    podrian: 'podrían',
    podian: 'podían',
    politico: 'político',
    pragmatico: 'pragmático',
    proposito: 'propósito',
    provocacion: 'provocación',
    queria: 'quería',
    rapidas: 'rápidas',
    rapidos: 'rápidos',
    recibio: 'recibió',
    recomendacion: 'recomendación',
    relacion: 'relación',
    replica: 'réplica',
    restauracion: 'restauración',
    revelacion: 'revelación',
    sabia: 'sabía',
    salio: 'salió',
    senala: 'señala',
    senalara: 'señalará',
    senales: 'señales',
    servia: 'servía',
    siguio: 'siguió',
    sintio: 'sintió',
    situacion: 'situación',
    simbolos: 'símbolos',
    sobrevivio: 'sobrevivió',
    tomo: 'tomó',
    tradicion: 'tradición',
    tomas: 'tomás',
    tunica: 'túnica',
    via: 'vía',
    aun: 'aún',
    basto: 'bastó',
    cayo: 'cayó',
    confio: 'confío',
    credulo: 'crédulo',
    dia: 'día',
    evalua: 'evalúa',
    ganandose: 'ganándose',
    musica: 'música',
    mostro: 'mostró',
    parecia: 'parecía',
    partio: 'partió',
    podia: 'podía',
    quedo: 'quedó',
    viajo: 'viajó',
    veian: 'veían',
    vigia: 'vigía',
    vivia: 'vivía',
    vivio: 'vivió',
  })
);

function normalizeWord(word) {
  return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function collectVisibleStrings(root, output, parentKey = '') {
  if (typeof root === 'string') {
    if (!technicalKeys.has(parentKey)) output.push(root);
    return;
  }

  if (Array.isArray(root)) {
    root.forEach((entry) => collectVisibleStrings(entry, output, parentKey));
    return;
  }

  if (root && typeof root === 'object') {
    Object.entries(root).forEach(([key, value]) =>
      collectVisibleStrings(value, output, key)
    );
  }
}

function buildReferenceDictionary(rules) {
  const strings = [];
  collectVisibleStrings(rules, strings);
  const variants = new Map();

  for (const value of strings) {
    for (const word of value.match(/\p{L}+/gu) ?? []) {
      const lower = word.toLowerCase();
      const normalized = normalizeWord(lower);
      const entries = variants.get(normalized) ?? new Set();
      entries.add(lower);
      variants.set(normalized, entries);
    }
  }

  const dictionary = new Map(manualWords);
  for (const [normalized, entries] of variants) {
    const candidates = [...entries].filter((entry) => entry !== normalized);
    if (entries.size === 1 && candidates.length === 1) {
      dictionary.set(normalized, candidates[0]);
    }
  }

  return dictionary;
}

function preserveCase(source, replacement) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function fixValue(value, dictionary) {
  let correctedValue = value;
  for (const [source, replacement] of manualPhrases) {
    correctedValue = correctedValue.replaceAll(source, replacement);
  }

  return correctedValue.replace(/\p{L}+/gu, (word) => {
    const normalized = normalizeWord(word);
    if (word.toLowerCase() !== normalized) return word;
    if (contextSensitiveWords.has(normalized)) return word;
    if (normalized.endsWith('cion')) {
      return preserveCase(word, `${normalized.slice(0, -4)}ción`);
    }
    if (normalized.endsWith('sion')) {
      return preserveCase(word, `${normalized.slice(0, -4)}sión`);
    }
    const replacement = dictionary.get(normalized);
    return replacement ? preserveCase(word, replacement) : word;
  });
}

function collectEdits(node, dictionary, edits, parentKey = '') {
  if (node.type === 'object') {
    for (const property of node.children ?? []) {
      const [keyNode, valueNode] = property.children;
      collectEdits(valueNode, dictionary, edits, keyNode.value);
    }
    return;
  }

  if (node.type === 'array') {
    for (const child of node.children ?? []) {
      collectEdits(child, dictionary, edits, parentKey);
    }
    return;
  }

  if (node.type !== 'string' || technicalKeys.has(parentKey)) return;
  const corrected = fixValue(node.value, dictionary);
  if (corrected !== node.value) {
    edits.push({ offset: node.offset, length: node.length, value: corrected });
  }
}

function fixJsonFile(path, dictionary) {
  let source = fs.readFileSync(path, 'utf8');
  const root = parseTree(source);
  const edits = [];
  collectEdits(root, dictionary, edits);

  for (const edit of edits.sort((a, b) => b.offset - a.offset)) {
    source =
      source.slice(0, edit.offset) +
      JSON.stringify(edit.value) +
      source.slice(edit.offset + edit.length);
  }

  fs.writeFileSync(path, source, 'utf8');
  return edits.length;
}

const rules = JSON.parse(fs.readFileSync('public/data/rules.json', 'utf8'));
const dictionary = buildReferenceDictionary(rules);
const files = ['public/data/campaign.json', 'public/data/campaigns.json'];

for (const file of files) {
  console.log(`${file}: ${fixJsonFile(file, dictionary)} textos corregidos`);
}
