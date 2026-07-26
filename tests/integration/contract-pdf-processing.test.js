import assert from 'node:assert/strict';
import test from 'node:test';
import { processContractPdf } from '../../src/application/process-contract-pdf.js';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';
import { scenarios } from '../fixtures/contracts/scenarios.js';

const personText = scenarios.find(([name]) => name === 'flexible-credit-person')[1];
const companyText = scenarios.find(([name]) => name === 'flexible-credit-company')[1];

function parserSpy() {
  const calls = [];
  return {
    calls,
    parse(rawText) {
      calls.push(rawText);
      return parseCurrentContract(rawText);
    }
  };
}

test('pełny przepływ: ekstraktor zwraca string, a parser tworzy currentContract dokładnie raz', async () => {
  const spy = parserSpy();
  const currentContract = await processContractPdf({}, {
    extractText: async () => personText,
    parseCurrentContract: spy.parse
  });
  assert.equal(spy.calls.length, 1);
  assert.equal(spy.calls[0], personText);
  assert.equal(currentContract.customerType, 'person');
  assert.equal(currentContract.contractType, 'flexible');
});

test('adapter ekstrakcji przekazuje parserowi wyłącznie pole text z obiektu', async () => {
  const spy = parserSpy();
  await processContractPdf({}, {
    extractText: async () => ({ text: companyText, pages: 2 }),
    parseCurrentContract: spy.parse
  });
  assert.deepEqual(spy.calls, [companyText]);
});

test('pusty tekst PDF zgłasza błąd etapu ekstrakcji', async () => {
  await assert.rejects(
    processContractPdf({}, { extractText: async () => '   ' }),
    error => error.stage === 'extraction' && error.message === 'Nie udało się odczytać tekstu z PDF.'
  );
});

test('poprawny tekst z brakującymi danymi zgłasza walidację, nie odczyt PDF', async () => {
  await assert.rejects(
    processContractPdf({}, {
      extractText: async () => personText,
      validateCurrentContract: () => ({ valid: false, issues: ['Brak wymaganej wartości: address.'] })
    }),
    error => error.stage === 'validation'
      && error.message.includes('brakuje wymaganych danych:')
      && !error.message.includes('odczytać PDF')
  );
});

test('poprawny tekst bez rozpoznanego rodzaju umowy zgłasza etap rozpoznania', async () => {
  await assert.rejects(
    processContractPdf({}, {
      extractText: async () => 'To jest poprawnie odczytana warstwa tekstowa bez znaczników umowy.'
    }),
    error => error.stage === 'recognition'
      && error.message === 'Odczytano PDF, ale nie rozpoznano rodzaju umowy.'
  );
});

test('fixture wcześniej działającej umowy osoby fizycznej przechodzi cały przepływ', async () => {
  const contract = await processContractPdf({}, { extractText: async () => personText });
  assert.equal(contract.customerType, 'person');
  assert.equal(contract.personalId.length, 11);
});

test('fixture wcześniej działającej umowy firmy przechodzi cały przepływ', async () => {
  const contract = await processContractPdf({}, { extractText: async () => companyText });
  assert.equal(contract.customerType, 'company');
  assert.equal(contract.personalId.length, 10);
});

test('jedno uruchomienie analizy nie może wywołać wspólnego parsera więcej niż raz', async () => {
  const spy = parserSpy();
  await processContractPdf({}, { extractText: async () => personText, parseCurrentContract: spy.parse });
  assert.equal(spy.calls.length, 1);
});
