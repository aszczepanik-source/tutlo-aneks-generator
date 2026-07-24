import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getAnnexRoute } from '../../../../router.js';
import { calculateAnnex25, parseMoneyToCents } from '../../../domain/annex-calculations.js';
import { prepareAnnex25 } from '../generator.js';
import manifest from '../manifest.json' with { type: 'json' };

const installments = Array.from({ length: 24 }, (_, index) => ({
  dueDate: `${2025 + Math.floor((index + 8) / 12)}-${String((index + 8) % 12 + 1).padStart(2, '0')}-15`
}));
const contract = {
  contractType: 'flexible', paymentType: 'internal', installmentCount: 24,
  coursePriceCents: 957600, installments, agreementNumber: 'EL/1/1/2025', agreementDate: '01.01.2025',
  customerName: 'Jan Kowalski', address: 'Testowa 1', pesel: '12345678901', lessonCount: 192,
  monthlyLimit: 24, bankAccount: '12345678901234567890123456', teacherTypes: 'Lektor Polski'
};

test('aneks 25 jest dostępny wyłącznie dla elastycznej umowy na 24 raty wewnętrzne', () => {
  assert.ok(getAnnexRoute('25', contract));
  assert.equal(getAnnexRoute('25', { ...contract, paymentType: 'credit' }), undefined);
  assert.equal(getAnnexRoute('25', { ...contract, contractType: 'limit' }), undefined);
  assert.equal(getAnnexRoute('25', { ...contract, installmentCount: 12 }), undefined);
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
  assert.throws(() => calculateAnnex25({ ...contract, installments: installments.slice(1), courseStartDate: undefined }, '2026-01-20', 30000), /daty rozpoczęcia/);
});

test('prepareAnnex25 wypełnia dokładnie wszystkie rzeczywiste placeholdery', () => {
  const prepared = prepareAnnex25(contract, { newInstallment: '300,00 zł' }, '2026-01-20');
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.equal(Object.values(prepared.values).some(value => /NaN|Infinity|undefined|null|\{\{/.test(String(value))), false);
});

test('build publikuje firmowy szablon aneksu 25', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  assert.ok(template.byteLength > 0);
  const build = await readFile(new URL('../../../../scripts/build-release.mjs', import.meta.url), 'utf8');
  assert.match(build, /cp\(new URL\('\.\.\/src\/'[\s\S]*recursive: true/);
});
