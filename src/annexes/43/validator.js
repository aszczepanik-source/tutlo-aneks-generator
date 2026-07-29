const unavailable = 'Aneks 43 jest dostępny tylko dla umowy elastycznej z płatnością kredytową i Grupą Rodzinną za dodatkową opłatą.';

const missing = (value) => value === undefined || value === null || String(value).trim() === '';

export function validateAnnex43Data(currentContract) {
  if (currentContract?.contractType !== 'flexible'
    || currentContract?.paymentType !== 'credit'
    || currentContract?.paymentVariant !== 'credit'
    || currentContract?.familyGroupVariant !== 'paid') throw new Error(unavailable);

  if (missing(currentContract.agreementNumber)) throw new Error('Nie udało się odczytać numeru umowy.');
  const agreementDate = currentContract.agreementDate
    ?? currentContract.dataZawarciaUmowy ?? currentContract.contractDate;
  if (missing(agreementDate)) throw new Error('Nie udało się odczytać daty zawarcia umowy.');
  if (missing(currentContract.customerName)) {
    throw new Error(currentContract.customerType === 'company'
      ? 'Nie udało się odczytać nazwy firmy.' : 'Nie udało się odczytać imienia i nazwiska klienta.');
  }
  if (missing(currentContract.address)) throw new Error('Nie udało się odczytać adresu klienta.');
  if (!['person', 'company'].includes(currentContract.customerType)
    || missing(currentContract.personalId)) throw new Error('Nie udało się odczytać numeru PESEL/NIP.');
  return currentContract;
}

export function validate(input) {
  try { validateAnnex43Data(input?.currentContract ?? input); return []; }
  catch (error) { return [{ message: error.message }]; }
}
