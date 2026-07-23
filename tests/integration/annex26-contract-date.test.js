import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerationPlan } from '../../src/annexes/26/generator.js';
import { prepareAnnex } from '../../src/application/prepare-annex.js';
import {
  extractAgreementNumber
} from '../../src/domain/contract-extraction.js';
import {
  extractAgreementDateFromNumber,
  extractAnnex26Contract
} from '../../src/annexes/26/extractor.js';

const PDF_TEXT = `
  UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
  nr EL/JF/811/192956/3/9/2025 zawarta na odległość
  Imię i nazwisko: Jan Kowalski;
  Adres: ul. Testowa 1, 00-001 Warszawa PESEL: 90010112345
  Liczba lekcji: 101
  Limit miesięczny: 8
  Typy lektorów: PL i native speaker Cena kursu: 1200,00 zł
  Obecna rata: 50,00 zł
  Liczba rat już opłaconych: 4
  Kwota kredytu: 1200,00 zł
  Umowa kredytowa 11.06.2025
`;

test('data zawarcia umowy pochodzi z trzech ostatnich segmentów numeru', () => {
  assert.equal(extractAgreementNumber(PDF_TEXT), 'EL/JF/811/192956/3/9/2025');
  assert.equal(extractAgreementDateFromNumber('EL/JF/811/192956/3/9/2025'), '2025-09-03');
  assert.equal(extractAnnex26Contract(PDF_TEXT, extractAgreementNumber(PDF_TEXT)).agreementDate, '2025-09-03');
});

test('nieprawidłowy miesiąc w numerze umowy pozostawia pole do walidacji aneksu 26', () => {
  assert.equal(extractAgreementDateFromNumber('ABC/10/13/2025'), undefined);
});

test('brak daty w numerze umowy pozostawia pole do walidacji aneksu 26', () => {
  assert.equal(extractAgreementDateFromNumber('ABC/BEZ/DATY'), undefined);
});

test('pełny przepływ tekst PDF -> contract -> aneks 26 zachowuje datę umowy', () => {
  const contract = extractAnnex26Contract(PDF_TEXT, extractAgreementNumber(PDF_TEXT));

  assert.deepEqual(Object.keys(contract).filter(key => /date/i.test(key)), [
    'agreementDate',
    'creditAgreementDate'
  ]);
  assert.equal(contract.agreementNumber, 'EL/JF/811/192956/3/9/2025');
  assert.equal(contract.agreementDate, '2025-09-03');

  let prepared;
  assert.doesNotThrow(() => {
    prepared = prepareAnnex('26', contract, {
      newInstallmentCents: 4000,
      bank: 'Test Bank',
      bankAccount: '00 1111 2222'
    }, '2026-07-23');
  }, /Nieprawidłowa data zawarcia umowy: undefined/);
  const generation = createGenerationPlan(prepared.values);

  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '03.09.2025');
  assert.equal(generation.ok, true);
  assert.equal(generation.values.DATA_ZAWARCIA_UMOWY, '03.09.2025');
  assert.ok(Object.values(generation.values).every(value => value !== undefined));
});

test('poprawny tekst PDF nie uruchamia komunikatu błędu odczytu PDF', () => {
  let status = '';
  try {
    extractAnnex26Contract(PDF_TEXT, extractAgreementNumber(PDF_TEXT));
  } catch {
    status = 'Nie udało się odczytać PDF';
  }
  assert.notEqual(status, 'Nie udało się odczytać PDF');
});
