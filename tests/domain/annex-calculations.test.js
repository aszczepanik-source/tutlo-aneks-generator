import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCKED_RULES, calculateAnnex11, calculateAnnex26, calculateAnnex29, calculateAnnex29a, parseDate } from '../../src/domain/annex-calculations.js';

test('wspólny parser obsługuje wszystkie formaty dat z PDF', () => {
  for (const value of ['10.06.2025', '10-06-2025', '2025-06-10', '1.6.2025']) {
    assert.equal(parseDate(value).toISOString().slice(0, 10), value === '1.6.2025' ? '2025-06-01' : '2025-06-10');
  }
});

test('wspólny parser odrzuca nieistniejącą datę i podaje pole oraz wartość', () => {
  assert.throws(() => parseDate('31.02.2025', 'data umowy kredytu'), {
    message: 'Nieprawidłowa data umowy kredytu: 31.02.2025'
  });
});

const installments = Array.from({ length: 24 }, (_, i) => ({ dueDate: `${2026 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}-15`, amountCents: 10000 + i }));
test('aneks 29 odejmuje najbliższą kwalifikującą się ratę i dodaje 3 dni', () => {
  const result = calculateAnnex29({ coursePrice: 2400, installments }, '2026-06-15');
  assert.equal(result.newPriceCents, 229995); assert.equal(result.effectiveDate, '2026-06-18'); assert.equal(result.freeInstallments[0].dueDate, '2026-06-15');
});
test('aneks 29a odejmuje dwie najbliższe kwalifikujące się raty', () => {
  const result = calculateAnnex29a({ coursePrice: 2400, installments }, '2026-06-15');
  assert.equal(result.newPriceCents, 219989); assert.deepEqual(result.freeInstallments.map(x => x.dueDate), ['2026-06-15', '2026-07-15']);
});
test('aneksy gratis blokują brak wymaganej liczby przyszłych rat', () => {
  assert.throws(() => calculateAnnex29a({ coursePrice: 0.01, installments: installments.slice(0, 1) }, '2026-01-15'), /co najmniej 2/);
});
test('aneks 11 przesuwa raty, zachowuje kwoty i 24 pozycje', () => {
  const result = calculateAnnex11({ contractEndDate: '2027-12-31', installments }, '2026-01-31', 2);
  assert.deepEqual([result.suspensionStart,result.suspensionEnd,result.paymentResumeDate,result.newContractEndDate], ['2026-02-01','2026-03-31','2026-04-01','2028-02-29']);
  assert.equal(result.installments.length, 24); assert.equal(result.installments[0].amountCents, installments[0].amountCents); assert.equal(result.installments[1].dueDate, '2026-04-15');
});
test('aneks 25 pozostaje zablokowany', () => { assert.match(BLOCKED_RULES['25'], /nowej ceny/); });

test('aneks 26 stosuje wszystkie wzory i pierwszy dzień następnego miesiąca', () => {
  const result = calculateAnnex26({
    currentInstallmentCents: 99_99, paidInstallments: 4,
    coursePrice: 1200, lessonCount: 101
  }, '2026-07-23', 40_00);
  assert.deepEqual({
    remaining: result.remainingInstallments,
    discount: result.discountCents,
    newPrice: result.newPriceCents,
    percentage: result.remainingPercentage,
    lessons: result.newLessonCount,
    average: result.newAverageInstallmentCents,
    paid: result.paidToAnnexDateCents,
    refund: result.bankRefundCents,
    effective: result.effectiveDate
  }, {
    remaining: 20, discount: 20_000, newPrice: 1000_00,
    percentage: 5 / 6, lessons: 84, average: 4167,
    paid: 20_000, refund: 20_000, effective: '2026-08-01'
  });
});

test('aneks 26 zaokrągla starą i średnią ratę do groszy', () => {
  const result = calculateAnnex26({ currentInstallmentCents: 1000, paidInstallments: 23, coursePrice: 240.25, lessonCount: 3 }, '2026-01-31', 1000);
  assert.equal(result.newPriceCents, 24024);
  assert.equal(result.newLessonCount, 3);
  assert.equal(result.newAverageInstallmentCents, 1001);
  assert.equal(result.paidToAnnexDateCents, 23023);
});
