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
  assert.equal(wild.features.find((f) => f.id === '3-sobrecarga-de-magia-salvaje').references[0].requiresSourceCheck, false);
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

test('separa los ocho rayos de Rociada prismática de los cuatro efectos de Saber druídico', () => {
  const prismatic = rules.spells.find((s) => s.id === 'rociada-prismatica').description;
  assert.deepEqual([...prismatic.matchAll(/(?:^|\n)(\d)\. /g)].map((m) => Number(m[1])), [1,2,3,4,5,6,7,8]);
  assert.ok(prismatic.includes('12d6'));
  assert.ok(!/druídico|venenosa|Florecer|Sensor climático/i.test(prismatic));
  const druid = rules.spells.find((s) => s.id === 'saber-druidico').description;
  for (const effect of ['Sensor climático:', 'Florecer:', 'Efecto sensorial:', 'Jugar con fuego:']) assert.ok(druid.includes(effect));
  assert.ok(!/Violeta|teletransporta|12d6/.test(druid));
});

test('atribuye cada perfil invocado a su conjuro y recupera las acciones del corcel', () => {
  const text = (id) => rules.spells.find((s) => s.id === id).description;
  assert.ok(text('animar-objetos').includes('Objeto animado.'));
  assert.ok(!text('antipatia-simpatia').includes('Objeto animado'));
  assert.ok(!/Golpe:|Autómata Enorme/.test(text('apariencia')));
  assert.ok(text('invocar-aberracion').includes('Rayo ocular (contemplador)'));
  assert.ok(text('invocar-aberracion').includes('1d8 + 3 + nivel del conjuro'));
  assert.ok(!/Letargo pétreo|CA 13/.test(text('invocar-aberracion')));
  assert.ok(text('invocar-automata').includes('CON 18'));
  assert.ok(!/Aura susurrante|slaad/.test(text('invocar-automata')));
  assert.ok(text('invocar-celestial').includes('Toque sanador, una vez al día'));
  assert.ok(!/MAZA RADIANTE|ARCO RADIANTE|VENGADOR/.test(text('invocar-dragon')));
  assert.ok(text('invocar-muerto-viviente').includes('1d8 + 3'));
  assert.ok(!text('invocar-muerto-viviente').includes('143 + 3'));
  for (const name of ['Mirada siniestra', 'Paso feérico', 'Toque sanador', 'Vínculo vital']) assert.ok(text('hallar-corcel').includes(name));
  assert.ok(text('insecto-gigante').includes('SAB 14 (+2)'));
  assert.ok(text('insecto-gigante').includes('PG 30 + 10 por cada nivel del conjuro por encima de 4'));
});

test('las tablas climáticas y los cien resultados de magia salvaje conservan su orden', () => {
  const weather = rules.spells.find((s) => s.id === 'controlar-el-clima').description;
  for (const marker of ['Precipitaciones: 1,', 'Temperatura: 1,', '6, frío extremo', 'Viento: 1,', '5, tempestad']) assert.ok(weather.includes(marker));
  assert.ok(!weather.includes('CORCEL'));
  const wild = rules.classes.find((c) => c.id === 'hechicero').subclasses.find((s) => s.id === 'hechiceria-de-magia-salvaje').features.find((f) => f.id === '3-sobrecarga-de-magia-salvaje').references[0].description;
  const covered = [...wild.matchAll(/^(\d{2})–(\d{2}):/gm)].flatMap((m) => Array.from({length: (Number(m[2]) || 100) - Number(m[1]) + 1}, (_, i) => Number(m[1]) + i));
  assert.deepEqual(covered, Array.from({length:100}, (_,i) => i+1));
  assert.ok(wild.includes('1, Bola de fuego; 2, Confusión; 3, Grasa;'));
});

test('los tres compañeros primigenios tienen perfiles separados y fórmulas por nivel', () => {
  const refs = rules.classes.find((c) => c.id === 'explorador').subclasses.find((s) => s.id === 'senor-de-las-bestias').features.find((f) => f.id === '3-companero-primigenio').references;
  assert.deepEqual(refs.map((r) => r.name), ['Bestia de los mares', 'Bestia del cielo', 'Bestia de tierra firme']);
  for (const ref of refs) {
    assert.ok(!ref.requiresSourceCheck);
    assert.ok(ref.description.includes('CA 13 + tu modificador por Sabiduría'));
    assert.ok(ref.description.includes('tu nivel de explorador'));
  }
  assert.ok(refs[0].description.includes('nadar 18 m'));
  assert.ok(refs[1].description.includes('Pasar volando'));
  assert.ok(refs[2].description.includes('añade 1d6'));
});

test('las tablas de conjuros de subclase y los d20 no conservan celdas ilegibles', () => {
  const feature=(cls,id)=>rules.classes.find((c)=>c.id===cls).subclasses.flatMap((s)=>s.features).find((f)=>f.id===id);
  assert.ok(feature('brujo','3-conjuros-del-celestial').description.includes('7 Guardián de la fe'));
  assert.ok(feature('druida','3-conjuros-del-circulo-de-la-tierra').description.includes('7 Tormenta de hielo 9 Cono de frío'));
  assert.ok(feature('explorador','3-conjuros-de-acechador').description.includes('9 Terror 13 Invisibilidad mejorada 17 Apariencia'));
  assert.ok(feature('hechicero','14-trance-de-orden').description.includes('el d20'));
  assert.ok(feature('guerrero','10-supremacia-en-combate-mejorada').description.includes('un d10'));
  assert.ok(feature('monje','3-artes-sombrias').description.includes('truco ilusión menor.'));
  assert.ok(!rules.feats.find((f)=>f.id==='tiro-con-arco').description.includes('DOTES DE DON ÉPICO'));
});
