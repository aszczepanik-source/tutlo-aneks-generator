import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAnnex26 } from '../index.js';

const contract = {
  agreementNumber: 'EL/1/1/1/1/1/2025', agreementDate: '2025-12-01', customerType: 'person',
  courseStartDate: '2026-01-15', customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1',
  coursePriceCents: 1125000, monthlyInstallmentCents: 46875, lessonCount: 450, monthlyLessonLimit: 57,
  teacherVariant: 'polish_english_native', contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit'
};
const form = { newInstallment: '400,00', bank: 'Inbank', bankAccount: '12345678901234567890123456' };
const annexDate = new Date('2026-07-20T12:00:00Z');
const prepare = overrides => prepareAnnex26({ ...contract, ...overrides }, form, annexDate);

test('aneks 26 stosuje regułę 15/16 także przez granicę roku', () => {
  for (const [courseStartDate, usedMonths, remainingMonths] of [
    ['2026-01-13', 7, 17], ['2026-01-15', 7, 17], ['2026-01-16', 6, 18],
    ['2026-01-20', 6, 18], ['2025-12-15', 8, 16], ['2025-12-16', 7, 17]
  ]) {
    const { calculation } = prepare({ courseStartDate });
    assert.equal(calculation.oldInstallments, usedMonths, courseStartDate);
    assert.equal(calculation.newInstallments, remainingMonths, courseStartDate);
  }
});

test('aneks 26 poprawnie zmienia finanse dla 7 albo 6 wykorzystanych miesięcy', () => {
  const through15 = prepare({ courseStartDate: '2026-01-15' }).calculation;
  const after15 = prepare({ courseStartDate: '2026-01-16' }).calculation;
  assert.deepEqual({ paid: through15.paidToAnnexDateCents, remaining: through15.newInstallments,
    discount: through15.discountCents, price: through15.newPriceCents },
  { paid: 328125, remaining: 17, discount: 116875, price: 1008125 });
  assert.deepEqual({ paid: after15.paidToAnnexDateCents, remaining: after15.newInstallments,
    discount: after15.discountCents, price: after15.newPriceCents },
  { paid: 281250, remaining: 18, discount: 123750, price: 1001250 });
});

test('aneks 26 ignoruje agreementDate w finansach, ale zachowuje formalną datę umowy', () => {
  const first = prepare({ agreementDate: '2025-12-01', courseStartDate: '2026-01-20' });
  const second = prepare({ agreementDate: '2025-11-01', courseStartDate: '2026-01-20' });
  assert.deepEqual(first.calculation, second.calculation);
  assert.equal(first.values.DATA_ZAWARCIA_UMOWY, '01.12.2025');
});

test('aneks 26 blokuje brak początku kursu, aneks przed startem i miesiące poza zakresem', () => {
  assert.throws(() => prepare({ courseStartDate: null }), /Nie udało się odczytać daty rozpoczęcia kursu/);
  assert.throws(() => prepare({ courseStartDate: '2026-07-21' }), /przed datą rozpoczęcia kursu/);
  assert.throws(() => prepare({ courseStartDate: '2026-07-20' }), /większa od 0/);
  assert.throws(() => prepare({ courseStartDate: '2024-07-15' }), /przekroczył 24-miesięczny okres/);
});
