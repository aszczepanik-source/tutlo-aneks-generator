import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { prepareAnnex43 } from '../../src/annexes/43/index.js';
import { annex43TemplateUrl } from '../../src/infrastructure/local-docx-generator.js';

const contract = {
  agreementNumber: 'EL/43/2026', agreementDate: '2026-07-01', customerType: 'person',
  customerName: 'Jan Kowalski', personalId: '00210100004', address: 'Testowa 1',
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

test('nierozpoznany typ umowy ukrywa kartę i blokuje bezpośrednie przygotowanie Aneksu 43', () => {
  for (const contractType of [undefined, 'unknown', 'limited']) {
    const invalidContract = { ...contract, contractType };
    assert.equal(getAvailableAnnexCards(invalidContract).some(card => card.no === '43'), false);
    assert.throws(() => prepareAnnex43(invalidContract), /Aneks 43 jest dostępny tylko/);
  }
});

test('kliknięcie karty 43 wywołuje generator i pobieranie Aneksu 43', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(no==='43'\)\{/);
  assert.match(html, /downloadAnnex43\(prepareAnnex43\(currentContract\)\)/);
  assert.doesNotMatch(html, /no==='35'/);
});

let sourceTemplatePresent = true;
try { await access(new URL('../../src/annexes/43/template.docx', import.meta.url)); } catch { sourceTemplatePresent = false; }
test('build publikuje template.docx Aneksu 43 w dist', { skip: !sourceTemplatePresent && 'Brak źródłowego szablonu do ręcznego wgrania.' }, async () => {
  await access(new URL('../../dist/src/annexes/43/template.docx', import.meta.url));
});
