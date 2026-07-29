import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex43 } from '../index.js';
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';
import { annex43Filename } from '../../../infrastructure/local-docx-generator.js';

const person = {
  agreementNumber: 'EL/2026/43', agreementDate: '2026-07-10', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'ul. Testowa 1, Warszawa',
  contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit', familyGroupVariant: 'paid'
};
const prepare = (contract = person, today = '2026-07-29') => prepareAnnex43(contract, { today });

test('przygotowuje dokładny komplet wartości dla osoby fizycznej', () => {
  assert.deepEqual(prepare().values, {
    NUMER_UMOWY: 'EL/2026/43', DATA_ZAWARCIA_UMOWY: '10.07.2026', DATA_ANEKSU: '29.07.2026',
    IMIE_NAZWISKO: 'Jan Kowalski', ADRES: 'ul. Testowa 1, Warszawa',
    IDENTYFIKATOR_LABEL: 'PESEL', IDENTYFIKATOR: '90010112345', DATA_WEJSCIA_W_ZYCIE: '30.07.2026'
  });
});

test('mapuje firmę oraz NIP wspólnymi polami currentContract', () => {
  const values = prepare({ ...person, customerType: 'company', customerName: 'ABC Sp. z o.o.', personalId: '1234567890' }).values;
  assert.equal(values.IMIE_NAZWISKO, 'ABC Sp. z o.o.');
  assert.equal(values.IDENTYFIKATOR_LABEL, 'NIP');
  assert.equal(values.IDENTYFIKATOR, '1234567890');
});

test('data wejścia w życie jest następnym dniem, także na końcu miesiąca i roku', () => {
  assert.equal(prepare(person, '2026-07-29').values.DATA_WEJSCIA_W_ZYCIE, '30.07.2026');
  assert.equal(prepare(person, '2026-07-31').values.DATA_WEJSCIA_W_ZYCIE, '01.08.2026');
  assert.equal(prepare(person, '2026-12-31').values.DATA_WEJSCIA_W_ZYCIE, '01.01.2027');
});

for (const [field, message] of [
  ['agreementNumber', 'Nie udało się odczytać numeru umowy.'],
  ['agreementDate', 'Nie udało się odczytać daty zawarcia umowy.'],
  ['address', 'Nie udało się odczytać adresu klienta.'],
  ['personalId', 'Nie udało się odczytać numeru PESEL/NIP.']
]) test(`brak pola ${field} blokuje generowanie`, () => {
  assert.throws(() => prepare({ ...person, [field]: undefined }), new RegExp(message.replace(/[.?]/g, '\\$&')));
});

for (const overrides of [
  { familyGroupVariant: 'included' }, { familyGroupVariant: null },
  { contractType: 'limit' }, { paymentType: 'internal', paymentVariant: 'internal_24' }
]) test(`niezgodny wariant blokuje generowanie: ${JSON.stringify(overrides)}`, () => {
  assert.throws(() => prepare({ ...person, ...overrides }), /Aneks 43 jest dostępny tylko/);
});

test('płatny wariant dla elastycznej umowy kredytowej pozwala przygotować bezpieczne wartości', () => {
  const prepared = prepare();
  assert.deepEqual(Object.keys(prepared.values), manifest.requiredFields);
  assert.ok(Object.values(prepared.values).every(value => value !== undefined && value !== null && !/undefined/.test(value)));
  assert.equal(annex43Filename(prepared.values), 'Aneks 43 – Jan Kowalski.docx');
  assert.equal(annex43Filename({ IMIE_NAZWISKO: 'ABC Sp. z o.o.' }), 'Aneks 43 – ABC Sp. z o.o..docx');
});

test('data zawarcia umowy uwzględnia istniejące aliasy bez wartości domyślnej', () => {
  assert.equal(prepare({ ...person, agreementDate: undefined, dataZawarciaUmowy: '11.07.2026' }).values.DATA_ZAWARCIA_UMOWY, '11.07.2026');
  assert.equal(prepare({ ...person, agreementDate: undefined, contractDate: '2026-07-12' }).values.DATA_ZAWARCIA_UMOWY, '12.07.2026');
});

const templateUrl = new URL('../template.docx', import.meta.url);
let templatePresent = true;
try { await access(templateUrl); } catch { templatePresent = false; }

test('template.docx zawiera wszystkie placeholdery mimo podziału tekstu znacznikami Worda', { skip: !templatePresent && 'Szablon należy wgrać ręcznie.' }, async () => {
  assert.deepEqual(extractDocxPlaceholders(await readFile(templateUrl)), [...manifest.requiredFields].sort());
});
