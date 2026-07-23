import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { annexModules } from '../src/annexes/catalog.js';
import { getAnnexRoute, getAvailableAnnexRoutes } from '../router.js';

const EXISTING_ANNEXES = ['11', '25', '26', '29', '29a'];

test('router resolves annexes through the module registry', () => {
  for (const id of EXISTING_ANNEXES) {
    const route = getAnnexRoute(id);
    const registered = annexModules.get(id);

    assert.equal(route.number, registered.manifest.id);
    assert.equal(route.name, registered.manifest.label);
    assert.equal(route.template, registered.manifest.template);
    assert.deepEqual(route.requiredPlaceholders, registered.manifest.requiredFields);
    assert.equal(route.createGenerationPlan, registered.createGenerationPlan);
  }
  assert.equal(getAnnexRoute('27'), undefined);
});

test('all existing annex modules are available to the router', () => {
  assert.deepEqual(getAvailableAnnexRoutes().map(({ number }) => number), EXISTING_ANNEXES);
  assert.ok(getAvailableAnnexRoutes().every(({ available }) => available));
});

test('the existing interface and user path remain connected unchanged', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="pdfInput"/);
  assert.match(html, /id="analyzeBtn"/);
  assert.match(html, /id="annexGrid"/);
  assert.match(html, /id="manualAnnexGrid"/);
  assert.match(html, /import \{ getAnnexRoute \} from '\.\/router\.js'/);
  assert.match(html, /const route=getAnnexRoute\(no\)/);
  assert.match(html, /window\.open\(url,'_blank'\)/);
});
