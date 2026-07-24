const REQUIRED = [
  ['agreementNumber', 'Nie odczytano numeru umowy.'],
  ['agreementDate', 'Nie odczytano prawidłowej daty zawarcia umowy z numeru umowy.'],
  ['customerName', data => data.customerType === 'company'
    ? 'Nie odczytano nazwy firmy.' : 'Nie odczytano imienia i nazwiska.'],
  ['address', 'Nie odczytano adresu.'],
  ['pesel', data => data.customerType === 'company'
    ? 'Nie odczytano NIP firmy.' : 'Nie odczytano numeru PESEL.'],
  ['coursePriceCents', 'Nie odczytano ceny kursu.'],
  ['currentInstallmentCents', 'Nie odczytano wysokości obecnej raty.'],
  ['lessonCount', 'Nie odczytano liczby lekcji.'],
  ['monthlyLimit', 'Nie odczytano limitu miesięcznego.'],
  ['teacherTypes', 'Nie odczytano typów lektorów.'],
  ['bank', 'Nie podano banku.'],
  ['bankAccount', 'Nie podano numeru rachunku bankowego.']
];

const ALLOWED_BANKS = new Set([
  'Inbank',
  'Oney',
  'BGŻ BNP Paribas',
  'mBank',
  'Ikano Bank',
  'Alior Bank'
]);

export function validateAnnex26Data(data) {
  const missing = REQUIRED.find(([field]) => data[field] === undefined
    || data[field] === null || data[field] === '');
  if (missing) throw new Error(typeof missing[1] === 'function' ? missing[1](data) : missing[1]);

  if (data.customerType === 'company' && !/^\d{10}$/.test(data.pesel)) {
    throw new Error('NIP firmy musi zawierać dokładnie 10 cyfr.');
  }
  if (data.customerType !== 'company' && !/^\d{11}$/.test(data.pesel)) {
    throw new Error('PESEL musi zawierać dokładnie 11 cyfr.');
  }

  if (!Number.isInteger(data.newInstallmentCents) || data.newInstallmentCents <= 0) {
    throw new Error('Nowa rata musi być liczbą większą od 0.');
  }
  if (!Number.isInteger(data.coursePriceCents) || data.coursePriceCents <= 0) {
    throw new Error('Cena kursu musi być skończoną liczbą dodatnią.');
  }
  if (!Number.isFinite(data.lessonCount) || data.lessonCount <= 0) {
    throw new Error('Liczba lekcji musi być skończoną liczbą dodatnią.');
  }
  if (!Number.isInteger(data.currentInstallmentCents) || data.currentInstallmentCents <= 0) {
    throw new Error('Nie można wyliczyć obecnej raty z ceny kursu.');
  }
  if (data.newInstallmentCents >= data.currentInstallmentCents) {
    throw new Error('Nowa rata musi być niższa od obecnej raty.');
  }
  if (!ALLOWED_BANKS.has(data.bank)) {
    throw new Error('Wybierz bank z listy.');
  }
  if (!/^\d{26}$/.test(data.bankAccount)) {
    throw new Error('Numer rachunku musi zawierać dokładnie 26 cyfr.');
  }
}
