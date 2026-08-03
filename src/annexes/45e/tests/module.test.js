import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAvailableAnnexCards, getPostPaymentChangeAnnexCards } from '../../availability.js';
import { ANNEX_27_BANKS } from '../../27/validator.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';
import manifest from '../manifest.json' with { type: 'json' };
import { ANNEX_45E_BANKS, prepareAnnex45E } from '../index.js';

const account = '12345678901234567890123456';
const contract = {
  contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'T/2026/01', agreementDate: '2026-01-02', courseStartDate: '2026-01-10',
  customerType: 'person', customerName: 'Jan Kowalski', address: 'Testowa 1', personalId: '12345678901',
  lessonCount: 144, teacherVariant: 'polish_english_native', monthlyInstallmentCents: 20000
};
const inputs = { newInstallment: '150', weeklyLimit: '4', bank: 'Inbank', bankAccount: account, tutloAccount: account };
const prepare = (overrides = {}, form = inputs, date = '2026-07-15') => prepareAnnex45E({ ...contract, ...overrides }, form, date);

test('dostępność wyłącznie limit + credit i tylko po zmianie formy płatności', () => {
  assert.ok(getPostPaymentChangeAnnexCards(contract).some(card => card.no === '45e' && card.mode === 'post_payment_change'));
  assert.ok(!getAvailableAnnexCards(contract).some(card => card.no === '45e'));
  for (const variant of [
    { contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24' },
    { contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' },
    { contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24' }
  ]) assert.ok(!getPostPaymentChangeAnnexCards(variant).some(card => card.no === '45e'));
});

test('wylicza raty, spłatę, nową cenę i średnią od początku kursu', () => {
  const prepared = prepare();
  assert.equal(prepared.calculation.installmentCount, 7);
  assert.equal(prepared.calculation.remainingInstallments, 17);
  assert.equal(prepared.calculation.paidToAnnexDateCents, 140000);
  assert.equal(prepared.calculation.remainingTutloCents, 255000);
  assert.equal(prepared.calculation.newPriceCents, 395000);
  assert.equal(prepared.calculation.newAverageInstallmentCents, 16458);
  assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '16.07.2026');
});

test('mapuje istniejące wyniki usedMonths, ratę umowną i spłatę bez symbolu waluty', () => {
  const prepared = prepare({ courseStartDate: '2026-01-16', monthlyInstallmentCents: 30000 });
  assert.equal(prepared.calculation.usedMonths, 6);
  assert.equal(prepared.calculation.currentInstallmentCents, 30000);
  assert.equal(prepared.calculation.paidToAnnexDateCents, 180000);
  assert.equal(prepared.values.LICZBA_RAT, '6');
  assert.equal(prepared.values.OBECNA_RATA, '300,00');
  assert.equal(prepared.values.SPLACONO_DO_DNIA_ANEKSU, '1800,00');
});

test('template, prepared.values i manifest mają spójny komplet wymaganych placeholderów', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  const placeholders = extractDocxPlaceholders(template);
  const prepared = prepare();
  const rowKeys = new Set(Object.keys(prepared.values.RATY[0]));
  const valueKeys = new Set(Object.keys(prepared.values));
  const missingValues = placeholders.filter(key => !key.startsWith('#') && !key.startsWith('/')
    && !valueKeys.has(key) && !rowKeys.has(key));
  const requiredTemplateFields = placeholders.filter(key => !key.startsWith('#') && !key.startsWith('/')
    && !rowKeys.has(key));

  assert.deepEqual(missingValues, []);
  assert.deepEqual(requiredTemplateFields.filter(key => !manifest.requiredFields.includes(key)), []);
  assert.ok(['SPLACONO_DO_DNIA_ANEKSU', 'LICZBA_RAT', 'OBECNA_RATA']
    .every(key => manifest.requiredFields.includes(key)));
});

test('wynikowy DOCX zastępuje nowe placeholdery i zawiera pojedynczą walutę', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  const prepared = prepare({ courseStartDate: '2026-01-16', monthlyInstallmentCents: 30000 });
  class FakeZip {
    constructor() {
      this.files = { 'word/document.xml': true };
      this.xml = '{{SPLACONO_DO_DNIA_ANEKSU}} zł | {{LICZBA_RAT}} | {{OBECNA_RATA}} zł';
    }
    file() { return { asText: () => this.xml }; }
    generate() { return new TextEncoder().encode(this.xml); }
  }
  class FakeDocxtemplater {
    constructor(zip) { this.zip = zip; }
    render(values) {
      this.zip.xml = this.zip.xml.replace(/\{\{([^{}]+)\}\}/g, (_, key) => values[key]);
    }
    getZip() { return this.zip; }
  }
  const output = renderDocx(template, prepared, { PizZip: FakeZip, docxtemplater: FakeDocxtemplater });
  const xml = new TextDecoder().decode(output);

  assert.doesNotMatch(xml, /\{\{(?:SPLACONO_DO_DNIA_ANEKSU|LICZBA_RAT|OBECNA_RATA)\}\}/);
  assert.match(xml, /1800,00 zł/);
  assert.match(xml, /300,00 zł/);
  assert.doesNotMatch(xml, /zł\s*zł/);
});

test('stosuje regułę 15. dnia istniejącego helpera miesięcy', () => {
  assert.equal(prepare({ courseStartDate: '2026-01-15' }).calculation.usedMonths, 7);
  assert.equal(prepare({ courseStartDate: '2026-01-16' }).calculation.usedMonths, 6);
});

test('harmonogram zawiera wyłącznie pozostałe raty, od I, zawsze do 5. dnia miesiąca', () => {
  const { calculation } = prepare();
  assert.equal(calculation.installments.length, calculation.remainingInstallments);
  assert.deepEqual(calculation.installments.slice(0, 2), [
    { NUMER_RATY: 'I rata', KWOTA: '150,00', TERMIN: '05.08.2026' },
    { NUMER_RATY: 'II rata', KWOTA: '150,00', TERMIN: '05.09.2026' }
  ]);
  assert.ok(calculation.installments.every(row => row.TERMIN.startsWith('05.')));
});

test('oba rachunki wymagają 26 cyfr i są normalizowane po wklejeniu', () => {
  const spaced = '12 3456 7890 1234 5678 9012 3456';
  const prepared = prepare({}, { ...inputs, bankAccount: spaced, tutloAccount: spaced });
  assert.equal(prepared.values.NUMER_RACHUNKU_BANKU, account);
  assert.equal(prepared.values.NUMER_RACHUNKU_TUTLO, account);
  for (const field of ['bankAccount', 'tutloAccount']) {
    assert.throws(() => prepare({}, { ...inputs, [field]: account.slice(1) }), /26 cyfr/);
  }
});

test('bank korzysta bezpośrednio z istniejącej listy banków używanej przez Aneks 26', () => {
  assert.equal(ANNEX_45E_BANKS, ANNEX_27_BANKS);
  assert.throws(() => prepare({}, { ...inputs, bank: 'Inny bank' }), /listy Aneksu 26/);
});

test('liczba lekcji i typy lektorów są przepisane z umowy', () => {
  const prepared = prepare({ lessonCount: 321, teacherVariant: 'english_native' });
  assert.equal(prepared.values.LICZBA_LEKCJI, '321');
  assert.equal(prepared.values.TYPY_LEKTOROW, 'English Expert, Native Speaker');
});
