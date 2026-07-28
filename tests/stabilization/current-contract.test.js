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
  assert.throws(() => validateCurrentContract(contract), error =>
    error.errors.some(item => item.field === 'customerType'));
});

test('fixture: firma bez NIP nie jest zgadywana', () => {
  const contract = parseCurrentContract(base({ buyer: 'FIRMA: Acme sp. z o.o.' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), error =>
    error.errors.some(item => item.field === 'customerType'));
});

test('fixture: sama etykieta FIRMA bez danych nie ustala typu klienta', () => {
  const contract = parseCurrentContract(base({ buyer: 'FIRMA:' }));
  assert.equal(contract.customerType, undefined);
  assert.throws(() => validateCurrentContract(contract), error =>
    error.errors.some(item => item.field === 'customerType'));
});

test('fixture: błędny numer umowy jest odrzucany konkretnym komunikatem', () => {
  const contract = parseCurrentContract(base().replace('EL/JF/811/192956/3/9/2025', 'EL/JF/błędny'));
  assert.equal(contract.agreementNumber, undefined);
  assert.throws(() => validateCurrentContract(contract), error =>
    error.errors.map(item => item.field).includes('agreementNumber')
      && error.errors.map(item => item.field).includes('agreementDate'));
});

test('fixture: błędny teacherVariant', () => {
  const contract = parseCurrentContract(base({ teachers: 'Lektor bez rozpoznanego wariantu' }));
  assert.equal(contract.teacherVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu lektorów/);
});

test('teacherVariant jest rozpoznawany tylko wewnątrz sekcji ZAWARTOŚĆ KURSU', () => {
  const contract = parseCurrentContract(base({
    teachers: 'Zajęcia prowadzone przez English Expert oraz Native Speakera',
    extra: 'Oferta obejmuje również zajęcia z Lektorem Polskim.'
  }));
  assert.equal(contract.teacherVariant, 'english_native');
});

test('teacherVariant uwzględnia odmiany gramatyczne i podziały linii', () => {
  const contract = parseCurrentContract(base({
    teachers: 'Spotkania z LEKTORAMI\nPOLSKIMI, English\nExpertem i Native\nSpeakerami'
  }));
  assert.equal(contract.teacherVariant, 'polish_english_native');
});

test('teacherVariant rozpoznaje odpowiadający nagłówek bez polskich znaków', () => {
  const contract = parseCurrentContract(base({ teachers: 'English Expert i Native Speaker' })
    .replace('ZAWARTOŚĆ KURSU', 'ZAWARTOSC\nKURSU'));
  assert.equal(contract.teacherVariant, 'english_native');
});

test('teacherVariant nie jest szukany po opuszczeniu sekcji zawartości kursu', () => {
  const contract = parseCurrentContract(base({
    teachers: 'Zajęcia z English Expert',
    payment: 'Native Speaker i Lektor Polski; raty 0% przy wykorzystaniu kredytu konsumenckiego'
  }));
  assert.equal(contract.teacherVariant, undefined);
});

test('fixture: nierozpoznany wariant płatności', () => {
  const contract = parseCurrentContract(base({ payment: 'raty wewnętrzne według indywidualnego harmonogramu' }));
  assert.equal(contract.paymentVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), /wariantu rat wewnętrznych/);
});

test('przypadkowa liczba 24 poza sekcją płatności nie wybiera wariantu 24-ratalnego', () => {
  const contract = parseCurrentContract(`24 lekcje w pakiecie. WARUNKI PŁATNOŚCI raty wewnętrzne według indywidualnego harmonogramu`);
  assert.equal(contract.paymentType, 'internal');
  assert.equal(contract.paymentVariant, undefined);
});

test('nazwa banku poza sekcją płatności nie klasyfikuje umowy jako kredytowej', () => {
  const contract = parseCurrentContract(`Kupujący korzysta z usług Alior Bank. WARUNKI PŁATNOŚCI forma nierozpoznana`);
  assert.equal(contract.paymentType, undefined);
  assert.equal(contract.paymentVariant, undefined);
});

test('nierozpoznana forma płatności zachowuje komunikat walidacji dla UI', () => {
  const contract = parseCurrentContract(base({ payment: 'forma nierozpoznana' }));
  assert.equal(contract.paymentType, undefined);
  assert.equal(contract.paymentVariant, undefined);
  assert.throws(() => validateCurrentContract(contract), error =>
    error.message.includes('Nie odczytano wymaganych danych:')
      && error.errors.some(item => item.field === 'paymentType'));
});

test('integracyjnie odczytuje cały currentContract z układu tekstu PDF', () => {
  const rawText = `UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
nr EL/JS/966/125049/5/12/2025 zawarta na odległość
DANE NABYWCY
FIRMA: Lingua Nova sp. z o.o.
ADRES: ul. Długa 12, 00-001 Warszawa TELEFON: 500 600 700
NIP: 521-123-45-67
SPECYFIKACJA KURSU
ZASADY KORZYSTANIA Z LEKCJI. Niewykorzystane lekcje nie przechodzą na kolejny miesiąc.
Liczba Lekcji Indywidualnych: 288
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU
Spotkania indywidualne z English Expertem i Native Speakerami
WARUNKI PŁATNOŚCI
Pierwsza wpłata: 499,00 zł. Miesięczna opłata: 399,00 zł.
Łączna cena usługi: 12.999,99 zł brutto.
Raty wewnętrzne, płatność następuje w 4 równych ratach.
Rachunek bankowy Tutlo: mBank S.A. 12 3456 7890 1234 5678 9012 3456
POSTANOWIENIA KOŃCOWE`;
  assert.deepEqual(parseCurrentContract(rawText), {
    rawText, contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_4',
    agreementNumber: 'EL/JS/966/125049/5/12/2025', agreementDate: '2025-12-05',
    customerType: 'company', customerName: 'Lingua Nova sp. z o.o.', personalId: '5211234567',
    address: 'ul. Długa 12, 00-001 Warszawa', coursePriceCents: 1299999, lessonCount: 288,
    monthlyLessonLimit: 12, teacherVariant: 'english_native', internalPaymentAccount: ACCOUNT,
    installmentPlan: Array.from({ length: 4 }, (_, index) =>
      ({ number: index + 1, dueDate: null, amountCents: null, type: 'internal' }))
  });
});

test('walidacja raportuje wszystkie braki w jednym błędzie', () => {
  const contract = parseCurrentContract(base({ payment: `raty wewnętrzne, płatność następuje w 4 równych ratach ${ACCOUNT}` }));
  contract.coursePriceCents = undefined;
  contract.lessonCount = undefined;
  contract.internalPaymentAccount = undefined;
  contract.installmentPlan = undefined;
  assert.throws(() => validateCurrentContract(contract), error => {
    assert.deepEqual(error.errors, [
      { field: 'coursePriceCents', message: 'Nie odczytano całkowitej ceny kursu.' },
      { field: 'lessonCount', message: 'Nie odczytano liczby lekcji.' },
      { field: 'internalPaymentAccount', message: 'Nie odczytano poprawnego rachunku rat wewnętrznych.' },
      { field: 'installmentPlan', message: 'Nie odczytano harmonogramu płatności.' }
    ]);
    return /całkowitej ceny kursu[\s\S]*liczby lekcji[\s\S]*rachunku rat wewnętrznych[\s\S]*harmonogramu płatności/.test(error.message);
  });
});

test('semantyczne finansowanie przez instytucję w sekcji płatności oznacza kredyt', () => {
  const contract = parseCurrentContract(base({ payment: 'Finansowanie przez instytucję finansującą; raty kredytowe zgodnie z umową pożyczki.' }));
  assert.equal(contract.paymentType, 'credit');
  assert.equal(contract.paymentVariant, 'credit');
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
