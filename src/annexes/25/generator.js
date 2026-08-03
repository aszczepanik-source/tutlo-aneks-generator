import manifest from './manifest.json' with { type: 'json' };
import { addDays, calculateAnnex25, formatDate, parseMoneyToCents } from '../../domain/annex-calculations.js';
import { validateAnnex25Data } from './validator.js';
import { getLocalIsoDate } from '../shared/local-date.js';

const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Brak danych umowy: ${label}.`);
  return value;
};
const contractBankAccount = value => {
  const normalized = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{26}$/.test(normalized)) throw new Error('Nie odczytano numeru rachunku z umowy.');
  return normalized;
};
const formatAmountWithoutCurrency = cents => (cents / 100).toFixed(2).replace('.', ',');
const scheduleValues = installments => Object.fromEntries(installments.flatMap(item => {
  const key = String(item.nr).padStart(2, '0');
  return [[`RATA_${key}_KWOTA`, formatAmountWithoutCurrency(item.amountCents)], [`RATA_${key}_TERMIN`, formatDate(item.dueDate)]];
}));

const teacherTypes = variant => {
  if (variant === 'polish_english_native') return 'Lektor Polski, English Expert, Native Speaker';
  if (variant === 'english_native') return 'English Expert, Native Speaker';
  return variant;
};

export function prepareAnnex25(currentContract, inputs = {}, annexDate = getLocalIsoDate()) {
  validateAnnex25Data(currentContract);
  const calculation = calculateAnnex25(currentContract, annexDate, parseMoneyToCents(inputs.newInstallment, 'nowa rata'));
  const lessonCount = Number(required(currentContract.lessonCount, 'liczba lekcji'));
  const values = {
    ADRES: required(currentContract.address, 'adres'), DATA_ANEKSU: formatDate(annexDate),
    DATA_WEJSCIA_W_ZYCIE: formatDate(addDays(annexDate, 1)),
    DATA_ZAWARCIA_UMOWY: formatDate(required(currentContract.agreementDate, 'data zawarcia umowy')),
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: currentContract.personalId,
    IMIE_NAZWISKO: required(currentContract.customerName, 'imię i nazwisko'),
    LIMIT_MIESIECZNY: String(required(currentContract.monthlyLessonLimit, 'limit miesięczny')),
    NOWA_CENA: formatAmountWithoutCurrency(calculation.newPriceCents),
    NOWA_LICZBA_LEKCJI: String(Math.round(lessonCount * calculation.newPriceCents / currentContract.coursePriceCents)),
    NOWA_SREDNIA_RATA: formatAmountWithoutCurrency(calculation.newAverageInstallmentCents),
    NUMER_KONTA: contractBankAccount(currentContract.internalPaymentAccount),
    NUMER_UMOWY: required(currentContract.agreementNumber, 'numer umowy'),
    PESEL: required(currentContract.personalId, 'PESEL'),
    TYPY_LEKTOROW: required(teacherTypes(currentContract.teacherVariant), 'typy lektorów'),
    ...scheduleValues(calculation.installments)
  };
  const missing = manifest.requiredFields.filter(field => values[field] === undefined || String(values[field]).trim() === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId: '25', template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation };
}
