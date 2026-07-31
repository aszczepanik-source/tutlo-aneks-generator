import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnnexRoute, getAvailableAnnexRoutes } from '../../router.js';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { annexModules, getAnnexModule } from '../../src/annexes/catalog.js';
import { prepareAnnex43 } from '../../src/annexes/43/index.js';

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

test('aktywny runtime rejestruje wyłącznie Aneks 43 dla Grupy Rodzinnej', () => {
  assert.equal(annexModules.has('35'), false);
  assert.equal(getAnnexModule('35'), undefined);
  assert.equal(getAnnexRoute('35'), undefined);

  const annex43 = getAnnexModule('43');
  assert.equal(annex43.manifest.id, '43');
  assert.equal(annex43.manifest.label, '43 – Grupa Rodzinna');
  assert.equal(annex43.prepareAnnex43, prepareAnnex43);
});

test('router udostępnia Aneks 43 dokładnie raz tylko dla wariantu paid', () => {
  for (const contract of contracts) {
    const paidRoutes = getAvailableAnnexRoutes({ ...contract, familyGroupVariant: 'paid' });
    assert.equal(paidRoutes.filter(route => route.number === '43').length, 1);
    assert.equal(paidRoutes.some(route => route.number === '35'), false);

    for (const familyGroupVariant of ['included', null, undefined]) {
      const routes = getAvailableAnnexRoutes({ ...contract, familyGroupVariant });
      assert.equal(routes.some(route => route.number === '43'), false);
      assert.equal(routes.some(route => route.number === '35'), false);
    }
  }
});
