import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getLocalIsoDate } from '../../src/annexes/shared/local-date.js';

test('lokalna data kalendarzowa zachowuje 3 sierpnia 2026', () => {
  assert.equal(getLocalIsoDate(new Date(2026, 7, 3, 0, 30)), '2026-08-03');
});

test('lokalna data kalendarzowa uzupełnia jednocyfrowy miesiąc i dzień zerami', () => {
  assert.equal(getLocalIsoDate(new Date(2026, 0, 5)), '2026-01-05');
});

test('aktywne generatory nie używają toISOString do ustalania bieżącej daty aneksu', async () => {
  const files = [
    'src/application/prepare-annex.js',
    ...['11', '25', '25a', '26', '27', '29', '29a', '43', '45', '45c', '45e', '48']
      .map(id => `src/annexes/${id}/generator.js`)
  ];
  const sources = await Promise.all(files.map(file => readFile(file, 'utf8')));

  assert.equal(sources.some(source => /new Date\(\)\.toISOString\(\)/.test(source)), false);
});
