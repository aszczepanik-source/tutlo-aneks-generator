import assert from 'node:assert/strict';
import test from 'node:test';
import { extractContractData } from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';
import { renderDocx } from '../../src/infrastructure/local-docx-generator.js';

const form={newInstallment:'400,00',bank:'Inbank',bankAccount:'12345678901234567890123456'};
const canonical = parsed => ({ ...parsed, contractType:'flexible', paymentType:'credit', paymentVariant:'credit', courseStartDate:'2025-09-01', teacherVariant:'polish_english_native' });
const text = buyer => `UMOWA ELASTYCZNA nr EL/TEST/100/200/3/9/2025
DANE NABYWCY ${buyer}
SPECYFIKACJA KURSU Data rozpoczęcia kursu: 01-09-2025 Liczba Lekcji Indywidualnych: 450 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
ZAWARTOŚĆ KURSU Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speaker realizowanych w platformie
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 11 250,00 zł brutto. Opłata miesięczna wynosi 468,75 zł`;

test('aneks 26 integracyjnie obsługuje osobę i firmę z publicznego parsera', () => {
  for (const [buyer,type,name,id] of [
    ['IMIĘ I NAZWISKO: Jan Testowy ADRES: Testowa 1 PESEL: 123 456 789 01','person','Jan Testowy','12345678901'],
    ['FIRMA: Przykład sp. z o.o. ADRES: Firmowa 2 NIP: 123-456-32 18','company','Przykład sp. z o.o.','1234563218']
  ]) {
    const parsed=extractContractData(text(buyer));
    assert.deepEqual({type:parsed.customerType,id:parsed.personalId},{type,id});
    const prepared=prepareAnnex26(canonical(parsed),form,new Date('2026-07-24T12:00:00Z'));
    assert.equal(prepared.values.IMIE_NAZWISKO,name);
    assert.equal(prepared.values.IDENTYFIKATOR,id);
    assert.equal(prepared.values.IDENTYFIKATOR_LABEL,type==='company'?'NIP':'PESEL');
  }
});

test('aneks 26 generuje końcowy DOCX z kanonicznego currentContract', () => {
  const prepared=prepareAnnex26(canonical(extractContractData(text('IMIĘ I NAZWISKO: Jan Testowy ADRES: Testowa 1 PESEL: 12345678901'))),form);
  class Zip { constructor(){this.files={}} file(){return undefined} generate(){return new TextEncoder().encode('DOCX')} }
  class Doc { constructor(zip){this.zip=zip} render(){} getZip(){return this.zip} }
  assert.ok(renderDocx(new Uint8Array(),prepared,{PizZip:Zip,docxtemplater:Doc}).byteLength>0);
});
