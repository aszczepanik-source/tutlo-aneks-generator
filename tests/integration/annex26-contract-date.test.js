import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAgreementDate } from '../../src/domain/contract-extraction.js';

test('odczytuje końcową datę niezależnie od treści wcześniejszych segmentów', () => {
  for (const agreementNumber of [
    'EL/JF/811/192956/3/9/2025',
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
  const agreementNumber = `  Zażółć\u00a0gęślą/${'segment-'.repeat(6)}bez daty  `;

  assert.equal(extractAgreementDate(agreementNumber), undefined);
  assert.deepEqual(warn.mock.calls[0].arguments[1], {
    normalizedAgreementNumber: `Zażółć gęślą/${'segment-'.repeat(6)}bez daty`,
    last40Characters: `Zażółć gęślą/${'segment-'.repeat(6)}bez daty`.slice(-40),
    endingDatePatternFound: false
  });
});
