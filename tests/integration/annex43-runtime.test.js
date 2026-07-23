import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { getAnnexRoute } from '../../router.js';
import { prepareAnnex43 } from '../../src/annexes/43/index.js';

const customer = 'Imię i nazwisko: Jan Kowalski Adres: Polna 1, 00-001 Warszawa PESEL: 90010112345';
const agreementNumber = 'EL/ABC/10/2/2024';

test('router udostępnia aneks 43 tylko przy dodatkowej opłacie, niezależnie od finansowania', () => {
  for (const paymentType of ['credit', 'internal']) {
    assert.equal(getAnnexRoute('43', { rawText: `Kurs Tutlo Plus za dodatkową opłatą`, paymentType })?.number, '43');
  }
  assert.equal(getAnnexRoute('43', { rawText: 'Kurs Tutlo Plus możliwość korzystania przez 2 dodatkowych Użytkowników' }), undefined);
});

test('router -> aneks 43 -> prepareAnnex43 -> Apps Script działa bez ReferenceError', async () => {
  const contract = { agreementNumber, rawText: `${customer} Kurs Tutlo Plus za dodatkową opłatą` };
  assert.equal(getAnnexRoute('43', contract).number, '43');
  const prepared = prepareAnnex43(contract);
  const replacements = [];
  const context = {
    console, Date,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ value, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    DriveApp: { getFolderById: () => ({}), getFileById: () => ({ makeCopy: () => ({ getId: () => 'copy-id' }) }) },
    DocumentApp: { openById: () => ({ getBody: () => ({ replaceText: (...args) => replacements.push(args) }), saveAndClose() {}, getUrl: () => 'https://docs.google.com/document/d/copy-id' }) }
  };
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('../../apps-scirpt/Code.gs', import.meta.url), 'utf8'), context);
  const output = context.doPost({ postData: { contents: JSON.stringify({ action: 'generate', requestId: 'request-43-test', ...prepared }) } });
  const result = JSON.parse(output.value);
  assert.equal(result.ok, true);
  assert.equal(replacements.length, 7);
});
