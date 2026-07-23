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

/** Extracts and validates the agreement date encoded in the contract number. */
export function extractAgreementDateFromContractNumber(contractNumber) {
  const segments = String(contractNumber || '').split('/');
  const dateSegments = segments.slice(-3);

  if (
    dateSegments.length !== 3 ||
    !/^\d{1,2}$/.test(dateSegments[0]) ||
    !/^\d{1,2}$/.test(dateSegments[1]) ||
    !/^\d{4}$/.test(dateSegments[2])
  ) {
    throw new Error(`Numer umowy nie zawiera daty w formacie dzień/miesiąc/rok: ${contractNumber || '(brak numeru)'}`);
  }

  const [day, month, year] = dateSegments.map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new Error(`Końcówka numeru umowy nie tworzy poprawnej daty: ${dateSegments.join('/')}`);
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Extracts annex 26 source data from the locally-read contract text. */
export function extractAnnex26Contract(text) {
  const flat = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const amount = label => cents(first(flat, [new RegExp(`${label}[^\\d]{0,40}([\\d ]+(?:[,.]\\d{1,2})?)\\s*(?:zł|PLN)`, 'i')]));
  const number = label => first(flat, [new RegExp(`${label}[^\\d]{0,30}(\\d+)`, 'i')]);
  const contractNumber = first(flat, [/(?:numer|nr)\s+umowy\s*[:#]?\s*([A-Z0-9/_-]+)/i, /umow[ay]\s+nr\s*([A-Z0-9/_-]+)/i]);

  const paidInstallments = number('(?:liczba rat już opłaconych|numer aktualnej raty|opłacono rat)');
  return {
    contractNumber,
    agreementDate: extractAgreementDateFromContractNumber(contractNumber),
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
