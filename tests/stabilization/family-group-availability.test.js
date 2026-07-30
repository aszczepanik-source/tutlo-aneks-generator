import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';

const contracts = [
  { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
  { contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24' },
  { contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit' },
  { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_4' }
];

test('Aneks 43 jest widoczny wyłącznie dla płatnego wariantu grupy rodzinnej', () => {
  for (const contract of contracts) {
    for (const familyGroupVariant of ['included', null, undefined]) {
      const cards = getAvailableAnnexCards({ ...contract, familyGroupVariant });
      assert.equal(cards.some(card => ['35', '43'].includes(card.no)), false);
    }

    const cards = getAvailableAnnexCards({ ...contract, familyGroupVariant: 'paid' });
    assert.equal(cards.some(card => card.no === '35'), false);
    assert.equal(cards.filter(card => card.no === '43').length, 1);
    assert.equal(cards.find(card => card.no === '43').name, '43 – Grupa Rodzinna');
    assert.equal(cards.find(card => card.no === '43').status, 'tutlo');
  }
});

test('Aneks 43 nie ma dodatkowego warunku typu umowy, limitu ani płatności', () => {
  const cards = getAvailableAnnexCards({
    contractType: undefined,
    paymentType: undefined,
    paymentVariant: undefined,
    familyGroupVariant: 'paid'
  });

  assert.deepEqual(cards.map(card => card.no), ['43']);
});
