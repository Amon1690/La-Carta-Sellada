import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPELLS_PER_LEVEL, cleanRuleDescription } from './rules-source-repairs.mjs';

const rules = JSON.parse(fs.readFileSync(new URL('../public/data/rules.json', import.meta.url), 'utf8'));

test('el catálogo cubre el índice primario del Manual 2024 y los tres conjuros perdidos', () => {
  assert.deepEqual(SPELLS_PER_LEVEL.map((_, level) => rules.spells.filter((s) => s.level === level).length), SPELLS_PER_LEVEL);
  for (const id of ['localizar-objeto', 'castigo-brillante', 'rociada-de-color', 'escudo', 'rociada-venenosa']) assert.ok(rules.spells.some((s) => s.id === id), id);
  assert.ok(!rules.spells.some((s) => s.id === 'escupo'));
  assert.equal(rules.spells.find((s) => s.id === 'de-mordenkainen').name, 'Sanctasanctórum privado de Mordenkainen');
  for (const s of rules.spells) {
    assert.ok(!/(?:Abjuración|Adivinación|Conjuración|Encantamiento|Evocación|Ilusión|Ilusionismo|Nigromancia|Transmutación) de nivel \d+ \([^)]+\)/i.test(s.description), `Metadatos de otro conjuro en ${s.id}`);
    for (const key of ['castingTime','range','components','duration']) assert.ok(s[key] && s[key] !== '—', `${s.id}: ${key}`);
  }
});

test('las opciones de clase están íntegras y asociadas al nivel que las concede', () => {
  const warlock = rules.classes.find((c) => c.id === 'brujo');
  const sorcerer = rules.classes.find((c) => c.id === 'hechicero');
  const master = rules.classes.find((c) => c.id === 'guerrero').subclasses.find((s) => s.id === 'maestro-del-combate');
  assert.equal(warlock.features.find((f) => f.id === '1-invocaciones-sobrenaturales').options.length, 28);
  assert.equal(sorcerer.features.find((f) => f.id === '2-metamagia').options.length, 10);
  const maneuvers = master.features.find((f) => f.id === '3-supremacia-en-combate').options;
  assert.equal(maneuvers.length, 20);
  assert.ok(maneuvers.find((o) => o.id === 'cambio-de-posicion-ventajoso').description.includes('Tira el dado de supremacía.'));
  assert.ok(master.features.some((f) => f.name === 'Supremacía en combate mejorada'));
  assert.ok(master.features.some((f) => f.name === 'Supremacía en combate definitiva'));
  const wild = sorcerer.subclasses.find((s) => s.id === 'hechiceria-de-magia-salvaje');
  assert.ok(wild.features.find((f) => f.id === '3-sobrecarga-de-magia-salvaje').references[0].requiresSourceCheck);
  assert.ok(!wild.features.find((f) => f.id === '18-sobrecarga-domada').description.includes('1d100'));
  const beasts = rules.classes.find((c) => c.id === 'explorador').subclasses.find((s) => s.id === 'senor-de-las-bestias');
  assert.equal(beasts.features.find((f) => f.id === '3-companero-primigenio').references[0].sourcePage, 111);
  assert.ok(!beasts.features.find((f) => f.id === '15-compartir-conjuros').description.includes('BESTIA'));
  assert.ok(!sorcerer.features.find((f) => f.id === '1-lanzamiento-de-conjuros').description.includes('FUENTE DE MAGIA'));
  for (const cls of rules.classes) for (const f of [...cls.features,...cls.subclasses.flatMap((s) => s.features)]) {
    assert.ok(!f.description.includes('OPCIONES DE '), f.id);
    assert.ok(!f.description.endsWith('…'), `Rasgo recortado: ${f.id}`);
  }
});

test('conserva las dotes, habilidades, criaturas y las 48 subclases sin conceder rasgos de otra', () => {
  assert.equal(rules.feats.length, 75);
  assert.equal(rules.skills.length, 18);
  assert.equal(rules.equipment.length, 160);
  assert.equal(rules.equipment.find((item) => item.id === 'cuerda').weight, '2,5 kg');
  assert.equal(rules.equipment.find((item) => item.id === 'libro-de-conjuros').cost, '50 po');
  assert.equal(rules.equipment.find((item) => item.id === 'libro').cost, '25 po');
  assert.equal(rules.creatures.length, 51);
  assert.equal(rules.classes.length, 12);
  let count = 0;
  for (const cls of rules.classes) {
    assert.equal(cls.subclasses.length, 4, cls.id);
    for (const subclass of cls.subclasses) {
      assert.ok(subclass.features.length > 0, subclass.name);
      assert.equal(new Set(subclass.features.map((f) => f.id)).size, subclass.features.length);
      count += subclass.features.length;
    }
  }
  assert.equal(count, 241);
  const paladin = rules.classes.find((c) => c.id === 'paladin');
  const entrega = paladin.subclasses.find((s) => s.id === 'juramento-de-entrega');
  const gloria = paladin.subclasses.find((s) => s.id === 'juramento-de-gloria');
  assert.ok(entrega.features.some((f) => f.name === 'Aura de entrega'));
  assert.ok(!gloria.features.some((f) => f.name === 'Aura de entrega'));
  assert.ok(gloria.features.some((f) => f.name === 'Conjuros del juramento de gloria'));
  assert.ok(rules.classes.find((c) => c.id === 'mago').subclasses.find((s) => s.id === 'abjurador').features.some((f) => f.name === 'Resistencia a conjuros'));
});

test('limpia los dados OCR confirmados y no arrastra las listas de conjuros a los rasgos', () => {
  assert.equal(cleanRuleDescription('Tira 1420. Recibe 1246 de daño y suma 144.'), 'Tira 1d20. Recibe 12d6 de daño y suma 1d4.');
  assert.equal(cleanRuleDescription('Rasgo. LISTA DE CONJUROS DE MAGO texto ajeno'), 'Rasgo.');
});
