import manifest from './manifest.json' with { type: 'json' };
import { calculateCourseMonths, formatDate } from '../../domain/annex-calculations.js';
import { validateAnnex48Data } from './validator.js';
import { getLocalIsoDate } from '../shared/local-date.js';

export const TOTAL_MONTHS = 24;
const formatAmount = cents => (cents / 100).toFixed(2).replace('.', ',');
const parseDate = (value, label) => {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Nieprawidłowa ${label}.`);
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    throw new Error(`Nieprawidłowa ${label}.`);
  }
  return date;
};

function usedLessons(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) {
    throw new Error('Liczba wykorzystanych lekcji musi być liczbą całkowitą większą lub równą 0.');
  }
  return Number(text);
}

export function prepareAnnex48(currentContract, inputs = {}, annexDate = getLocalIsoDate()) {
  validateAnnex48Data(currentContract);
  const lessonsUsed = usedLessons(inputs.usedLessons);
  const { usedMonths, remainingMonths } = calculateCourseMonths({
    courseStartDate: currentContract.courseStartDate, annexDate, totalMonths: TOTAL_MONTHS
  });
  const annex = parseDate(annexDate, 'data aneksu');
  const effectiveDate = getLocalIsoDate(new Date(annex.getFullYear(), annex.getMonth() + 1, 1));
  const values = {
    NUMER_UMOWY: String(currentContract.agreementNumber),
    DATA_ZAWARCIA_UMOWY: formatDate(currentContract.agreementDate, 'data zawarcia umowy'),
    DATA_ANEKSU: formatDate(annexDate),
    IMIE_NAZWISKO: String(currentContract.customerName),
    ADRES: String(currentContract.address).replace(/^(ul\.\s*){2,}/i, 'ul. '),
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: String(currentContract.personalId),
    WYKORZYSTANE_LEKCJE: String(lessonsUsed),
    SPLACONO_DO_DNIA_ANEKSU: formatAmount(usedMonths * currentContract.monthlyInstallmentCents),
    POZOSTAŁE_LEKCJE: String(remainingMonths * currentContract.monthlyLessonLimit),
    DATA_WEJSCIA_W_ZYCIE: formatDate(effectiveDate)
  };
  const summary = {
    annex: manifest.label, customer: values.IMIE_NAZWISKO, agreementNumber: values.NUMER_UMOWY,
    agreementDate: values.DATA_ZAWARCIA_UMOWY, courseStartDate: formatDate(currentContract.courseStartDate),
    paymentType: currentContract.paymentType, monthlyInstallment: formatAmount(currentContract.monthlyInstallmentCents),
    monthlyLessonLimit: String(currentContract.monthlyLessonLimit), usedMonths, remainingMonths,
    usedLessons: values.WYKORZYSTANE_LEKCJE, paidToAnnexDate: values.SPLACONO_DO_DNIA_ANEKSU,
    remainingLessons: values.POZOSTAŁE_LEKCJE, annexDate: values.DATA_ANEKSU, effectiveDate: values.DATA_WEJSCIA_W_ZYCIE
  };
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values, calculation: { usedMonths, remainingMonths }, summary };
}
