const required = [
  ['agreementNumber', 'numer umowy'],
  ['agreementDate', 'data zawarcia umowy'],
  ['customerType', 'typ klienta'],
  ['customerName', 'dane klienta'],
  ['personalId', 'PESEL/NIP'],
  ['address', 'adres']
];

export function validateAnnex29Data(currentContract) {
  if (currentContract?.contractType !== 'flexible'
    || currentContract?.paymentType !== 'internal'
    || currentContract?.paymentVariant !== 'internal_24') {
    throw new Error('Aneks 29 wymaga umowy flexible z ratami wewnętrznymi internal_24.');
  }
  for (const [field, label] of required) {
    if (currentContract[field] === undefined || currentContract[field] === null
      || String(currentContract[field]).trim() === '') throw new Error(`Brak danych umowy: ${label}.`);
  }
  const { coursePriceCents, monthlyInstallmentCents } = currentContract;
  if (!Number.isSafeInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Brak prawidłowej ceny kursu.');
  if (!Number.isSafeInteger(monthlyInstallmentCents) || monthlyInstallmentCents <= 0) throw new Error('Brak prawidłowej wysokości raty.');
  if (coursePriceCents <= monthlyInstallmentCents) throw new Error('Nowa cena kursu musi być większa od zera.');
  return currentContract;
}

export function validate(input) {
  try { validateAnnex29Data(input?.currentContract ?? input); return []; }
  catch (error) { return [{ message: error.message }]; }
}
