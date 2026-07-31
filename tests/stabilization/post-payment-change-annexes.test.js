import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getAvailableAnnexCards, getPostPaymentChangeAnnexCards } from '../../src/annexes/availability.js';
import { prepareAnnex29 } from '../../src/annexes/29/generator.js';
import { prepareAnnex29a } from '../../src/annexes/29a/generator.js';
import { normalizeBankAccountInput } from '../../src/ui/bank-account-input.js';

const base = {
  agreementNumber: 'EL/2026/123', agreementDate: '2026-02-14', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1, Warszawa',
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
      assert.match(card.desc, /Konsultant wpisuje numer rachunku Tutlo/);
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

test('formularz pokazuje wymagane konto wyłącznie dla jawnego trybu post_payment_change', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const id of ['29', '29a']) {
    assert.match(html, new RegExp(`id="annex${id}TutloBankAccountField" hidden`));
    assert.match(html, new RegExp(`accountInput\\.required=postPaymentChange`));
    assert.match(html, new RegExp(`['"]annex${id}TutloBankAccount['"]`));
  }
  assert.match(html, /openGenerator\(item\.no,item\.mode\|\|'standard'\)/);
  assert.doesNotMatch(html, /prepareAnnex(?:29|29a)(?:Credit|PostPaymentChange)/);
});

test('wspólny ogranicznik pola rachunku zachowuje najwyżej pierwsze 26 cyfr', () => {
  const account = '12345678901234567890123456';
  assert.equal(normalizeBankAccountInput(account), account);
  assert.equal(normalizeBankAccountInput(`${account}7`), account);
  assert.equal(normalizeBankAccountInput(`${account}7890`), account);
  assert.equal(normalizeBankAccountInput('12 3456 7890 1234 5678 9012 3456 9999'), account);
  assert.equal(normalizeBankAccountInput('12ab! 3456-7890/1234.5678_9012+3456'), account);
});

test('oba pola rachunku aneksów 29 używają wspólnego ogranicznika zdarzenia input', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /for\(const id of \['annex29TutloBankAccount','annex29aTutloBankAccount'\]\)/);
  assert.match(html, /bindBankAccountInput\(document\.getElementById\(id\),'Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr\.'\)/);
});

for (const [id, prepare] of [['29', prepareAnnex29], ['29a', prepareAnnex29a]]) {
  test(`aneks ${id}: konto jest wymagane, walidowane i normalizowane w post_payment_change`, () => {
    for (const tutloBankAccount of ['', '1'.repeat(25), '1'.repeat(27), 'A'.repeat(26), '1'.repeat(25) + '-']) {
      assert.throws(() => prepare(credits[0], { mode: 'post_payment_change', tutloBankAccount }),
        /Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr/);
    }
    for (const contract of credits) {
      const snapshot = structuredClone(contract);
      const prepared = prepare(contract, {
        mode: 'post_payment_change', tutloBankAccount: '12 3456 7890 1234 5678 9012 3456', today: '2026-07-28'
      });
      assert.equal(prepared.context.mode, 'post_payment_change');
      assert.equal(prepared.context.tutloBankAccount, '12345678901234567890123456');
      assert.deepEqual(contract, snapshot);
    }
  });

  test(`aneks ${id}: dokładnie 26 cyfr pozwala generować, a krótszy numer nadal blokuje`, () => {
    const account = '12345678901234567890123456';
    assert.throws(() => prepare(credits[0], { mode: 'post_payment_change', tutloBankAccount: account.slice(0, 25) }),
      /Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr/);
    const prepared = prepare(credits[0], { mode: 'post_payment_change', tutloBankAccount: account });
    assert.equal(prepared.context.tutloBankAccount, account);
  });

  test(`aneks ${id}: limit + kredyt wymaga konta Tutlo w trybie po zmianie płatności`, () => {
    const limitCredit = credits.find(contract => contract.contractType === 'limit');
    assert.throws(() => prepare(limitCredit, { mode: 'post_payment_change', tutloBankAccount: '' }),
      /Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr/);
    const prepared = prepare(limitCredit, {
      mode: 'post_payment_change', tutloBankAccount: '12 3456 7890 1234 5678 9012 3456'
    });
    assert.equal(prepared.context.tutloBankAccount, '12345678901234567890123456');
  });

  test(`aneks ${id}: kredyt bez post_payment_change pozostaje zablokowany`, () => {
    assert.throws(() => prepare(credits[0]), /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
  });
}
