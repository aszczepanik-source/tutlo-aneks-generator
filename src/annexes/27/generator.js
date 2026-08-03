import manifest from './manifest.json' with { type: 'json' };
import { validateCurrentContract } from '../../domain/contract-extraction.js';
import { validateAnnex27Data } from './validator.js';
import { calculateCourseMonths } from '../../domain/annex-calculations.js';

const INSTALLMENT_COUNT = 24;
const iso = date => date.toISOString().slice(0, 10);
const formatDate = value => { const [y, m, d] = value.split('-'); return `${d}.${m}.${y}`; };
const money = cents => (cents / 100).toFixed(2).replace('.', ',');
const account = value => String(value ?? '').replace(/\s/g, '');

function parseMoney(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}

const roman = value => {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let number = value; let result = '';
  for (const [size, token] of map) while (number >= size) { result += token; number -= size; }
  return result;
};

export function buildTutloSchedule(annexDate, remainingMonths, newRateCents) {
  const start = new Date(`${annexDate}T12:00:00Z`);
  return Array.from({ length: remainingMonths }, (_, index) => {
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index + 1, 5, 12));
    return { NUMER_RATY: `${roman(index + 1)} rata`, KWOTA: money(newRateCents), TERMIN: formatDate(iso(due)) };
  });
}

export function calculateAnnex27(contract, annexDate, newRateCents) {
  if (!contract.courseStartDate) throw new Error('Nie udało się odczytać daty rozpoczęcia kursu.');
  const { usedMonths: paidMonths, remainingMonths } = calculateCourseMonths({
    courseStartDate: contract.courseStartDate, annexDate, totalMonths: INSTALLMENT_COUNT
  });
  const data = { ...contract, oldCoursePriceCents: contract.coursePriceCents,
    oldRateCents: contract.monthlyInstallmentCents, newRateCents, paidMonths, remainingMonths };
  const paidAmountCents = paidMonths * data.oldRateCents;
  const remainingBankAmountCents = data.oldCoursePriceCents - paidAmountCents;
  const remainingTutloAmountCents = remainingMonths * newRateCents;
  const discountCents = remainingBankAmountCents - remainingTutloAmountCents;
  const newCoursePriceCents = paidAmountCents + remainingTutloAmountCents;
  const calculation = { paidMonths, remainingMonths, paidAmountCents, remainingBankAmountCents,
    remainingTutloAmountCents, discountCents, newCoursePriceCents,
    refundToBankCents: remainingBankAmountCents,
    newLessonCount: Math.round(contract.lessonCount * newCoursePriceCents / contract.coursePriceCents),
    newAverageRateCents: newCoursePriceCents / INSTALLMENT_COUNT };
  if (discountCents <= 0) throw new Error('Zmiana musi skutkować dodatnim rabatem.');
  if (newCoursePriceCents <= paidAmountCents) throw new Error('Nowa cena musi być wyższa od kwoty już spłaconej.');
  if (remainingTutloAmountCents <= 0) throw new Error('Kwota pozostała do zapłaty Tutlo musi być dodatnia.');
  return calculation;
}

export function prepareAnnex27(currentContract, formData, today = new Date()) {
  validateCurrentContract(currentContract);
  const annexDate = today instanceof Date ? iso(today) : String(today);
  const newRateCents = parseMoney(formData?.newInstallment);
  if (!currentContract.courseStartDate) throw new Error('Nie udało się odczytać daty rozpoczęcia kursu.');
  const { usedMonths: paidMonths, remainingMonths } = calculateCourseMonths({
    courseStartDate: currentContract.courseStartDate, annexDate, totalMonths: INSTALLMENT_COUNT
  });
  const data = { ...currentContract, bank: String(formData?.bank ?? '').trim(),
    bankAccount: account(formData?.bankAccount), tutloAccount: account(formData?.tutloAccount),
    oldCoursePriceCents: currentContract.coursePriceCents, oldRateCents: currentContract.monthlyInstallmentCents,
    newRateCents, paidMonths, remainingMonths };
  validateAnnex27Data(data);
  const calculation = calculateAnnex27(currentContract, annexDate, newRateCents);
  const effective = new Date(`${annexDate}T12:00:00Z`); effective.setUTCDate(effective.getUTCDate() + 1);
  const values = {
    NUMER_UMOWY: currentContract.agreementNumber, DATA_ZAWARCIA_UMOWY: formatDate(currentContract.agreementDate),
    DATA_ANEKSU: formatDate(annexDate), DATA_WEJSCIA_W_ZYCIE: formatDate(iso(effective)),
    IMIE_NAZWISKO: currentContract.customerName, ADRES: currentContract.address,
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL', IDENTYFIKATOR: currentContract.personalId,
    NOWA_LICZBA_LEKCJI: String(calculation.newLessonCount), LIMIT_MIESIECZNY: String(currentContract.monthlyLessonLimit),
    NOWA_CENA: money(calculation.newCoursePriceCents), NOWA_SREDNIA_RATA: money(calculation.newAverageRateCents),
    KWOTA_POZOSTALA_BANK: money(calculation.remainingBankAmountCents), BANK: data.bank,
    KWOTA_POZOSTALA_TUTLO: money(calculation.remainingTutloAmountCents), LICZBA_POZOSTALYCH_RAT: String(calculation.remainingMonths),
    NUMER_RACHUNKU_TUTLO: data.tutloAccount, KWOTA_DO_ZWROTU_BANKOWI: money(calculation.refundToBankCents),
    NUMER_RACHUNKU_BANKU: data.bankAccount,
    RATY: buildTutloSchedule(annexDate, calculation.remainingMonths, newRateCents)
  };
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation };
}
