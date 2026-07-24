import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  extractAgreementNumber, extractContractData, extractInternalInstallmentAccount,
  INTERNAL_INSTALLMENT_ACCOUNT_LABEL
} from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/generator.js';

const rawText = `UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
ZAWARTOŚĆ KURSU 1. Zajęcia w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9576,00 zł brutto.`;

test('wspólny extractor zwraca komplet podstawowych danych umowy', () => {
  assert.deepEqual(extractContractData(rawText), {
    agreementNumber: 'EL/JF/811/192956/3/9/2025', agreementDate: '03.09.2025',
    customerName: 'Monika Wójcik', pesel: '82111304868', customerType: 'person',
    address: 'Galileusza 10/13, 67-200 Głogów',
    coursePrice: 9576, coursePriceCents: 957600,
    coursePriceDiagnostic: { phraseFound: true, followingText: '9576,00 zł brutto.', valuePassedToPrepareAnnex26: 957600 },
    monthlyInstallment: 399, lessonCount: 450, monthlyLimit: 57,
    teacherTypes: 'Lektor Polski, English Expert, Native Speaker'
  });
});

test('odczytuje rachunek rat wewnętrznych spod właściwej etykiety i normalizuje separatory', () => {
  assert.equal(INTERNAL_INSTALLMENT_ACCOUNT_LABEL, 'rachunek bankowy Tutlo');
  for (const printed of [
    '12 3456 7890 1234 5678 9012 3456',
    '12-3456-7890-1234-5678-9012-3456',
    '12345678901234567890123456',
    '12 3456\n7890 1234\n5678 9012 3456'
  ]) {
    const contract = extractContractData(`WARUNKI PŁATNOŚCI rachunek bankowy Tutlo: ${printed}`);
    assert.equal(contract.bankAccount, '12345678901234567890123456');
    assert.equal(typeof contract.bankAccount, 'string');
  }
});

test('nie pobiera przypadkowych identyfikatorów ani rachunku kredytodawcy', () => {
  const text = `Numer umowy 12345678901234567890123456 PESEL 12345678901 NIP 1234567890
    numer rachunku kredytodawcy: 98765432109876543210987654`;
  assert.equal(extractInternalInstallmentAccount(text), undefined);
  assert.equal(extractContractData(text).bankAccount, undefined);
});

test('odczytuje firmę i normalizuje NIP z tabeli danych nabywcy', () => {
  const contract = extractContractData(`Tutlo Sp. z o.o. FIRMA: Tutlo
    DANE\u00a0NABYWCY
    firma : Agnieszka Paprotna
    ADRES: Żerkówek 28, 56-120 Brzeg Dolny TELEFON: 123 456 789
    E-MAIL: klient@example.com NIP: 692-245-39 48
    SPECYFIKACJA KURSU ZAWARTOŚĆ KURSU WARUNKI PŁATNOŚCI`);

  assert.equal(contract.customerName, 'Agnieszka Paprotna');
  assert.equal(contract.pesel, '6922453948');
  assert.equal(contract.customerType, 'company');
});

for (const printedNip of [
  'NIP: 6922453948',
  'NIP 6922453948',
  'NIP:\n6922453948',
  'NIP: 692-245-39 48'
]) {
  test(`odczytuje NIP zapisany jako „${printedNip.replace('\n', ' / ')}”`, () => {
    const contract = extractContractData(`DANE NABYWCY
      FIRMA: Klient Firmowy
      ADRES: Testowa 1
      ${printedNip}
      SPECYFIKACJA KURSU ZAWARTOŚĆ KURSU WARUNKI PŁATNOŚCI`);

    assert.equal(contract.customerName, 'Klient Firmowy');
    assert.equal(contract.pesel, '6922453948');
    assert.equal(typeof contract.pesel, 'string');
    assert.equal(contract.customerType, 'company');
  });
}

test('diagnostyka NIP zawiera wyłącznie wynik rozpoznania, bez wartości NIP', () => {
  const calls = [];
  const originalInfo = console.info;
  console.info = (...args) => calls.push(args);
  try {
    extractContractData(`DANE NABYWCY FIRMA: Klient Firmowy NIP 692-245-39 48
      SPECYFIKACJA KURSU ZAWARTOŚĆ KURSU WARUNKI PŁATNOŚCI`);
  } finally {
    console.info = originalInfo;
  }

  assert.deepEqual(calls, [[
    '[NIP nabywcy diagnostic]',
    { labelFound: true, normalizedLength: 10, isExactly10Digits: true }
  ]]);
  assert.doesNotMatch(JSON.stringify(calls), /6922453948|692-245/);
});

test('nie uznaje firmy Tutlo spoza tabeli DANE NABYWCY za nabywcę', () => {
  const contract = extractContractData(`FIRMA: Tutlo Sp. z o.o.
    DANE NABYWCY Imię i nazwisko: Jan Kowalski Adres: Polna 1 PESEL: 12345678901
    SPECYFIKACJA KURSU ZAWARTOŚĆ KURSU WARUNKI PŁATNOŚCI`);
  assert.equal(contract.customerName, 'Jan Kowalski');
  assert.equal(contract.customerType, 'person');
});

for (const agreementNumber of [
  'EL/JS/966/125049/5/12/2025',
  'EL/PM/745/130243/23/9/2025',
  'EL/JF/811/192956/3/9/2025',
  'EL/J/1/2/3/4/2025',
  'EL/ĄĆĘŁŃÓŚŹŻA/123/456/31/12/2025'
]) {
  test(`odczytuje pełny numer umowy ${agreementNumber}`, () => {
    const text = `UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO\nnr ${agreementNumber} zawarta na odległość`;
    assert.equal(extractAgreementNumber(text), agreementNumber);
  });
}

test('odtwarza numer rozbity nową linią i spacjami wokół ukośników', () => {
  const text = `UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
nr EL / JS / 966 /\n125049 / 5 / 12 / 2025 zawarta na odległość`;
  assert.equal(extractAgreementNumber(text), 'EL/JS/966/125049/5/12/2025');
});

test('nie ucina kodu, gdy PDF rozdzieli jego litery końcem linii', () => {
  const text = `UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
nr EL/J\nS/966/125049/5/12/2025 zawarta na odległość`;
  assert.equal(extractAgreementNumber(text), 'EL/JS/966/125049/5/12/2025');
});

test('nie pobiera numeru EL z miejsca dokumentu innego niż nagłówek umowy', () => {
  assert.equal(extractAgreementNumber('Identyfikator EL/JS/966/125049/5/12/2025 w stopce dokumentu'), undefined);
});

test('przekazuje pełny numer z PDF do parsera końcowej daty', () => {
  const contract = extractContractData(`UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
nr EL/JS/966/125049/5/12/2025 zawarta na odległość`);
  assert.equal(contract.agreementNumber, 'EL/JS/966/125049/5/12/2025');
  assert.equal(contract.agreementDate, '05.12.2025');
});

for (const [printed, expectedCents] of [
  ['7176,00', 717600], ['7 176,00', 717600], ['7.176,00', 717600], ['7176.00', 717600]
]) {
  test(`odczytuje cenę kursu w formacie ${printed}`, () => {
    const result = extractContractData(`§2 WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi ${printed} zł brutto.`);
    assert.equal(result.coursePriceCents, expectedCents);
    assert.equal(result.coursePrice, 7176);
  });
}

test('odczytuje cenę kursu rozbitą na linie przez ekstrakcję PDF', () => {
  const result = extractContractData(`§2\nWARUNKI PŁATNOŚCI\nCałkowita cena kursu wynosi\n7 176,00 zł brutto.`);
  assert.equal(result.coursePriceCents, 717600);
});

test('nie wybiera innej kwoty, gdy po dokładnej frazie nie ma ceny', () => {
  const result = extractContractData('Całkowita cena kursu wynosi brak danych. Rata wynosi 399,00 zł.');
  assert.equal(result.coursePriceCents, undefined);
  assert.deepEqual(result.coursePriceDiagnostic, {
    phraseFound: true, followingText: 'brak danych. Rata wynosi 399,00 zł.', valuePassedToPrepareAnnex26: undefined
  });
});

test('odczytuje trzy zaznaczone typy lektorów wyłącznie z sekcji ZAWARTOŚĆ KURSU', () => {
  const contract = extractContractData(`Native Speaker poza właściwą sekcją
ZAWARTOŚĆ KURSU
1. Zajęcia w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker
WARUNKI PŁATNOŚCI`);

  assert.equal(contract.teacherTypes, 'Lektor Polski, English Expert, Native Speaker');
});

test('odczytuje dwa zaznaczone typy lektorów wyłącznie z sekcji ZAWARTOŚĆ KURSU', () => {
  const contract = extractContractData(`Lektor Polski poza właściwą sekcją
ZAWARTOŚĆ KURSU
1. Zajęcia w formie spotkań indywidualnych z English Expert, Native Speaker
WARUNKI PŁATNOŚCI`);

  assert.equal(contract.teacherTypes, 'English Expert, Native Speaker');
});

test('odczytuje Native Speaker jako jedyny typ lektora w pierwszym punkcie sekcji', () => {
  const contract = extractContractData(`ZAWARTOŚĆ KURSU
1. Zajęcia w formie spotkań indywidualnych z Native Speaker
WARUNKI PŁATNOŚCI`);

  assert.equal(contract.teacherTypes, 'Native Speaker');
});

test('zwraca komunikat dopiero przy braku sekcji ZAWARTOŚĆ KURSU', () => {
  const contract = extractContractData('Typy lektorów: Lektor Polski, English Expert, Native Speaker');

  assert.equal(contract.teacherTypes, 'Nie odczytano typów lektorów.');
});

const withSpecification = specification => `UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU
${specification}
ZAWARTOŚĆ KURSU 1. Zajęcia w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9576,00 zł brutto.`;

test('odczytuje liczbę lekcji i limit z umowy elastycznej', () => {
  const contract = extractContractData(withSpecification(`Data rozpoczęcia kursu: 01-09-2025
Data zakończenia kursu: 01-09-2027
Okres trwania kursu w Tutlo: 24 miesiące
Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy
Liczba Lekcji Indywidualnych: 192
Maksymalna miesięczna liczba
Lekcji Indywidualnych do wykorzystania: 24`));
  assert.equal(contract.lessonCount, 192);
  assert.equal(contract.monthlyLimit, 24);
});

test('odczytuje liczbę lekcji i limit z umowy z limitem', () => {
  const contract = extractContractData(withSpecification(`Data rozpoczęcia kursu: 23-06-2026
Data zakończenia kursu: 23-06-2028
Okres trwania kursu w Tutlo: 24 miesiące/miesięcy
Liczba Lekcji Indywidualnych: 288
Maksymalna miesięczna liczba
Lekcji Indywidualnych do wykorzystania: 12`));
  assert.equal(contract.lessonCount, 288);
  assert.equal(contract.monthlyLimit, 12);
});

test('obsługuje podziały i odstępy generowane przez PDF.js', () => {
  const cases = [
    ['Liczba Lekcji Indywidualnych:\n192', 'lessonCount', 192],
    ['Liczba Lekcji Indywidualnych:        288', 'lessonCount', 288],
    ['Maksymalna miesięczna liczba\nLekcji Indywidualnych do wykorzystania:\n24', 'monthlyLimit', 24],
    ['Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12', 'monthlyLimit', 12]
  ];
  for (const [specification, field, expected] of cases) {
    assert.equal(extractContractData(withSpecification(specification))[field], expected);
  }
});

test('nie myli liczby lekcji z limitem ani 24-miesięcznym okresem kursu', () => {
  const withoutLessonCount = extractContractData(withSpecification(`Okres trwania kursu w Tutlo: 24 miesiące
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12`));
  assert.equal(withoutLessonCount.lessonCount, undefined);
  assert.equal(withoutLessonCount.monthlyLimit, 12);
});

test('przekazuje odczytane pola przez currentContract do aneksu 26', () => {
  const currentContract = extractContractData(withSpecification(`Liczba Lekcji Indywidualnych: 192
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 24`));
  const prepared = prepareAnnex26(currentContract, {
    newInstallment: 300, bank: 'Inbank', bankAccount: '12345678901234567890123456'
  });
  assert.equal(currentContract.lessonCount, 192);
  assert.equal(currentContract.monthlyLimit, 24);
  assert.equal(prepared.values.LIMIT_MIESIECZNY, '24');
  assert.ok(Number(prepared.values.NOWA_LICZBA_LEKCJI) > 0);
});

test('analyze odczytuje PDF raz i zapisuje pełny currentContract', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const analyze = html.match(/async function analyze\(\)\{([\s\S]*?)\n  \}/)?.[1];
  assert.equal((analyze.match(/extractText\(currentFile\)/g) || []).length, 1);
  assert.match(analyze, /\.\.\.extractContractData\(text,extractAgreementNumber\(text\)\)/);
  for (const field of ['contractType', 'paymentType', 'paymentVariant', 'rawText']) assert.match(analyze, new RegExp(`${field}:`));
});

test('aneksy nie parsują podstawowych danych z rawText ani nie zależą od extractorów aneksów', async () => {
  for (const id of ['11', '26', '29', '29a', '43']) {
    const sources = await Promise.all(['index.js', 'generator.js'].map(name => readFile(new URL(`../../src/annexes/${id}/${name}`, import.meta.url), 'utf8')));
    const source = sources.join('\n');
    assert.doesNotMatch(source, /currentContract\?*\.rawText|contract\?*\.rawText|extractAnnex\d+Contract/);
  }
});
