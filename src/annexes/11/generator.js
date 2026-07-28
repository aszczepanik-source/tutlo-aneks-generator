import manifest from './manifest.json' with { type: 'json' };
import { addMonths, formatDate, iso, parseDate } from '../../domain/annex-calculations.js';
import { validateAnnex11Data } from './validator.js';

const INSTALLMENT_COUNT = 24;
const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Brak danych umowy: ${label}.`);
  }
  return value;
};
const amount = cents => (cents / 100).toFixed(2).replace('.', ',');

function installmentSchedule(contract, formData) {
  const plan = contract.installmentPlan;
  const firstDueDate = iso(parseDate(plan.firstPaymentDueDate, 'termin pierwszej raty'));
  const recurringStartDate = iso(parseDate(plan.recurringStartDate, 'termin kolejnych rat'));
  const originalDates = [firstDueDate, ...Array.from({ length: INSTALLMENT_COUNT - 1 },
    (_, index) => addMonths(recurringStartDate, index))];
  const suspensionStart = iso(parseDate(formData.suspensionStart, 'data początku zawieszenia'));
  const dates = originalDates.map(date => date >= suspensionStart
    ? addMonths(date, Number(formData.suspensionLength)) : date);
  const firstAmount = plan.firstPaymentAmountCents ?? contract.monthlyInstallmentCents;
  const recurringAmount = plan.recurringPaymentAmountCents ?? contract.monthlyInstallmentCents;

  return Object.fromEntries(dates.flatMap((date, index) => {
    const key = String(index + 1).padStart(2, '0');
    return [
      [`RATA_${key}_KWOTA`, amount(index === 0 ? firstAmount : recurringAmount)],
      [`RATA_${key}_TERMIN`, formatDate(date)]
    ];
  }));
}

export function prepareAnnex11(currentContract, formData = {}) {
  const data = { currentContract, formData };
  validateAnnex11Data(data);
  const values = {
    ADRES: required(currentContract.address, 'adres'),
    'DATA-WZNOWIENIA-PŁATNOŚCI': formatDate(formData.paymentResumeDate),
    DATA_ANEKSU: formatDate(formData.annexDate),
    DATA_WEJSCIA_W_ZYCIE: formatDate(formData.effectiveDate),
    DATA_ZAWARCIA_UMOWY: formatDate(required(currentContract.agreementDate, 'data zawarcia umowy')),
    'DŁUGOŚĆ_ZAWIESZENIA': String(formData.suspensionLength),
    IMIE_NAZWISKO: required(currentContract.customerName, 'klient'),
    KONIEC_ZAWIESZENIA: formatDate(formData.suspensionEnd),
    NOWY_KONIEC_UMOWY: formatDate(formData.newAgreementEnd),
    NUMER_UMOWY: required(currentContract.agreementNumber, 'numer umowy'),
    // The historical template label also carries a company's NIP.
    PESEL: required(currentContract.personalId, currentContract.customerType === 'company' ? 'NIP' : 'PESEL'),
    START_ZAWIESZENIA: formatDate(formData.suspensionStart),
    ...installmentSchedule(currentContract, formData)
  };
  const missing = manifest.requiredFields.filter(field => values[field] === undefined
    || String(values[field]).trim() === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values };
}

// Kept for the module's original public API.
export function createGenerationPlan(input) {
  try {
    const prepared = prepareAnnex11(input?.currentContract, input?.formData);
    return { ok: true, ...prepared, templateUrl: new URL(manifest.template, import.meta.url) };
  } catch (error) {
    return { ok: false, annexId: manifest.id, issues: [{ message: error.message }] };
  }
}
