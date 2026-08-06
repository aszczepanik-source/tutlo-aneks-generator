import manifest from './manifest.json' with { type: 'json' };
import { addDays, calculateAnnex25a, formatDate, parseMoneyToCents } from '../../domain/annex-calculations.js';
import { validateAnnex25aData } from './validator.js';
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

const teacherTypes = variant => {
  if (variant === 'polish_english_native') return 'Lektor Polski, English Expert, Native Speaker';
  if (variant === 'english_native') return 'English Expert, Native Speaker';
  return variant;
};

export function prepareAnnex25a(currentContract, inputs = {}, annexDate = getLocalIsoDate()) {
  validateAnnex25aData(currentContract);
  const calculation = calculateAnnex25a(currentContract, annexDate, parseMoneyToCents(inputs.newInstallment, 'nowa rata'));
  if (!calculation.installments.length) throw new Error('Brak harmonogramu rat po zmianie harmonogramu.');
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
    TYPY_LEKTOROW: required(teacherTypes(currentContract.teacherVariant), 'typy lektorów'),
    RATY: calculation.installments.map(item => ({
      NUMER_RATY: String(item.nr).padStart(2, '0'),
      KWOTA: formatAmountWithoutCurrency(item.amountCents),
      TERMIN: formatDate(item.dueDate)
    }))
  };
  const missing = manifest.requiredFields.filter(field => field !== 'RATY'
    && (values[field] === undefined || String(values[field]).trim() === ''));
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation };
}
