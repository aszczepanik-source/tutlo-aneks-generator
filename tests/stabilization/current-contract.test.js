import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTRACT_TYPES, CURRENT_CONTRACT_FIELDS, PAYMENT_TYPES, PAYMENT_VARIANTS,
  TEACHER_VARIANTS, parseCurrentContract, validateCurrentContract
} from '../../src/domain/contract-extraction.js';
import { recognizeCurrentContract } from '../../src/application/recognize-contract.js';

const ACCOUNT = '12345678901234567890123456';
const base = ({ buyer = 'IMIĘ I NAZWISKO: Jan Kowalski PESEL: 12345678901',
  type = 'ELASTYCZNY KURS JĘZYKOWY', payment = 'Raty 0% przy wykorzystaniu kredytu konsumenckiego',
  teachers = 'Lektorem Polskim, English Expert, Native Speaker', extra = '' } = {}) => `
UMOWA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY ${buyer} ADRES: Testowa 1 TELEFON: 500500500
SPECYFIKACJA KURSU ${type} Liczba Lekcji Indywidualnych: 192 Maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU ${teachers} WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 7 176,00 zł ${payment} ${/raty wewnętrzne/i.test(payment) && !payment.includes(ACCOUNT) ? `rachunek bankowy Tutlo: mBank S.A. ${ACCOUNT}` : ''} ${extra}`;

const expected = (rawText, overrides = {}) => ({
  rawText, contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'EL/JF/811/192956/3/9/2025', agreementDate: '2025-09-03',
  customerType: 'person', customerName: 'Jan Kowalski', personalId: '12345678901',
  address: 'Testowa 1', coursePriceCents: 717600, lessonCount: 192,
  monthlyLessonLimit: 12, teacherVariant: 'polish_english_native',
  internalPaymentAccount: null, installmentPlan: undefined, ...overrides
});

const fullFixtures = [
  ['flexible + credit + person', {}, {}],
  ['flexible + credit + company', { buyer: 'FIRMA: Acme sp. z o.o. NIP: 1234567890' },
    { customerType: 'company', customerName: 'Acme sp. z o.o.', personalId: '1234567890' }],
  ['flexible + internal_24 + person', { payment: `raty wewnętrzne, kolejne 23 raty rachunek bankowy Tutlo: mBank S.A. ${ACCOUNT}` },
    { paymentType: 'internal', paymentVariant: 'internal_24', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 24 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['flexible + internal_24 + company', { buyer: 'FIRMA: Acme sp. z o.o. NIP: 1234567890', payment: `raty wewnętrzne, kolejne 23 raty rachunek bankowy Tutlo: mBank S.A. ${ACCOUNT}` },
    { customerType: 'company', customerName: 'Acme sp. z o.o.', personalId: '1234567890', paymentType: 'internal', paymentVariant: 'internal_24', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 24 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['flexible + internal_2', { payment: 'raty wewnętrzne, płatność następuje w 2 równych ratach' },
    { paymentType: 'internal', paymentVariant: 'internal_2', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 2 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['flexible + internal_13', { payment: 'raty wewnętrzne: pierwszy rok z góry, następnie 12 rat' },
    { paymentType: 'internal', paymentVariant: 'internal_13', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 13 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['flexible + internal_4', { payment: 'raty wewnętrzne, płatność następuje w 4 równych ratach' },
    { paymentType: 'internal', paymentVariant: 'internal_4', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 4 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['limit + credit', { type: 'ZASADY KORZYSTANIA Z LEKCJI', payment: 'kredyt konsumencki' },
    { contractType: 'limit' }],
  ['limit + internal_24', { type: 'niewykorzystane lekcje nie przechodzą na kolejny miesiąc', payment: 'raty wewnętrzne: 24 miesięczne raty' },
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 24 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['limit + internal_2', { type: 'niewykorzystane lekcje nie przechodzą na kolejny miesiąc', payment: 'raty wewnętrzne w 2 ratach' },
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_2', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 2 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['limit + internal_13', { type: 'niewykorzystane lekcje nie przechodzą na kolejny miesiąc', payment: 'raty wewnętrzne: pierwszy rok z góry, następnie 12 rat' },
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_13', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 13 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }],
  ['limit + internal_4', { type: 'niewykorzystane lekcje nie przechodzą na kolejny miesiąc', payment: 'raty wewnętrzne w 4 ratach' },
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_4', internalPaymentAccount: ACCOUNT, installmentPlan: Array.from({ length: 4 }, (_, index) => ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' })) }]
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
  assert.throws(() => validateCurrentContract(contract), /Nie rozpoznano typu klienta/);
});

test('fixture: firma bez NIP nie jest zgadywana', () => {
  const contract = parseCurrentContract(base({ buyer: 'FIRMA: Acme sp. z o.o.' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), /Nie rozpoznano typu klienta/);
});

test('fixture: sama etykieta FIRMA bez danych nie ustala typu klienta', () => {
  const contract = parseCurrentContract(base({ buyer: 'FIRMA:' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), { message: 'Nie rozpoznano typu klienta.' });
});

test('fixture: błędny numer umowy jest odrzucany konkretnym komunikatem', () => {
  const contract = parseCurrentContract(base().replace('EL/JF/811/192956/3/9/2025', 'EL/JF/błędny'));
  assert.equal(contract.agreementNumber, undefined);
  assert.throws(() => validateCurrentContract(contract), { message: 'Nie odczytano poprawnego numeru umowy.' });
});

test('fixture: błędny teacherVariant', () => {
  const contract = parseCurrentContract(base({ teachers: 'Lektor bez rozpoznanego wariantu' }));
  assert.equal(contract.teacherVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu lektorów/);
});

test('fixture: nierozpoznany wariant płatności', () => {
  const contract = parseCurrentContract(base({ payment: 'raty wewnętrzne według indywidualnego harmonogramu' }));
  assert.equal(contract.paymentVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu rat wewnętrznych/);
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

test('zamrożony kontrakt blokuje zmianę pól, enumów, typów i formatów', () => {
  const result = parseCurrentContract(base());
  assert.deepEqual(Object.keys(result), CURRENT_CONTRACT_FIELDS);
  assert.deepEqual(CONTRACT_TYPES, ['flexible', 'limit']);
  assert.deepEqual(PAYMENT_TYPES, ['credit', 'internal']);
  assert.deepEqual(PAYMENT_VARIANTS, ['credit', 'internal_24', 'internal_2', 'internal_13', 'internal_4']);
  assert.deepEqual(TEACHER_VARIANTS, ['polish_english_native', 'english_native']);
  assert.match(result.agreementDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isInteger(result.coursePriceCents), true);
  assert.equal(result.internalPaymentAccount, null);
  for (const alias of ['pesel', 'nip', 'fullName', 'clientName', 'companyName', 'coursePrice',
    'oldPrice', 'monthlyLimit', 'teacherTypes', 'installmentCount', 'accountNumber']) {
    assert.equal(Object.hasOwn(result, alias), false);
  }
});
