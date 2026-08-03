import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('currentContract nie przechowuje pełnego tekstu PDF', () => {
  const rawText = 'poufny tekst PDF klienta';
  const contract = parseCurrentContract(rawText);
  assert.equal(Object.hasOwn(contract, 'rawText'), false);
  assert.equal(JSON.stringify(contract).includes(rawText), false);
});

test('aktywny kod nie loguje danych klienta ani pełnych payloadów', async () => {
  const [html, extraction, availability] = await Promise.all([
    read('index.html'), read('src/domain/contract-extraction.js'), read('src/annexes/availability.js')
  ]);
  const activeSource = `${html}\n${extraction}\n${availability}`;
  assert.doesNotMatch(activeSource, /console\.(?:log|debug|info)\s*\(/);
  assert.doesNotMatch(activeSource, /console\.error\s*\([^)]*(?:rawText|currentContract|prepared\.values|body|response)/i);
});

test('.gitignore obejmuje wymagane artefakty i materiały poufne', async () => {
  const entries = new Set((await read('.gitignore')).split(/\r?\n/).map(line => line.trim()));
  for (const entry of ['node_modules/', 'coverage/', 'tmp/', 'logs/', '*.log', '*.pem', '*.key', '*.p12', '*.pfx']) {
    assert.equal(entries.has(entry), true, `brak wpisu ${entry}`);
  }
});

test('workflow instaluje zależności deterministycznie przez npm ci', async () => {
  const workflow = await read('.github/workflows/main.yml');
  assert.match(workflow, /run:\s*npm ci\b/);
  assert.doesNotMatch(workflow, /run:\s*npm install\b/);
});

test('martwy Apps Script nie jest częścią aktywnego runtime', async () => {
  const [html, build, packageJson] = await Promise.all([
    read('index.html'), read('scripts/build-release.mjs'), read('package.json')
  ]);
  assert.doesNotMatch(`${html}\n${build}\n${packageJson}`, /AppsScriptClient|APPS_SCRIPT_URL|apps-scirpt/);
});
