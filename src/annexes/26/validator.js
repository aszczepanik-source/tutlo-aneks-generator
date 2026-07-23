const REQUIRED = [
  ['agreementNumber', 'Nie odczytano numeru umowy.'],
  ['agreementDate', 'Nie odczytano prawidłowej daty zawarcia umowy z numeru umowy.'],
  ['customerName', 'Nie odczytano imienia i nazwiska.'],
  ['address', 'Nie odczytano adresu.'],
  ['pesel', 'Nie odczytano numeru PESEL.'],
  ['coursePriceCents', 'Nie odczytano ceny kursu.'],
  ['currentInstallmentCents', 'Nie odczytano wysokości obecnej raty.'],
  ['lessonCount', 'Nie odczytano liczby lekcji.'],
  ['monthlyLimit', 'Nie odczytano limitu miesięcznego.'],
  ['teacherTypes', 'Nie odczytano typów lektorów.'],
  ['bank', 'Nie podano banku.'],
  ['bankAccount', 'Nie podano numeru rachunku bankowego.']
];

export function validateAnnex26Data(data) {
  const missing = REQUIRED.find(([field]) => data[field] === undefined
    || data[field] === null || data[field] === '');
  if (missing) throw new Error(missing[1]);

  if (!Number.isInteger(data.newInstallmentCents) || data.newInstallmentCents <= 0) {
    throw new Error('Nowa rata musi być liczbą większą od 0.');
  }
  if (data.newInstallmentCents >= data.currentInstallmentCents) {
    throw new Error('Nowa rata musi być niższa od obecnej raty.');
  }
  if (!/^\d{26}$/.test(data.bankAccount)) {
    throw new Error('Numer rachunku musi zawierać dokładnie 26 cyfr.');
  }
}
