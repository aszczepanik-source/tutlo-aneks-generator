import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex26 } from '../index.js';
import { extractContractData } from '../../../domain/contract-extraction.js';
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';

const RAW_TEXT = `
UMOWA ELASTYCZNA nr EL/TEST/100/200/3/9/2025
DANE NABYWCY Imię i nazwisko: Jan Testowy Adres: ul. Testowa 1, 00-001 Warszawa PESEL: 00210100004
SPECYFIKACJA KURSU Liczba Lekcji Indywidualnych: 450 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
ZAWARTOŚĆ KURSU 1. Zajęcia w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Cena kursu: Całkowita cena kursu wynosi 11250,00 zł brutto. Rata miesięczna: 999,99 zł`;
const contract = extractContractData(RAW_TEXT, 'EL/TEST/100/200/3/9/2025');
const account = '12345678901234567890123456';
const form = { newInstallment: '400,00', bank: 'Inbank', bankAccount: account };

for (const [amount, expected] of [
  ['9576,00', 9576_00],
  ['11 250,00', 11250_00],
  ['12 999,99', 12999_99]
]) {
  test(`wspólny extractor odczytuje całkowitą cenę kursu ${amount}`, () => {
    const extracted = extractContractData(
      `Całkowita cena kursu wynosi ${amount} zł brutto.`, contract.agreementNumber
    );

    assert.equal(extracted.coursePrice, expected / 100);
  });
}

test('aneks 26 odczytuje stały wzór, datę z numeru i buduje komplet placeholderów', () => {
  const prepared = prepareAnnex26(contract, form);
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.deepEqual({
    number: prepared.values.NUMER_UMOWY,
    date: prepared.values.DATA_ZAWARCIA_UMOWY,
    creditDate: prepared.values.DATA_UMOWY_KREDYTU,
    name: prepared.values.IMIE_NAZWISKO,
    address: prepared.values.ADRES,
    identifierLabel: prepared.values.IDENTYFIKATOR_LABEL,
    identifier: prepared.values.IDENTYFIKATOR,
    lessons: prepared.calculation.newLessonCount,
    limit: prepared.values.LIMIT_MIESIECZNY,
    teachers: prepared.values.TYPY_LEKTOROW,
    credit: prepared.values.KWOTA_KREDYTU
  }, {
    number: 'EL/TEST/100/200/3/9/2025', date: '03.09.2025', creditDate: '03.09.2025',
    name: 'Jan Testowy', address: 'ul. Testowa 1, 00-001 Warszawa',
    identifierLabel: 'PESEL', identifier: '00210100004',
    lessons: 414, limit: '57', teachers: 'Lektorem Polskim, English Expert, Native Speakerem', credit: '11250,00 zł'
  });
});

test('aneks 26 wylicza starą ratę z ceny kursu i nie odczytuje jej z warunków płatności', () => {
  assert.equal(contract.monthlyInstallment, 468.75);
});

test('aneks 26 stosuje wszystkie wzory', () => {
  const { calculation, values } = prepareAnnex26(contract, form, new Date('2026-07-24T12:00:00Z'));
  assert.equal(calculation.installmentCount, 24);
  assert.equal(calculation.oldInstallments, 11);
  assert.equal(calculation.newInstallments, 13);
  assert.equal(calculation.discountCents, 89375);
  assert.equal(values.NOWA_CENA, '10356,25 zł');
  assert.equal(values.NOWA_SREDNIA_RATA, '431,51 zł');
  assert.equal(values.SPLACONO_DO_DNIA_ANEKSU, '5156,25 zł');
  assert.equal(values.KWOTA_DO_ZWROTU_BANKOWI, '893,75 zł');
  assert.equal(values.DATA_ANEKSU, '24.07.2026');
  assert.equal(values.DATA_WEJSCIA_W_ZYCIE, '25.07.2026');
});

for (const [today, annexDate, effectiveDate] of [
  ['2026-07-24', '24.07.2026', '25.07.2026'],
  ['2026-07-31', '31.07.2026', '01.08.2026'],
  ['2026-12-31', '31.12.2026', '01.01.2027'],
  ['2028-02-28', '28.02.2028', '29.02.2028']
]) {
  test(`aneks 26 wchodzi w życie dzień po ${annexDate}`, () => {
    const agreementYear = Number(today.slice(0, 4)) - 1;
    const prepared = prepareAnnex26({ ...contract, agreementDate: `03.09.${agreementYear}` }, form,
      new Date(`${today}T12:00:00Z`));
    assert.equal(prepared.values.DATA_ANEKSU, annexDate);
    assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, effectiveDate);
  });
}

test('aneks 26 mapuje wyłącznie dwa prawidłowe warianty lektorów', () => {
  assert.equal(prepareAnnex26(contract, form).values.TYPY_LEKTOROW,
    'Lektorem Polskim, English Expert, Native Speakerem');
  assert.equal(prepareAnnex26({ ...contract, teacherTypes: 'English Expert, Native Speaker' }, form)
    .values.TYPY_LEKTOROW, 'English Expert, Native Speakerem');
});

test('aneks 26 rozpoznaje rzeczywisty wariant z trzema typami lektorów po obecności fraz', () => {
  const teacherTypes = 'Zajęcia z LEKTOREM\n  POLSKIM, , English   Expert oraz Native Speakerem.';

  assert.equal(prepareAnnex26({ ...contract, teacherTypes }, form).values.TYPY_LEKTOROW,
    'Lektorem Polskim, English Expert, Native Speakerem');
});

test('aneks 26 rozpoznaje rzeczywisty wariant bez lektora polskiego po obecności fraz', () => {
  const teacherTypes = 'Zajęcia obejmują english expert,\n , native   speaker.';

  assert.equal(prepareAnnex26({ ...contract, teacherTypes }, form).values.TYPY_LEKTOROW,
    'English Expert, Native Speakerem');
});

test('aneks 26 blokuje niepełną lub inną kombinację lektorów', () => {
  for (const teacherTypes of ['Lektor Polski', 'Native Speaker', 'Lektor Polski, Native Speaker',
    'Polscy lektorzy', 'English experci']) {
    assert.throws(() => prepareAnnex26({ ...contract, teacherTypes }, form),
      { message: 'Nie rozpoznano prawidłowego wariantu lektorów.' });
  }
});

test('prepared.values i wygenerowany DOCX nie zawierają błędnych nazw lektorów', async () => {
  const prepared = prepareAnnex26(contract, form);
  assert.doesNotMatch(JSON.stringify(prepared.values), /Polscy lektorzy|English experci/);

  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.ok(extractDocxPlaceholders(template).includes('TYPY_LEKTOROW'));

  class TestZip {
    constructor(input) {
      this.files = { 'word/document.xml': true };
      this.xml = typeof input === 'string' ? input : '{{TYPY_LEKTOROW}}';
    }
    file() { return { asText: () => this.xml }; }
    generate() { return new TextEncoder().encode(this.xml); }
  }
  class TestDocxtemplater {
    constructor(zip) { this.zip = zip; }
    render(values) { this.zip.xml = this.zip.xml.replace('{{TYPY_LEKTOROW}}', values.TYPY_LEKTOROW); }
    getZip() { return this.zip; }
  }
  const output = new TextDecoder().decode(renderDocx('{{TYPY_LEKTOROW}}', prepared,
    { PizZip: TestZip, docxtemplater: TestDocxtemplater }));
  assert.doesNotMatch(output, /Polscy lektorzy|English experci/);
  assert.equal(output, 'Lektorem Polskim, English Expert, Native Speakerem');
});

test('aneks 26 waliduje nową ratę', () => {
  assert.doesNotThrow(() => prepareAnnex26(contract, form));
  assert.doesNotThrow(() => prepareAnnex26(contract, { ...form, newInstallment: '  400,00 ' }));
  assert.throws(() => prepareAnnex26(contract, { ...form, newInstallment: 0 }), /większą od 0/);
  assert.throws(() => prepareAnnex26(contract, { ...form, newInstallment: '468,80' }), /niższa/);
  assert.throws(() => prepareAnnex26(contract, { ...form, newInstallment: 500 }), /niższa/);
});

test('aneks 26 akceptuje wyłącznie bank wybrany z listy', () => {
  assert.equal(prepareAnnex26(contract, form).values.BANK, 'Inbank');
  assert.throws(() => prepareAnnex26(contract, { ...form, bank: '' }), /Nie podano banku/);
  assert.throws(() => prepareAnnex26(contract, { ...form, bank: 'Własny Bank' }), /Wybierz bank z listy/);
});

test('aneks 26 normalizuje i waliduje rachunek', () => {
  assert.throws(() => prepareAnnex26(contract, { ...form, bankAccount: account.slice(1) }),
    { message: 'Numer rachunku musi zawierać dokładnie 26 cyfr.' });
  assert.equal(prepareAnnex26(contract, form).values.NUMER_RACHUNKU_BANKU, account);
  assert.equal(prepareAnnex26(contract, { ...form, bankAccount: `${account}7` }).values.NUMER_RACHUNKU_BANKU, account);
  assert.equal(prepareAnnex26(contract, { ...form, bankAccount: '12 3456 7890 1234 5678 9012 3456' }).values.NUMER_RACHUNKU_BANKU, account);
});

test('publiczne API aneksu 26 zawiera wyłącznie manifest i prepareAnnex26', async () => {
  assert.deepEqual(Object.keys(await import('../index.js')).sort(), ['manifest', 'prepareAnnex26']);
});
