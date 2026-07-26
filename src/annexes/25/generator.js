import manifest from './manifest.json' with { type: 'json' };
import { calculateAnnex25, formatDate, money, parseMoneyToCents } from '../../domain/annex-calculations.js';

const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Brak danych umowy: ${label}.`);
  return value;
};
const contractBankAccount = value => {
  const normalized = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{26}$/.test(normalized)) throw new Error('Nie odczytano numeru rachunku z umowy.');
  return normalized;
};
const scheduleValues = installments => Object.fromEntries(installments.flatMap(item => {
  const key = String(item.nr).padStart(2, '0');
  return [[`RATA_${key}_KWOTA`, money(item.amountCents)], [`RATA_${key}_TERMIN`, formatDate(item.dueDate)]];
}));

export function prepareAnnex25(currentContract, inputs = {}, annexDate = new Date().toISOString().slice(0, 10)) {
  if (currentContract?.contractType !== 'flexible' || currentContract?.paymentType !== 'internal') {
    throw new Error('Aneks 25 jest dostępny wyłącznie dla elastycznej umowy z ratami wewnętrznymi.');
  }
  const calculation = calculateAnnex25(currentContract, annexDate, parseMoneyToCents(inputs.newInstallment, 'nowa rata'));
  const lessonCount = Number(required(currentContract.lessonCount, 'liczba lekcji'));
  const values = {
    ADRES: required(currentContract.address, 'adres'), DATA_ANEKSU: formatDate(annexDate),
    DATA_ZAWARCIA_UMOWY: formatDate(required(currentContract.agreementDate, 'data zawarcia umowy')),
    IMIE_NAZWISKO: required(currentContract.customerName, 'imię i nazwisko'),
    LIMIT_MIESIECZNY: String(required(currentContract.monthlyLimit, 'limit miesięczny')),
    NOWA_CENA: money(calculation.newPriceCents),
    NOWA_LICZBA_LEKCJI: String(Math.round(lessonCount * calculation.newPriceCents / currentContract.coursePriceCents)),
    NOWA_SREDNIA_RATA: money(calculation.newAverageInstallmentCents),
    NUMER_KONTA: contractBankAccount(currentContract.internalPaymentAccount),
    NUMER_UMOWY: required(currentContract.agreementNumber, 'numer umowy'),
    PESEL: required(currentContract.pesel, 'PESEL'),
    TYPY_LEKTOROW: required(currentContract.teacherTypes, 'typy lektorów'),
    ...scheduleValues(calculation.installments)
  };
  const missing = manifest.requiredFields.filter(field => values[field] === undefined || String(values[field]).trim() === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId: '25', template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation };
}
