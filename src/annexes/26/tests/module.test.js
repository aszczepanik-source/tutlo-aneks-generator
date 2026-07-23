import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { createGenerationPlan } from '../generator.js';
import { validate } from '../validator.js';
import { prepareAnnex } from '../../../application/prepare-annex.js';

const completeInput = Object.fromEntries(manifest.requiredFields.map((field) => [field, `wartość ${field}`]));

test('aneks 26: manifest opisuje niezależny moduł', () => {
  assert.equal(manifest.id, '26');
  assert.equal(manifest.template, 'template.docx');
  assert.ok(manifest.requiredFields.length > 0);
});

test('aneks 26: walidator zgłasza wszystkie brakujące pola', () => {
  const issues = validate({});
  assert.deepEqual(issues.map((issue) => issue.field), manifest.requiredFields);
});

test('aneks 26: generator tworzy plan bez modyfikowania wartości', () => {
  const result = createGenerationPlan(completeInput);
  assert.equal(result.ok, true);
  assert.equal(result.annexId, '26');
  assert.deepEqual(result.values, completeInput);
  assert.match(result.templateUrl.pathname, /26\/template\.docx$/);
});

test('aneks 26: przygotowanie wypełnia wszystkie placeholdery szablonu', () => {
  const prepared = prepareAnnex('26', {
    address: 'Testowa 1', contractDate: '2025-01-02', customerName: 'Jan Kowalski',
    contractNumber: 'U/26', pesel: '90010112345', creditAgreementDate: '2025-01-03',
    creditAmountCents: 120000, monthlyLimit: 8, teacherTypes: 'PL i native speaker',
    currentInstallmentCents: 5000, paidInstallments: 4, coursePriceCents: 120000, lessonCount: 101
  }, { newInstallmentCents: 4000, bank: 'Test Bank', bankAccount: '00 1111 2222' }, '2026-07-23');

  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.equal(prepared.values.NOWA_CENA, '1000,00 zł');
  assert.equal(prepared.values.NOWA_LICZBA_LEKCJI, '84');
  assert.equal(prepared.values.NOWA_SREDNIA_RATA, '41,67 zł');
  assert.equal(prepared.values.SPLACONO_DO_DNIA_ANEKSU, '200,00 zł');
  assert.equal(prepared.values.KWOTA_DO_ZWROTU_BANKOWI, '200,00 zł');
});
