import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';
import {
  getAvailableAnnexCards, getScheduleChangeAnnexCards, getPostPaymentChangeAnnexCards, isAnnexAvailable
} from '../../src/annexes/availability.js';
import { prepareAnnex29 } from '../../src/annexes/29/generator.js';
import { prepareAnnex29a } from '../../src/annexes/29a/generator.js';

const fixtureOneTime = `UMOWA O ŚWIADCZENIE USŁUG EL/TESTE/105/205/12/1/2026
Tutlo sp. z o.o., NIP: 7010701530
DANE NABYWCY
IMIĘ I NAZWISKO: Jan Testowy PESEL: 00210100004
ADRES: ul. Testowa 3, 00-003 Warszawa
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 12 miesięcy
Liczba Lekcji Indywidualnych: 144
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU
144 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert oraz Native Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena pakietu kursu wynosi: 5460.6 zł brutto, co oznacza, że wynagrodzenie przysługujące Tutlo za każdy miesiąc trwania
Umowy wynosi 455.05 zł brutto.
Płatność następuje jednorazowo w terminie do 1 dnia po podpisaniu umowy, przelewem elektronicznym za pośrednictwem Autopay S.A. z
siedzibą w Sopocie lub przelewem bankowym na następujący rachunek bankowy Tutlo: mBank S.A.- 70114010104903574502000000.
Płatność uznaje się za dokonaną po zaksięgowaniu przelewu na ww. rachunku bankowym Tutlo.
§ 3 WARUNKI UMOWY`;

test('parser rozpoznaje jednorazową wpłatę wewnętrzną jako internal_1 dla umowy z limitem', () => {
  const contract = parseCurrentContract(fixtureOneTime);
  assert.equal(contract.contractType, 'limit');
  assert.equal(contract.paymentType, 'internal');
  assert.equal(contract.paymentVariant, 'internal_1');
  assert.equal(contract.internalPaymentAccount, '70114010104903574502000000');
  assert.equal(contract.coursePriceCents, 546060);
  assert.equal(contract.monthlyInstallmentCents, 45505);
  assert.equal(contract.installmentPlan.paymentCount, 1);
  assert.equal(contract.installmentPlan.followingPaymentsCount, 0);
  assert.equal(contract.installmentPlan.paymentVariant, 'internal_1');
});

const base = {
  agreementNumber: 'EL/2026/123', agreementDate: '2026-02-14', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '00210100004', address: 'Testowa 1, Warszawa',
  coursePriceCents: 546060, monthlyInstallmentCents: 45505, paymentType: 'internal'
};

test('sekcja po zmianie harmonogramu obejmuje jednorazową wpłatę oraz 2/4/13 rat dla flexible i limit', () => {
  for (const contractType of ['flexible', 'limit']) {
    for (const paymentVariant of ['internal_1', 'internal_2', 'internal_4', 'internal_13']) {
      const contract = { ...base, contractType, paymentVariant };
      const cards = getScheduleChangeAnnexCards(contract);
      const expectedIds = contractType === 'flexible' && ['internal_2', 'internal_4'].includes(paymentVariant)
        ? ['29', '29a', '25a'] : ['29', '29a'];
      assert.deepEqual(cards.map(card => card.no), expectedIds);
      for (const card of cards.filter(item => ['29', '29a'].includes(item.no))) {
        assert.equal(card.status, 'tutlo');
        assert.equal(card.enabled, true);
        assert.equal(card.mode, 'post_schedule_change');
      }
      const annex25a = cards.find(item => item.no === '25a');
      if (annex25a) { assert.equal(annex25a.status, 'tutlo'); assert.equal(annex25a.enabled, true); }
      assert.equal(getAvailableAnnexCards(contract)
        .filter(item => ['29', '29a', '25a'].includes(item.no) && item.status === 'tutlo').length, 0);
    }
  }
});

test('sekcja po zmianie harmonogramu nie obejmuje standardowych 24 rat, kredytu ani nieobsługiwanych typów', () => {
  assert.deepEqual(getScheduleChangeAnnexCards({ ...base, contractType: 'flexible', paymentVariant: 'internal_24' }), []);
  assert.deepEqual(getScheduleChangeAnnexCards({ ...base, contractType: 'limit', paymentVariant: 'internal_24' }), []);
  assert.deepEqual(getScheduleChangeAnnexCards({ ...base, contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' }), []);
  assert.deepEqual(getScheduleChangeAnnexCards({ ...base, contractType: 'unknown', paymentVariant: 'internal_2' }), []);
  assert.deepEqual(getScheduleChangeAnnexCards(undefined), []);
});

test('isAnnexAvailable zwraca true dla 29/29a w trybie po zmianie harmonogramu', () => {
  for (const contractType of ['flexible', 'limit']) {
    for (const paymentVariant of ['internal_1', 'internal_2', 'internal_4', 'internal_13']) {
      const contract = { ...base, contractType, paymentVariant };
      assert.equal(isAnnexAvailable('29', contract), true);
      assert.equal(isAnnexAvailable('29a', contract), true);
    }
  }
  assert.equal(isAnnexAvailable('29', { ...base, contractType: 'flexible', paymentVariant: 'internal_24' }), true);
  assert.deepEqual(getPostPaymentChangeAnnexCards({ ...base, contractType: 'flexible', paymentVariant: 'internal_1' }), []);
});

for (const [id, prepare] of [['29', prepareAnnex29], ['29a', prepareAnnex29a]]) {
  test(`aneks ${id}: tryb post_schedule_change działa dla flexible i limit z jednorazową wpłatą oraz 2/4/13 ratami`, () => {
    for (const contractType of ['flexible', 'limit']) {
      for (const paymentVariant of ['internal_1', 'internal_2', 'internal_4', 'internal_13']) {
        const contract = { ...base, contractType, paymentVariant };
        const prepared = prepare(contract, { mode: 'post_schedule_change', today: '2026-07-28' });
        assert.deepEqual(prepared.context, { mode: 'post_schedule_change' });
        assert.ok(Number.isSafeInteger(prepared.calculation.newCoursePriceCents));
      }
    }
  });

  test(`aneks ${id}: tryb post_schedule_change odrzuca internal_24 i kredyt`, () => {
    assert.throws(() => prepare({ ...base, contractType: 'flexible', paymentVariant: 'internal_24' },
      { mode: 'post_schedule_change', today: '2026-07-28' }), /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
    assert.throws(() => prepare({ ...base, contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
      { mode: 'post_schedule_change', today: '2026-07-28' }), /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
  });

  test(`aneks ${id}: bez trybu post_schedule_change warianty 1/2/4/13 pozostają zablokowane`, () => {
    for (const paymentVariant of ['internal_1', 'internal_2', 'internal_4', 'internal_13']) {
      assert.throws(() => prepare({ ...base, contractType: 'flexible', paymentVariant }),
        /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
      assert.throws(() => prepare({ ...base, contractType: 'limit', paymentVariant }),
        /wymaga umowy flexible z ratami wewnętrznymi internal_24/);
    }
  });
}
