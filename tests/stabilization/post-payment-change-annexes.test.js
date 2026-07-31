import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  getAvailableAnnexCards,
  getPostPaymentChangeAnnexCards
} from '../../src/annexes/availability.js';

const limitedCredit = { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' };

test('sekcja po zmianie płatności jest dostępna wyłącznie dla limit + credit', () => {
  assert.equal(getPostPaymentChangeAnnexCards(limitedCredit).length, 4);
  for (const contract of [
    { contractType: 'limit', paymentType: 'internal' },
    { contractType: 'flexible', paymentType: 'credit' },
    { contractType: 'flexible', paymentType: 'internal' },
    { contractType: 'unknown', paymentType: 'credit' },
    { contractType: 'limit', paymentType: 'unknown' }
  ]) assert.deepEqual(getPostPaymentChangeAnnexCards(contract), []);
});

test('sekcja ma cztery unikalne, tekstowe identyfikatory w wymaganej kolejności', () => {
  const ids = getPostPaymentChangeAnnexCards(limitedCredit).map(card => card.no);
  assert.deepEqual(ids, ['45b', '29', '29a', '11a']);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(id => typeof id === 'string'));
  assert.notEqual(ids[0], '45');
  assert.notEqual(ids[2], '29');
  assert.notEqual(ids[3], '11');
});

test('każda karta wymaga zmiany płatności i pozostaje nieaktywna', () => {
  for (const card of getPostPaymentChangeAnnexCards(limitedCredit)) {
    assert.equal(card.enabled, false);
    assert.equal(card.status, 'planned');
    assert.match(card.desc, /Wymaga zmiany formy płatności/);
  }
});

test('standardowa lista limit + credit pozostaje bez zmian', () => {
  assert.deepEqual(getAvailableAnnexCards(limitedCredit).map(card => card.no), [
    'wydluzenie-dostepu', '20-lekcji-gratis', 'tutlo-premium', 'lektorzy-pl',
    '48', '30', '30a'
  ]);
});

test('nieaktywne karty nie mają obsługi kliknięcia ani połączenia z generatorami 29 i 29a', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /item\.enabled===false\?'disabled'/);
  assert.match(html, /if\(item\.enabled!==false\).*addEventListener/);
  assert.doesNotMatch(html, /prepareAnnex(?:29|29a)PostPaymentChange/);
});
