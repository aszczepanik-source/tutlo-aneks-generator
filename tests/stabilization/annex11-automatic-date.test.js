import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAnnex } from '../../src/application/prepare-annex.js';

const installments = Array.from({ length: 24 }, (_, index) => ({
  amountCents: 10_000,
  dueDate: `${2026 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-15`
}));
const contract = {
  address: 'Testowa 1',
  agreementDate: '2025-01-01',
  agreementNumber: 'TEST/1',
  contractEndDate: '2027-12-31',
  customerName: 'Jan Kowalski',
  installments,
  pesel: '00210100004'
};

test('Aneks 11 wylicza datę aneksu i wejścia w życie bez pola formularza', () => {
  const prepared = prepareAnnex('11', contract, { suspensionMonths: '1' }, '2026-07-28');

  assert.equal(prepared.values.DATA_ANEKSU, '28.07.2026');
  assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '29.07.2026');
});

test('Aneks 11 nie pobiera daty aneksu z formularza', () => {
  const prepared = prepareAnnex('11', contract, {
    annexDate: 'undefined',
    suspensionMonths: '2'
  }, '2026-07-28');

  assert.equal(prepared.calculation.annexDate, '2026-07-28');
  assert.equal(prepared.values.DATA_ANEKSU, '28.07.2026');
  assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '29.07.2026');
});
