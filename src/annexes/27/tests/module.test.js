import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateAnnex27, prepareAnnex27 } from '../generator.js';
import { annex27Filename } from '../../../infrastructure/local-docx-generator.js';
import { normalizeBankAccountInput } from '../../../ui/bank-account-input.js';

const account = '12345678901234567890123456';
const contract = {
  agreementNumber: 'EL/1/1/1/1/1/2025', agreementDate: '2025-07-15', customerType: 'person',
  courseStartDate: '2025-07-15',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1',
  coursePriceCents: 240000, monthlyInstallmentCents: 10000, lessonCount: 240,
  monthlyLessonLimit: 20, teacherVariant: 'polish_english_native', contractType: 'flexible',
  paymentType: 'credit', paymentVariant: 'credit', installmentPlan: undefined
};
const form = { bank: 'Inbank', newInstallment: '50,00', bankAccount: account, tutloAccount: `12 3456 7890 1234 5678 9012 3456` };

test('oba pola rachunku używają wspólnego ogranicznika do 26 cyfr', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  assert.match(html, /for\(const id of \['annex27BankAccount','annex27TutloAccount'\]\)\{\s*bindBankAccountInput\(document\.getElementById\(id\)/);
  assert.equal(normalizeBankAccountInput('12 3456 7890 1234 5678 9012 3456 7890'), account);
});

function prepare(courseStartDate = '2025-07-15', today = '2026-06-28') {
  return prepareAnnex27({ ...contract, courseStartDate }, form, today);
}

test('bazowe obliczenia 2400/100/12/50 i dokładnie 12 rat', () => {
  const result = calculateAnnex27(contract, '2026-06-28', 5000);
  assert.deepEqual({ paid: result.paidAmountCents, bank: result.remainingBankAmountCents,
    tutlo: result.remainingTutloAmountCents, discount: result.discountCents,
    price: result.newCoursePriceCents, refund: result.refundToBankCents, rows: result.remainingMonths },
  { paid: 120000, bank: 120000, tutlo: 60000, discount: 60000, price: 180000, refund: 120000, rows: 12 });
});

for (const [remaining, courseStartDate] of [[6, '2025-01-15'], [20, '2026-03-15']]) {
  test(`${remaining} pozostałych rat ma numerację od I i termin w kolejnym miesiącu`, () => {
    const prepared = prepare(courseStartDate);
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

test('obliczenia zależą od początku kursu, a nie od formalnej daty umowy', () => {
  const first = prepareAnnex27({ ...contract, agreementDate: '2025-05-10', courseStartDate: '2025-07-01' }, form, '2026-07-30');
  const second = prepareAnnex27({ ...contract, agreementDate: '2025-06-15', courseStartDate: '2025-07-01' }, form, '2026-07-30');
  assert.deepEqual(first.calculation, second.calculation);
  assert.equal(first.calculation.paidMonths, 13);
});

test('zmiana początku kursu zmienia wyniki miesięczne zgodnie z dotychczasowym wzorem', () => {
  const february = prepareAnnex27({ ...contract, courseStartDate: '2026-02-01' }, form, '2026-07-30');
  const march = prepareAnnex27({ ...contract, courseStartDate: '2026-03-01' }, form, '2026-07-30');
  assert.equal(february.calculation.paidMonths, 6);
  assert.equal(march.calculation.paidMonths, 5);
  assert.notEqual(february.calculation.discountCents, march.calculation.discountCents);
  assert.notEqual(february.calculation.newCoursePriceCents, march.calculation.newCoursePriceCents);
});

test('aneks 27 stosuje regułę 15/16 także przez granicę roku', () => {
  for (const [courseStartDate, paidMonths, remainingMonths] of [
    ['2026-01-13', 7, 17],
    ['2026-01-15', 7, 17],
    ['2026-01-16', 6, 18],
    ['2026-01-20', 6, 18],
    ['2025-12-15', 8, 16],
    ['2025-12-16', 7, 17]
  ]) {
    const { calculation } = prepareAnnex27({ ...contract, courseStartDate }, form, '2026-07-20');
    assert.equal(calculation.paidMonths, paidMonths, courseStartDate);
    assert.equal(calculation.remainingMonths, remainingMonths, courseStartDate);
  }
});

test('aneks 27 poprawnie zmienia finanse i harmonogram dla 7 albo 6 wykorzystanych miesięcy', () => {
  const through15 = prepareAnnex27({ ...contract, courseStartDate: '2026-01-15' }, form, '2026-07-20');
  const after15 = prepareAnnex27({ ...contract, courseStartDate: '2026-01-16' }, form, '2026-07-20');

  assert.deepEqual({ paid: through15.calculation.paidAmountCents, remaining: through15.calculation.remainingMonths,
    discount: through15.calculation.discountCents, price: through15.calculation.newCoursePriceCents,
    rows: through15.values.RATY.length },
  { paid: 70000, remaining: 17, discount: 85000, price: 155000, rows: 17 });
  assert.deepEqual({ paid: after15.calculation.paidAmountCents, remaining: after15.calculation.remainingMonths,
    discount: after15.calculation.discountCents, price: after15.calculation.newCoursePriceCents,
    rows: after15.values.RATY.length },
  { paid: 60000, remaining: 18, discount: 90000, price: 150000, rows: 18 });
});

test('brak początku kursu blokuje generator bez fallbacku do daty umowy', () => {
  assert.throws(() => prepareAnnex27({ ...contract, courseStartDate: null }, form, '2026-07-30'),
    { message: 'Nie udało się odczytać daty rozpoczęcia kursu.' });
});

test('formalna data zawarcia umowy nadal trafia do DATA_ZAWARCIA_UMOWY', () => {
  const prepared = prepareAnnex27({ ...contract, agreementDate: '2025-05-10', courseStartDate: '2025-07-01' }, form, '2026-07-30');
  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '10.05.2025');
});

test('aneks 27 blokuje datę aneksu przed startem i miesiące poza zakresem bez clampowania', () => {
  assert.throws(() => prepareAnnex27({ ...contract, courseStartDate: '2026-07-21' }, form, '2026-07-20'),
    /przed datą rozpoczęcia kursu/);
  assert.throws(() => prepareAnnex27({ ...contract, courseStartDate: '2026-07-20' }, form, '2026-07-20'),
    /większa od 0/);
  assert.throws(() => prepareAnnex27({ ...contract, courseStartDate: '2024-07-15' }, form, '2026-07-20'),
    /przekroczył 24-miesięczny okres/);
});

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
