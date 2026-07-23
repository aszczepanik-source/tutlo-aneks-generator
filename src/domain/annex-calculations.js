const DAY = 86_400_000;

export function parseIsoDate(value, field = 'data') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error(`Nieprawidłowa ${field}.`);
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error(`Nieprawidłowa ${field}.`);
  return date;
}

export function iso(date) { return date.toISOString().slice(0, 10); }
export function formatDate(value) {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: 'UTC' }).format(parseIsoDate(value));
}
export function addDays(value, count) {
  const date = parseIsoDate(value);
  date.setTime(date.getTime() + count * DAY);
  return iso(date);
}
export function addMonths(value, count) {
  const source = parseIsoDate(value);
  const day = source.getUTCDate();
  const result = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + count, 1, 12));
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0, 12)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return iso(result);
}
export function money(cents) { return `${(cents / 100).toFixed(2).replace('.', ',')} zł`; }

function requireInstallments(contract, minimum, annexDate) {
  const installments = (contract.installments || [])
    .map(item => ({ dueDate: item.dueDate, amountCents: Number(item.amountCents) }))
    .filter(item => item.dueDate >= annexDate && Number.isInteger(item.amountCents) && item.amountCents >= 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (installments.length < minimum) throw new Error(`Wymagane są co najmniej ${minimum} raty z terminem w dniu aneksu lub później.`);
  return installments.slice(0, minimum);
}

export function calculateFreeInstallments(contract, annexDate, count) {
  parseIsoDate(annexDate, 'data aneksu');
  if (!Number.isInteger(contract.coursePriceCents)) throw new Error('Brak ceny kursu.');
  const freeInstallments = requireInstallments(contract, count, annexDate);
  const newPriceCents = contract.coursePriceCents - freeInstallments.reduce((sum, item) => sum + item.amountCents, 0);
  if (newPriceCents < 0) throw new Error('Nowa cena nie może być ujemna.');
  return { annexDate, effectiveDate: addDays(annexDate, 3), newPriceCents, freeInstallments };
}

export function calculateAnnex29(contract, annexDate) { return calculateFreeInstallments(contract, annexDate, 1); }
export function calculateAnnex29a(contract, annexDate) { return calculateFreeInstallments(contract, annexDate, 2); }

export function calculateAnnex11(contract, annexDate, suspensionMonths) {
  parseIsoDate(annexDate, 'data aneksu');
  if (![1, 2].includes(suspensionMonths)) throw new Error('Zawieszenie może trwać 1 albo 2 miesiące.');
  if (!contract.contractEndDate) throw new Error('Brak daty końca umowy.');
  if (!Array.isArray(contract.installments) || contract.installments.length !== 24) throw new Error('Harmonogram musi zawierać dokładnie 24 raty.');
  const start = new Date(`${annexDate}T12:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() + 1, 1);
  const resume = new Date(start); resume.setUTCMonth(resume.getUTCMonth() + suspensionMonths);
  const end = new Date(resume); end.setUTCDate(0);
  const startIso = iso(start);
  const installments = contract.installments.map(item => ({
    ...item,
    dueDate: item.dueDate >= startIso ? addMonths(item.dueDate, suspensionMonths) : item.dueDate
  }));
  return {
    annexDate, suspensionMonths, suspensionStart: startIso, suspensionEnd: iso(end),
    paymentResumeDate: iso(resume), newContractEndDate: addMonths(contract.contractEndDate, suspensionMonths), installments
  };
}

export const BLOCKED_RULES = Object.freeze({
  '25': 'Dokumentacja nie określa sposobu wyliczenia nowej ceny, liczby lekcji, średniej raty ani nowego harmonogramu.',
  '26': 'Dokumentacja określa jedynie ręczne pola banku i rachunku. Brakuje reguł nowej ceny, liczby lekcji, średniej raty, spłaconej kwoty i zwrotu bankowi.'
});
