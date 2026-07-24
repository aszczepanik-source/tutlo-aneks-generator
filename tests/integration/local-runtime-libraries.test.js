import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('aktywny HTML ładuje PizZip i docxtemplater wyłącznie lokalnie', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const libraryTags = [...html.matchAll(/<script\s+[^>]*src=["']([^"']*(?:pizzip|docxtemplater)[^"']*)["'][^>]*>/gi)]
    .map(match => match[1]);
  assert.deepEqual(libraryTags, ['./vendor/pizzip.min.js', './vendor/docxtemplater.js']);
  assert.ok(libraryTags.every(url => !/^https?:\/\//i.test(url)));
});

test('build kopiuje obie biblioteki npm i sprawdza ich obecność w dist', async () => {
  const build = await readFile(new URL('../../scripts/build-release.mjs', import.meta.url), 'utf8');
  assert.match(build, /pizzip\/dist\/pizzip\.min\.js/);
  assert.match(build, /docxtemplater\/build\/docxtemplater\.js/);
  assert.match(build, /Promise\.all\(browserLibraries\.map/);
});
