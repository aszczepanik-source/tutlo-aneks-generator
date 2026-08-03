import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex29 } from '../generator.js';
import { validate } from '../validator.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';
import { extractDocxPlaceholders, readZipEntry } from '../../shared/template-inspection.js';

const contract = {
  agreementNumber: 'EL/2026/123', agreementDate: '2026-02-14', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '00210100004', address: 'Testowa 1, Warszawa',
  coursePriceCents: 1392000, monthlyInstallmentCents: 58000,
  contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24'
};

test('aneks 29: oblicza cenę i wszystkie placeholdery wyłącznie z currentContract', () => {
  const prepared = prepareAnnex29({ ...contract, rawText: new Proxy({}, { get() { throw new Error('rawText read'); } }) }, { today: '2026-07-28' });
  assert.equal(prepared.calculation.newCoursePriceCents, 1334000);
  assert.deepEqual(prepared.values, {
    ADRES: 'Testowa 1, Warszawa', DATA_ANEKSU: '28.07.2026', DATA_WEJSCIA_W_ZYCIE: '29.07.2026',
    DATA_ZAWARCIA_UMOWY: '14.02.2026', IMIE_NAZWISKO: 'Jan Kowalski', NOWA_CENA: '13 340,00',
    NUMER_UMOWY: 'EL/2026/123', IDENTYFIKATOR_LABEL: 'PESEL', IDENTYFIKATOR: '00210100004'
  });
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
});

test('aneks 29: mapuje wyłącznie PESEL osoby lub NIP firmy w obu trybach', () => {
  const cases = [
    { mode: 'standard', contract, options: {} },
    { mode: 'post_payment_change', contract: { ...contract, paymentType: 'credit', paymentVariant: 'credit' }, options: {} }
  ];
  for (const { mode, contract: modeContract, options } of cases) {
    const person = prepareAnnex29({ ...modeContract, customerType: 'person', personalId: '12345678901' }, { ...options, mode, today: '2026-07-28' });
    const company = prepareAnnex29({ ...modeContract, customerType: 'company', personalId: '1234567890' }, { ...options, mode, today: '2026-07-28' });
    assert.equal(person.values.IDENTYFIKATOR_LABEL, 'PESEL');
    assert.equal(person.values.IDENTYFIKATOR, '12345678901');
    assert.equal(company.values.IDENTYFIKATOR_LABEL, 'NIP');
    assert.equal(company.values.IDENTYFIKATOR, '1234567890');
    assert.equal('PESEL' in person.values, false);
    assert.equal('PESEL' in company.values, false);
  }
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

test('aneks 29: DOCX firmy zawiera wyłącznie etykietę NIP i nie pozostawia PESEL', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  const prepared = prepareAnnex29({ ...contract, customerType: 'company', personalId: '1234567890' }, { today: '2026-07-28' });
  const xml = readZipEntry(template, 'word/document.xml').toString('utf8');
  const text = xml.replace(/<[^>]+>/g, '')
    .replace('{{IDENTYFIKATOR_LABEL}}', prepared.values.IDENTYFIKATOR_LABEL)
    .replace('{{IDENTYFIKATOR}}', prepared.values.IDENTYFIKATOR);
  assert.match(text, /NIP:\s*1234567890/);
  assert.doesNotMatch(text, /PESEL:|\{\{PESEL\}\}/);
});

test('aneks 29: manifest wskazuje istniejący szablon i właściwy wariant', () => {
  assert.equal(manifest.id, '29');
  assert.deepEqual(manifest.allowedContractVariants, ['flexible/internal/internal_24']);
});
