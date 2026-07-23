import assert from 'node:assert/strict';
import test from 'node:test';
import { BLOCKED_RULES, calculateAnnex11, calculateAnnex29, calculateAnnex29a } from '../../src/domain/annex-calculations.js';

const installments = Array.from({ length: 24 }, (_, i) => ({ dueDate: `${2026 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}-15`, amountCents: 10000 + i }));
test('aneks 29 odejmuje najbliższą kwalifikującą się ratę i dodaje 3 dni', () => {
  const result = calculateAnnex29({ coursePriceCents: 240000, installments }, '2026-06-15');
  assert.equal(result.newPriceCents, 229995); assert.equal(result.effectiveDate, '2026-06-18'); assert.equal(result.freeInstallments[0].dueDate, '2026-06-15');
});
test('aneks 29a odejmuje dwie najbliższe kwalifikujące się raty', () => {
  const result = calculateAnnex29a({ coursePriceCents: 240000, installments }, '2026-06-15');
  assert.equal(result.newPriceCents, 219989); assert.deepEqual(result.freeInstallments.map(x => x.dueDate), ['2026-06-15', '2026-07-15']);
});
test('aneksy gratis blokują brak wymaganej liczby przyszłych rat', () => {
  assert.throws(() => calculateAnnex29a({ coursePriceCents: 1, installments: installments.slice(0, 1) }, '2026-01-15'), /co najmniej 2/);
});
test('aneks 11 przesuwa raty, zachowuje kwoty i 24 pozycje', () => {
  const result = calculateAnnex11({ contractEndDate: '2027-12-31', installments }, '2026-01-31', 2);
  assert.deepEqual([result.suspensionStart,result.suspensionEnd,result.paymentResumeDate,result.newContractEndDate], ['2026-02-01','2026-03-31','2026-04-01','2028-02-29']);
  assert.equal(result.installments.length, 24); assert.equal(result.installments[0].amountCents, installments[0].amountCents); assert.equal(result.installments[1].dueDate, '2026-04-15');
});
test('aneksy 25 i 26 mają dokładne blokady zamiast wymyślonych obliczeń', () => { assert.match(BLOCKED_RULES['25'], /nowej ceny/); assert.match(BLOCKED_RULES['26'], /zwrotu bankowi/); });
