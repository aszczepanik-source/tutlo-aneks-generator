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

export function calculateCourseMonths({ courseStartDate, annexDate, totalMonths = 24 }) {
  if (!Number.isInteger(totalMonths) || totalMonths <= 0) {
    throw new Error('Liczba miesięcy kursu musi być dodatnią liczbą całkowitą.');
  }
  const start = parseDate(courseStartDate, 'data rozpoczęcia kursu');
  const annex = parseDate(annexDate, 'data aneksu');
  if (annex < start) {
    throw new Error('Data aneksu nie może przypadać przed datą rozpoczęcia kursu ani przed miesiącem rozpoczęcia.');
  }
  const monthDifference = (annex.getUTCFullYear() - start.getUTCFullYear()) * 12
    + annex.getUTCMonth() - start.getUTCMonth();
  const usedMonths = monthDifference + (start.getUTCDate() <= 15 ? 1 : 0);
  if (usedMonths <= 0) throw new Error('Liczba wykorzystanych miesięcy musi być większa od 0.');
  if (usedMonths > totalMonths) throw new Error(`Kurs przekroczył ${totalMonths}-miesięczny okres.`);
  return { usedMonths, remainingMonths: totalMonths - usedMonths };
}

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
  if (!plan?.firstPaymentDueDate || !plan?.recurringStartDate) {
    throw new Error('Brak daty rozpoczęcia harmonogramu rat w danych umowy.');
  }
  const firstDueDate = iso(parseDate(plan.firstPaymentDueDate, 'termin pierwszej raty'));
  const recurringStartDate = iso(parseDate(plan.recurringStartDate, 'data rozpoczęcia kolejnych rat'));
  return [firstDueDate, ...Array.from({ length: ANNEX_25_INSTALLMENTS - 1 },
    (_, index) => addMonths(recurringStartDate, index))];
}

export function calculateAnnex25(contract, annexDate, newInstallmentCents) {
  const coursePriceCents = contract.coursePriceCents;
  if (!Number.isSafeInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Cena kursu jest nieprawidłowa.');
  if (contract.paymentVariant !== 'internal_24') throw new Error('Aneks 25 wymaga umowy na 24 raty wewnętrzne.');
  if (coursePriceCents % ANNEX_25_INSTALLMENTS !== 0) throw new Error('Cena kursu nie dzieli się na 24 pełne raty w groszach.');
  const oldInstallmentCents = coursePriceCents / ANNEX_25_INSTALLMENTS;
  if (!Number.isSafeInteger(newInstallmentCents) || newInstallmentCents <= 0) throw new Error('Nowa rata musi być dodatnią kwotą.');
  if (newInstallmentCents >= oldInstallmentCents) {
    throw new Error(`Nowa rata musi być niższa od obecnej raty wynoszącej ${money(oldInstallmentCents)}.`);
  }
  const effectiveDate = firstOfNextMonth(annexDate);
  const dueDates = annex25DueDates(contract);
  if (dueDates.length !== ANNEX_25_INSTALLMENTS || dueDates.some(date => !date)) throw new Error('Harmonogram musi zawierać dokładnie 24 raty z terminami.');
  const { usedMonths: paidInstallments, remainingMonths: remainingInstallments } = calculateCourseMonths({
    courseStartDate: contract.courseStartDate, annexDate, totalMonths: ANNEX_25_INSTALLMENTS
  });
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

const ANNEX_25A_LUMP_VARIANTS = Object.freeze({ internal_2: 2, internal_4: 4 });

/**
 * Same reduction as Aneks 25, but for contracts whose original schedule is a
 * fixed number of equal lump installments (2 or 4) instead of 24 monthly
 * ones. Rata 1 is always kept unchanged (it is settled almost immediately
 * after signing); everything from rata 2 onward is unrolled into one
 * continuous monthly run through month 24, starting at rata 2's own due
 * date, with the same "already-used months stay at the old rate" split as
 * calculateAnnex25.
 */
export function calculateAnnex25a(contract, annexDate, newInstallmentCents) {
  const coursePriceCents = contract.coursePriceCents;
  if (!Number.isSafeInteger(coursePriceCents) || coursePriceCents <= 0) throw new Error('Cena kursu jest nieprawidłowa.');
  const monthlyInstallmentCents = contract.monthlyInstallmentCents;
  if (!Number.isSafeInteger(monthlyInstallmentCents) || monthlyInstallmentCents <= 0) throw new Error('Miesięczna opłata jest nieprawidłowa.');
  const totalMonths = 24;
  const paymentCount = ANNEX_25A_LUMP_VARIANTS[contract.paymentVariant];
  if (!paymentCount) throw new Error('Aneks 25a wymaga umowy z harmonogramem 2 lub 4 rat wewnętrznych.');
  const scheduleInstallments = contract.installmentPlan?.installments;
  if (!Array.isArray(scheduleInstallments) || scheduleInstallments.length !== paymentCount) {
    throw new Error('Brak pełnego harmonogramu oryginalnych rat w danych umowy.');
  }
  if (!Number.isSafeInteger(newInstallmentCents) || newInstallmentCents <= 0) throw new Error('Nowa rata musi być dodatnią kwotą.');
  if (newInstallmentCents >= monthlyInstallmentCents) {
    throw new Error(`Nowa rata musi być niższa od obecnej miesięcznej opłaty wynoszącej ${money(monthlyInstallmentCents)}.`);
  }

  const monthsPerInstallment = totalMonths / paymentCount;
  const keptInstallment = scheduleInstallments[0];
  const runStartInstallment = scheduleInstallments[1];
  if (!keptInstallment || !runStartInstallment) throw new Error('Brak pełnego harmonogramu oryginalnych rat w danych umowy.');

  const { usedMonths } = calculateCourseMonths({ courseStartDate: contract.courseStartDate, annexDate, totalMonths });
  const runMonths = totalMonths - monthsPerInstallment;
  const paidWithinRun = Math.max(0, Math.min(runMonths, usedMonths - monthsPerInstallment));
  const remainingWithinRun = runMonths - paidWithinRun;
  const runStartDate = iso(parseDate(runStartInstallment.dueDate, 'termin drugiej raty'));

  const runInstallments = Array.from({ length: runMonths }, (_, index) => ({
    nr: index + 2,
    dueDate: addMonths(runStartDate, index),
    amountCents: index < paidWithinRun ? monthlyInstallmentCents : newInstallmentCents
  }));
  const installments = [
    { nr: 1, dueDate: keptInstallment.dueDate, amountCents: keptInstallment.amountCents },
    ...runInstallments
  ];

  const discountCents = (monthlyInstallmentCents - newInstallmentCents) * remainingWithinRun;
  const newPriceCents = coursePriceCents - discountCents;
  if (installments.reduce((sum, item) => sum + item.amountCents, 0) !== newPriceCents) {
    throw new Error('Suma harmonogramu nie odpowiada nowej cenie.');
  }
  const effectiveDate = firstOfNextMonth(annexDate);

  return {
    annexDate, effectiveDate, oldInstallmentCents: monthlyInstallmentCents, newInstallmentCents,
    paidInstallments: 1 + paidWithinRun, remainingInstallments: remainingWithinRun,
    discountCents, newPriceCents,
    paidToAnnexDateCents: keptInstallment.amountCents + monthlyInstallmentCents * paidWithinRun,
    newAverageInstallmentCents: Math.round(newPriceCents / totalMonths),
    installments
  };
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
