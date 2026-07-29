export const ANNEX_27_BANKS = new Set(['Inbank', 'Oney', 'BGŻ BNP Paribas', 'mBank', 'Ikano Bank', 'Alior Bank']);

export function validateAnnex27Data(data) {
  if (data.contractType !== 'flexible' || data.paymentType !== 'credit' || data.paymentVariant !== 'credit')
    throw new Error('Aneks 27 obsługuje wyłącznie elastyczną umowę kredytową.');
  if (!ANNEX_27_BANKS.has(data.bank)) throw new Error('Wybierz bank z listy.');
  if (!Number.isInteger(data.oldCoursePriceCents) || data.oldCoursePriceCents <= 0) throw new Error('Cena kursu musi być dodatnia.');
  if (!Number.isInteger(data.oldRateCents) || data.oldRateCents <= 0) throw new Error('Obecna rata musi być dodatnia.');
  if (!Number.isInteger(data.newRateCents) || data.newRateCents <= 0) throw new Error('Nowa rata musi być liczbą dodatnią z maksymalnie dwoma miejscami po przecinku.');
  if (data.newRateCents >= data.oldRateCents) throw new Error('Nowa rata musi być niższa od obecnej raty.');
  if (!/^\d{26}$/.test(data.bankAccount)) throw new Error('Numer rachunku banku musi zawierać dokładnie 26 cyfr.');
  if (!/^\d{26}$/.test(data.tutloAccount)) throw new Error('Numer rachunku Tutlo musi zawierać dokładnie 26 cyfr.');
  if (!Number.isInteger(data.paidMonths) || data.paidMonths < 0 || data.paidMonths >= 24) throw new Error('Liczba opłaconych rat musi mieścić się w zakresie od 0 do 23.');
  if (!Number.isInteger(data.remainingMonths) || data.remainingMonths <= 0) throw new Error('Liczba pozostałych rat musi być dodatnia.');
}
