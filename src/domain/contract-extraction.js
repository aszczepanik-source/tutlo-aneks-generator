/** Extracts the agreement number printed after "nr" in the contract heading. */
export function extractAgreementNumber(text) {
  const heading = String(text || '')
    .slice(0, 4000)
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');
  const agreementNumberPattern = /\bUMOWA\b.{0,300}?\bnr(?:\s+umowy)?\s*[:#]?\s*(EL\/[A-ZĄĆĘŁŃÓŚŹŻ](?:\s*[A-ZĄĆĘŁŃÓŚŹŻ]){0,9}\/\d+\/\d+\/\d{1,2}\/\d{1,2}\/\d{4})(?=\s|$|[.,;:])/iu;
  return heading.match(agreementNumberPattern)?.[1].replace(/\s/g, '');
}

const capture = (text, pattern) => text.match(pattern)?.[1]?.trim();

const BUYER_FIELD_END = String.raw`(?=\s+(?:imię\s+i\s+nazwisko|firma|adres|telefon|e-?mail|PESEL|NIP)\s*:?(?:\s|$)|$)`;

/** Reads identity fields exclusively from the DANE NABYWCY table. */
function extractBuyerData(buyer) {
  const companyName = capture(buyer, new RegExp(String.raw`firma\s*:?\s*(.+?)${BUYER_FIELD_END}`, 'i'));
  // The PDF text layer may separate the label, optional colon and value into
  // different items. At this point those item boundaries are whitespace, so
  // read only the digit/space/hyphen run immediately following the buyer's NIP
  // label. In particular, never search the seller/header part of the document.
  const nipMatch = buyer.match(/(?:^|\s)NIP\b\s*:?\s*([\d][\d\s-]*)/i);
  const nipLabelFound = /(?:^|\s)NIP\b/i.test(buyer);
  const nip = nipMatch?.[1].trim().replace(/[\s-]/g, '');
  const nipDiagnostic = {
    labelFound: nipLabelFound,
    normalizedLength: nip?.length || 0,
    isExactly10Digits: /^\d{10}$/.test(nip || '')
  };

  const customerName = capture(buyer, new RegExp(String.raw`imię\s+i\s+nazwisko\s*:?\s*(.+?)${BUYER_FIELD_END}`, 'i'));
  const rawPesel = capture(buyer, /(?:^|\s)PESEL\s*:?\s*([\d\s]+?)(?=\s+(?:imię\s+i\s+nazwisko|firma|adres|telefon|e-?mail|NIP)\s*:?(?:\s|$)|$)/i);
  const pesel = rawPesel?.replace(/\s/g, '');
  const personComplete = customerName !== undefined && /^\d{11}$/.test(pesel || '');
  const companyComplete = companyName !== undefined && nipDiagnostic.isExactly10Digits;

  if (companyName !== undefined || nipLabelFound) {
    // Deliberately contains neither the NIP nor any other buyer data.
    console.info('[NIP nabywcy diagnostic]', nipDiagnostic);
  }
  if (personComplete && companyComplete) return {
    customerDiagnostic: 'Sekcja DANE NABYWCY zawiera jednocześnie komplet danych osoby fizycznej i firmy.'
  };
  if (personComplete) return { customerName, pesel, customerType: 'person' };
  if (companyComplete) return { customerName: companyName, pesel: nip, customerType: 'company' };

  const personLabelFound = /(?:^|\s)imię\s+i\s+nazwisko\s*:?\s/i.test(buyer);
  const peselLabelFound = /(?:^|\s)PESEL\s*:?\s/i.test(buyer);
  const companyLabelFound = /(?:^|\s)firma\s*:?\s/i.test(buyer);
  let customerDiagnostic = 'Nie odczytano kompletnych danych nabywcy w sekcji DANE NABYWCY.';
  if (personLabelFound && !customerName) customerDiagnostic = 'Nie odczytano imienia i nazwiska.';
  else if (personLabelFound && !/^\d{11}$/.test(pesel || '')) customerDiagnostic = 'Nie odczytano numeru PESEL.';
  else if (peselLabelFound) customerDiagnostic = 'Nie odczytano imienia i nazwiska.';
  else if (companyLabelFound && !companyName) customerDiagnostic = 'Nie odczytano nazwy firmy.';
  else if (companyLabelFound && !nipDiagnostic.isExactly10Digits) customerDiagnostic = 'Nie odczytano NIP firmy.';
  else if (nipLabelFound) customerDiagnostic = 'Nie odczytano nazwy firmy.';
  return { customerDiagnostic };
}

const TEACHER_TYPE_PHRASES = [
  ['Lektorem Polskim', 'Lektor Polski'],
  ['English Expert', 'English Expert'],
  ['Native Speaker', 'Native Speaker']
];

/** Reads only the selected teacher labels printed in the course-content section. */
function extractTeacherTypes(text) {
  const contents = capture(text, /zawartość kursu\s+(.+?)(?=\s+(?:warunki płatności|całkowita cena kursu)\b)/i);
  if (contents === undefined) return 'Nie odczytano typów lektorów.';

  const selectedTypes = TEACHER_TYPE_PHRASES
    .filter(([phrase]) => contents.includes(phrase))
    .map(([, teacherType]) => teacherType);
  return selectedTypes.length > 0 ? selectedTypes.join(', ') : undefined;
}

/** Normalizes whitespace introduced while PDF.js combines text items and lines. */
export function normalizeContractText(rawText) {
  return String(rawText || '').replace(/\u00a0|\u202f/g, ' ').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const COURSE_PRICE_PHRASE = 'Całkowita cena kursu wynosi';

// This is the label used by internal-installment agreements. Keep this
// deliberately narrower than a generic "numer rachunku" search: credit
// agreements can contain a lender's account which is not Tutlo's payment
// account.
export const INTERNAL_INSTALLMENT_ACCOUNT_LABEL = 'rachunek bankowy Tutlo';

const ACCOUNT_DIAGNOSTIC_TERMS = [
  'numer rachunku', 'nr rachunku', 'rachunek', 'konto', 'wpłaty', 'płatność'
];

/**
 * Returns focused payment-text diagnostics. Callers can display this only in a
 * controlled diagnostic flow; the extractor itself never logs contract text.
 */
export function getInternalPaymentAccountDiagnostic(text) {
  const source = String(text || '').replace(/\u00a0|\u202f/g, ' ');
  const occurrences = [];
  for (const term of ACCOUNT_DIAGNOSTIC_TERMS) {
    const pattern = new RegExp(term.replace(/ /g, String.raw`\s+`), 'giu');
    for (const match of source.matchAll(pattern)) {
      occurrences.push({
        term,
        context: source.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120)
      });
    }
  }
  const possible26DigitSequences = [...source.matchAll(/(?<!\d)(?:\d[\s-]*){26}(?![\s-]*\d)/g)]
    .map(match => ({ raw: match[0], normalized: match[0].replace(/[\s-]/g, '') }));
  return { occurrences, possible26DigitSequences };
}

/** Reads and normalizes the Tutlo account printed in the payment conditions. */
export function extractInternalInstallmentAccount(text) {
  const normalizedText = normalizeContractText(text);
  const labelPattern = INTERNAL_INSTALLMENT_ACCOUNT_LABEL.replace(/ /g, String.raw`\s+`);
  const match = normalizedText.match(new RegExp(
    // In the contract the bank name is printed between the account label and
    // its number: "rachunek bankowy Tutlo: mBank S.A. <26 digits>".
    String.raw`\b${labelPattern}\b\s*:\s*mBank\s+S\.A\.\s*((?:\d[\s-]*){26})(?![\s-]*\d)`,
    'iu'
  ));
  const account = match?.[1].replace(/[\s-]/g, '');
  return /^\d{26}$/.test(account || '') ? account : undefined;
}

/** Reads only the first monetary value directly following the contractual course-price phrase. */
export function extractCoursePrice(text) {
  const phraseIndex = text.toLocaleLowerCase('pl').indexOf(COURSE_PRICE_PHRASE.toLocaleLowerCase('pl'));
  const followingText = phraseIndex < 0 ? '' : text.slice(phraseIndex + COURSE_PRICE_PHRASE.length).trimStart();
  const amount = followingText.match(/^(\d{1,3}(?:[ .]\d{3})+|\d+)([,.])(\d{2})(?=\s*zł(?:\s|[.,;:]|$))/i);
  if (!amount) return { coursePriceCents: undefined, diagnostic: {
    phraseFound: phraseIndex >= 0, followingText: followingText.slice(0, 80), valuePassedToPrepareAnnex26: undefined
  } };
  const whole = amount[1].replace(/[ .]/g, '');
  const coursePriceCents = Number(`${whole}${amount[3]}`);
  return { coursePriceCents: Number.isSafeInteger(coursePriceCents) && coursePriceCents > 0 ? coursePriceCents : undefined,
    diagnostic: { phraseFound: true, followingText: followingText.slice(0, 80), valuePassedToPrepareAnnex26: coursePriceCents } };
}

const AGREEMENT_DATE_PATTERN = /\/(\d{1,2})\/(\d{1,2})\/(\d{4})/g;

/** Produces the exact, stable representation used by agreement-date matching. */
export function normalizeAgreementNumber(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\p{Zs}\r\n\t]/gu, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

/** Returns non-personal diagnostics suitable for the temporary date-error UI. */
export function getAgreementDateDiagnostic(agreementNumber) {
  const normalizedAgreementNumber = normalizeAgreementNumber(agreementNumber);
  const matches = [...normalizedAgreementNumber.matchAll(AGREEMENT_DATE_PATTERN)];
  return {
    last60Characters: JSON.stringify(String(agreementNumber ?? '').slice(-60)),
    endingDatePatternFound: matches.length > 0,
    normalizedAgreementNumber
  };
}

/** Extracts the contract date solely from the day/month/year suffix of the agreement number. */
export function parseAgreementDateFromNumber(agreementNumber) {
  const normalizedAgreementNumber = normalizeAgreementNumber(agreementNumber);
  const matches = [...normalizedAgreementNumber.matchAll(AGREEMENT_DATE_PATTERN)];
  const match = matches.at(-1);
  if (!match) {
    // Kept only on the exceptional path and deliberately limited to the agreement
    // number: no customer data or other contract contents are emitted.
    console.log('[agreement date diagnostic]', {
      rawAgreementNumber: agreementNumber,
      jsonAgreementNumber: JSON.stringify(agreementNumber),
      normalizedAgreementNumber,
      length: String(agreementNumber ?? '').length,
      charCodes: Array.from(String(agreementNumber ?? '')).map(char => char.codePointAt(0)),
      last60Characters: JSON.stringify(String(agreementNumber ?? '').slice(-60))
    });
    console.warn('[Data umowy] Nie odczytano prawidłowej daty z numeru umowy.');
    return undefined;
  }
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (day < 1 || day > 31 || month < 1 || month > 12
    || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    console.warn('[Data umowy] Końcowy wzorzec daty nie jest poprawną datą kalendarzową.', {
      ...getAgreementDateDiagnostic(agreementNumber)
    });
    return undefined;
  }
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

// Preserve the existing public name for callers outside the current-contract flow.
export const extractAgreementDate = parseAgreementDateFromNumber;

/**
 * Extracts the basic data from the one currently supported contract layout.
 * Annex modules receive this result and must not parse these fields from raw text.
 */
export function extractContractData(rawText, agreementNumber = extractAgreementNumber(rawText)) {
  const text = normalizeContractText(rawText);
  const buyer = capture(text, /dane nabywcy\s+(.+?)(?=\s+specyfikacja kursu\b)/i) || '';
  const buyerData = extractBuyerData(buyer);
  const specification = capture(text, /specyfikacja kursu\s+(.+?)(?=\s+zawartość kursu\b)/i) || '';
  const { coursePriceCents, diagnostic: coursePriceDiagnostic } = extractCoursePrice(text);
  const coursePrice = Number.isInteger(coursePriceCents) ? coursePriceCents / 100 : undefined;
  // Read the longer label first so it can never be confused with the lesson-count label.
  const monthlyLimit = Number(capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:\s*(\d+)/i)) || undefined;
  const lessonCount = Number(capture(specification, /liczba lekcji indywidualnych\s*:\s*(\d+)/i)) || undefined;
  const courseStartDate = capture(specification, /data rozpoczęcia kursu\s*:\s*(\d{1,2}[-.]\d{1,2}[-.]\d{4})/i);
  const internalPaymentAccount = extractInternalInstallmentAccount(text);

  // Some agreements print every due date, while §2 of the 24-installment variant
  // defines the first payment and then 23 payments on the same day of successive months.
  const printedDueDates = [...text.matchAll(/(?:termin(?:em)?|płatn\w*|rata\w*)[^.]{0,80}?(\d{1,2}[.-]\d{1,2}[.-]\d{4})/gi)]
    .map(match => match[1]);

  return {
    agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber),
    ...buyerData,
    address: capture(buyer, /adres\s*:\s*(.+?)(?=\s+(?:telefon|e-?mail|PESEL|NIP)\s*:|$)/i),
    coursePrice: Number.isFinite(coursePrice) ? coursePrice : undefined,
    coursePriceCents,
    coursePriceDiagnostic,
    monthlyInstallment: Number.isFinite(coursePrice) ? Math.round((coursePrice / 24) * 100) / 100 : undefined,
    ...(/kolejn(?:ych|e)\s+23\s+rat/i.test(text) ? { installmentCount: 24 } : {}),
    ...(printedDueDates.length ? { installmentDueDates: printedDueDates } : {}),
    ...(courseStartDate ? { courseStartDate } : {}),
    ...(internalPaymentAccount?.length === 26 ? { internalPaymentAccount } : {}),
    lessonCount,
    monthlyLimit,
    teacherTypes: extractTeacherTypes(text)
  };
}
