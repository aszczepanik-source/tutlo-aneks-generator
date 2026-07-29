import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { prepareAnnex43 } from '../../src/annexes/43/index.js';
import { annex43TemplateUrl } from '../../src/infrastructure/local-docx-generator.js';

const contract = {
  agreementNumber: 'EL/43/2026', agreementDate: '2026-07-01', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '90010112345', address: 'Testowa 1',
  contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit', familyGroupVariant: 'paid'
};
const visible = value => getAvailableAnnexCards({ ...contract, familyGroupVariant: value }).some(card => card.no === '43');

test('pełny przepływ udostępnia Aneks 43, wartości i właściwy URL szablonu', () => {
  assert.equal(visible('paid'), true);
  assert.equal(Object.keys(prepareAnnex43(contract, { today: '2026-07-29' }).values).length, 8);
  assert.equal(annex43TemplateUrl('https://example.test/app/src/infrastructure/local-docx-generator.js'),
    'https://example.test/app/src/annexes/43/template.docx');
});

test('wariant included i brak wariantu ukrywają Aneks 43', () => {
  assert.equal(visible('included'), false);
  assert.equal(visible(null), false);
});

let sourceTemplatePresent = true;
try { await access(new URL('../../src/annexes/43/template.docx', import.meta.url)); } catch { sourceTemplatePresent = false; }
test('build publikuje template.docx Aneksu 43 w dist', { skip: !sourceTemplatePresent && 'Brak źródłowego szablonu do ręcznego wgrania.' }, async () => {
  await access(new URL('../../dist/src/annexes/43/template.docx', import.meta.url));
});
