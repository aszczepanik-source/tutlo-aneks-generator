import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerationPlan } from '../../src/annexes/26/generator.js';
import { prepareAnnex } from '../../src/application/prepare-annex.js';
import { extractAnnex26Contract } from '../../src/domain/contract-extraction.js';

test('parser przekazuje datę zawarcia umowy do generowania aneksu 26', () => {
  const contract = extractAnnex26Contract(`
    Numer umowy: TU/2025/26
    Data zawarcia umowy: 10.06.2025
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

  assert.equal(contract.agreementDate, '2025-06-10');

  const prepared = prepareAnnex('26', contract, {
    newInstallmentCents: 4000,
    bank: 'Test Bank',
    bankAccount: '00 1111 2222'
  }, '2026-07-23');
  const generation = createGenerationPlan(prepared.values);

  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '10.06.2025');
  assert.equal(generation.ok, true);
  assert.equal(generation.values.DATA_ZAWARCIA_UMOWY, '10.06.2025');
  assert.ok(Object.values(generation.values).every(value => value !== undefined));
});
