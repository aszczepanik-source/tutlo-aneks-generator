import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAgreementDate, parseAgreementDateFromNumber } from '../../src/domain/contract-extraction.js';

test('parser daty odczytuje końcową datę numeru w ISO', () => {
  assert.equal(parseAgreementDateFromNumber('EL/TEST/100/200/3/9/2025'), '2025-09-03');
});

test('parser daty obsługuje dzień, miesiąc, rok i rok przestępny', () => {
  for (const [number, expected] of [['EL/X/1/1/31/12/2025','2025-12-31'], ['EL/X/1/1/1/1/2026','2026-01-01'], ['EL/X/1/1/29/2/2028','2028-02-29']]) assert.equal(extractAgreementDate(number), expected);
});

test('parser daty odrzuca nieistniejącą datę', () => {
  assert.equal(extractAgreementDate('EL/X/1/1/31/2/2025'), undefined);
});
