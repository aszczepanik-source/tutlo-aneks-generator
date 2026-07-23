function first(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

function cents(value) {
  if (!value) return undefined;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

function isoDate(value) {
  if (!value) return undefined;
  const match = value.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (!match) return undefined;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

/** Extracts annex 26 source data from the locally-read contract text. */
export function extractAnnex26Contract(text) {
  const flat = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const amount = label => cents(first(flat, [new RegExp(`${label}[^\\d]{0,40}([\\d ]+(?:[,.]\\d{1,2})?)\\s*(?:zł|PLN)`, 'i')]));
  const number = label => first(flat, [new RegExp(`${label}[^\\d]{0,30}(\\d+)`, 'i')]);

  const paidInstallments = number('(?:liczba rat już opłaconych|numer aktualnej raty|opłacono rat)');
  return {
    contractNumber: first(flat, [/(?:numer|nr)\s+umowy\s*[:#]?\s*([A-Z0-9/_-]+)/i, /umow[ay]\s+nr\s*([A-Z0-9/_-]+)/i]),
    contractDate: isoDate(first(flat, [/(?:data zawarcia umowy|umow[ay]\s+zawart[ae]\s+(?:w dniu)?)[^\d]{0,20}(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i])),
    customerName: first(flat, [/(?:imię i nazwisko|imie i nazwisko)\s*:\s*([^,;]{3,80})/i, /(?:kursant|klient)\s*:\s*([^,;]{3,80})/i]),
    address: first(flat, [/(?:adres zamieszkania|adres)\s*:\s*(.{5,120}?)(?=\s+(?:PESEL|NIP|telefon|e-mail|email)\b)/i]),
    pesel: first(flat, [/(?:PESEL|NIP)\s*:\s*([0-9-]{10,13})/i]),
    lessonCount: Number(number('(?:liczba|pakiet)\\s+lekcji')) || undefined,
    monthlyLimit: number('limit\\s+miesięczny'),
    teacherTypes: first(flat, [/(?:typy? lektorów|lektorzy)\s*:\s*(.{2,100}?)(?=\s+(?:cena|wartość|rata|limit)\b)/i]),
    coursePriceCents: amount('(?:cena|wartość)\\s+(?:kursu|umowy)'),
    currentInstallmentCents: amount('(?:obecna|miesięczna|aktualna)?\\s*rata'),
    paidInstallments: paidInstallments === undefined ? undefined : Number(paidInstallments),
    creditAmountCents: amount('kwota\\s+kredytu'),
    creditAgreementDate: isoDate(first(flat, [/(?:data umowy kredytowej|umowa kredytowa[^\d]{0,30})(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})/i]))
  };
}
