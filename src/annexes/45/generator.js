import manifest from './manifest.json' with { type: 'json' };
import { addDays, calculateAnnex25, formatDate, parseMoneyToCents } from '../../domain/annex-calculations.js';
import { validateAnnex45Data } from './validator.js';

const formatAmount = cents => (cents / 100).toFixed(2).replace('.', ',');
const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Brak danych umowy: ${label}.`);
  return value;
};
const bankAccount = value => {
  const normalized = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{26}$/.test(normalized)) throw new Error('Brak danych umowy: numer konta Tutlo.');
  return normalized;
};
const teacherTypes = variant => {
  if (variant === 'polish_english_native') return 'Lektor Polski, English Expert, Native Speaker';
  if (variant === 'english_native') return 'English Expert, Native Speaker';
  return variant;
};
const localIsoDate = date => {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const scheduleValues = installments => Object.fromEntries(installments.flatMap(item => {
  const key = String(item.nr).padStart(2, '0');
  return [[`RATA_${key}_KWOTA`, formatAmount(item.amountCents)], [`RATA_${key}_TERMIN`, formatDate(item.dueDate)]];
}));

function weeklyLimit(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text) || Number(text) <= 0 || !Number.isSafeInteger(Number(text))) {
    throw new Error('Nowy limit lekcji tygodniowo musi być dodatnią liczbą całkowitą.');
  }
  return String(Number(text));
}

export function prepareAnnex45(currentContract, inputs = {}, annexDate = localIsoDate(new Date())) {
  validateAnnex45Data(currentContract);
  const newInstallmentCents = parseMoneyToCents(inputs.newInstallment, 'nowa rata');
  if (newInstallmentCents >= currentContract.monthlyInstallmentCents) {
    throw new Error('Nowa rata musi być niższa od obecnej raty miesięcznej.');
  }
  const limit = weeklyLimit(inputs.weeklyLimit);
  // The course start is mandatory above; Annex 25's established schedule logic uses the parsed installment plan.
  const calculation = calculateAnnex25(currentContract, annexDate, newInstallmentCents);
  const values = {
    NUMER_UMOWY: required(currentContract.agreementNumber, 'numer umowy'),
    DATA_ZAWARCIA_UMOWY: formatDate(currentContract.agreementDate, 'data zawarcia umowy'),
    DATA_ANEKSU: formatDate(annexDate),
    IMIE_NAZWISKO: required(currentContract.customerName, 'dane klienta'),
    ADRES: required(currentContract.address, 'adres'),
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: required(currentContract.personalId, currentContract.customerType === 'company' ? 'NIP' : 'PESEL'),
    SPLACONO_DO_DNIA_ANEKSU: formatAmount(calculation.paidToAnnexDateCents),
    LICZBA_LEKCJI: String(required(currentContract.lessonCount, 'liczba lekcji')),
    TYPY_LEKTOROW: required(teacherTypes(currentContract.teacherVariant), 'wariant lektorów'),
    LIMIT_TYGODNIOWY: limit,
    NOWA_CENA: formatAmount(calculation.newPriceCents),
    NOWA_SREDNIA_RATA: formatAmount(calculation.newAverageInstallmentCents),
    NUMER_KONTA: bankAccount(currentContract.internalPaymentAccount),
    DATA_WEJSCIA_W_ZYCIE: formatDate(addDays(annexDate, 1)),
    ...scheduleValues(calculation.installments)
  };
  const missing = manifest.requiredFields.filter(field => values[field] === undefined || values[field] === null || String(values[field]).trim() === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  const summary = {
    annex: manifest.label, customer: values.IMIE_NAZWISKO, agreementNumber: values.NUMER_UMOWY,
    agreementDate: values.DATA_ZAWARCIA_UMOWY, courseStartDate: formatDate(currentContract.courseStartDate),
    oldInstallment: formatAmount(calculation.oldInstallmentCents), newInstallment: formatAmount(calculation.newInstallmentCents),
    oldInstallments: calculation.paidInstallments, newInstallments: calculation.remainingInstallments,
    discount: formatAmount(calculation.discountCents), oldPrice: formatAmount(currentContract.coursePriceCents),
    newPrice: values.NOWA_CENA, newAverageInstallment: values.NOWA_SREDNIA_RATA,
    lessonCount: values.LICZBA_LEKCJI, weeklyLimit: limit, annexDate: values.DATA_ANEKSU,
    effectiveDate: values.DATA_WEJSCIA_W_ZYCIE, firstChangedMonth: formatDate(calculation.effectiveDate).slice(3)
  };
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation, summary };
}
