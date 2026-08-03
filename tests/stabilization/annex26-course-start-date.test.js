import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';

const specification = value => `
UMOWA nr EL/TEST/100/200/15/1/2026
DANE NABYWCY IMIĘ I NAZWISKO: Jan Kowalski ADRES: Testowa 1 PESEL: 84040810706
§ 1 SPECYFIKACJA KURSU Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy
${value}
Liczba Lekcji Indywidualnych: 192 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU 192 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 7 176,00 zł. Opłata miesięczna za każdy miesiąc trwania Umowy wynosi: 299,00 zł. Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego udzielonego przez bank.
§ 3 WARUNKI UMOWY`;

const baseContract = overrides => ({
  ...parseCurrentContract(specification('Data rozpoczęcia kursu: 01.02.2026')),
  ...overrides
});
const form = { newInstallment: '250,00', bank: 'Inbank', bankAccount: '12345678901234567890123456' };
const annexDate = new Date('2026-07-30T12:00:00Z');

for (const input of ['25-06-2025', '25.06.2025', '\n25/06/2025']) {
  test(`parser odczytuje datę rozpoczęcia kursu w formacie ${JSON.stringify(input)}`, () => {
    assert.equal(parseCurrentContract(specification(`Data rozpoczęcia kursu: ${input}`)).courseStartDate,
      '2025-06-25');
  });
}

test('parser wybiera datę rozpoczęcia, a nie sąsiadującą datę zakończenia', () => {
  const contract = parseCurrentContract(specification(
    'Data rozpoczęcia kursu: 25-06-2025 Data zakończenia kursu: 25-06-2027'
  ));
  assert.equal(contract.courseStartDate, '2025-06-25');
});

test('parser zwraca null bez daty rozpoczęcia i nie szuka jej poza §1', () => {
  assert.equal(parseCurrentContract(specification('Data zakończenia kursu: 25-06-2027')).courseStartDate, null);
  const outsideSpecification = specification('Data zakończenia kursu: 25-06-2027')
    .replace('§ 3 WARUNKI UMOWY', '§ 3 WARUNKI UMOWY Data rozpoczęcia kursu: 25-06-2025 ZAŁĄCZNIK Data rozpoczęcia kursu: 01-01-2024');
  assert.equal(parseCurrentContract(outsideSpecification).courseStartDate, null);
});

test('Aneks 26 liczy od początku kursu, niezależnie od formalnej daty umowy', () => {
  const first = prepareAnnex26(baseContract({ agreementDate: '2026-01-15' }), form, annexDate);
  const second = prepareAnnex26(baseContract({ agreementDate: '2025-06-01' }), form, annexDate);
  assert.equal(first.calculation.oldInstallments, 6);
  assert.equal(first.calculation.newInstallments, 18);
  assert.deepEqual(first.calculation, second.calculation);
  assert.equal(first.values.DATA_ZAWARCIA_UMOWY, '15.01.2026');
  assert.equal(second.values.DATA_ZAWARCIA_UMOWY, '01.06.2025');
  assert.notEqual(first.values.DATA_ZAWARCIA_UMOWY, '01.02.2026');
});

test('zmiana początku kursu zmienia liczbę starych rat', () => {
  assert.equal(prepareAnnex26(baseContract({ courseStartDate: '2026-03-01' }), form, annexDate)
    .calculation.oldInstallments, 5);
});

test('brak początku kursu blokuje generator bez fallbacku do daty umowy', () => {
  assert.throws(() => prepareAnnex26(baseContract({ courseStartDate: null }), form, annexDate),
    { message: 'Nie udało się odczytać daty rozpoczęcia kursu.' });
});

test('prepareAnnex26 samodzielnie wymaga pełnej kombinacji flexible/credit/credit', () => {
  for (const overrides of [
    { contractType: 'limit' }, { paymentType: 'internal' }, { paymentVariant: 'internal_24' }
  ]) {
    assert.throws(() => prepareAnnex26(baseContract(overrides), form, annexDate),
      /wyłącznie elastyczną umowę kredytową/);
  }
});
