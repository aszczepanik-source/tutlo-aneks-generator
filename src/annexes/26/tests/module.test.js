import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex26 } from '../index.js';
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';

const account = '12345678901234567890123456';
const form = { newInstallment: '400,00', bank: 'Inbank', bankAccount: account };
const contract = {
  contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit',
  agreementNumber: 'EL/TEST/100/200/3/9/2025', agreementDate: '2025-09-03', courseStartDate: '2025-09-01',
  customerType: 'person', customerName: 'Jan Testowy', personalId: '00210100004',
  address: 'ul. Testowa 1, 00-001 Warszawa', coursePriceCents: 1125000,
  monthlyInstallmentCents: 46875, lessonCount: 450, monthlyLessonLimit: 57,
  teacherVariant: 'polish_english_native'
};

test('aneks 26 buduje komplet placeholderów z kanonicznego currentContract', () => {
  const prepared = prepareAnnex26(contract, form, new Date('2026-07-24T12:00:00Z'));
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.equal(prepared.values.DATA_ZAWARCIA_UMOWY, '03.09.2025');
  assert.equal(prepared.values.IDENTYFIKATOR, '00210100004');
  assert.equal(prepared.values.LIMIT_MIESIECZNY, '57');
  assert.equal(prepared.values.TYPY_LEKTOROW, 'Lektorem Polskim, English Expert, Native Speakerem');
  assert.equal(prepared.values.KWOTA_KREDYTU, '11250,00 zł');
});

test('aneks 26 stosuje wzory oparte na cenie w groszach', () => {
  const { calculation, values } = prepareAnnex26(contract, form, new Date('2026-07-24T12:00:00Z'));
  assert.deepEqual({ old: calculation.oldInstallments, next: calculation.newInstallments, discount: calculation.discountCents }, { old: 11, next: 13, discount: 89375 });
  assert.equal(values.NOWA_CENA, '10356,25 zł');
  assert.equal(values.NOWA_SREDNIA_RATA, '431,51 zł');
  assert.equal(values.SPLACONO_DO_DNIA_ANEKSU, '5156,25 zł');
});

for (const [today, effective] of [['2026-07-31','01.08.2026'], ['2026-12-31','01.01.2027'], ['2028-02-28','29.02.2028']]) {
  test(`data wejścia w życie przechodzi poprawnie po ${today}`, () => {
    const datedContract = { ...contract, courseStartDate: `${Number(today.slice(0,4))-1}-09-01` };
    assert.equal(prepareAnnex26(datedContract, form, new Date(`${today}T12:00:00Z`)).values.DATA_WEJSCIA_W_ZYCIE, effective);
  });
}

test('aneks 26 przyjmuje wyłącznie kanoniczny teacherVariant', () => {
  assert.equal(prepareAnnex26({ ...contract, teacherVariant: 'english_native' }, form).values.TYPY_LEKTOROW, 'English Expert, Native Speakerem');
  assert.throws(() => prepareAnnex26({ ...contract, teacherVariant: undefined }, form), /wariantu lektorów/);
});

test('aneks 26 waliduje ratę, bank i 26-cyfrowy rachunek', () => {
  assert.doesNotThrow(() => prepareAnnex26(contract, form));
  assert.throws(() => prepareAnnex26(contract, { ...form, newInstallment: 0 }), /większą od 0/);
  assert.throws(() => prepareAnnex26(contract, { ...form, newInstallment: '468,80' }), /niższa/);
  assert.throws(() => prepareAnnex26(contract, { ...form, bank: 'Własny Bank' }), /Wybierz bank z listy/);
  assert.throws(() => prepareAnnex26(contract, { ...form, bankAccount: account.slice(1) }), /26 cyfr/);
  assert.equal(prepareAnnex26(contract, { ...form, bankAccount: '12 3456 7890 1234 5678 9012 3456' }).values.NUMER_RACHUNKU_BANKU, account);
});

test('końcowy DOCX otrzymuje przygotowany wariant lektorów', () => {
  class Zip { constructor(input) { this.files={'word/document.xml':true}; this.xml=String(input); } file(){return {asText:()=>this.xml}} generate(){return new TextEncoder().encode(this.xml)} }
  class Doc { constructor(zip){this.zip=zip} render(values){this.zip.xml=this.zip.xml.replace('{{TYPY_LEKTOROW}}', values.TYPY_LEKTOROW)} getZip(){return this.zip} }
  const output = new TextDecoder().decode(renderDocx('{{TYPY_LEKTOROW}}', prepareAnnex26(contract, form), { PizZip: Zip, docxtemplater: Doc }));
  assert.equal(output, 'Lektorem Polskim, English Expert, Native Speakerem');
});

test('template.docx zawiera wymagane placeholdery', async () => {
  const fields = extractDocxPlaceholders(await readFile(new URL('../template.docx', import.meta.url)));
  assert.deepEqual(fields, [...manifest.requiredFields].sort());
});
