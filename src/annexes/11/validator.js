import { addMonths, iso, parseDate } from '../../domain/annex-calculations.js';

const INSTALLMENT_COUNT = 24;

export function annex11Schedule(contract) {
  const plan = contract?.installmentPlan;
  if (plan?.paymentCount !== INSTALLMENT_COUNT || !plan.firstPaymentDueDate
    || !plan.recurringStartDate) {
    throw new Error('Niepełny harmonogram: wymagane są kwoty i terminy dokładnie 24 rat.');
  }
  const firstAmount = plan.firstPaymentAmountCents ?? contract.monthlyInstallmentCents;
  const recurringAmount = plan.recurringPaymentAmountCents ?? contract.monthlyInstallmentCents;
  if (![firstAmount, recurringAmount].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new Error('Niepełny harmonogram: brakuje prawidłowych kwot rat.');
  }
  const firstDate = iso(parseDate(plan.firstPaymentDueDate, 'termin pierwszej raty'));
  const recurringDate = iso(parseDate(plan.recurringStartDate, 'termin kolejnych rat'));
  return [{ dueDate: firstDate, amountCents: firstAmount },
    ...Array.from({ length: INSTALLMENT_COUNT - 1 }, (_, index) => ({
      dueDate: addMonths(recurringDate, index), amountCents: recurringAmount
    }))];
}

export function validateAnnex11Data({ currentContract: contract, formData } = {}) {
  if (contract?.contractType !== 'flexible' || contract?.paymentType !== 'internal'
    || contract?.paymentVariant !== 'internal_24') {
    throw new Error('Aneks 11 wymaga umowy flexible z wariantem internal_24.');
  }
  const months = Number(formData?.suspensionMonths);
  if (![1, 2].includes(months)) throw new Error('Wybierz okres zawieszenia: 1 albo 2 miesiące.');
  const installments = annex11Schedule(contract);
  return { contract, months, installments };
}

export function validate(input) {
  try { validateAnnex11Data(input); return []; } catch (error) { return [{ message: error.message }]; }
}
