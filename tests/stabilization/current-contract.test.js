import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_CONTRACT_FIELDS, parseCurrentContract, validateCurrentContract } from '../../src/domain/contract-extraction.js';

const fixtureA = `UMOWA O ŚWIADCZENIE USŁUG nr EL/JT/787/161827/31/10/2025
Tutlo sp. z o.o., NIP: 7010701530
DANE NABYWCY
IMIĘ I NAZWISKO: Anna Kowalska
ADRES: Długa 1, 00-001 Warszawa TELEFON: 500 500 500
PESEL: 90010112345
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 24 miesiące
Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy
Liczba Lekcji Indywidualnych: 480
Maksymalna miesięczna liczba
Lekcji Indywidualnych do wykorzystania: 60
ZAWARTOŚĆ KURSU
480 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert i Native
Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena kursu wynosi 13920,00 zł brutto. Dopłata Tutlo Plus: 200,00 zł.
Opłata miesięczna za każdy miesiąc trwania Umowy wynosi: 580,00 zł brutto.
Pierwsza rata wynosi 580,00 zł, a kolejnych 23 rat wynosi po 580,00 zł, płatne
na następujący rachunek bankowy Tutlo: mBank S.A. - 47114010104903526761000000
§ 3 WARUNKI UMOWY
Załącznik: FINANSOWANIE KURSU — dostępny jest także kredyt konsumencki.`;

const fixtureB = `UMOWA O ŚWIADCZENIE USŁUG EL/PD/147/115351/23/6/2026
Tutlo sp. z o.o., NIP: 7010701530
DANE NABYWCY
IMIĘ I NAZWISKO: Piotr Nowak PESEL: 85050512345
ADRES: Polna 2, 30-001 Kraków
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 24 miesiące
Liczba Lekcji Indywidualnych: 288
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU
288 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert oraz Native Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena pakietu kursu wynosi: 9576.0 zł brutto. Dopłata Tutlo Plus wynosi 999,00 zł.
wynagrodzenie przysługujące Tutlo za każdy miesiąc trwania Umowy wynosi 399.0 zł brutto.
Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego udzielonego przez bank.
§ 3 WARUNKI UMOWY
Minimalny czas zobowiązania Nabywcy wynikający z Umowy może występować w innych wzorcach.
DOSTĘPNOŚĆ LEKTORÓW NA PLATFORMIE: Lektor Polski, English Expert, Native Speaker.`;

const expectedA = {
  rawText: fixtureA, contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24',
  agreementNumber: 'EL/JT/787/161827/31/10/2025', agreementDate: '2025-10-31',
  customerType: 'person', customerName: 'Anna Kowalska', personalId: '90010112345',
  address: 'Długa 1, 00-001 Warszawa', coursePriceCents: 1392000,
  monthlyInstallmentCents: 58000, lessonCount: 480, monthlyLessonLimit: 60,
  teacherVariant: 'polish_english_native', internalPaymentAccount: '47114010104903526761000000',
  installmentPlan: { paymentCount: 24, firstPaymentAmountCents: 58000,
    recurringPaymentAmountCents: 58000, followingPaymentsCount: 23, paymentVariant: 'internal_24' }
};

const expectedB = {
  rawText: fixtureB, contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'EL/PD/147/115351/23/6/2026', agreementDate: '2026-06-23',
  customerType: 'person', customerName: 'Piotr Nowak', personalId: '85050512345',
  address: 'Polna 2, 30-001 Kraków', coursePriceCents: 957600,
  monthlyInstallmentCents: 39900, lessonCount: 288, monthlyLessonLimit: 12,
  teacherVariant: 'polish_english_native', internalPaymentAccount: null, installmentPlan: undefined
};

test('fixture A: pełny currentContract umowy elastycznej z 24 ratami wewnętrznymi', () => {
  assert.deepEqual(parseCurrentContract(fixtureA), expectedA);
  assert.deepEqual(Object.keys(parseCurrentContract(fixtureA)), CURRENT_CONTRACT_FIELDS);
  assert.equal(validateCurrentContract(parseCurrentContract(fixtureA)).installmentPlan.paymentCount, 24);
});

test('harmonogram rat odczytuje terminy podane w §2 warunków płatności', () => {
  const text = fixtureA.replace(
    'Pierwsza rata wynosi 580,00 zł, a kolejnych 23 rat wynosi po 580,00 zł, płatne',
    `pierwsza rata w wysokości 580,00 zł płatna najpóźniej w ciągu 1 dnia od dnia zawarcia Umowy,
kolejnych 23 rat w wysokości 580,00 zł płatne z góry do dnia 5. każdego miesiąca począwszy od 3 miesiąca trwania Umowy, to jest od grudnia 2025, płatne`
  );
  const plan = parseCurrentContract(text).installmentPlan;
  assert.deepEqual(plan, {
    paymentCount: 24,
    firstPaymentAmountCents: 58000,
    recurringPaymentAmountCents: 58000,
    followingPaymentsCount: 23,
    paymentVariant: 'internal_24',
    firstPaymentDueDate: '2025-11-01',
    recurringStartDate: '2025-12-05',
    recurringDayOfMonth: 5
  });
});

test('fixture B: pełny currentContract umowy z limitem i kredytem', () => {
  assert.deepEqual(parseCurrentContract(fixtureB), expectedB);
  assert.deepEqual(Object.keys(parseCurrentContract(fixtureB)), CURRENT_CONTRACT_FIELDS);
  assert.equal(validateCurrentContract(parseCurrentContract(fixtureB)).internalPaymentAccount, null);
});

test('frazy z dalszych paragrafów i załączników nie zmieniają klasyfikacji', () => {
  const result = parseCurrentContract(fixtureB);
  assert.equal(result.contractType, 'limit');
  assert.equal(result.paymentType, 'credit');
});

test('lista kredytów wyłącznie w załączniku nie ustawia płatności kredytowej', () => {
  const result = parseCurrentContract(fixtureA.replace(
    /Pierwsza rata[\s\S]*?47114010104903526761000000/, 'Płatność nierozpoznana'));
  assert.equal(result.paymentType, undefined);
});

test('rzeczywista umowa z English Expert i Native Speakerem ma wariant english_native', () => {
  const text = fixtureB.replace('Lektorem Polskim, English Expert oraz Native Speakerem',
    'English Expert oraz Native Speakerem');
  assert.equal(parseCurrentContract(text).teacherVariant, 'english_native');
});

test('rzeczywista umowa z trzema typami lektorów ma wariant polish_english_native', () => {
  assert.equal(parseCurrentContract(fixtureA).teacherVariant, 'polish_english_native');
});

test('teacherVariant odczytuje trzy typy z tekstu PDF.js rozbitego przed Speakerem', () => {
  const text = `ZAWARTOŚĆ KURSU
Przedmiotem Umowy jest świadczenie przez Tutlo na rzecz Użytkownika kursu z języka angielskiego online obejmującego:
288 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native
Speakerem realizowanych w platformie internetowej pod adresem tutlo.com.
§ 2
WARUNKI PŁATNOŚCI`;

  assert.equal(parseCurrentContract(text).teacherVariant, 'polish_english_native');
});

test('teacherVariant odczytuje English Expert i Native Speakera z tekstu PDF.js', () => {
  const text = `ZAWARTOŚĆ KURSU
288 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z English Expert, Native
Speakerem realizowanych w platformie internetowej.
§2 WARUNKI PŁATNOŚCI`;

  assert.equal(parseCurrentContract(text).teacherVariant, 'english_native');
});

test('teacherVariant ignoruje listę wszystkich lektorów w załączniku', () => {
  const text = fixtureB.replace('Lektorem Polskim, English Expert oraz Native Speakerem',
    'English\nExpert oraz Native\nSpeakerem');
  assert.equal(parseCurrentContract(text).teacherVariant, 'english_native');
});

test('NIP Tutlo w nagłówku nie jest identyfikatorem klienta', () => {
  const result = parseCurrentContract(fixtureB.replace('PESEL: 85050512345', ''));
  assert.equal(result.customerType, undefined);
  assert.equal(result.personalId, undefined);
});

test('24 miesiące kursu nie oznaczają 24 rat', () => {
  const result = parseCurrentContract(fixtureB.replace(
    /Forma płatności:[^\n]+/, 'Płatność na następujący rachunek bankowy Tutlo: 47114010104903526761000000'));
  assert.equal(result.paymentType, 'internal');
  assert.equal(result.paymentVariant, undefined);
  assert.equal(result.installmentPlan, undefined);
});

test('dopłata Tutlo Plus nie jest ceną całego kursu', () => {
  assert.equal(parseCurrentContract(fixtureB).coursePriceCents, 957600);
});

test('walidacja zbiera wszystkie braki, w tym miesięczną opłatę, limit i paymentCount', () => {
  const contract = { ...expectedA, coursePriceCents: undefined, monthlyInstallmentCents: undefined,
    monthlyLessonLimit: undefined, internalPaymentAccount: undefined, installmentPlan: undefined };
  assert.throws(() => validateCurrentContract(contract), error => {
    assert.deepEqual(error.errors.map(item => item.field), [
      'coursePriceCents', 'monthlyInstallmentCents', 'monthlyLessonLimit',
      'internalPaymentAccount', 'installmentPlan/paymentCount'
    ]);
    return true;
  });
});

export { fixtureA, fixtureB, expectedA, expectedB };
