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
  assert.match(html, /downloadAnnex26\(prepared/);
});

test('interface presents the requested annex statuses and click messages', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /Generator Tutlo/);
  assert.match(html, /Aneks w Team Tutlo/);
  assert.match(html, /W przygotowaniu/);
  assert.match(html, /Ten aneks jest obsługiwany w dedykowanym generatorze\./);
  assert.match(html, /Ten aneks nie został jeszcze wdrożony\./);

  for (const [id, name] of [
    ['11', 'Zawieszenie umowy'],
    ['26', 'Zmniejszenie rat kredytowych'],
    ['29', 'Jedna rata gratis'],
    ['29a', 'Dwie raty gratis']
  ]) {
    assert.match(html, new RegExp(`no:'${id}',name:'${name}',status:'tutlo'`));
  }
  assert.match(html, /name:'Rozszerzenie pakietu lektorów'.*hasPolishLecturers===false/);
  assert.match(html, /name:'Aneks 45'.*type==='limit'.*payment==='credit'/);
});

test('konfiguracja release zawiera moduły i lokalne szablony wymagane przez GitHub Pages', async () => {
  const releaseHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const generator = await readFile(new URL('../src/infrastructure/local-docx-generator.js', import.meta.url), 'utf8');
  const build = await readFile(new URL('../scripts/build-release.mjs', import.meta.url), 'utf8');
  const annex25Template = await readFile(new URL('../src/annexes/25/template.docx', import.meta.url));
  const annex26Template = await readFile(new URL('../src/annexes/26/template.docx', import.meta.url));
  assert.match(build, /cp\(new URL\('\.\.\/src\/'[\s\S]*recursive: true/);
  assert.match(releaseHtml, /type="module"/);
  assert.match(generator, /renderDocx/);
  assert.ok(annex25Template.byteLength > 0);
  assert.ok(annex26Template.byteLength > 0);
  assert.doesNotMatch(releaseHtml, /AppsScriptClient|APPS_SCRIPT_URL/);
});

test('workflow Pages pokazuje pełny wynik nieudanych testów', async () => {
  const workflow = await readFile(new URL('../.github/workflows/main.yml', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.match(workflow, /- name: Run tests\s+run: npm test/);
  assert.doesNotMatch(workflow, /test-results\.log|szczegóły pozostają ukryte|ukrywania? endpointu/i);
  assert.match(packageJson.scripts.test, /tests\/\*\.test\.js/);
  assert.match(packageJson.scripts.test, /src\/annexes\/\*\/tests\/\*\.test\.js/);
  assert.doesNotMatch(packageJson.scripts.test, /^node --test$/);
});
