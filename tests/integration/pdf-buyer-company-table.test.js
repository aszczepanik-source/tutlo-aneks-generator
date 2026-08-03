import assert from 'node:assert/strict';
import test from 'node:test';
import { extractContractData } from '../../src/domain/contract-extraction.js';

// PDF.js joins the individual cells/lines of the production DANE NABYWCY
// table with whitespace before passing the text to the domain extractor.
test('integracja: odczytuje NIP z układu tabeli DANE NABYWCY wyciągniętego z PDF', () => {
  const pdfTextItems = [
    'Tutlo Sp. z o.o.',
    'NIP: 5272600188',
    'DANE NABYWCY',
    'FIRMA:', 'Klient Firmowy',
    'ADRES:', 'Testowa 1',
    'TELEFON:', '123 456 789',
    'E-MAIL:', 'klient@example.test',
    'NIP:', '1234563218',
    'SPECYFIKACJA KURSU',
    'ZAWARTOŚĆ KURSU',
    'WARUNKI PŁATNOŚCI'
  ];

  const contract = extractContractData(pdfTextItems.join(' '));

  assert.deepEqual(
    { customerName: contract.customerName, personalId: contract.personalId, customerType: contract.customerType },
    { customerName: 'Klient Firmowy', personalId: '1234563218', customerType: 'company' }
  );
});
