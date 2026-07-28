import { parseDate } from '../../domain/annex-calculations.js';

const CONTRACT_REQUIRED = [
  ['agreementNumber', 'numer umowy'], ['agreementDate', 'data zawarcia umowy'],
  ['customerType', 'rodzaj klienta'], ['customerName', 'klient'], ['personalId', 'PESEL/NIP'],
  ['address', 'adres'], ['monthlyInstallmentCents', 'miesięczna rata'],
  ['installmentPlan', 'harmonogram rat']
];
const FORM_DATES = [
  ['annexDate', 'data aneksu'], ['suspensionStart', 'data początku zawieszenia'],
  ['suspensionEnd', 'data końca zawieszenia'], ['newAgreementEnd', 'nowy koniec umowy'],
  ['paymentResumeDate', 'data wznowienia płatności'], ['effectiveDate', 'data wejścia w życie']
];

export function validateAnnex11Data({ currentContract: contract, formData } = {}) {
  if (contract?.contractType !== 'flexible') throw new Error('Aneks 11 wymaga umowy elastycznej.');
  if (contract.paymentType !== 'internal') throw new Error('Aneks 11 wymaga rat wewnętrznych.');
  if (contract.paymentVariant !== 'internal_24') {
    throw new Error('Aneks 11 wymaga umowy na 24 raty wewnętrzne.');
  }
  const missing = CONTRACT_REQUIRED.find(([field]) => contract[field] === undefined
    || contract[field] === null || contract[field] === '');
  if (missing) throw new Error(`Brak danych umowy: ${missing[1]}.`);
  if (!['person', 'company'].includes(contract.customerType)) throw new Error('Nie rozpoznano rodzaju klienta.');
  if (contract.customerType === 'person' && !/^\d{11}$/.test(contract.personalId)) {
    throw new Error('PESEL musi zawierać dokładnie 11 cyfr.');
  }
  if (contract.customerType === 'company' && !/^\d{10}$/.test(contract.personalId)) {
    throw new Error('NIP musi zawierać dokładnie 10 cyfr.');
  }
  const plan = contract.installmentPlan;
  if (plan.paymentCount !== 24 || !plan.firstPaymentDueDate || !plan.recurringStartDate) {
    throw new Error('Harmonogram musi zawierać terminy dokładnie 24 rat.');
  }
  const amounts = [plan.firstPaymentAmountCents ?? contract.monthlyInstallmentCents,
    plan.recurringPaymentAmountCents ?? contract.monthlyInstallmentCents];
  if (amounts.some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('Harmonogram zawiera nieprawidłową kwotę raty.');
  }
  const dates = Object.fromEntries(FORM_DATES.map(([field, label]) => [field,
    parseDate(formData?.[field], label)]));
  const length = Number(formData?.suspensionLength);
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new Error('Długość zawieszenia musi być dodatnią liczbą pełnych miesięcy.');
  }
  if (dates.suspensionEnd < dates.suspensionStart) {
    throw new Error('Koniec zawieszenia nie może poprzedzać jego początku.');
  }
  if (dates.paymentResumeDate <= dates.suspensionEnd) {
    throw new Error('Wznowienie płatności musi przypadać po końcu zawieszenia.');
  }
  return { contract, formData };
}

export function validate(input) {
  try { validateAnnex11Data(input); return []; } catch (error) { return [{ message: error.message }]; }
}
