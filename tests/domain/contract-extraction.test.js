import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractContractData } from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/generator.js';

const rawText = `UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
ZAWARTOŚĆ KURSU 1. Zajęcia w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9576,00 zł brutto.`;

test('wspólny extractor zwraca komplet podstawowych danych umowy', () => {
  assert.deepEqual(extractContractData(rawText), {
    agreementNumber: 'EL/JF/811/192956/3/9/2025', agreementDate: '03.09.2025',
    customerName: 'Monika Wójcik', address: 'Galileusza 10/13, 67-200 Głogów', pesel: '82111304868',
    coursePrice: 9576, monthlyInstallment: 399, lessonCount: 450, monthlyLimit: 57,
    teacherTypes: 'Lektor Polski, English Expert, Native Speaker'
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
