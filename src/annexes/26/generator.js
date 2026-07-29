import manifest from './manifest.json' with { type: 'json' };
import { validateAnnex26Data } from './validator.js';
import { validateCurrentContract } from '../../domain/contract-extraction.js';

const INSTALLMENT_COUNT = 24;
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

const annex26TeacherTypes = variant => {
  if (variant === 'polish_english_native') return 'Lektorem Polskim, English Expert, Native Speakerem';
  if (variant === 'english_native') return 'English Expert, Native Speakerem';
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
  const agreement = new Date(`${contract.agreementDate}T12:00:00Z`);
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
  validateCurrentContract(contract);
  if (contract.contractType !== 'flexible' || contract.paymentVariant !== 'credit') {
    throw new Error('Aneks 26 obsługuje wyłącznie elastyczną umowę kredytową.');
  }
  const lessonCount = normalizeNumber(contract?.lessonCount);
  const coursePriceCents = contract?.coursePriceCents;
  const newInstallmentCents = moneyToCents(formData?.newInstallment);
  const currentInstallmentCents = Number.isInteger(coursePriceCents)
    ? Math.round(coursePriceCents / INSTALLMENT_COUNT)
    : NaN;

  const data = {
    ...contract,
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
    IDENTYFIKATOR_LABEL: data.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: data.personalId,
    DATA_ZAWARCIA_UMOWY: formatAnnex26Date(agreementDate),
    NOWA_LICZBA_LEKCJI: String(calculation.newLessonCount),
    TYPY_LEKTOROW: annex26TeacherTypes(data.teacherVariant),
    LIMIT_MIESIECZNY: String(data.monthlyLessonLimit),
    NOWA_CENA: annex26Money(calculation.newPriceCents),
    NOWA_SREDNIA_RATA: annex26Money(calculation.newAverageInstallmentCents),
    KWOTA_KREDYTU: annex26Money(data.coursePriceCents),
    BANK: data.bank,
    DATA_UMOWY_KREDYTU: formatAnnex26Date(agreementDate),
    SPLACONO_DO_DNIA_ANEKSU: annex26Money(calculation.paidToAnnexDateCents),
    KWOTA_DO_ZWROTU_BANKOWI: annex26Money(calculation.bankRefundCents),
    NUMER_RACHUNKU_BANKU: data.bankAccount,
    DATA_WEJSCIA_W_ZYCIE: formatAnnex26Date(calculation.effectiveDate)
  };

  return { annexId: manifest.id, template: manifest.template,
    templateVersion: manifest.templateVersion, requiredFields: manifest.requiredFields, values, calculation };
}
