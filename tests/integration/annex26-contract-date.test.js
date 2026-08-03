import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractAgreementDate,
  getAgreementDateDiagnostic,
  normalizeAgreementNumber,
  parseAgreementDateFromNumber
} from '../../src/domain/contract-extraction.js';

test('parser daty odczytuje pełny numer umowy', () => {
  assert.equal(parseAgreementDateFromNumber('EL/TEST/100/200/3/9/2025'), '03.09.2025');
});

test('odczytuje końcową datę niezależnie od treści wcześniejszych segmentów', () => {
  for (const agreementNumber of [
    'EL/TEST/100/200/3/9/2025',
    'ŻÓŁĆ/ĄĘ/811/192956/3/9/2025',
    'Umowa-Łódź/wersja specjalna/3/9/2025',
    'Umowa\u00a0Łódź /3/9/2025',
    'Aneks (Łódź)/część-1/dodatkowy / segment/3/9/2025'
  ]) {
    assert.equal(extractAgreementDate(agreementNumber), '03.09.2025');
  }
});

test('odrzuca nieistniejącą datę mimo znalezienia końcowego wzorca', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.equal(extractAgreementDate('ŻÓŁĆ/ĄĘ/811/192956/31/2/2025'), undefined);
  assert.equal(warn.mock.calls[0].arguments[1].endingDatePatternFound, true);
});

test('diagnostyka braku daty pokazuje znormalizowany numer, jego końcówkę i wynik dopasowania', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const log = t.mock.method(console, 'log', () => {});
  const agreementNumber = `  Zażółć\u00a0gęślą/${'segment-'.repeat(6)}bez daty  `;

  assert.equal(extractAgreementDate(agreementNumber), undefined);
  assert.deepEqual(log.mock.calls[0].arguments[1], {
    rawAgreementNumber: agreementNumber,
    jsonAgreementNumber: JSON.stringify(agreementNumber),
    normalizedAgreementNumber: `Zażółć gęślą/${'segment-'.repeat(6)}bez daty`,
    length: agreementNumber.length,
    charCodes: Array.from(agreementNumber).map(char => char.codePointAt(0)),
    last60Characters: JSON.stringify(agreementNumber.slice(-60))
  });
  assert.equal(warn.mock.calls[0].arguments[0], '[Data umowy] Nie odczytano prawidłowej daty z numeru umowy.');
});

test('odczytuje ostatnią datę, gdy PDF dokleił niewidoczne znaki i następną linię', () => {
  const agreementNumber = 'EL/TEST/100/200/3/9/2025\u00a0\t\nDANE NABYWCY';

  assert.equal(normalizeAgreementNumber(agreementNumber), 'EL/TEST/100/200/3/9/2025 DANE NABYWCY');
  assert.equal(extractAgreementDate(agreementNumber), '03.09.2025');
  assert.deepEqual(getAgreementDateDiagnostic(agreementNumber), {
    last60Characters: JSON.stringify(agreementNumber),
    endingDatePatternFound: true,
    normalizedAgreementNumber: 'EL/TEST/100/200/3/9/2025 DANE NABYWCY'
  });
});

test('wybiera ostatnie wystąpienie daty i waliduje je kalendarzowo', t => {
  assert.equal(extractAgreementDate('ARCHIWALNA/1/1/2024, NUMER/3/9/2025).'), '03.09.2025');
  const warn = t.mock.method(console, 'warn', () => {});
  assert.equal(extractAgreementDate('ARCHIWALNA/1/1/2024, NUMER/31/2/2025 tekst'), undefined);
  assert.equal(warn.mock.calls[0].arguments[1].endingDatePatternFound, true);
});
