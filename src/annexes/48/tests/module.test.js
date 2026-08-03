import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAvailableAnnexCards } from '../../availability.js';
import { getAnnexRoute } from '../../../../router.js';
import { prepareAnnex48 } from '../index.js';
import { calculateCourseMonths } from '../../../domain/annex-calculations.js';

test('kanoniczny helper liczy miesiące według reguły 15/16', () => {
  for (const [courseStartDate, usedMonths, remainingMonths] of [
    ['2026-01-13', 7, 17], ['2026-01-15', 7, 17], ['2026-01-16', 6, 18],
    ['2026-01-20', 6, 18], ['2025-12-15', 8, 16], ['2025-12-16', 7, 17]
  ]) {
    assert.deepEqual(calculateCourseMonths({ courseStartDate, annexDate: '2026-07-20' }),
      { usedMonths, remainingMonths });
  }
});

test('kanoniczny helper waliduje dane i nie przyjmuje daty umowy', () => {
  const dates = { courseStartDate: '2026-01-20', annexDate: '2026-07-20' };
  assert.deepEqual(calculateCourseMonths({ ...dates, agreementDate: '2020-01-01' }),
    calculateCourseMonths({ ...dates, agreementDate: '2026-07-20' }));
  assert.throws(() => calculateCourseMonths({ courseStartDate: '2026-07-21', annexDate: '2026-07-20' }), /przed datą rozpoczęcia/);
  assert.throws(() => calculateCourseMonths({ annexDate: '2026-07-20' }), /Nieprawidłowa data rozpoczęcia/);
  assert.throws(() => calculateCourseMonths({ courseStartDate: '2026-01-01' }), /Nieprawidłowa data aneksu/);
  assert.throws(() => calculateCourseMonths({ courseStartDate: 'x', annexDate: '2026-07-20' }), /Nieprawidłowa/);
  assert.throws(() => calculateCourseMonths({ courseStartDate: '2024-01-01', annexDate: '2026-07-20' }), /przekroczył/);
  assert.throws(() => calculateCourseMonths({ ...dates, totalMonths: 0 }), /dodatnią liczbą całkowitą/);
  assert.throws(() => calculateCourseMonths({ ...dates, totalMonths: 1.5 }), /dodatnią liczbą całkowitą/);
});

const contract = {
  contractType: 'limit', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'UL/1/2026', agreementDate: '2026-01-02', courseStartDate: '2026-01-13',
  customerType: 'person', customerName: 'Jan Kowalski', address: 'ul. Testowa 1, Warszawa',
  personalId: '90010112345', monthlyInstallmentCents: 30000, monthlyLessonLimit: 12
};

test('48 jest widoczny dla każdej umowy z limitem niezależnie od płatności', () => {
  for (const payment of [{ paymentType: 'credit', paymentVariant: 'credit' },
    { paymentType: 'internal', paymentVariant: 'internal_24' },
    { paymentType: 'recognized-other', paymentVariant: 'recognized-other' }]) {
    assert.equal(getAvailableAnnexCards({ ...contract, ...payment }).some(item => item.no === '48'), true);
    assert.ok(getAnnexRoute('48', { ...contract, ...payment }));
  }
});

test('48 jest niewidoczny dla umów elastycznych i nierozpoznanego typu', () => {
  for (const contractType of ['flexible', undefined]) {
    for (const paymentType of ['credit', 'internal']) {
      const candidate = { ...contract, contractType, paymentType };
      assert.equal(getAvailableAnnexCards(candidate).some(item => item.no === '48'), false);
      assert.equal(getAnnexRoute('48', candidate), undefined);
    }
  }
});

test('wlicza miesiąc rozpoczęcia kursu wyłącznie dla startu do 15. dnia włącznie', () => {
  for (const [courseStartDate, expected] of [
    ['2026-01-01', 7],
    ['2026-01-13', 7],
    ['2026-01-15', 7],
    ['2026-01-16', 6],
    ['2026-01-20', 6],
    ['2026-01-31', 6]
  ]) {
    assert.equal(calculateCourseMonths({ courseStartDate, annexDate: '2026-07-15' }).usedMonths, expected);
  }
});

test('dzień podpisania aneksu nie wpływa na liczbę wykorzystanych miesięcy', () => {
  for (const annexDate of ['2026-07-01', '2026-07-15', '2026-07-31']) {
    assert.equal(calculateCourseMonths({ courseStartDate: '2026-01-13', annexDate }).usedMonths, 7);
    assert.equal(calculateCourseMonths({ courseStartDate: '2026-01-20', annexDate }).usedMonths, 6);
  }
});

test('liczy miesiące przez granicę roku według zasady do 15. dnia', () => {
  assert.equal(calculateCourseMonths({ courseStartDate: '2025-12-20', annexDate: '2026-07-15' }).usedMonths, 7);
  assert.equal(calculateCourseMonths({ courseStartDate: '2025-12-15', annexDate: '2026-07-15' }).usedMonths, 8);
});

test('wylicza wartości finansowe, lekcje i pierwszy dzień następnego miesiąca', () => {
  const prepared = prepareAnnex48(contract, { usedLessons: '5' }, '2026-07-15');
  assert.deepEqual(prepared.calculation, { usedMonths: 7, remainingMonths: 17 });
  assert.equal(prepared.values.SPLACONO_DO_DNIA_ANEKSU, '2100,00');
  assert.equal(prepared.values.POZOSTAŁE_LEKCJE, '204');
  assert.equal(prepared.values.WYKORZYSTANE_LEKCJE, '5');
  assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '01.08.2026');
  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '02.01.2026');
  assert.equal(Object.values(prepared.values).some(value => value == null), false);
});

test('start po 15. dniu zmienia wyłącznie zależne wartości miesięczne', () => {
  const prepared = prepareAnnex48({ ...contract, courseStartDate: '2026-01-20' }, { usedLessons: '5' }, '2026-07-31');
  assert.deepEqual(prepared.calculation, { usedMonths: 6, remainingMonths: 18 });
  assert.equal(prepared.values.SPLACONO_DO_DNIA_ANEKSU, '1800,00');
  assert.equal(prepared.values.POZOSTAŁE_LEKCJE, '216');
  assert.equal(prepared.values.WYKORZYSTANE_LEKCJE, '5');
  assert.equal(prepared.values.DATA_WEJSCIA_W_ZYCIE, '01.08.2026');
});

test('obliczenia miesięcy nie korzystają z daty zawarcia umowy', () => {
  const januaryAgreement = prepareAnnex48({ ...contract, courseStartDate: '2026-01-20' }, { usedLessons: 0 }, '2026-07-15');
  const olderAgreement = prepareAnnex48({ ...contract, agreementDate: '2020-03-04', courseStartDate: '2026-01-20' }, { usedLessons: 0 }, '2026-07-15');
  assert.deepEqual(olderAgreement.calculation, januaryAgreement.calculation);
  assert.equal(olderAgreement.values.SPLACONO_DO_DNIA_ANEKSU, januaryAgreement.values.SPLACONO_DO_DNIA_ANEKSU);
  assert.equal(olderAgreement.values.POZOSTAŁE_LEKCJE, januaryAgreement.values.POZOSTAŁE_LEKCJE);
});

test('grudniowy aneks wchodzi w życie 1 stycznia kolejnego roku', () => {
  assert.equal(prepareAnnex48({ ...contract, courseStartDate: '2026-12-01' }, { usedLessons: 0 }, '2026-12-31')
    .values.DATA_WEJSCIA_W_ZYCIE, '01.01.2027');
});

test('wykorzystane lekcje nie wpływają na pozostałą pulę, a zero jest dozwolone', () => {
  const zero = prepareAnnex48(contract, { usedLessons: 0 }, '2026-07-15');
  const many = prepareAnnex48(contract, { usedLessons: 100 }, '2026-07-15');
  assert.equal(zero.values.WYKORZYSTANE_LEKCJE, '0');
  assert.equal(zero.values.POZOSTAŁE_LEKCJE, many.values.POZOSTAŁE_LEKCJE);
});

test('odrzuca ujemną, dziesiętną i brakującą liczbę wykorzystanych lekcji', () => {
  for (const usedLessons of [-1, '1.5', '']) {
    assert.throws(() => prepareAnnex48(contract, { usedLessons }, '2026-07-15'), /liczbą całkowitą/);
  }
});

test('braki danych automatycznych i niedozwolone daty blokują generator', () => {
  assert.throws(() => prepareAnnex48({ ...contract, courseStartDate: null }, { usedLessons: 1 }, '2026-07-15'), /daty rozpoczęcia kursu/);
  assert.throws(() => prepareAnnex48({ ...contract, monthlyInstallmentCents: null }, { usedLessons: 1 }, '2026-07-15'), /miesięcznej raty/);
  assert.throws(() => prepareAnnex48({ ...contract, monthlyLessonLimit: null }, { usedLessons: 1 }, '2026-07-15'), /miesięcznego limitu lekcji/);
  assert.throws(() => prepareAnnex48(contract, { usedLessons: 1 }, '2025-12-31'), /przed miesiącem rozpoczęcia/);
  assert.throws(() => prepareAnnex48({ ...contract, courseStartDate: '2026-07-16' }, { usedLessons: 1 }, '2026-07-31'), /musi być większa od 0/);
  assert.throws(() => prepareAnnex48(contract, { usedLessons: 1 }, '2028-01-01'), /przekroczył 24-miesięczny okres/);
});

test('formularz ma tylko jedno pole konsultanta, a karta otwiera generator 48', async () => {
  const html = await readFile(new URL('../../../../index.html', import.meta.url), 'utf8');
  const form = html.match(/<form id="annex48Form"[\s\S]*?<\/form>/)?.[0] ?? '';
  assert.equal((form.match(/<input\b/g) ?? []).length, 1);
  assert.match(form, /id="annex48UsedLessons"/);
  assert.match(html, /if\(no==='48'\)[\s\S]*?annex48Dialog/);
  assert.match(html, /prepareAnnex48\(currentContract,\{usedLessons:/);
});
