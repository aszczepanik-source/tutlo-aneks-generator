import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnnexRoute } from '../../router.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';

test('router zachowuje aktywne aneksy, w tym identyfikatory literowe', () => {
  for (const id of ['11','25','26','27','29','29a','43','45','45c','45e','48']) assert.equal(getAnnexRoute(id, id==='43'?{contractType:'flexible',familyGroupVariant:'paid'}:id==='45'?{contractType:'flexible',paymentType:'internal',paymentVariant:'internal_24'}:id==='45c'?{contractType:'limit',paymentType:'internal',paymentVariant:'internal_24'}:id==='48'?{contractType:'limit'}:undefined)?.number,id);
  assert.equal(typeof getAnnexRoute('29a').number,'string');
});

test('publiczne API Aneksu 26 przyjmuje gotowy currentContract bez rawText', () => {
  const contract={contractType:'flexible',paymentType:'credit',paymentVariant:'credit',agreementNumber:'EL/X/1/1/1/1/2025',agreementDate:'2025-01-01',courseStartDate:'2025-01-01',customerType:'person',customerName:'Jan Testowy',personalId:'12345678901',address:'Testowa 1',coursePriceCents:240000,monthlyInstallmentCents:10000,lessonCount:240,monthlyLessonLimit:20,teacherVariant:'english_native'};
  assert.doesNotThrow(()=>prepareAnnex26(contract,{newInstallment:'50',bank:'Inbank',bankAccount:'12345678901234567890123456'}));
});
