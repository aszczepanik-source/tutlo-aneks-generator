import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { calculateAnnex11Dates, prepareAnnex11 } from '../generator.js';
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

const contract = {
  agreementNumber: 'EL/11/2025', agreementDate: '2025-09-15', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '12345678901', address: 'Testowa 1, Warszawa',
  monthlyInstallmentCents: 50000, contractType: 'flexible', paymentType: 'internal',
  paymentVariant: 'internal_24',
  installmentPlan: { paymentCount: 24, firstPaymentAmountCents: 45000,
    recurringPaymentAmountCents: 50000, firstPaymentDueDate: '2025-09-05',
    recurringStartDate: '2025-10-05' }
};
const dueDates = values => Array.from({ length: 24 }, (_, index) => values[`RATA_${String(index + 1).padStart(2, '0')}_TERMIN`]);

for (const expected of [
  { months: 1, end: '31.08.2026', resume: '01.09.2026', newEnd: '05.09.2027',
    absent: ['05.08.2026'], tail: ['05.09.2027'] },
  { months: 2, end: '30.09.2026', resume: '01.10.2026', newEnd: '05.10.2027',
    absent: ['05.08.2026', '05.09.2026'], tail: ['05.09.2027', '05.10.2027'] }
]) {
  test(`28.07.2026: automatyczne daty i harmonogram dla ${expected.months} mies.`, () => {
    const prepared = prepareAnnex11(contract, { suspensionMonths: String(expected.months) }, { today: '2026-07-28' });
    assert.equal(prepared.values.DATA_ANEKSU, '28.07.2026');
    assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '29.07.2026');
    assert.equal(prepared.values.START_ZAWIESZENIA, '01.08.2026');
    assert.equal(prepared.values.KONIEC_ZAWIESZENIA, expected.end);
    assert.equal(prepared.values['DATA-WZNOWIENIA-PŁATNOŚCI'], expected.resume);
    assert.equal(prepared.values.NOWY_KONIEC_UMOWY, expected.newEnd);
    const dates = dueDates(prepared.values);
    expected.absent.forEach(date => assert.ok(!dates.includes(date)));
    assert.deepEqual(dates.slice(-expected.months), expected.tail);
    expected.tail.forEach((_, index) => assert.equal(prepared.values[`RATA_${String(25 - expected.months + index).padStart(2, '0')}_KWOTA`], '500,00'));
  });
}

test('31.12 wyznacza początek zawieszenia w kolejnym roku', () => {
  assert.deepEqual(calculateAnnex11Dates('2026-12-31', 1, '2027-12-31'), {
    annexDate: '2026-12-31', effectiveDate: '2027-01-01', suspensionStart: '2027-01-01',
    suspensionEnd: '2027-01-31', paymentResumeDate: '2027-02-01', oldAgreementEnd: '2027-12-31',
    newAgreementEnd: '2028-01-31'
  });
});

test('luty roku przestępnego kończy się 29 lutego', () => {
  assert.equal(calculateAnnex11Dates('2028-01-15', 1, '2028-06-30').suspensionEnd, '2028-02-29');
});

test('dwa miesiące zawieszenia przechodzą przez koniec roku', () => {
  const dates = calculateAnnex11Dates('2026-11-30', 2, '2027-11-30');
  assert.deepEqual([dates.suspensionStart, dates.suspensionEnd, dates.paymentResumeDate],
    ['2026-12-01', '2027-01-31', '2027-02-01']);
});

test('konkretnie zgłasza brak raty w okresie zawieszenia', () => {
  assert.throws(() => prepareAnnex11(contract, { suspensionMonths: 1 }, { today: '2030-07-28' }), /Brak raty w okresie zawieszenia/);
});

test('odrzuca niepełny installmentPlan i wybór inny niż 1 lub 2', () => {
  assert.throws(() => validateAnnex11Data({ currentContract: contract, formData: {} }), /Wybierz okres/);
  assert.throws(() => validateAnnex11Data({ currentContract: { ...contract, installmentPlan: { paymentCount: 24 } }, formData: { suspensionMonths: 1 } }), /Niepełny harmonogram/);
});

for (const identity of [
  { customerType: 'person', customerName: 'Jan Kowalski', personalId: '12345678901' },
  { customerType: 'company', customerName: 'Tutlo Klient sp. z o.o.', personalId: '1234567890' }
]) {
  test(`DOCX mapuje PESEL dla: ${identity.customerType}`, async () => {
    const prepared = prepareAnnex11({ ...contract, ...identity }, { suspensionMonths: 1 }, { today: '2026-07-28' });
    assert.equal(prepared.values.PESEL, identity.personalId);
    const template = await readFile(new URL('../template.docx', import.meta.url));
    const bytes = renderDocx(template, prepared, { PizZip, docxtemplater: Docxtemplater });
    assert.deepEqual(remainingPlaceholders(new PizZip(bytes)), []);
  });
}

test('generator ignoruje rawText i korzysta z currentContract', async () => {
  const prepared = prepareAnnex11({ ...contract, rawText: 'inne dane' }, { suspensionMonths: 1 }, { today: '2026-07-28' });
  assert.equal(prepared.values.NUMER_UMOWY, contract.agreementNumber);
  const source = await readFile(new URL('../generator.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /rawText/);
});

test('URL i publikacja szablonu pozostają dostępne', async () => {
  assert.equal(annex11TemplateUrl('https://example.github.io/tutlo-aneks-generator/src/infrastructure/local-docx-generator.js'),
    'https://example.github.io/tutlo-aneks-generator/src/annexes/11/template.docx');
  await access(new URL('../../../../dist/src/annexes/11/template.docx', import.meta.url));
});

test('formularz zawiera wyłącznie wybór okresu i przycisk pobierania', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="annex11Form"[\s\S]*?<\/form>/)?.[0];
  assert.equal((form.match(/<select\b/g) || []).length, 1);
  assert.equal((form.match(/<input\b/g) || []).length, 0);
  assert.match(form, />1 miesiąc</);
  assert.match(form, />2 miesiące</);
  assert.match(form, />Pobierz aneks</);
});
