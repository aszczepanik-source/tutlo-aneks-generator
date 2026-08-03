import manifest from './manifest.json' with { type: 'json' };
import { addDays, addMonths, formatDate, iso, parseDate } from '../../domain/annex-calculations.js';
import { validateAnnex11Data } from './validator.js';
import { getLocalIsoDate } from '../shared/local-date.js';

const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Brak danych umowy: ${label}.`);
  }
  return value;
};
const amount = cents => (cents / 100).toFixed(2).replace('.', ',');
const firstOfNextMonth = value => {
  const date = parseDate(value, 'data aneksu');
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12)));
};

export function calculateAnnex11Dates(annexDate, suspensionMonths, courseStartDate) {
  const suspensionStart = firstOfNextMonth(annexDate);
  const paymentResumeDate = addMonths(suspensionStart, suspensionMonths);
  const end = parseDate(paymentResumeDate);
  end.setUTCDate(0);
  return {
    annexDate,
    effectiveDate: addDays(annexDate, 1),
    suspensionStart,
    suspensionEnd: iso(end),
    paymentResumeDate,
    newAgreementEnd: addMonths(courseStartDate, 24 + suspensionMonths)
  };
}

function suspendedSchedule(installments, dates, months) {
  const suspended = installments.filter(item => item.dueDate >= dates.suspensionStart
    && item.dueDate < dates.paymentResumeDate);
  if (suspended.length !== months) {
    throw new Error(`Brak ${months === 1 ? 'raty' : 'dwóch rat'} w okresie zawieszenia.`);
  }
  const remaining = installments.filter(item => !suspended.includes(item));
  const lastDueDate = installments.at(-1).dueDate;
  return [...remaining, ...suspended.map((item, index) => ({
    ...item, dueDate: addMonths(lastDueDate, index + 1)
  }))];
}

function installmentValues(installments) {
  return Object.fromEntries(installments.flatMap((item, index) => {
    const key = String(index + 1).padStart(2, '0');
    return [[`RATA_${key}_KWOTA`, amount(item.amountCents)],
      [`RATA_${key}_TERMIN`, formatDate(item.dueDate)]];
  }));
}

export function prepareAnnex11(currentContract, formData = {}, options = {}) {
  const { months, installments } = validateAnnex11Data({ currentContract, formData });
  const annexDate = options.today || getLocalIsoDate();
  parseDate(annexDate, 'data aneksu');
  if (!currentContract.courseStartDate) {
    throw new Error('Nie udało się odczytać daty rozpoczęcia kursu.');
  }
  let dates;
  try {
    dates = calculateAnnex11Dates(annexDate, months, currentContract.courseStartDate);
  } catch (error) {
    throw new Error(`Nie można wyznaczyć nowego końca umowy: ${error.message}`);
  }
  const schedule = suspendedSchedule(installments, dates, months);
  const values = {
    ADRES: required(currentContract.address, 'adres'),
    'DATA-WZNOWIENIA-PŁATNOŚCI': formatDate(dates.paymentResumeDate),
    DATA_ANEKSU: formatDate(dates.annexDate),
    DATA_WEJSCIA_W_ZYCIE: formatDate(dates.effectiveDate),
    DATA_ZAWARCIA_UMOWY: formatDate(required(currentContract.agreementDate, 'data zawarcia umowy')),
    'DŁUGOŚĆ_ZAWIESZENIA': String(months),
    IMIE_NAZWISKO: required(currentContract.customerName, 'klient'),
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: currentContract.personalId,
    KONIEC_ZAWIESZENIA: formatDate(dates.suspensionEnd),
    NOWY_KONIEC_UMOWY: formatDate(dates.newAgreementEnd),
    NUMER_UMOWY: required(currentContract.agreementNumber, 'numer umowy'),
    START_ZAWIESZENIA: formatDate(dates.suspensionStart),
    ...installmentValues(schedule)
  };
  const missing = manifest.requiredFields.filter(field => !String(values[field] ?? '').trim());
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values };
}

export function createGenerationPlan(input) {
  try {
    const prepared = prepareAnnex11(input?.currentContract, input?.formData, input?.options);
    return { ok: true, ...prepared, templateUrl: new URL(manifest.template, import.meta.url) };
  } catch (error) {
    return { ok: false, annexId: manifest.id, issues: [{ message: error.message }] };
  }
}
