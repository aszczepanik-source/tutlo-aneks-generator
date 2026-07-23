import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex26 } from '../index.js';
import { extractAnnex26Contract } from '../extractor.js';

const RAW_TEXT = `
UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU Liczba lekcji: 450 Limit miesięczny: 57
ZAWARTOŚĆ KURSU Typy lektorów: Lektor Polski, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Cena kursu: Całkowita cena kursu wynosi 11250,00 zł brutto. Rata miesięczna: 999,99 zł`;
const contract = { rawText: RAW_TEXT, agreementNumber: 'EL/JF/811/192956/3/9/2025' };
const account = '12345678901234567890123456';
const form = { newInstallment: '400,00', bank: 'Inbank', bankAccount: account };

for (const [amount, expected] of [
  ['9576,00', 9576_00],
  ['11 250,00', 11250_00],
  ['12 999,99', 12999_99]
]) {
  test(`aneks 26 odczytuje całkowitą cenę kursu ${amount}`, () => {
    const extracted = extractAnnex26Contract(
      `§ 2 WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi ${amount} zł brutto.`,
      contract.agreementNumber
    );

    assert.equal(extracted.coursePriceCents, expected);
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
    pesel: prepared.values.PESEL,
    lessons: prepared.calculation.newLessonCount,
    limit: prepared.values.LIMIT_MIESIECZNY,
    teachers: prepared.values.TYPY_LEKTOROW,
    credit: prepared.values.KWOTA_KREDYTU
  }, {
    number: 'EL/JF/811/192956/3/9/2025', date: '03.09.2025', creditDate: '03.09.2025',
    name: 'Monika Wójcik', address: 'Galileusza 10/13, 67-200 Głogów', pesel: '82111304868',
    lessons: 414, limit: '57', teachers: 'Lektor Polski, English Expert, Native Speaker', credit: '11250,00 zł'
  });
});

test('aneks 26 wylicza starą ratę z ceny kursu i nie odczytuje jej z warunków płatności', () => {
  const extracted = extractAnnex26Contract(RAW_TEXT, contract.agreementNumber);
  assert.equal(extracted.currentInstallmentCents, 468_75);
});

test('aneks 26 stosuje wszystkie wzory', () => {
  const { calculation, values } = prepareAnnex26(contract, form);
  assert.equal(calculation.installmentCount, 24);
  assert.equal(calculation.oldInstallments, 11);
  assert.equal(calculation.newInstallments, 13);
  assert.equal(calculation.discountCents, 89375);
  assert.equal(values.NOWA_CENA, '10356,25 zł');
  assert.equal(values.NOWA_SREDNIA_RATA, '431,51 zł');
  assert.equal(values.SPLACONO_DO_DNIA_ANEKSU, '5156,25 zł');
  assert.equal(values.KWOTA_DO_ZWROTU_BANKOWI, '893,75 zł');
  assert.equal(values.DATA_WEJSCIA_W_ZYCIE, '01.08.2026');
});

test('aneks 26 waliduje nową ratę', () => {
  assert.doesNotThrow(() => prepareAnnex26(contract, form));
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
