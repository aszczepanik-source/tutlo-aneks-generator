import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerationPlan } from '../../src/annexes/26/generator.js';
import { prepareAnnex } from '../../src/application/prepare-annex.js';
import {
  extractAgreementDateFromContractNumber,
  extractAnnex26Contract
} from '../../src/domain/contract-extraction.js';

test('data zawarcia umowy pochodzi z trzech ostatnich segmentów numeru', () => {
  assert.equal(extractAgreementDateFromContractNumber('EL/JF/811/192956/3/9/2025'), '2025-09-03');
  assert.equal(extractAgreementDateFromContractNumber('ABC/10/6/2025'), '2025-06-10');
});

test('nieprawidłowy miesiąc w numerze umowy powoduje jednoznaczny błąd', () => {
  assert.throws(
    () => extractAgreementDateFromContractNumber('ABC/10/13/2025'),
    /Końcówka numeru umowy nie tworzy poprawnej daty: 10\/13\/2025/
  );
});

test('brak daty w numerze umowy powoduje jednoznaczny błąd', () => {
  assert.throws(
    () => extractAgreementDateFromContractNumber('ABC/BEZ/DATY'),
    /Numer umowy nie zawiera daty w formacie dzień\/miesiąc\/rok/
  );
});

test('parser przekazuje datę zawarcia umowy do generowania aneksu 26', () => {
  const contract = extractAnnex26Contract(`
    Numer umowy: EL/JF/811/192956/10/6/2025
    Umowa o świadczenie usług edukacyjnych zawarta w dniu 01.01.1999
    Imię i nazwisko: Jan Kowalski;
    Adres: ul. Testowa 1, 00-001 Warszawa PESEL: 90010112345
    Liczba lekcji: 101
    Limit miesięczny: 8
    Typy lektorów: PL i native speaker Cena kursu: 1200,00 zł
    Obecna rata: 50,00 zł
    Liczba rat już opłaconych: 4
    Kwota kredytu: 1200,00 zł
    Umowa kredytowa 11.06.2025
  `);

  assert.deepEqual(Object.keys(contract).filter(key => /date/i.test(key)), [
    'agreementDate',
    'creditAgreementDate'
  ]);
  assert.equal(contract.agreementDate, '2025-06-10');

  let prepared;
  assert.doesNotThrow(() => {
    prepared = prepareAnnex('26', contract, {
      newInstallmentCents: 4000,
      bank: 'Test Bank',
      bankAccount: '00 1111 2222'
    }, '2026-07-23');
  }, /Nieprawidłowa data zawarcia umowy: undefined/);
  const generation = createGenerationPlan(prepared.values);

  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '10.06.2025');
  assert.equal(generation.ok, true);
  assert.equal(generation.values.DATA_ZAWARCIA_UMOWY, '10.06.2025');
  assert.ok(Object.values(generation.values).every(value => value !== undefined));
});
