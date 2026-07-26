import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAnnex26 } from '../generator.js';
const contract={rawText:'diagnostic only',contractType:'flexible',paymentType:'credit',paymentVariant:'credit',agreementNumber:'EL/JF/1/1/1/1/2025',agreementDate:'2025-01-01',customerType:'person',customerName:'Jan Kowalski',personalId:'12345678901',address:'Testowa 1',coursePriceCents:1125000,lessonCount:450,monthlyLessonLimit:24,teacherVariant:'polish_english_native',internalPaymentAccount:null,installmentPlan:null};
const form={newInstallment:'400',bank:'Inbank',bankAccount:'12345678901234567890123456'};
test('aneks 26 chroni prepared.values dla canonical currentContract',()=>{
 const values=prepareAnnex26(contract,form,new Date('2025-09-03T12:00:00Z')).values;
 assert.deepEqual(values,{NUMER_UMOWY:'EL/JF/1/1/1/1/2025',DATA_ANEKSU:'03.09.2025',IMIE_NAZWISKO:'Jan Kowalski',ADRES:'Testowa 1',PESEL:'12345678901',DATA_ZAWARCIA_UMOWY:'01.01.2025',NOWA_LICZBA_LEKCJI:'409',TYPY_LEKTOROW:'Lektorem Polskim, English Expert, Native Speakerem',LIMIT_MIESIECZNY:'24',NOWA_CENA:'10218,75 zł',NOWA_SREDNIA_RATA:'425,78 zł',KWOTA_KREDYTU:'11250,00 zł',BANK:'Inbank',DATA_UMOWY_KREDYTU:'01.01.2025',SPLACONO_DO_DNIA_ANEKSU:'4218,75 zł',KWOTA_DO_ZWROTU_BANKOWI:'1031,25 zł',NUMER_RACHUNKU_BANKU:'12345678901234567890123456',DATA_WEJSCIA_W_ZYCIE:'04.09.2025'});
});
test('aneks 26 obsługuje firmę bez aliasu PESEL',()=>assert.equal(prepareAnnex26({...contract,customerType:'company',customerName:'Firma',personalId:'1234567890'},form,new Date('2025-09-03T12:00:00Z')).values.PESEL,'1234567890'));
test('aneks 26 nie analizuje rawText',()=>assert.deepEqual(prepareAnnex26({...contract,rawText:'PESEL 999'},form,new Date('2025-09-03T12:00:00Z')).values,prepareAnnex26({...contract,rawText:'NIP 000'},form,new Date('2025-09-03T12:00:00Z')).values));
