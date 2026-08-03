import manifest from './manifest.json' with { type: 'json' };
import { addDays, addMonths, calculateCourseMonths, formatDate, parseMoneyToCents } from '../../domain/annex-calculations.js';
import { validateAnnex45EData } from './validator.js';
import { getLocalIsoDate } from '../shared/local-date.js';

const TOTAL_MONTHS = 24;

const formatAmount = cents => (cents / 100).toFixed(2).replace('.', ',');
const normalizeAccount = value => String(value ?? '').replace(/\D/g, '').slice(0, 26);
const teacherTypes = variant => {
  if (variant === 'polish_english_native') return 'Lektor Polski, English Expert, Native Speaker';
  if (variant === 'english_native') return 'English Expert, Native Speaker';
  return String(variant);
};
const roman = value => {
  const numbers = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = value;
  return numbers.map(([number, symbol]) => {
    const count = Math.floor(rest / number);
    rest %= number;
    return symbol.repeat(count);
  }).join('');
};
const firstDueDate = annexDate => {
  const nextMonth = addMonths(annexDate, 1);
  return `${nextMonth.slice(0, 8)}05`;
};
const weeklyLimit = value => {
  const text = String(value ?? '').trim();
  if (!/^[1-6]$/.test(text)) throw new Error('Nowy limit tygodniowy musi być wybrany z listy od 1 do 6.');
  return text;
};

export function prepareAnnex45E(currentContract, inputs = {}, annexDate = getLocalIsoDate()) {
  const data = {
    ...currentContract,
    bank: String(inputs.bank ?? '').trim(),
    bankAccount: normalizeAccount(inputs.bankAccount),
    tutloAccount: normalizeAccount(inputs.tutloAccount)
  };
  validateAnnex45EData(data);
  const newInstallmentCents = parseMoneyToCents(inputs.newInstallment, 'nowa rata');
  const limit = weeklyLimit(inputs.weeklyLimit);
  const { usedMonths, remainingMonths } = calculateCourseMonths({
    courseStartDate: data.courseStartDate, annexDate, totalMonths: TOTAL_MONTHS
  });
  if (remainingMonths <= 0) throw new Error('Brak pozostałych rat Tutlo do umieszczenia w harmonogramie.');
  const paidToAnnexDateCents = usedMonths * data.monthlyInstallmentCents;
  const remainingTutloCents = newInstallmentCents * remainingMonths;
  const newPriceCents = paidToAnnexDateCents + remainingTutloCents;
  const newAverageInstallmentCents = Math.round(newPriceCents / TOTAL_MONTHS);
  const firstDue = firstDueDate(annexDate);
  const installments = Array.from({ length: remainingMonths }, (_, index) => ({
    NUMER_RATY: `${roman(index + 1)} rata`,
    KWOTA: formatAmount(newInstallmentCents),
    TERMIN: formatDate(addMonths(firstDue, index))
  }));
  const values = {
    NUMER_UMOWY: String(data.agreementNumber),
    DATA_ZAWARCIA_UMOWY: formatDate(data.agreementDate, 'data zawarcia umowy'),
    DATA_ANEKSU: formatDate(annexDate, 'data aneksu'),
    IMIE_NAZWISKO: String(data.customerName),
    ADRES: String(data.address).replace(/^(ul\.\s*){2,}/i, 'ul. '),
    IDENTYFIKATOR_LABEL: data.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: String(data.personalId),
    LICZBA_LEKCJI: String(data.lessonCount),
    TYPY_LEKTOROW: teacherTypes(data.teacherVariant),
    LIMIT_TYGODNIOWY: limit,
    NOWA_CENA: formatAmount(newPriceCents),
    NOWA_SREDNIA_RATA: formatAmount(newAverageInstallmentCents),
    SPLACONO_DO_DNIA_ANEKSU: formatAmount(paidToAnnexDateCents),
    LICZBA_RAT: String(usedMonths),
    OBECNA_RATA: formatAmount(data.monthlyInstallmentCents),
    KWOTA_POZOSTALA_BANK: '0,00',
    BANK: data.bank,
    KWOTA_POZOSTALA_TUTLO: formatAmount(remainingTutloCents),
    LICZBA_POZOSTALYCH_RAT: String(remainingMonths),
    NUMER_RACHUNKU_TUTLO: data.tutloAccount,
    RATY: installments,
    KWOTA_DO_ZWROTU_BANKOWI: '0,00',
    NUMER_RACHUNKU_BANKU: data.bankAccount,
    DATA_WEJSCIA_W_ZYCIE: formatDate(addDays(annexDate, 1))
  };
  const calculation = {
    installmentCount: usedMonths,
    usedMonths,
    remainingInstallments: remainingMonths,
    currentInstallmentCents: data.monthlyInstallmentCents,
    newInstallmentCents,
    paidToAnnexDateCents,
    remainingTutloCents,
    newPriceCents,
    newAverageInstallmentCents,
    installments
  };
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation };
}
