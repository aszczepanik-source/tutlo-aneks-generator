import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getAnnexRoute } from '../../router.js';

test('router i pozostałe aneksy pozostają dostępne', () => {
  for (const id of ['11', '26', '29', '29a']) assert.equal(getAnnexRoute(id).number, id);
});

test('frontend aneksu 26 używa tylko prepareAnnex26', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /prepareAnnex26\(currentContract/);
  assert.doesNotMatch(html, /extractAnnex26Contract|validateAnnex26SourceData|calculateAnnex26|logAnnex26Diagnostic/);
  assert.match(html, /replace\(\/\\D\/g,''\)\.slice\(0,26\)/);
});
