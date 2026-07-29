import assert from 'node:assert/strict';
import test from 'node:test';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';

const contract = {
  contractType: 'flexible',
  paymentType: 'credit',
  paymentVariant: 'credit'
};

test('Aneks 43 jest widoczny wyłącznie dla płatnego wariantu grupy rodzinnej', () => {
  for (const familyGroupVariant of ['included', null, undefined]) {
    assert.equal(getAvailableAnnexCards({ ...contract, familyGroupVariant })
      .some(card => card.no === '43'), false);
  }

  const cards = getAvailableAnnexCards({ ...contract, familyGroupVariant: 'paid' });
  assert.equal(cards.filter(card => card.no === '43').length, 1);
  assert.equal(cards.find(card => card.no === '43').status, 'planned');
});
