import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateAnnex25, parseMoneyToCents } from '../../../domain/annex-calculations.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';
import { prepareAnnex25 } from '../generator.js';
import { validateAnnex25Data } from '../validator.js';
import manifest from '../manifest.json' with { type: 'json' };
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';

const installments = Array.from({ length: 24 }, (_, index) => ({
  dueDate: `${2025 + Math.floor((index + 8) / 12)}-${String((index + 8) % 12 + 1).padStart(2, '0')}-15`
}));
const contract = {
  contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24',
  coursePriceCents: 957600, installments, agreementNumber: 'EL/1/1/2025', agreementDate: '01.01.2025',
  customerType: 'person', customerName: 'Jan Kowalski', address: 'Testowa 1', personalId: '12345678901', lessonCount: 192,
  monthlyLessonLimit: 24, monthlyInstallmentCents: 39900,
  internalPaymentAccount: '12345678901234567890123456', teacherVariant: 'polish_english_native',
  installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-09-15',
    recurringStartDate: '2025-10-15', recurringDayOfMonth: 15 }
};

test('walidacja aneksu 25 używa kanonicznego wariantu 24 rat wewnętrznych', () => {
  assert.equal(validateAnnex25Data(contract), contract);
  assert.doesNotThrow(() => prepareAnnex25(contract, { newInstallment: '300' }, '2026-01-20'));
  for (const paymentVariant of ['internal_2', 'internal_13', 'internal_4']) {
    assert.throws(() => validateAnnex25Data({ ...contract, paymentVariant }),
      /Aneks 25 wymaga umowy na 24 raty wewnętrzne\./);
  }
  assert.throws(() => validateAnnex25Data({ ...contract, paymentType: 'credit', paymentVariant: 'credit' }),
    /Aneks 25 wymaga rat wewnętrznych\./);
  assert.throws(() => validateAnnex25Data({ ...contract, contractType: 'limit' }),
    /Aneks 25 wymaga umowy elastycznej\./);
});

test('walidacja nie wymaga installmentCount i nie analizuje rawText', () => {
  const withoutLegacyCount = { ...contract, rawText: 'umowa na 2 raty' };
  delete withoutLegacyCount.installmentCount;
  assert.doesNotThrow(() => validateAnnex25Data(withoutLegacyCount));
  assert.doesNotThrow(() => validateAnnex25Data({ ...withoutLegacyCount, rawText: undefined }));
});

test('normalizacja kwoty przyjmuje obsługiwane formaty i odrzuca NaN, Infinity oraz nadmiar cyfr', () => {
  for (const value of ['199', '199 zł', '199,00', '199,00 zł']) assert.equal(parseMoneyToCents(value), 19900);
  for (const value of ['', 'NaN', 'Infinity', '199,001']) assert.throws(() => parseMoneyToCents(value));
});

test('obliczenia używają groszy, następnego miesiąca i pełnego harmonogramu', () => {
  const result = calculateAnnex25(contract, '2026-01-20', 30000);
  assert.equal(result.oldInstallmentCents, 39900);
  assert.equal(result.effectiveDate, '2026-02-01');
  assert.equal(result.installments.length, 24);
  assert.equal(result.paidInstallments + result.remainingInstallments, 24);
  assert.ok(result.installments.slice(0, result.paidInstallments).every(item => item.amountCents === 39900));
  assert.ok(result.installments.slice(result.paidInstallments).every(item => item.amountCents === 30000));
  assert.equal(result.installments.reduce((sum, item) => sum + item.amountCents, 0), result.newPriceCents);
});

test('blokuje ratę równą lub wyższą, brak ceny i niepełny harmonogram', () => {
  assert.throws(() => calculateAnnex25(contract, '2026-01-20', 39900), /niższa.*399,00 zł/);
  assert.throws(() => calculateAnnex25(contract, '2026-01-20', 40000), /niższa.*399,00 zł/);
  assert.throws(() => calculateAnnex25({ ...contract, coursePriceCents: undefined }, '2026-01-20', 30000), /Cena kursu/);
  assert.throws(() => calculateAnnex25({ ...contract, installmentPlan: { paymentCount: 24 } }, '2026-01-20', 30000), /daty rozpoczęcia/);
});

test('prepareAnnex25 wypełnia dokładnie wszystkie rzeczywiste placeholdery', () => {
  const prepared = prepareAnnex25(contract, { newInstallment: '300,00 zł' }, '2026-01-20');
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.equal(Object.values(prepared.values).some(value => /NaN|Infinity|undefined|null|\{\{/.test(String(value))), false);
});

test('prepareAnnex25 korzysta z installmentPlan i generuje DOCX', async () => {
  const prepared = prepareAnnex25(contract, { newInstallment: '300,00 zł' }, '2026-01-20');
  assert.deepEqual(prepared.calculation.installments.slice(0, 3).map(item => item.dueDate),
    ['2025-09-15', '2025-10-15', '2025-11-15']);
  class FakeZip {
    constructor() { this.files = { 'word/document.xml': true }; this.xml = '{{NUMER_UMOWY}}'; }
    file() { return { asText: () => this.xml }; }
    generate() { return new TextEncoder().encode(this.xml); }
  }
  class FakeDocxtemplater {
    constructor(zip) { this.zip = zip; }
    render(values) { this.zip.xml = this.zip.xml.replace('{{NUMER_UMOWY}}', values.NUMER_UMOWY); }
    getZip() { return this.zip; }
  }
  const document = renderDocx(new Uint8Array(), prepared,
    { PizZip: FakeZip, docxtemplater: FakeDocxtemplater });
  assert.ok(document.byteLength > 0);
});

test('formularz aneksu 25 zawiera wyłącznie pole nowej raty', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="annex25Form"[\s\S]*?<\/form>/)?.[0];
  assert.equal((form.match(/<input\b/g) || []).length, 1);
  assert.match(form, /id="annex25NewInstallment"/);
  assert.doesNotMatch(form, /bank|rachun|dat[aey] zmian/i);
});

test('numer konta pochodzi z currentContract, jest normalizowany i pozostaje stringiem', () => {
  const spacedAccount = '12 3456-7890 1234 5678 9012 3456';
  const prepared = prepareAnnex25(
    { ...contract, internalPaymentAccount: spacedAccount },
    { newInstallment: '300', bank: 'Nie używaj', bankAccount: '99999999999999999999999999' },
    '2026-01-20'
  );
  assert.equal(prepared.values.NUMER_KONTA, '12345678901234567890123456');
  assert.equal(typeof prepared.values.NUMER_KONTA, 'string');
  assert.equal('BANK' in prepared.values, false);
});

test('brak poprawnego konta w currentContract blokuje generowanie czytelnym komunikatem', () => {
  for (const internalPaymentAccount of [undefined, '', '123', '123456789012345678901234567']) {
    assert.throws(
      () => prepareAnnex25({ ...contract, internalPaymentAccount }, { newInstallment: '300' }, '2026-01-20'),
      /Nie odczytano numeru rachunku z umowy\./
    );
  }
});

test('szablon aneksu 25 używa placeholdera NUMER_KONTA', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.ok(extractDocxPlaceholders(template).includes('NUMER_KONTA'));
  assert.equal(prepareAnnex25(contract, { newInstallment: '300' }, '2026-01-20').values.NUMER_KONTA,
    contract.internalPaymentAccount);
});

test('build publikuje firmowy szablon aneksu 25', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.ok(template.byteLength > 0);
  const build = await readFile(new URL('../../../../scripts/build-release.mjs', import.meta.url), 'utf8');
  assert.match(build, /cp\(new URL\('\.\.\/src\/'[\s\S]*recursive: true/);
});
