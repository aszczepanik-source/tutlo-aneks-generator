import manifest from './manifest.json' with { type: 'json' };
import { validateAnnex26Data } from './validator.js';

const INSTALLMENT_COUNT = 24;
const ANNEX_26_TEACHER_PHRASES = {
  polish: /\b(?:lektor\s+polski|lektorem\s+polskim)\b/iu,
  english: /\benglish\s+expert\b/iu,
  native: /\bnative\s+speaker(?:em)?\b/iu
};
const annex26Iso = date => date.toISOString().slice(0, 10);
const formatAnnex26Date = value => {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
};
const annex26Money = cents => `${(cents / 100).toFixed(2).replace('.', ',')} zł`;

const annex26EffectiveDate = annexDate => {
  const effectiveDate = new Date(`${annexDate}T12:00:00Z`);
  effectiveDate.setUTCDate(effectiveDate.getUTCDate() + 1);
  return annex26Iso(effectiveDate);
};

const annex26TeacherTypes = teacherTypes => {
  const source = String(teacherTypes ?? '');
  const hasPolish = ANNEX_26_TEACHER_PHRASES.polish.test(source);
  const hasEnglish = ANNEX_26_TEACHER_PHRASES.english.test(source);
  const hasNative = ANNEX_26_TEACHER_PHRASES.native.test(source);

  if (hasPolish && hasEnglish && hasNative) {
    return 'Lektorem Polskim, English Expert, Native Speakerem';
  }
  if (!hasPolish && hasEnglish && hasNative) return 'English Expert, Native Speakerem';
  throw new Error('Nie rozpoznano prawidłowego wariantu lektorów.');
};

const normalizeNumber = value => {
  const normalized = String(value ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const moneyToCents = value => {
  const parsed = normalizeNumber(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
};

function assertFiniteCalculation(calculation) {
  const numericFields = [
    'newLessonCount', 'newPriceCents', 'newAverageInstallmentCents',
    'paidToAnnexDateCents', 'bankRefundCents'
  ];
  const invalid = numericFields.filter(field => !Number.isFinite(calculation[field]));
  if (invalid.length) throw new Error(`Nieprawidłowy wynik obliczeń aneksu 26: ${invalid.join(', ')}.`);
}

function calculate(contract, annexDate, newInstallmentCents) {
  const [day, month, year] = contract.agreementDate.split('.');
  const agreement = new Date(`${year}-${month}-${day}T12:00:00Z`);
  const annex = new Date(`${annexDate}T12:00:00Z`);
  const oldInstallments = (annex.getUTCFullYear() - agreement.getUTCFullYear()) * 12
    + annex.getUTCMonth() - agreement.getUTCMonth() + 1;
  if (oldInstallments < 0 || oldInstallments > INSTALLMENT_COUNT) {
    throw new Error('Liczba rat objętych dotychczasową ratą musi mieścić się w zakresie od 0 do 24.');
  }

  const newInstallments = INSTALLMENT_COUNT - oldInstallments;
  const discountCents = newInstallments * (contract.currentInstallmentCents - newInstallmentCents);
  const newPriceCents = contract.coursePriceCents - discountCents;
  return {
    annexDate, effectiveDate: annex26EffectiveDate(annexDate), installmentCount: INSTALLMENT_COUNT,
    oldInstallments, newInstallments, discountCents, newPriceCents,
    remainingPercentage: newPriceCents / contract.coursePriceCents,
    newLessonCount: Math.round(contract.lessonCount * newPriceCents / contract.coursePriceCents),
    newAverageInstallmentCents: Math.round(newPriceCents / INSTALLMENT_COUNT),
    paidToAnnexDateCents: oldInstallments * contract.currentInstallmentCents,
    bankRefundCents: discountCents
  };
}

export function prepareAnnex26(contract, formData, today = new Date()) {
  const coursePrice = normalizeNumber(contract?.coursePrice);
  const lessonCount = normalizeNumber(contract?.lessonCount);
  const monthlyInstallment = normalizeNumber(contract?.monthlyInstallment);
  const coursePriceCents = Number.isInteger(contract?.coursePriceCents)
    ? contract.coursePriceCents
    : moneyToCents(contract?.coursePrice);
  const newInstallmentCents = moneyToCents(formData?.newInstallment);
  const currentInstallmentCents = Number.isInteger(coursePriceCents)
    ? Math.round(coursePriceCents / INSTALLMENT_COUNT)
    : NaN;

  // Tymczasowa diagnostyka źródeł liczbowych; celowo nie zawiera danych osobowych.
  console.info('[Aneks 26] źródła obliczeń', {
    coursePrice: contract?.coursePrice,
    coursePriceType: typeof contract?.coursePrice,
    lessonCount: contract?.lessonCount,
    lessonCountType: typeof contract?.lessonCount,
    monthlyInstallment: contract?.monthlyInstallment,
    monthlyInstallmentType: typeof contract?.monthlyInstallment,
    parsed: { coursePrice, coursePriceCents, lessonCount, monthlyInstallment, newInstallmentCents },
    coursePriceExtraction: contract?.coursePriceDiagnostic
  });

  const data = {
    ...contract,
    // currentContract exposes the canonical identifier as personalId. Keep the
    // template-facing PESEL field local to annex 26 instead of reverting the
    // shared contract model to its former `pesel` property.
    pesel: contract?.personalId ?? contract?.pesel,
    coursePrice,
    coursePriceCents,
    lessonCount,
    currentInstallmentCents,
    newInstallmentCents,
    bank: String(formData?.bank || '').trim(),
    bankAccount: String(formData?.bankAccount || '').replace(/\D/g, '').slice(0, 26)
  };
  validateAnnex26Data(data);

  const annexDate = annex26Iso(today);
  const calculation = calculate(data, annexDate, data.newInstallmentCents);
  assertFiniteCalculation(calculation);
  const agreementDate = data.agreementDate;
  const values = {
    NUMER_UMOWY: data.agreementNumber,
    DATA_ANEKSU: formatAnnex26Date(annexDate),
    IMIE_NAZWISKO: data.customerName,
    ADRES: data.address,
    PESEL: data.pesel,
    DATA_ZAWARCIA_UMOWY: agreementDate,
    NOWA_LICZBA_LEKCJI: String(calculation.newLessonCount),
    TYPY_LEKTOROW: annex26TeacherTypes(data.teacherTypes),
    LIMIT_MIESIECZNY: String(data.monthlyLimit),
    NOWA_CENA: annex26Money(calculation.newPriceCents),
    NOWA_SREDNIA_RATA: annex26Money(calculation.newAverageInstallmentCents),
    KWOTA_KREDYTU: annex26Money(data.coursePriceCents),
    BANK: data.bank,
    DATA_UMOWY_KREDYTU: agreementDate,
    SPLACONO_DO_DNIA_ANEKSU: annex26Money(calculation.paidToAnnexDateCents),
    KWOTA_DO_ZWROTU_BANKOWI: annex26Money(calculation.bankRefundCents),
    NUMER_RACHUNKU_BANKU: data.bankAccount,
    DATA_WEJSCIA_W_ZYCIE: formatAnnex26Date(calculation.effectiveDate)
  };

  return { annexId: manifest.id, template: manifest.template,
    templateVersion: manifest.templateVersion, requiredFields: manifest.requiredFields, values, calculation };
}
