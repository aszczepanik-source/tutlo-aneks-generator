import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAgreementNumber, extractContractData, extractInternalInstallmentAccount, validateCurrentContract } from '../../src/domain/contract-extraction.js';

const personText = `UMOWA ELASTYCZNA nr EL / TEST / 100 /\n200 / 3 / 9 / 2025 zawarta na odległość
DANE NABYWCY IMIĘ I NAZWISKO: Jan Testowy ADRES: ul. Testowa 1, 00-001 Warszawa PESEL: 002 101 000 04
SPECYFIKACJA KURSU Data rozpoczęcia kursu: 01-09-2025 Liczba Lekcji Indywidualnych: 450 Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 57
ZAWARTOŚĆ KURSU Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z English Expert, Native Speaker realizowanych w platformie
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 11 250,00 zł brutto. Opłata miesięczna wynosi 468,75 zł.`;

test('publiczne API parsera zwraca kanoniczne dane osoby', () => {
  const result = extractContractData(personText);
  assert.deepEqual({ agreementNumber: result.agreementNumber, agreementDate: result.agreementDate, courseStartDate: result.courseStartDate, customerType: result.customerType, personalId: result.personalId, coursePriceCents: result.coursePriceCents, monthlyInstallmentCents: result.monthlyInstallmentCents, monthlyLessonLimit: result.monthlyLessonLimit, teacherVariant: result.teacherVariant }, {
    agreementNumber: 'EL/TEST/100/200/3/9/2025', agreementDate: '2025-09-03', courseStartDate: '2025-09-01', customerType: 'person', personalId: '00210100004', coursePriceCents: 1125000, monthlyInstallmentCents: 46875, monthlyLessonLimit: 57, teacherVariant: 'english_native'
  });
});

test('parser odczytuje firmę i normalizuje NIP', () => {
  for (const nip of ['1234563218', '123-456-32 18', '123 456 32 18']) {
    const result = extractContractData(`DANE NABYWCY FIRMA: Przykład sp. z o.o. ADRES: Firmowa 2 NIP: ${nip} SPECYFIKACJA KURSU`);
    assert.deepEqual({ customerType: result.customerType, personalId: result.personalId }, { customerType: 'company', personalId: '1234563218' });
  }
});

test('parser rozpoznaje PESEL osoby i waliduje typ klienta', () => {
  const contract = extractContractData('DANE NABYWCY IMIĘ I NAZWISKO: Jan Kowalski ADRES: Testowa 1 PESEL: 123 456 789 01 SPECYFIKACJA KURSU');
  assert.equal(contract.customerType, 'person');
  assert.equal(contract.personalId, '12345678901');
  assert.equal(validateCurrentContract({ ...contract, contractType:'flexible', paymentType:'credit', paymentVariant:'credit', agreementNumber:'EL/X/1/1/1/1/2025', agreementDate:'2025-01-01', coursePriceCents:240000, monthlyInstallmentCents:10000, lessonCount:240, monthlyLessonLimit:20, teacherVariant:'english_native' }).personalId, '12345678901');
});

test('parser odtwarza numer umowy rozbity przez PDF', () => {
  assert.equal(extractAgreementNumber('UMOWA ELASTYCZNA nr EL / TESTA / 101 /\n201 / 5 / 12 / 2025 zawarta na odległość'), 'EL/TESTA/101/201/5/12/2025');
});

for (const [printed, cents] of [['7176,00',717600], ['7 176,00',717600], ['7.176,00',717600], ['7176.00',717600], ['12 999,99',1299999]]) {
  test(`parser odczytuje cenę kursu ${printed}`, () => assert.equal(extractContractData(`WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi ${printed} zł brutto.`).coursePriceCents, cents));
}

for (const [printed, cents] of [['399,00',39900], ['1 250,50',125050], ['399.99',39999]]) {
  test(`parser odczytuje ratę miesięczną ${printed}`, () => assert.equal(extractContractData(`WARUNKI PŁATNOŚCI Opłata miesięczna wynosi ${printed} zł.`).monthlyInstallmentCents, cents));
}

test('parser wybiera wyłącznie wewnętrzny rachunek płatności', () => {
  const account='12345678901234567890123456';
  const text=`numer rachunku kredytodawcy: 98765432109876543210987654 WARUNKI PŁATNOŚCI na następujący rachunek bankowy Tutlo: 12 3456 7890 1234 5678 9012 3456`;
  assert.equal(extractInternalInstallmentAccount(text), account);
  assert.equal(extractContractData(text).internalPaymentAccount, account);
});
