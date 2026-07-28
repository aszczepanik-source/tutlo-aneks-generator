import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ANNEX_STATUSES, getAvailableAnnexCards } from '../../src/annexes/availability.js';

const flexibleInternalIds = variant => [
  ...(variant === 'internal_24' ? ['25'] : []),
  'wydluzenie-dostepu', '20-lekcji-gratis', 'rozlozenie-platnosci', 'tutlo-premium',
  '11', '29', '29a', '45'
];
const flexibleInternalStatuses = variant => [
  ...(variant === 'internal_24' ? ['tutlo'] : []),
  'external', 'external', 'external', 'external',
  'planned', 'planned', 'planned', 'planned'
];
const limitInternalIds = [
  'wydluzenie-dostepu', '20-lekcji-gratis', 'rozlozenie-platnosci', 'tutlo-premium',
  'lektorzy-pl', '45', '35', '48', '29', '29a'
];
const limitInternalStatuses = [
  'external', 'external', 'external', 'external', 'external',
  'planned', 'planned', 'planned', 'planned', 'planned'
];

function assertCards(contract, expectedIds, expectedStatuses) {
  const before = structuredClone(contract);
  const cards = getAvailableAnnexCards(contract);
  assert.deepEqual(cards.map(card => card.no), expectedIds);
  assert.deepEqual(cards.map(card => card.status), expectedStatuses);
  assert.equal(cards.length, expectedIds.length, 'matrix must not return extra cards');
  assert.equal(new Set(cards.map(card => card.no)).size, cards.length, 'card ids must be unique');
  assert.deepEqual(contract, before, 'router must not mutate currentContract');
}

for (const paymentVariant of ['internal_24', 'internal_2', 'internal_13', 'internal_4']) {
  test(`flexible + ${paymentVariant} has the exact card matrix`, () => {
    assertCards(
      { contractType: 'flexible', paymentType: 'internal', paymentVariant, rawText: 'ignored' },
      flexibleInternalIds(paymentVariant), flexibleInternalStatuses(paymentVariant)
    );
  });

  test(`limit + ${paymentVariant} has the exact card matrix`, () => {
    assertCards(
      { contractType: 'limit', paymentType: 'internal', paymentVariant, rawText: 'ignored' },
      limitInternalIds, limitInternalStatuses
    );
  });
}

test('flexible + credit has the exact card matrix', () => {
  assertCards(
    { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
    ['26', 'wydluzenie-dostepu', '20-lekcji-gratis', 'tutlo-premium', '30', '30a', '10', '35'],
    ['tutlo', 'external', 'external', 'external', 'planned', 'planned', 'planned', 'planned']
  );
});

test('limit + credit has the exact card matrix', () => {
  assertCards(
    { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' },
    ['wydluzenie-dostepu', '20-lekcji-gratis', 'tutlo-premium', 'lektorzy-pl',
      '45', '35', '48', '30', '30a'],
    ['external', 'external', 'external', 'external',
      'planned', 'planned', 'planned', 'planned', 'planned']
  );
});

test('yellow generators occur only in their exact supported combinations', () => {
  const combinations = [
    ...['internal_24', 'internal_2', 'internal_13', 'internal_4'].flatMap(paymentVariant => [
      { contractType: 'flexible', paymentType: 'internal', paymentVariant },
      { contractType: 'limit', paymentType: 'internal', paymentVariant }
    ]),
    { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
    { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' }
  ];
  for (const contract of combinations) {
    const yellowIds = getAvailableAnnexCards(contract)
      .filter(card => card.status === 'tutlo').map(card => card.no);
    const expected = contract.contractType === 'flexible' && contract.paymentVariant === 'internal_24'
      ? ['25']
      : contract.contractType === 'flexible' && contract.paymentVariant === 'credit' ? ['26'] : [];
    assert.deepEqual(yellowIds, expected);
  }
});

test('statuses preserve yellow, green and red UI meanings', () => {
  assert.deepEqual(ANNEX_STATUSES, {
    tutlo: { label: 'Generator Tutlo', className: 'generator-tutlo' },
    external: { label: 'Aneks w Team Tutlo', className: 'external-generator' },
    planned: { label: 'W przygotowaniu', className: 'in-preparation' }
  });
});

test('router reads no rawText and planned cards cannot open a generator', async () => {
  const availability = await readFile(new URL('../../src/annexes/availability.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(availability, /rawText/);
  assert.match(html, /if\(item\.status==='planned'\)[\s\S]*?return;/);
  assert.match(html, /const items=getAvailableAnnexCards\(contract\)/);
  assert.doesNotMatch(availability, /prepareAnnex|validate|generate|downloadAnnex/);
});

test('unsupported or incomplete classifications return no cards', () => {
  assert.deepEqual(getAvailableAnnexCards(undefined), []);
  assert.deepEqual(getAvailableAnnexCards({ contractType: 'flexible', paymentType: 'credit' }), []);
  assert.deepEqual(getAvailableAnnexCards({
    contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_unknown'
  }), []);
});
