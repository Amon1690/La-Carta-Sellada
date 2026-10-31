import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertUniqueIds, assertLocalResource, validateCampaignRefs } from './validate-data.mjs';

test('rejects duplicate and missing identifiers', () => {
  assert.throws(() => assertUniqueIds([{ id: 'same' }, { id: 'same' }], 'fixtures'), /duplicado/);
  assert.throws(() => assertUniqueIds([{}], 'fixtures'), /identificador vacío/);
  assert.deepEqual([...assertUniqueIds([{ id: 'first' }, { id: 'second' }], 'fixtures')], ['first', 'second']);
});

test('checks exact case, missing assets and traversal independently of the host OS', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'la-carta-data-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'assets'));
  fs.writeFileSync(path.join(directory, 'assets', 'Map.png'), 'fixture');
  assert.equal(assertLocalResource(directory, 'assets/Map.png'), path.join(fs.realpathSync(directory), 'assets', 'Map.png'));
  assert.throws(() => assertLocalResource(directory, 'assets/map.png'), /mayúsculas incorrectas/);
  assert.throws(() => assertLocalResource(directory, 'assets/missing.png'), /inexistente/);
  for (const reference of ['../outside', 'assets/../../outside', 'assets/%2e%2e/outside', 'C:\\outside', '/outside']) {
    assert.throws(() => assertLocalResource(directory, reference), /fuera del directorio permitido/);
  }
});

test('links scenes to act labels while permitting narrative scene titles', () => {
  const campaign = { id: 'fixture', npcs: [], items: [], locations: [], encounters: [], playerCharacters: [],
    playerOptions: [], antagonistOptions: [], acts: [{ id: 'act-1', label: 'Acto I', scenes: ['Título narrativo'] }],
    scenes: [{ id: 'scene-1', act: 'Acto I' }] };
  assert.doesNotThrow(() => validateCampaignRefs(campaign));
  campaign.scenes[0].act = 'Acto desconocido';
  assert.throws(() => validateCampaignRefs(campaign), /acto desconocido/);
});
