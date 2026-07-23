function amountToCents(value) {
  if (!value) return undefined;
  const amount = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function capture(text, pattern) {
  return text.match(pattern)?.[1]?.trim();
}

export function extractAgreementDateFromNumber(agreementNumber) {
  const parts = String(agreementNumber || '').split('/').slice(-3);
  if (parts.length !== 3 || !/^\d{1,2}$/.test(parts[0])
    || !/^\d{1,2}$/.test(parts[1]) || !/^\d{4}$/.test(parts[2])) return undefined;

  const [day, month, year] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Odczyt stałych pól wariantu „umowa elastyczna + kredyt / pożyczka”. */
export function extractAnnex26Contract(rawText, agreementNumber) {
  const text = String(rawText || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const money = label => amountToCents(capture(text,
    new RegExp(`${label}\\s*:?\\s*([\\d ]+(?:[,.]\\d{1,2})?)\\s*(?:zł|PLN)`, 'i')));

  return {
    agreementNumber,
    agreementDate: extractAgreementDateFromNumber(agreementNumber),
    customerName: capture(text, /imię i nazwisko\s*:\s*(.+?)(?=\s+adres\s*:)/i),
    address: capture(text, /adres\s*:\s*(.+?)(?=\s+PESEL\s*:)/i),
    pesel: capture(text, /PESEL\s*:\s*(\d{11})\b/i),
    lessonCount: Number(capture(text, /liczba lekcji\s*:\s*(\d+)/i)) || undefined,
    monthlyLimit: Number(capture(text, /limit miesięczny\s*:\s*(\d+)/i)) || undefined,
    teacherTypes: capture(text, /typy lektorów\s*:\s*(.+?)(?=\s+(?:WARUNKI PŁATNOŚCI\s+)?cena kursu\s*:)/i),
    coursePriceCents: money('cena kursu'),
    currentInstallmentCents: money('rata miesięczna')
  };
}
