import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableAnnexCards } from '../../availability.js';
import { prepareAnnex45C, validateAnnex45CData } from '../index.js';

const contract = {
  contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_24',
  agreementNumber: 'UL/1/2025', agreementDate: '2025-08-15', courseStartDate: '2025-08-01', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Długa 1, 00-001 Warszawa',
  coursePriceCents: 480000, monthlyInstallmentCents: 20000, lessonCount: 240,
  teacherVariant: 'polish_english_native', internalPaymentAccount: '12345678901234567890123456',
  installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-08-15', recurringStartDate: '2025-09-15' }
};
const prepare = (overrides = {}, inputs = { newInstallment: '150,00', weeklyLimit: '5' }, date = '2026-07-30') =>
  prepareAnnex45C({ ...contract, ...overrides }, inputs, date);

test('45C jest dostępny wyłącznie dla limit/internal/internal_24', () => {
  assert.ok(getAvailableAnnexCards(contract).some(item => item.no === '45c'));
  for (const overrides of [
    { contractType: 'flexible' }, { paymentType: 'credit', paymentVariant: 'credit' },
    { paymentVariant: 'internal_13' }, { paymentVariant: undefined }
  ]) assert.ok(!getAvailableAnnexCards({ ...contract, ...overrides }).some(item => item.no === '45c'));
});

test('formularz i przygotowanie wymagają wyłącznie nowej raty oraz limitu', () => {
  assert.doesNotThrow(() => prepare());
  assert.throws(() => prepare({}, { weeklyLimit: '5' }), /nowa rata/);
  assert.throws(() => prepare({}, { newInstallment: '150' }), /limit/);
});

test('zmiana od 13. raty dzieli pełny harmonogram i wylicza ceny', () => {
  const prepared = prepare();
  const { calculation, values } = prepared;
  assert.equal(calculation.paidInstallments, 12);
  assert.equal(calculation.remainingInstallments, 12);
  assert.ok(calculation.installments.slice(0, 12).every(item => item.amountCents === 20000));
  assert.ok(calculation.installments.slice(12).every(item => item.amountCents === 15000));
  assert.equal(values.SPLACONO_DO_DNIA_ANEKSU, '2400,00');
  assert.equal(calculation.discountCents, 60000);
  assert.equal(values.NOWA_CENA, '4200,00');
  assert.equal(calculation.installments.reduce((sum, item) => sum + item.amountCents, 0), calculation.newPriceCents);
  assert.equal(values.NOWA_SREDNIA_RATA, '175,00');
  assert.equal(values.LIMIT_TYGODNIOWY, '5');
  assert.equal(values.LICZBA_LEKCJI, '240');
});

test('termin pierwszej raty nie zmienia liczby rat po starej i nowej stawce', () => {
  const first = prepare().calculation;
  const second = prepare({ installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-08-30',
    recurringStartDate: '2025-09-30' } }).calculation;
  assert.deepEqual([first.paidInstallments, first.remainingInstallments],
    [second.paidInstallments, second.remainingInstallments]);
  assert.notDeepEqual(first.installments.map(item => item.dueDate), second.installments.map(item => item.dueDate));
});

test('uzupełnia 24 kwoty i terminy bez waluty, dopisku roku ani pustych wartości', () => {
  const { values } = prepare();
  for (let index = 1; index <= 24; index += 1) {
    const key = String(index).padStart(2, '0');
    assert.match(values[`RATA_${key}_KWOTA`], /^\d+,\d{2}$/);
    assert.match(values[`RATA_${key}_TERMIN`], /^\d{2}\.\d{2}\.\d{4}$/);
  }
  assert.ok(Object.values(values).every(value => value !== undefined && value !== null));
  assert.ok(Object.values(values).every(value => !/zł|r\.$/.test(String(value))));
});

test('harmonogram poprawnie przechodzi między miesiącami i grudniem a styczniem', () => {
  const { calculation } = prepare({
    installmentPlan: { paymentCount: 24, firstPaymentDueDate: '2025-12-31', recurringStartDate: '2026-01-31' }
  }, undefined, '2026-01-15');
  assert.deepEqual(calculation.installments.slice(0, 4).map(item => item.dueDate),
    ['2025-12-31', '2026-01-31', '2026-02-28', '2026-03-31']);
});

test('odrzuca ratę równą lub wyższą i niepoprawny limit', () => {
  for (const newInstallment of ['200', '201']) assert.throws(() => prepare({}, { newInstallment, weeklyLimit: '5' }),
    /Nowa rata musi być niższa od obecnej raty miesięcznej/);
  for (const weeklyLimit of ['0', '-1', '1,5', '1.5']) assert.throws(() => prepare({}, { newInstallment: '150', weeklyLimit }),
    /dodatnią liczbą całkowitą/);
});

test('braki krytycznych danych umowy blokują generator dokładnym komunikatem', () => {
  for (const [field, overrides, message] of [
    ['termin', { installmentPlan: { paymentCount: 24, recurringStartDate: '2025-09-15' } }, /pierwszy termin płatności/],
    ['rata', { monthlyInstallmentCents: undefined }, /pierwotna rata miesięczna/],
    ['cena', { coursePriceCents: undefined }, /cena kursu/],
    ['konto', { internalPaymentAccount: undefined }, /numer konta Tutlo/]
  ]) assert.throws(() => prepare(overrides), message, field);
});

test('walidator odrzuca każdy niedozwolony rodzaj umowy', () => {
  assert.throws(() => validateAnnex45CData({ ...contract, contractType: 'flexible' }), /umowy z limitem/);
  assert.throws(() => validateAnnex45CData({ ...contract, paymentType: 'credit' }), /rat wewnętrznych/);
  assert.throws(() => validateAnnex45CData({ ...contract, paymentVariant: 'internal_2' }), /24 raty/);
});
