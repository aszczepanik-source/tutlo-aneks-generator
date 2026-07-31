import { ANNEX_27_BANKS } from '../27/validator.js';

export const ANNEX_45E_BANKS = ANNEX_27_BANKS;

export function validateAnnex45EData(data) {
  if (data?.contractType !== 'limit' || data?.paymentType !== 'credit' || data?.paymentVariant !== 'credit') {
    throw new Error('Aneks 45e obsługuje wyłącznie umowę z limitem i płatnością kredytową.');
  }
  const required = [
    ['agreementNumber', 'numer umowy'], ['agreementDate', 'data zawarcia umowy'],
    ['courseStartDate', 'data rozpoczęcia kursu'], ['customerName', 'dane klienta'],
    ['address', 'adres'], ['personalId', data?.customerType === 'company' ? 'NIP' : 'PESEL'],
    ['lessonCount', 'liczba lekcji'], ['teacherVariant', 'wariant lektorów'],
    ['monthlyInstallmentCents', 'obecna rata kredytowa']
  ];
  const missing = required.find(([field]) => data?.[field] === undefined || data[field] === null || String(data[field]).trim() === '');
  if (missing) throw new Error(`Brak danych umowy: ${missing[1]}.`);
  if (!Number.isSafeInteger(data.monthlyInstallmentCents) || data.monthlyInstallmentCents <= 0) {
    throw new Error('Obecna rata kredytowa musi być dodatnią kwotą.');
  }
  if (!ANNEX_45E_BANKS.has(data.bank)) throw new Error('Wybierz bank z listy Aneksu 26.');
  if (!/^\d{26}$/.test(data.bankAccount)) throw new Error('Numer rachunku bankowego Banku musi zawierać dokładnie 26 cyfr.');
  if (!/^\d{26}$/.test(data.tutloAccount)) throw new Error('Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr.');
}
