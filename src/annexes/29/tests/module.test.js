import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex29 } from '../generator.js';
import { validate } from '../validator.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';

const contract = {
  agreementNumber: 'EL/2026/123', agreementDate: '2026-02-14', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1, Warszawa',
  coursePriceCents: 1392000, monthlyInstallmentCents: 58000,
  contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24'
};

test('aneks 29: oblicza cenę i wszystkie placeholdery wyłącznie z currentContract', () => {
  const prepared = prepareAnnex29({ ...contract, rawText: new Proxy({}, { get() { throw new Error('rawText read'); } }) }, { today: '2026-07-28' });
  assert.equal(prepared.calculation.newCoursePriceCents, 1334000);
  assert.deepEqual(prepared.values, {
    ADRES: 'Testowa 1, Warszawa', DATA_ANEKSU: '28.07.2026', DATA_WEJSCIA_W_ZYCIE: '29.07.2026',
    DATA_ZAWARCIA_UMOWY: '14.02.2026', IMIE_NAZWISKO: 'Jan Kowalski', NOWA_CENA: '13 340,00',
    NUMER_UMOWY: 'EL/2026/123', PESEL: '90010112345'
  });
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
});

test('aneks 29: jutro uwzględnia koniec miesiąca, roku i rok przestępny', () => {
  assert.equal(prepareAnnex29(contract, { today: '2026-12-31' }).values.DATA_WEJSCIA_W_ZYCIE, '01.01.2027');
  assert.equal(prepareAnnex29(contract, { today: '2028-02-28' }).values.DATA_WEJSCIA_W_ZYCIE, '29.02.2028');
});

test('aneks 29: dopuszcza tylko flexible/internal/internal_24 i dodatnią nową cenę', () => {
  assert.deepEqual(validate(contract), []);
  for (const paymentVariant of ['internal_2', 'internal_13', 'internal_4']) assert.ok(validate({ ...contract, paymentVariant }).length);
  assert.ok(validate({ ...contract, paymentType: 'credit', paymentVariant: 'credit' }).length);
  assert.ok(validate({ ...contract, contractType: 'limit' }).length);
  assert.ok(validate({ ...contract, coursePriceCents: 1 * contract.monthlyInstallmentCents }).length);
  assert.ok(validate({ ...contract, monthlyInstallmentCents: undefined }).length);
});

test('aneks 29: rzeczywisty DOCX ma komplet placeholderów i generuje treść bez podwójnego zł', async () => {
  const prepared = prepareAnnex29(contract, { today: '2026-07-28' });
  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.deepEqual(extractDocxPlaceholders(template), [...manifest.requiredFields].sort());
  class FakeZip {
    constructor() { this.files = { 'word/document.xml': true }; this.xml = '{{NOWA_CENA}} zł'; }
    file() { return { asText: () => this.xml }; }
    generate() { return new TextEncoder().encode(this.xml); }
  }
  class FakeDocxtemplater {
    constructor(zip) { this.zip = zip; }
    render(values) { this.zip.xml = this.zip.xml.replace('{{NOWA_CENA}}', values.NOWA_CENA); }
    getZip() { return this.zip; }
  }
  const bytes = renderDocx(template, prepared, { PizZip: FakeZip, docxtemplater: FakeDocxtemplater });
  const text = new TextDecoder().decode(bytes);
  assert.ok(bytes.byteLength > 0);
  assert.doesNotMatch(text, /{{|zł\s*zł/);
});

test('aneks 29: manifest wskazuje istniejący szablon i właściwy wariant', () => {
  assert.equal(manifest.id, '29');
  assert.deepEqual(manifest.allowedContractVariants, ['flexible/internal/internal_24']);
});
