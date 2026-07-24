import manifest from './manifest.json' with { type: 'json' };
import { validateAnnex26Data } from './validator.js';

const INSTALLMENT_COUNT = 24;
const annex26Iso = date => date.toISOString().slice(0, 10);
const formatAnnex26Date = value => {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
};
const annex26Money = cents => `${(cents / 100).toFixed(2).replace('.', ',')} zł`;

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
  const effective = new Date(annex);
  effective.setUTCMonth(effective.getUTCMonth() + 1, 1);

  return {
    annexDate, effectiveDate: annex26Iso(effective), installmentCount: INSTALLMENT_COUNT,
    oldInstallments, newInstallments, discountCents, newPriceCents,
    remainingPercentage: newPriceCents / contract.coursePriceCents,
    newLessonCount: Math.round(contract.lessonCount * newPriceCents / contract.coursePriceCents),
    newAverageInstallmentCents: Math.round(newPriceCents / INSTALLMENT_COUNT),
    paidToAnnexDateCents: oldInstallments * contract.currentInstallmentCents,
    bankRefundCents: discountCents
  };
}

export function prepareAnnex26(contract, formData) {
  const newInstallment = Number(String(formData?.newInstallment ?? '').replace(',', '.'));
  const data = {
    ...contract,
    coursePriceCents: Math.round(Number(contract?.coursePrice) * 100),
    currentInstallmentCents: Math.round(Number(contract?.monthlyInstallment) * 100),
    newInstallmentCents: Number.isFinite(newInstallment) ? Math.round(newInstallment * 100) : NaN,
    bank: String(formData?.bank || '').trim(),
    bankAccount: String(formData?.bankAccount || '').replace(/\D/g, '').slice(0, 26)
  };
  validateAnnex26Data(data);

  const annexDate = annex26Iso(new Date());
  const calculation = calculate(data, annexDate, data.newInstallmentCents);
  const agreementDate = data.agreementDate;
  const values = {
    NUMER_UMOWY: data.agreementNumber,
    DATA_ANEKSU: formatAnnex26Date(annexDate),
    IMIE_NAZWISKO: data.customerName,
    ADRES: data.address,
    PESEL: data.pesel,
    DATA_ZAWARCIA_UMOWY: agreementDate,
    NOWA_LICZBA_LEKCJI: String(calculation.newLessonCount),
    TYPY_LEKTOROW: data.teacherTypes,
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
