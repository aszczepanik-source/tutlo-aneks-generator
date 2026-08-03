import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAvailableAnnexCards } from '../../availability.js';
import { prepareAnnex45 } from '../index.js';

const contract = {
  contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24',
  agreementNumber: 'UE/1/2025', agreementDate: '2025-08-15', courseStartDate: '2025-08-01',
  customerType: 'person', customerName: 'Jan Kowalski', personalId: '00210100004',
  address: 'ul. Testowa 1, 00-001 Warszawa', coursePriceCents: 480000, monthlyInstallmentCents: 20000,
  lessonCount: 240, teacherVariant: 'polish_english_native',
  internalPaymentAccount: '12345678901234567890123456',
  installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-08-15', recurringStartDate: '2025-09-15' }
};
const inputs = { newInstallment: '150,00', weeklyLimit: '5' };
const prepare = (overrides = {}, submitted = inputs, date = '2026-07-30') =>
  prepareAnnex45({ ...contract, ...overrides }, submitted, date);

test('45 jest widoczny wyłącznie dla flexible/internal/internal_24', () => {
  assert.ok(getAvailableAnnexCards(contract).some(item => item.no === '45'));
  for (const overrides of [
    { contractType: 'limit' }, { paymentType: 'credit', paymentVariant: 'credit' },
    { paymentVariant: 'internal_13' }, { paymentVariant: undefined }
  ]) assert.ok(!getAvailableAnnexCards({ ...contract, ...overrides }).some(item => item.no === '45'));
});

test('formularz konsultanta zawiera wyłącznie nową ratę i limit', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="annex45Form"[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.deepEqual([...form.matchAll(/<input id="([^"]+)"/g)].map(match => match[1]),
    ['annex45NewInstallment', 'annex45WeeklyLimit']);
  assert.throws(() => prepare({}, { weeklyLimit: '5' }), /nowa rata/);
  assert.throws(() => prepare({}, { newInstallment: '150' }), /limit/);
});

test('courseStartDate jest wymagane, a agreementDate nie wpływa na wynik finansowy', () => {
  assert.throws(() => prepare({ courseStartDate: undefined }), /Nie udało się odczytać daty rozpoczęcia kursu/);
  const first = prepare({ agreementDate: '2024-01-01' });
  const second = prepare({ agreementDate: '2025-12-31' });
  assert.deepEqual(first.calculation, second.calculation);
  assert.equal(first.values.DATA_ZAWARCIA_UMOWY, '01.01.2024');
  assert.equal(second.values.DATA_ZAWARCIA_UMOWY, '31.12.2025');
});

test('zmiana od 13. raty zachowuje numerację i obliczenia Aneksu 25', () => {
  const { calculation, values } = prepare();
  assert.equal(calculation.paidInstallments, 12);
  assert.equal(calculation.remainingInstallments, 12);
  assert.ok(calculation.installments.slice(0, 12).every(item => item.amountCents === 20000));
  assert.ok(calculation.installments.slice(12).every(item => item.amountCents === 15000));
  assert.equal(values.SPLACONO_DO_DNIA_ANEKSU, '2400,00');
  assert.equal(calculation.discountCents, 60000);
  assert.equal(values.NOWA_CENA, '4200,00');
  assert.equal(calculation.installments.reduce((sum, item) => sum + item.amountCents, 0), calculation.newPriceCents);
  assert.equal(values.NOWA_SREDNIA_RATA, '175,00');
  assert.equal(values.LICZBA_LEKCJI, '240');
  assert.equal(values.LIMIT_TYGODNIOWY, '5');
});

test('termin pierwszej raty nie zmienia liczby rat po starej i nowej stawce', () => {
  const first = prepare().calculation;
  const second = prepare({ installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-08-30',
    recurringStartDate: '2025-09-30' } }).calculation;
  assert.deepEqual([first.paidInstallments, first.remainingInstallments],
    [second.paidInstallments, second.remainingInstallments]);
  assert.notDeepEqual(first.installments.map(item => item.dueDate), second.installments.map(item => item.dueDate));
});

test('mapuje PESEL i NIP do docelowych placeholderów', () => {
  const person = prepare().values;
  assert.equal(person.IDENTYFIKATOR_LABEL, 'PESEL');
  assert.equal(person.IDENTYFIKATOR, contract.personalId);
  const company = prepare({ customerType: 'company', customerName: 'Tutlo Klient sp. z o.o.', personalId: '1234567890' }).values;
  assert.equal(company.IDENTYFIKATOR_LABEL, 'NIP');
  assert.equal(company.IDENTYFIKATOR, '1234567890');
});

test('uzupełnia wszystkie 24 kwoty i terminy bez waluty, roku ani pustych wartości', () => {
  const { values } = prepare();
  for (let index = 1; index <= 24; index += 1) {
    const key = String(index).padStart(2, '0');
    assert.match(values[`RATA_${key}_KWOTA`], /^\d+,\d{2}$/);
    assert.match(values[`RATA_${key}_TERMIN`], /^\d{2}\.\d{2}\.\d{4}$/);
  }
  assert.ok(Object.values(values).every(value => value !== undefined && value !== null && String(value).trim()));
  assert.ok(Object.values(values).every(value => !/zł|r\.$/.test(String(value))));
});

test('odrzuca ratę równą lub wyższą oraz limit zerowy lub dziesiętny', () => {
  for (const newInstallment of ['200', '201']) assert.throws(
    () => prepare({}, { newInstallment, weeklyLimit: '5' }),
    /Nowa rata musi być niższa od obecnej raty miesięcznej/);
  for (const weeklyLimit of ['0', '1,5', '1.5']) assert.throws(
    () => prepare({}, { newInstallment: '150', weeklyLimit }), /dodatnią liczbą całkowitą/);
});

test('brak numeru konta oraz innych krytycznych danych blokuje generator', () => {
  assert.throws(() => prepare({ internalPaymentAccount: undefined }), /numer konta Tutlo/);
  assert.throws(() => prepare({ agreementNumber: undefined }), /numer umowy/);
  assert.throws(() => prepare({ teacherVariant: undefined }), /wariant lektorów/);
  assert.throws(() => prepare({ installmentPlan: { recurringStartDate: '2025-09-15' } }), /pierwszy termin płatności/);
});
