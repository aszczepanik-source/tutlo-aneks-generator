import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('wczytanie PDF pozostaje podłączone, a TEST POST został usunięty', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /els\.input\.addEventListener\('change'/);
  assert.match(html, /els\.dropzone\.addEventListener\('drop'/);
  assert.doesNotMatch(html, /testPostBtn|TEST POST|form\.submit\(\)/);
});
