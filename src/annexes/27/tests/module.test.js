import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAnnex27, prepareAnnex27 } from '../generator.js';
import { annex27Filename } from '../../../infrastructure/local-docx-generator.js';

const account = '12345678901234567890123456';
const contract = {
  agreementNumber: 'EL/1/1/1/1/1/2025', agreementDate: '2025-07-15', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1',
  coursePriceCents: 240000, monthlyInstallmentCents: 10000, lessonCount: 240,
  monthlyLessonLimit: 20, teacherVariant: 'polish_english_native', contractType: 'flexible',
  paymentType: 'credit', paymentVariant: 'credit', installmentPlan: undefined
};
const form = { bank: 'Inbank', newInstallment: '50,00', bankAccount: account, tutloAccount: `12 3456 7890 1234 5678 9012 3456` };

function prepare(agreementDate = '2025-07-15', today = '2026-06-28') {
  return prepareAnnex27({ ...contract, agreementDate }, form, today);
}

test('bazowe obliczenia 2400/100/12/50 i dokładnie 12 rat', () => {
  const result = calculateAnnex27(contract, '2026-06-28', 5000);
  assert.deepEqual({ paid: result.paidAmountCents, bank: result.remainingBankAmountCents,
    tutlo: result.remainingTutloAmountCents, discount: result.discountCents,
    price: result.newCoursePriceCents, refund: result.refundToBankCents, rows: result.remainingMonths },
  { paid: 120000, bank: 120000, tutlo: 60000, discount: 60000, price: 180000, refund: 120000, rows: 12 });
});

for (const [remaining, agreementDate] of [[6, '2025-01-15'], [20, '2026-03-15']]) {
  test(`${remaining} pozostałych rat ma numerację od I i termin w kolejnym miesiącu`, () => {
    const prepared = prepare(agreementDate);
    assert.equal(prepared.values.RATY.length, remaining);
    assert.equal(prepared.values.RATY[0].NUMER_RATY, 'I rata');
    assert.equal(prepared.values.RATY[0].TERMIN, '05.07.2026');
    assert.ok(prepared.values.RATY.every(row => Object.values(row).every(Boolean)));
  });
}

test('daty, etykiety identyfikatora, rachunki i kwoty bez podwójnego zł', () => {
  const person = prepare();
  const company = prepareAnnex27({ ...contract, customerType: 'company', customerName: 'Tutlo Sp. z o.o.', personalId: '1234567890' }, form, '2026-06-28');
  assert.equal(person.values.DATA_WEJSCIA_W_ZYCIE, '29.06.2026');
  assert.equal(person.values.IDENTYFIKATOR_LABEL, 'PESEL'); assert.equal(company.values.IDENTYFIKATOR_LABEL, 'NIP');
  assert.equal(person.values.NUMER_RACHUNKU_BANKU, account); assert.equal(person.values.NUMER_RACHUNKU_TUTLO, account);
  assert.equal(person.values.NOWA_CENA, '1800,00'); assert.equal(person.values.NOWA_SREDNIA_RATA, '75,00');
  assert.ok(!person.values.RATY[0].KWOTA.includes('zł'));
});

test('data wejścia w życie obsługuje koniec roku', () => assert.equal(prepareAnnex27({ ...contract, agreementDate: '2026-01-15' }, form, '2026-12-31').values.DATA_WEJSCIA_W_ZYCIE, '01.01.2027'));

test('waliduje bank, ratę, rabat i oba rachunki', () => {
  assert.throws(() => prepareAnnex27(contract, { ...form, bank: 'Inny' }, '2026-06-28'), /bank z listy/);
  assert.throws(() => prepareAnnex27(contract, { ...form, newInstallment: '100' }, '2026-06-28'), /niższa/);
  assert.throws(() => prepareAnnex27(contract, { ...form, newInstallment: '99,999' }, '2026-06-28'), /maksymalnie dwoma/);
  assert.throws(() => prepareAnnex27(contract, { ...form, bankAccount: account.slice(1) }, '2026-06-28'), /rachunku banku/);
  assert.throws(() => prepareAnnex27(contract, { ...form, tutloAccount: account.slice(1) }, '2026-06-28'), /rachunku Tutlo/);
  assert.throws(() => prepareAnnex27({ ...contract, coursePriceCents: 120000 }, form, '2026-06-28'), /rabat/);
});

test('dane dynamicznej tabeli nie mają pustych wierszy', () => {
  const prepared = prepare();
  assert.equal(prepared.values.RATY.length, 12);
  assert.ok(prepared.values.RATY.every(row => row.NUMER_RATY && row.KWOTA && row.TERMIN));
});

test('nazwa pliku usuwa wyłącznie znaki niedozwolone i ma fallback', () => {
  assert.equal(annex27Filename({ IMIE_NAZWISKO: 'Żaneta / Kowalska?' }), 'Aneks 27 Żaneta Kowalska.docx');
  assert.equal(annex27Filename({ IMIE_NAZWISKO: '//*' }), 'Aneks 27.docx');
});
