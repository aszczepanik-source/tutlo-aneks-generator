const required = [
  ['agreementNumber', 'numer umowy'], ['agreementDate', 'data zawarcia umowy'],
  ['customerType', 'typ klienta'], ['customerName', 'dane klienta'],
  ['personalId', 'PESEL/NIP'], ['address', 'adres']
];

const SCHEDULE_CHANGE_VARIANTS = ['internal_1', 'internal_2', 'internal_4', 'internal_13'];

export function validateAnnex29aData(currentContract, options = {}) {
  const postPaymentChange = options.mode === 'post_payment_change';
  const scheduleChange = options.mode === 'post_schedule_change';
  const allowedCredit = postPaymentChange
    && ['flexible', 'limit'].includes(currentContract?.contractType)
    && currentContract?.paymentType === 'credit' && currentContract?.paymentVariant === 'credit';
  const allowedStandard = !postPaymentChange && !scheduleChange && currentContract?.contractType === 'flexible'
    && currentContract?.paymentType === 'internal' && currentContract?.paymentVariant === 'internal_24';
  const allowedSchedule = scheduleChange
    && ['flexible', 'limit'].includes(currentContract?.contractType)
    && currentContract?.paymentType === 'internal'
    && SCHEDULE_CHANGE_VARIANTS.includes(currentContract?.paymentVariant);
  if (!allowedCredit && !allowedStandard && !allowedSchedule) {
    throw new Error('Aneks 29a wymaga umowy flexible z ratami wewnętrznymi internal_24, umowy flexible lub limit z ratami wewnętrznymi w innym harmonogramie (jednorazowo, 2, 4 lub 13 rat) w trybie po zmianie harmonogramu, albo trybu po zmianie płatności dla umowy kredytowej flexible lub limit.');
  }
  for (const [field, label] of required) {
    if (currentContract[field] === undefined || currentContract[field] === null
      || String(currentContract[field]).trim() === '') throw new Error(`Brak danych umowy: ${label}.`);
  }
  const { coursePriceCents, monthlyInstallmentCents } = currentContract;
  if (!Number.isSafeInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Brak prawidłowej ceny kursu.');
  if (!Number.isSafeInteger(monthlyInstallmentCents) || monthlyInstallmentCents <= 0) throw new Error('Brak prawidłowej wysokości raty.');
  if (coursePriceCents <= 2 * monthlyInstallmentCents) throw new Error('Nowa cena kursu musi być większa od zera.');
  return currentContract;
}

export function validate(input) {
  try { validateAnnex29aData(input?.currentContract ?? input, input?.options); return []; }
  catch (error) { return [{ message: error.message }]; }
}
