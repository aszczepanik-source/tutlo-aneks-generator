import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractAnnex26Contract } from '../../src/annexes/26/extractor.js';
import { validateSourceData } from '../../src/annexes/26/validator.js';
import { extractAgreementNumber } from '../../src/domain/contract-extraction.js';
import { getAnnexRoute } from '../../router.js';

const INCOMPLETE_CREDIT_AGREEMENT = `
  UMOWA O ŚWIADCZENIE USŁUG KURSU JĘZYKA ANGIELSKIEGO
  nr EL/JF/811/192956/3/9/2025
  Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego
`;

test('router rozpoznaje numer umowy kredytowej bez danych wymaganych przez aneks 26', () => {
  assert.equal(extractAgreementNumber(INCOMPLETE_CREDIT_AGREEMENT), 'EL/JF/811/192956/3/9/2025');
  assert.equal(getAnnexRoute('26').number, '26');
  assert.equal(getAnnexRoute('11').number, '11');
  assert.equal(getAnnexRoute('29').number, '29');
  assert.equal(getAnnexRoute('29a').number, '29a');
});

test('formularz 26 otwiera się przed walidacją jego danych', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(no==='26'\)[\s\S]*annex26Dialog'\)\.showModal\(\)/);
  assert.doesNotMatch(html, /extractAnnex26Contract\(text/);
  assert.match(html, /prepareAnnex\('26',extractAnnex26Contract\(currentContract\.sourceText/);
});

test('dopiero moduł 26 waliduje wyłącznie własne brakujące pola', () => {
  const contract = extractAnnex26Contract(
    INCOMPLETE_CREDIT_AGREEMENT,
    extractAgreementNumber(INCOMPLETE_CREDIT_AGREEMENT)
  );
  const issues = validateSourceData({
    ...contract,
    newInstallmentCents: 4000,
    bank: 'Bank',
    bankAccount: '00 1111'
  });

  assert.ok(issues.some(issue => issue.field === 'creditAgreementDate'));
  assert.ok(issues.some(issue => issue.field === 'creditAmountCents'));
  assert.ok(issues.some(issue => issue.field === 'monthlyLimit'));
  assert.ok(issues.some(issue => issue.field === 'teacherTypes'));
  assert.equal(getAnnexRoute('11').createGenerationPlan({}).annexId, '11');
});
