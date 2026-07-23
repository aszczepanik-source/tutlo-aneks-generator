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

test('formularz aneksu 26 wymaga wyboru banku z zamkniętej listy', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="annex26Bank" required>([\s\S]*?)<\/select>/);
  assert.ok(select, 'pole Bank powinno być wymaganym elementem select');
  assert.match(select[1], /<option value="" selected disabled>Wybierz bank\.\.\.<\/option>/);
  const values = [...select[1].matchAll(/<option value="([^"]*)"/g)].map(match => match[1]);
  assert.deepEqual(values, ['', 'Inbank', 'Oney', 'BGŻ BNP Paribas', 'mBank', 'Ikano Bank', 'Alior Bank']);
  assert.doesNotMatch(select[1], /contenteditable|<input/);
});
