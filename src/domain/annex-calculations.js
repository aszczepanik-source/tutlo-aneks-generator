const DAY = 86_400_000;

export function parseDate(value, field = 'data') {
  const text = typeof value === 'string' ? value.trim() : '';
  let year;
  let month;
  let day;
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [, year, month, day] = match;
  } else {
    match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
      || text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) [, day, month, year] = match;
  }

  const invalid = () => { throw new Error(`Nieprawidłowa ${field}: ${String(value)}`); };
  if (!match) invalid();
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)) invalid();
  return date;
}

// Kept as an alias for callers that already use the old public name.
export const parseIsoDate = parseDate;

export function iso(date) { return date.toISOString().slice(0, 10); }
export function formatDate(value, field) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
  }).format(parseDate(value, field));
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

export function parseMoneyToCents(value, field = 'kwota') {
  const text = String(value ?? '').trim().replace(/\s*zł\s*$/i, '').trim();
  const match = text.match(/^(\d+)(?:[,.](\d{1,2}))?$/);
  if (!match) throw new Error(`Nieprawidłowa ${field}. Wpisz dodatnią kwotę z maksymalnie dwoma miejscami po przecinku.`);
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error(`Nieprawidłowa ${field}. Wpisz dodatnią kwotę z maksymalnie dwoma miejscami po przecinku.`);
  return cents;
}

const ANNEX_25_INSTALLMENTS = 24;
const firstOfNextMonth = value => {
  const date = parseDate(value, 'data aneksu');
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12)));
};

function annex25DueDates(contract) {
  const plan = contract.installmentPlan;
  if (Array.isArray(plan?.installments) && plan.installments.length === ANNEX_25_INSTALLMENTS) {
    return plan.installments.map(item => iso(parseDate(item.dueDate, 'termin raty')));
  }
  // In the §2(2) variant the schedule starts on the course start date and
  // preserves its day (including end-of-month clamping) for all 24 months.
  if (!plan?.startDate) throw new Error('Brak daty rozpoczęcia harmonogramu rat w danych umowy.');
  const start = iso(parseDate(plan.startDate, 'data rozpoczęcia harmonogramu'));
  return Array.from({ length: ANNEX_25_INSTALLMENTS }, (_, index) => addMonths(start, index));
}

export function calculateAnnex25(contract, annexDate, newInstallmentCents) {
  const coursePriceCents = contract.coursePriceCents;
  if (!Number.isSafeInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Cena kursu jest nieprawidłowa.');
  if (contract.paymentVariant !== 'internal_24' || contract.installmentPlan?.paymentCount !== ANNEX_25_INSTALLMENTS) throw new Error('Aneks 25 wymaga umowy na 24 raty.');
  if (coursePriceCents % ANNEX_25_INSTALLMENTS !== 0) throw new Error('Cena kursu nie dzieli się na 24 pełne raty w groszach.');
  const oldInstallmentCents = coursePriceCents / ANNEX_25_INSTALLMENTS;
  if (!Number.isSafeInteger(newInstallmentCents) || newInstallmentCents <= 0) throw new Error('Nowa rata musi być dodatnią kwotą.');
  if (newInstallmentCents >= oldInstallmentCents) {
    throw new Error(`Nowa rata musi być niższa od obecnej raty wynoszącej ${money(oldInstallmentCents)}.`);
  }
  const effectiveDate = firstOfNextMonth(annexDate);
  const dueDates = annex25DueDates(contract);
  if (dueDates.length !== ANNEX_25_INSTALLMENTS || dueDates.some(date => !date)) throw new Error('Harmonogram musi zawierać dokładnie 24 raty z terminami.');
  const paidInstallments = dueDates.filter(date => date < effectiveDate).length;
  const remainingInstallments = ANNEX_25_INSTALLMENTS - paidInstallments;
  const installments = dueDates.map((dueDate, index) => ({
    nr: index + 1, dueDate, amountCents: index < paidInstallments ? oldInstallmentCents : newInstallmentCents
  }));
  const discountCents = (oldInstallmentCents - newInstallmentCents) * remainingInstallments;
  const newPriceCents = coursePriceCents - discountCents;
  if (installments.reduce((sum, item) => sum + item.amountCents, 0) !== newPriceCents) throw new Error('Suma harmonogramu nie odpowiada nowej cenie.');
  return { annexDate, effectiveDate, oldInstallmentCents, newInstallmentCents, paidInstallments,
    remainingInstallments, discountCents, newPriceCents,
    paidToAnnexDateCents: oldInstallmentCents * paidInstallments,
    newAverageInstallmentCents: Math.round(newPriceCents / ANNEX_25_INSTALLMENTS), installments };
}

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
  const coursePriceCents = Math.round(Number(contract.coursePrice) * 100);
  if (!Number.isInteger(coursePriceCents)) throw new Error('Brak ceny kursu.');
  const freeInstallments = requireInstallments(contract, count, annexDate);
  const newPriceCents = coursePriceCents - freeInstallments.reduce((sum, item) => sum + item.amountCents, 0);
  if (newPriceCents < 0) throw new Error('Nowa cena nie może być ujemna.');
  return { annexDate, effectiveDate: addDays(annexDate, 3), newPriceCents, freeInstallments };
}

export function calculateAnnex29(contract, annexDate) { return calculateFreeInstallments(contract, annexDate, 1); }
export function calculateAnnex29a(contract, annexDate) { return calculateFreeInstallments(contract, annexDate, 2); }

const ANNEX_26_INSTALLMENTS = 24;

export function calculateAnnex26(contract, annexDate, newInstallmentCents) {
  parseIsoDate(annexDate, 'data aneksu');
  const paidInstallments = Number(contract.paidInstallments);
  const coursePriceCents = Math.round(Number(contract.coursePrice) * 100);
  const lessonCount = Number(contract.lessonCount);

  if (!Number.isInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Brak ceny kursu.');
  const oldInstallmentCents = Math.round(coursePriceCents / ANNEX_26_INSTALLMENTS);
  if (!Number.isInteger(newInstallmentCents) || newInstallmentCents <= 0 || newInstallmentCents > oldInstallmentCents) {
    throw new Error('Nowa rata musi być dodatnia i nie może przekraczać obecnej raty.');
  }
  if (!Number.isInteger(paidInstallments) || paidInstallments < 0 || paidInstallments > ANNEX_26_INSTALLMENTS) {
    throw new Error('Liczba opłaconych rat musi mieścić się w zakresie od 0 do 24.');
  }
  if (!Number.isFinite(lessonCount) || lessonCount <= 0) throw new Error('Brak liczby lekcji.');

  const remainingInstallments = ANNEX_26_INSTALLMENTS - paidInstallments;
  const discountCents = remainingInstallments * (oldInstallmentCents - newInstallmentCents);
  const newPriceCents = coursePriceCents - discountCents;
  if (newPriceCents <= 0) throw new Error('Nowa cena kursu musi być dodatnia.');

  const effective = parseIsoDate(annexDate);
  effective.setUTCMonth(effective.getUTCMonth() + 1, 1);

  return {
    annexDate,
    effectiveDate: iso(effective),
    installmentCount: ANNEX_26_INSTALLMENTS,
    paidInstallments,
    remainingInstallments,
    discountCents,
    newPriceCents,
    remainingPercentage: newPriceCents / coursePriceCents,
    newLessonCount: Math.round(lessonCount * newPriceCents / coursePriceCents),
    newAverageInstallmentCents: Math.round(newPriceCents / ANNEX_26_INSTALLMENTS),
    paidToAnnexDateCents: paidInstallments * oldInstallmentCents,
    bankRefundCents: discountCents
  };
}

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
});
