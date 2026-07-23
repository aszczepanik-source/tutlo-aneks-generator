import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { annexModules, getAnnexModule } from '../../src/annexes/catalog.js';
import { extractDocxPlaceholders } from '../../src/annexes/shared/template-inspection.js';

const EXPECTED_IDS = ['11', '25', '26', '29', '29a'];

test('katalog udostępnia dokładnie istniejące generatory', () => {
  assert.deepEqual([...annexModules.keys()], EXPECTED_IDS);
  for (const id of EXPECTED_IDS) assert.equal(getAnnexModule(id)?.manifest.id, id);
  assert.equal(getAnnexModule('nieznany'), undefined);
});

for (const [id, annex] of annexModules) {
  test(`aneks ${id}: manifest jest zgodny z placeholderami własnego DOCX`, async () => {
    const templateUrl = new URL(`../../src/annexes/${id}/${annex.manifest.template}`, import.meta.url);
    const placeholders = extractDocxPlaceholders(await readFile(templateUrl));
    assert.deepEqual(placeholders, [...annex.manifest.requiredFields].sort());
  });
}
