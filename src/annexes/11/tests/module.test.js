import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateAnnex11Dates, prepareAnnex11 } from '../generator.js';
import { validateAnnex11Data } from '../validator.js';
import { annex11TemplateUrl } from '../../../infrastructure/local-docx-generator.js';
import manifest from '../manifest.json' with { type: 'json' };
import { extractDocxPlaceholders, readZipEntry } from '../../shared/template-inspection.js';

const contract = {
  agreementNumber: 'EL/11/2025', agreementDate: '2025-09-15', customerType: 'person',
  courseStartDate: '2025-03-21',
  customerName: 'Jan Kowalski', personalId: '12345678901', address: 'Testowa 1, Warszawa',
  monthlyInstallmentCents: 50000, contractType: 'flexible', paymentType: 'internal',
  paymentVariant: 'internal_24',
  installmentPlan: { paymentCount: 24, firstPaymentAmountCents: 45000,
    recurringPaymentAmountCents: 50000, firstPaymentDueDate: '2025-09-05',
    recurringStartDate: '2025-10-05' }
};
const dueDates = values => Array.from({ length: 24 }, (_, index) => values[`RATA_${String(index + 1).padStart(2, '0')}_TERMIN`]);

for (const expected of [
  { months: 1, end: '31.08.2026', resume: '01.09.2026', newEnd: '21.04.2027',
    absent: ['05.08.2026'], tail: ['05.09.2027'] },
  { months: 2, end: '30.09.2026', resume: '01.10.2026', newEnd: '21.05.2027',
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
  assert.deepEqual(calculateAnnex11Dates('2026-12-31', 1, '2025-03-21'), {
    annexDate: '2026-12-31', effectiveDate: '2027-01-01', suspensionStart: '2027-01-01',
    suspensionEnd: '2027-01-31', paymentResumeDate: '2027-02-01',
    newAgreementEnd: '2027-04-21'
  });
});

test('luty roku przestępnego kończy się 29 lutego', () => {
  assert.equal(calculateAnnex11Dates('2028-01-15', 1, '2025-03-21').suspensionEnd, '2028-02-29');
});

test('dwa miesiące zawieszenia przechodzą przez koniec roku', () => {
  const dates = calculateAnnex11Dates('2026-11-30', 2, '2025-03-21');
  assert.deepEqual([dates.suspensionStart, dates.suspensionEnd, dates.paymentResumeDate],
    ['2026-12-01', '2027-01-31', '2027-02-01']);
});

test('wylicza NOWY_KONIEC_UMOWY jako 25 pełnych miesięcy od courseStartDate', () => {
  const prepared = prepareAnnex11(contract, { suspensionMonths: 1 }, { today: '2026-07-28' });
  assert.equal(prepared.values.NOWY_KONIEC_UMOWY, '21.04.2027');
});

test('wylicza NOWY_KONIEC_UMOWY jako 26 pełnych miesięcy od courseStartDate', () => {
  const prepared = prepareAnnex11(contract, { suspensionMonths: 2 }, { today: '2026-07-28' });
  assert.equal(prepared.values.NOWY_KONIEC_UMOWY, '21.05.2027');
});

test('koniec miesiąca jest przewidywalnie ograniczany do ostatniego dnia miesiąca docelowego', () => {
  const prepared = prepareAnnex11({ ...contract, courseStartDate: '2025-01-31' },
    { suspensionMonths: 1 }, { today: '2026-07-28' });
  assert.equal(prepared.values.NOWY_KONIEC_UMOWY, '28.02.2027');
});

test('agreementDate nie wpływa na NOWY_KONIEC_UMOWY', () => {
  const first = prepareAnnex11({ ...contract, agreementDate: '2024-01-01' },
    { suspensionMonths: 1 }, { today: '2026-07-28' });
  const second = prepareAnnex11({ ...contract, agreementDate: '2026-01-01' },
    { suspensionMonths: 1 }, { today: '2026-07-28' });
  assert.equal(first.values.NOWY_KONIEC_UMOWY, second.values.NOWY_KONIEC_UMOWY);
});

test('contractEndDate i ostatni termin raty nie wpływają na NOWY_KONIEC_UMOWY', () => {
  const first = prepareAnnex11({ ...contract, contractEndDate: '2027-01-01' },
    { suspensionMonths: 1 }, { today: '2026-07-28' });
  const second = prepareAnnex11({
    ...contract,
    contractEndDate: '2030-12-31',
    installmentPlan: { ...contract.installmentPlan, recurringStartDate: '2025-10-06' }
  }, { suspensionMonths: 1 }, { today: '2026-07-28' });
  assert.notEqual(dueDates(first.values).at(-1), dueDates(second.values).at(-1));
  assert.equal(first.values.NOWY_KONIEC_UMOWY, second.values.NOWY_KONIEC_UMOWY);
});

test('brak courseStartDate zatrzymuje przygotowanie dokumentu z właściwym błędem', () => {
  assert.throws(() => prepareAnnex11({ ...contract, courseStartDate: null },
    { suspensionMonths: 1 }, { today: '2026-07-28' }), {
    message: 'Nie udało się odczytać daty rozpoczęcia kursu.'
  });
});

test('konkretnie zgłasza brak raty w okresie zawieszenia', () => {
  assert.throws(() => prepareAnnex11(contract, { suspensionMonths: 1 }, { today: '2030-07-28' }), /Brak raty w okresie zawieszenia/);
});

test('odrzuca niepełny installmentPlan i wybór inny niż 1 lub 2', () => {
  assert.throws(() => validateAnnex11Data({ currentContract: contract, formData: {} }), /Wybierz okres/);
  assert.throws(() => validateAnnex11Data({ currentContract: { ...contract, installmentPlan: { paymentCount: 24 } }, formData: { suspensionMonths: 1 } }), /Niepełny harmonogram/);
});

for (const identity of [
  { customerType: 'person', customerName: 'Jan Kowalski', personalId: '84040810706', identifierLabel: 'PESEL' },
  { customerType: 'company', customerName: 'Tutlo Klient sp. z o.o.', personalId: '1234567890' }
]) {
  test(`mapuje identyfikator dla: ${identity.customerType}`, () => {
    const prepared = prepareAnnex11({ ...contract, ...identity }, { suspensionMonths: 1 }, { today: '2026-07-28' });
    assert.equal(prepared.values.IDENTYFIKATOR_LABEL, identity.identifierLabel || 'NIP');
    assert.equal(prepared.values.IDENTYFIKATOR, identity.personalId);
    assert.equal(prepared.values.PESEL, identity.personalId);
  });
}

test('mapowanie identyfikatora nie zmienia pozostałych wartości Aneksu 11', () => {
  const person = prepareAnnex11(contract, { suspensionMonths: 1 }, { today: '2026-07-28' });
  const company = prepareAnnex11({ ...contract, customerType: 'company', personalId: '1234567890' },
    { suspensionMonths: 1 }, { today: '2026-07-28' });
  const withoutIdentifier = values => Object.fromEntries(Object.entries(values)
    .filter(([key]) => !['IDENTYFIKATOR_LABEL', 'IDENTYFIKATOR', 'PESEL'].includes(key)));
  assert.deepEqual(withoutIdentifier(company.values), withoutIdentifier(person.values));
});

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

test('wynikowy DOCX nie zawiera nierozwiązanego NOWY_KONIEC_UMOWY', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.deepEqual(extractDocxPlaceholders(template), [...manifest.requiredFields
    .filter(field => field !== 'PESEL'), 'IDENTYFIKATOR', 'IDENTYFIKATOR_LABEL'].sort());
  const prepared = prepareAnnex11(contract, { suspensionMonths: 1 }, { today: '2026-07-28' });
  const documentText = readZipEntry(template, 'word/document.xml').toString('utf8').replace(/<[^>]+>/g, '')
    .replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, field) => String(prepared.values[field.trim()] ?? ''));
  assert.match(documentText, /21\.04\.2027/);
  assert.doesNotMatch(documentText, /\{\{NOWY_KONIEC_UMOWY\}\}/);
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
