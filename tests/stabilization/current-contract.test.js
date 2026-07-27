import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_CONTRACT_FIELDS, parseCurrentContract, validateCurrentContract
} from '../../src/domain/contract-extraction.js';
import { recognizeCurrentContract } from '../../src/application/recognize-contract.js';

const ACCOUNT = '12345678901234567890123456';
const base = ({ buyer = 'IMIĘ I NAZWISKO: Jan Kowalski PESEL: 12345678901',
  type = 'ELASTYCZNY KURS JĘZYKOWY', payment = 'Raty 0% przy wykorzystaniu kredytu konsumenckiego',
  teachers = 'Lektorem Polskim, English Expert, Native Speaker', extra = '' } = {}) => `
UMOWA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY ${buyer} ADRES: Testowa 1 TELEFON: 500500500
SPECYFIKACJA KURSU ${type} Liczba Lekcji Indywidualnych: 192 Maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU ${teachers} WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 7 176,00 zł ${payment} ${extra}`;

const expected = (rawText, overrides = {}) => ({
  rawText, contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'EL/JF/811/192956/3/9/2025', agreementDate: '2025-09-03',
  customerType: 'person', customerName: 'Jan Kowalski', personalId: '12345678901',
  address: 'Testowa 1', coursePriceCents: 717600, lessonCount: 192,
  monthlyLessonLimit: 12, teacherVariant: 'polish_english_native',
  internalPaymentAccount: undefined, installmentPlan: undefined, ...overrides
});

const fullFixtures = [
  ['flexible + credit + person', {}, {}],
  ['flexible + credit + company', { buyer: 'FIRMA: Acme sp. z o.o. NIP: 1234567890' },
    { customerType: 'company', customerName: 'Acme sp. z o.o.', personalId: '1234567890' }],
  ['flexible + internal_24 + person', { payment: `raty wewnętrzne, kolejne 23 raty rachunek bankowy Tutlo: mBank S.A. ${ACCOUNT}` },
    { paymentType: 'internal', paymentVariant: 'internal_24', internalPaymentAccount: ACCOUNT, installmentPlan: { count: 24, dueDates: [] } }],
  ['flexible + internal_2', { payment: 'raty wewnętrzne, płatność następuje w 2 równych ratach' },
    { paymentType: 'internal', paymentVariant: 'internal_2', installmentPlan: { count: 2, dueDates: [] } }],
  ['flexible + internal_13', { payment: 'raty wewnętrzne: pierwszy rok z góry, następnie 12 rat' },
    { paymentType: 'internal', paymentVariant: 'internal_13', installmentPlan: { count: 13, dueDates: [] } }],
  ['flexible + internal_4', { payment: 'raty wewnętrzne, płatność następuje w 4 równych ratach' },
    { paymentType: 'internal', paymentVariant: 'internal_4', installmentPlan: { count: 4, dueDates: [] } }],
  ['limit + credit', { type: 'ZASADY KORZYSTANIA Z LEKCJI', payment: 'kredyt konsumencki' },
    { contractType: 'limit' }],
  ['limit + internal', { type: 'niewykorzystane lekcje nie przechodzą na kolejny miesiąc', payment: 'raty wewnętrzne w 4 ratach' },
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_4', installmentPlan: { count: 4, dueDates: [] } }]
];

for (const [name, options, overrides] of fullFixtures) {
  test(`fixture: ${name}`, () => {
    const rawText = base(options);
    assert.deepEqual(parseCurrentContract(rawText), expected(rawText, overrides));
  });
}

test('fixture: osoba bez PESEL nie jest zgadywana', () => {
  const contract = parseCurrentContract(base({ buyer: 'IMIĘ I NAZWISKO: Jan Kowalski' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), /kompletnego zestawu danych klienta/);
});

test('fixture: firma bez NIP nie jest zgadywana', () => {
  const contract = parseCurrentContract(base({ buyer: 'FIRMA: Acme sp. z o.o.' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), /kompletnego zestawu danych klienta/);
});

test('fixture: błędny teacherVariant', () => {
  const contract = parseCurrentContract(base({ teachers: 'Lektor bez rozpoznanego wariantu' }));
  assert.equal(contract.teacherVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu lektorów/);
});

test('fixture: nierozpoznany wariant płatności', () => {
  const contract = parseCurrentContract(base({ payment: 'raty wewnętrzne według indywidualnego harmonogramu' }));
  assert.equal(contract.paymentVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu płatności/);
});

test('przepływ wywołuje parser dokładnie raz i nie wprowadza aliasów', () => {
  const rawText = base();
  let calls = 0;
  const result = recognizeCurrentContract(rawText, value => { calls += 1; return parseCurrentContract(value); });
  assert.equal(calls, 1);
  assert.deepEqual(Object.keys(result), CURRENT_CONTRACT_FIELDS);
  for (const alias of ['pesel', 'nip', 'coursePrice', 'monthlyLimit', 'teacherTypes', 'installmentCount']) {
    assert.equal(Object.hasOwn(result, alias), false);
  }
});
