import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAnnex25 } from '../generator.js';
import { getAnnexRoute } from '../../../../router.js';

const installments = Array.from({ length: 24 }, (_, i) => ({ number: i + 1, dueDate: `2025-${String(i%12+1).padStart(2,'0')}-01`, amountCents: null }));
const contract = { rawText: 'diagnostic only', contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_24',
  agreementNumber: 'EL/JF/1/1/1/1/2025', agreementDate: '2025-01-01', customerType: 'person', customerName: 'Jan Kowalski',
  personalId: '12345678901', address: 'Testowa 1', coursePriceCents: 957600, lessonCount: 192, monthlyLessonLimit: 24,
  teacherVariant: 'polish_english_native', internalPaymentAccount: '12345678901234567890123456',
  installmentPlan: { paymentCount: 24, installments, startDate: '2025-01-01', totalAmountCents: 957600 } };

test('aneks 25 jest routowany wyłącznie dla canonical internal_24', () => {
  assert.ok(getAnnexRoute('25', contract));
  assert.equal(getAnnexRoute('25', {...contract,paymentVariant:'internal_2'}), undefined);
});
test('aneks 25 chroni prepared.values dla canonical currentContract', () => {
  const values=prepareAnnex25(contract,{newInstallment:'300'},'2025-06-20').values;
  assert.deepEqual(Object.fromEntries(['NUMER_UMOWY','DATA_ZAWARCIA_UMOWY','IMIE_NAZWISKO','PESEL','NUMER_KONTA','NOWA_CENA','TYPY_LEKTOROW'].map(k=>[k,values[k]])), {
    NUMER_UMOWY:'EL/JF/1/1/1/1/2025',DATA_ZAWARCIA_UMOWY:'01.01.2025',IMIE_NAZWISKO:'Jan Kowalski',PESEL:'12345678901',
    NUMER_KONTA:'12345678901234567890123456',NOWA_CENA:'8388,00 zł',TYPY_LEKTOROW:'Lektor Polski, English Expert, Native Speaker'});
  assert.equal(Object.keys(values).length,60);
});
test('aneks 25 nie analizuje rawText',()=>assert.deepEqual(prepareAnnex25({...contract,rawText:'PESEL: 999'}, {newInstallment:'300'},'2025-06-20').values,
  prepareAnnex25({...contract,rawText:'NIP: 000'}, {newInstallment:'300'},'2025-06-20').values));
