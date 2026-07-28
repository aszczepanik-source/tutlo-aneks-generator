import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex11 } from '../generator.js';
import { validateAnnex11Data } from '../validator.js';
import { annex11TemplateUrl, remainingPlaceholders, renderDocx } from '../../../infrastructure/local-docx-generator.js';

const browserContext = { console, TextEncoder, TextDecoder, DOMParser, XMLSerializer };
browserContext.window = browserContext;
browserContext.self = browserContext;
vm.createContext(browserContext);
for (const library of ['../../../../node_modules/pizzip/dist/pizzip.min.js',
  '../../../../node_modules/docxtemplater/build/docxtemplater.js']) {
  vm.runInContext(await readFile(new URL(library, import.meta.url), 'utf8'), browserContext);
}
const { PizZip, docxtemplater: Docxtemplater } = browserContext;

const formData = {
  annexDate: '2026-07-28', suspensionStart: '2026-08-01', suspensionEnd: '2026-09-30',
  suspensionLength: '2', newAgreementEnd: '2027-10-15', paymentResumeDate: '2026-10-01',
  effectiveDate: '2026-07-29'
};
const contract = {
  agreementNumber: 'EL/11/2025', agreementDate: '2025-09-15', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '12345678901', address: 'Testowa 1, Warszawa',
  coursePriceCents: 1200000, monthlyInstallmentCents: 50000, lessonCount: 240,
  monthlyLessonLimit: 20, teacherVariant: 'polish_english_native',
  internalPaymentAccount: '12345678901234567890123456', contractType: 'flexible',
  paymentType: 'internal', paymentVariant: 'internal_24',
  installmentPlan: { paymentCount: 24, firstPaymentAmountCents: 50000,
    recurringPaymentAmountCents: 50000, firstPaymentDueDate: '2025-09-15',
    recurringStartDate: '2025-10-15' }
};

test('aneks 11 działa wyłącznie dla flexible + internal + internal_24', () => {
  assert.doesNotThrow(() => validateAnnex11Data({ currentContract: contract, formData }));
  for (const paymentVariant of ['internal_2', 'internal_13', 'internal_4']) {
    assert.throws(() => validateAnnex11Data({ currentContract: { ...contract, paymentVariant }, formData }), /24 raty/);
  }
  assert.throws(() => validateAnnex11Data({ currentContract: { ...contract, paymentType: 'credit' }, formData }), /rat wewnętrznych/);
  assert.throws(() => validateAnnex11Data({ currentContract: { ...contract, contractType: 'limit' }, formData }), /elastycznej/);
});

for (const identity of [
  { customerType: 'person', customerName: 'Jan Kowalski', personalId: '12345678901' },
  { customerType: 'company', customerName: 'Tutlo Klient sp. z o.o.', personalId: '1234567890' }
]) {
  test(`aneks 11 generuje DOCX dla ${identity.customerType === 'company' ? 'firmy z NIP' : 'osoby z PESEL'}`, async () => {
    const prepared = prepareAnnex11({ ...contract, ...identity }, formData);
    assert.equal(prepared.values.PESEL, identity.personalId);
    assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
    const template = await readFile(new URL('../template.docx', import.meta.url));
    const bytes = renderDocx(template, prepared, { PizZip, docxtemplater: Docxtemplater });
    assert.ok(bytes.byteLength > 0);
    assert.deepEqual(remainingPlaceholders(new PizZip(bytes)), []);
  });
}

test('generator korzysta wyłącznie z pól kanonicznych i ignoruje dodatkowe dane', () => {
  const prepared = prepareAnnex11({ ...contract, ['raw' + 'Text']: 'internal_2' }, formData);
  assert.equal(prepared.values.NUMER_UMOWY, contract.agreementNumber);
  assert.equal(prepared.values.PESEL, contract.personalId);
});

test('generator nie odczytuje tekstu źródłowego umowy', async () => {
  const source = await readFile(new URL('../generator.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, new RegExp('raw' + 'Text'));
});

test('URL szablonu zachowuje bazową ścieżkę GitHub Pages', () => {
  const url = annex11TemplateUrl('https://example.github.io/tutlo-aneks-generator/src/infrastructure/local-docx-generator.js');
  assert.equal(url, 'https://example.github.io/tutlo-aneks-generator/src/annexes/11/template.docx');
});

test('build publikuje template.docx aneksu 11', async () => {
  await access(new URL('../../../../dist/src/annexes/11/template.docx', import.meta.url));
});

test('formularz zawiera wyłącznie siedem danych aneksu, bez danych umowy i klienta', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="annex11Form"[\s\S]*?<\/form>/)?.[0];
  assert.equal((form.match(/<input\b/g) || []).length, 7);
  for (const forbidden of ['AgreementNumber', 'CustomerName', 'PersonalId', 'Address', 'CoursePrice', 'LessonCount', 'Account']) {
    assert.doesNotMatch(form, new RegExp(`annex11${forbidden}`, 'i'));
  }
});
