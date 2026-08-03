import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getAvailableAnnexCards, getPostPaymentChangeAnnexCards } from '../../src/annexes/availability.js';
import { prepareAnnex29 } from '../../src/annexes/29/generator.js';
import { prepareAnnex29a } from '../../src/annexes/29a/generator.js';

const base = {
  agreementNumber: 'EL/2026/123', agreementDate: '2026-02-14', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '00210100004', address: 'Testowa 1, Warszawa',
  coursePriceCents: 1392000, monthlyInstallmentCents: 58000, paymentVariant: 'credit', paymentType: 'credit'
};
const credits = ['flexible', 'limit'].map(contractType => ({ ...base, contractType }));

test('sekcja po zmianie płatności jest widoczna dla flexible + credit i limit + credit', () => {
  assert.equal(getPostPaymentChangeAnnexCards(credits[0]).length, 4);
  assert.equal(getPostPaymentChangeAnnexCards(credits[1]).length, 5);
  for (const contract of [
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24' },
    { contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24' },
    { contractType: 'unknown', paymentType: 'credit', paymentVariant: 'credit' }
  ]) assert.deepEqual(getPostPaymentChangeAnnexCards(contract), []);
});

test('29 i 29a są aktywne tylko w dodatkowej sekcji, a 45b i 11a pozostają planowane', () => {
  for (const contract of credits) {
    const cards = getPostPaymentChangeAnnexCards(contract);
    assert.deepEqual(cards.map(card => card.no), contract.contractType === 'limit'
      ? ['45b', '29', '29a', '11a', '45e'] : ['45b', '29', '29a', '11a']);
    for (const id of ['29', '29a']) {
      const card = cards.find(item => item.no === id);
      assert.equal(card.status, 'tutlo');
      assert.equal(card.enabled, true);
      assert.equal(card.mode, 'post_payment_change');
      assert.doesNotMatch(card.desc, /rachunku Tutlo/);
      assert.equal(getAvailableAnnexCards(contract).filter(item => item.no === id).length, 0);
    }
    for (const id of ['45b', '11a']) {
      const card = cards.find(item => item.no === id);
      assert.equal(card.status, 'planned');
      assert.equal(card.enabled, false);
    }
  }
});

test('umowy internal zachowują 29 i 29a wyłącznie w standardowej sekcji', () => {
  for (const contractType of ['flexible', 'limit']) {
    const contract = { contractType, paymentType: 'internal', paymentVariant: 'internal_24' };
    const standardIds = getAvailableAnnexCards(contract).map(card => card.no);
    assert.ok(standardIds.includes('29'));
    assert.ok(standardIds.includes('29a'));
    assert.deepEqual(getPostPaymentChangeAnnexCards(contract), []);
  }
});

test('formularze 29 i 29a nie pokazują pola rachunku Tutlo w żadnym trybie', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const id of ['29', '29a']) {
    assert.doesNotMatch(html, new RegExp(`annex${id}TutloBankAccount`));
  }
  assert.match(html, /openGenerator\(item\.no,item\.mode\|\|'standard'\)/);
  assert.match(html, /const prepared=prepare\(currentContract,\{mode\}\)/);
  assert.doesNotMatch(html, /prepareAnnex(?:29|29a)(?:Credit|PostPaymentChange)/);
});

for (const [id, prepare] of [['29', prepareAnnex29], ['29a', prepareAnnex29a]]) {
  test(`aneks ${id}: brak rachunku Tutlo nie blokuje post_payment_change ani nie trafia do wyniku`, () => {
    for (const contract of credits) {
      const snapshot = structuredClone(contract);
      const options = { mode: 'post_payment_change', today: '2026-07-28' };
      Object.defineProperty(options, 'tutloBankAccount', {
        get() { throw new Error('generator odczytał nieużywany parametr rachunku'); }
      });
      const prepared = prepare(contract, options);
      assert.deepEqual(prepared.context, { mode: 'post_payment_change' });
      assert.equal('tutloBankAccount' in prepared.values, false);
      assert.equal('tutloBankAccount' in prepared.context, false);
      assert.deepEqual(contract, snapshot);
    }
  });

  test(`aneks ${id}: wynik finansowy jest identyczny bez nieużywanego rachunku`, () => {
    const withoutAccount = prepare(credits[0], { mode: 'post_payment_change', today: '2026-07-28' });
    const withIgnoredAccount = prepare(credits[0], {
      mode: 'post_payment_change', today: '2026-07-28', tutloBankAccount: 'nie jest przekazywany'
    });
    assert.deepEqual(withoutAccount.values, withIgnoredAccount.values);
    assert.deepEqual(withoutAccount.calculation, withIgnoredAccount.calculation);
  });

  test(`aneks ${id}: tryb standardowy pozostaje bez zmian`, () => {
    const internal = {
      ...credits[0], paymentType: 'internal', paymentVariant: 'internal_24'
    };
    const prepared = prepare(internal, { mode: 'standard', today: '2026-07-28' });
    assert.deepEqual(prepared.context, { mode: 'standard' });
    assert.ok(Number.isSafeInteger(prepared.calculation.newCoursePriceCents));
  });

  test(`aneks ${id}: kredyt bez post_payment_change pozostaje zablokowany`, () => {
    assert.throws(() => prepare(credits[0]), /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
  });
}
