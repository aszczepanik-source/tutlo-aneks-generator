import assert from 'node:assert/strict';
import test from 'node:test';
import { ANNEX_STATUSES, getAvailableAnnexCards } from '../../src/annexes/availability.js';

const REQUIRED_IDS = [
  '26',
  'wydluzenie-dostepu',
  '20-lekcji-gratis',
  'tutlo-premium',
  '10',
  '43',
  '28',
  '27'
];

const flexibleCredit = hasFamilyAdditionalFee => ({
  type: 'flexible',
  payment: 'credit',
  hasFamilyAdditionalFee
});

test('elastyczna umowa kredytowa ma wyłącznie wymagane karty w wymaganej kolejności', () => {
  const cards = getAvailableAnnexCards(flexibleCredit(true));

  assert.deepEqual(cards.map(card => card.no), REQUIRED_IDS);
  assert.deepEqual(cards.map(card => card.name), [
    'Zmniejszenie rat kredytowych',
    'Wydłużenie dostępu',
    '20 lekcji gratis',
    'Aneks Tutlo Premium',
    'Aneks 10',
    'Grupa rodzinna (Tutlo Plus)',
    'Aneks 28',
    'Aneks 27'
  ]);
  assert.equal(cards.length, REQUIRED_IDS.length);

  for (const hidden of ['11', '25', '29', '29a', '45', '48']) {
    assert.equal(cards.some(card => card.no === hidden), false, `${hidden} powinien być ukryty`);
  }
});

test('Grupa rodzinna wymaga wykrytej frazy „za dodatkową opłatą”', () => {
  assert.deepEqual(
    getAvailableAnnexCards(flexibleCredit(false)).map(card => card.no),
    REQUIRED_IDS.filter(id => id !== '43')
  );
  assert.equal(getAvailableAnnexCards(flexibleCredit(undefined)).some(card => card.no === '43'), false);
  assert.equal(getAvailableAnnexCards(flexibleCredit(true)).some(card => card.no === '43'), true);
});

test('statusy kart elastycznej umowy kredytowej mają właściwe kolory', () => {
  const cards = getAvailableAnnexCards(flexibleCredit(true));
  const expectedStatuses = ['tutlo', 'external', 'external', 'external', 'planned', 'planned', 'planned', 'planned'];

  assert.deepEqual(cards.map(card => card.status), expectedStatuses);
  assert.deepEqual(expectedStatuses.map(status => ANNEX_STATUSES[status].label), [
    'Generator Tutlo',
    'Aneks w Team Tutlo',
    'Aneks w Team Tutlo',
    'Aneks w Team Tutlo',
    'W przygotowaniu',
    'W przygotowaniu',
    'W przygotowaniu',
    'W przygotowaniu'
  ]);
  assert.deepEqual(expectedStatuses.map(status => ANNEX_STATUSES[status].className), [
    'generator-tutlo',
    'external-generator',
    'external-generator',
    'external-generator',
    'in-preparation',
    'in-preparation',
    'in-preparation',
    'in-preparation'
  ]);
});

test('elastyczna umowa na 24 raty wewnętrzne ma dokładnie wymagane karty i statusy', () => {
  const internal = getAvailableAnnexCards({
    type: 'flexible', payment: 'internal', variant: '24 równe raty miesięczne', hasPolishLecturers: false
  });
  assert.deepEqual(internal.map(card => card.no), [
    '25', '11', '29', '29a', 'wydluzenie-dostepu', '20-lekcji-gratis',
    'rozlozenie-platnosci', 'tutlo-premium', '45'
  ]);
  assert.deepEqual(internal.map(card => card.status), [
    'tutlo', 'planned', 'planned', 'planned', 'external', 'external', 'external', 'external', 'planned'
  ]);
  assert.equal(internal.some(card => card.no === '26'), false);
});

test('reguła rat wewnętrznych nie zmienia pozostałych wariantów', () => {
  assert.ok(getAvailableAnnexCards({ type: 'limit', payment: 'credit' }).some(card => card.no === '45'));
});
