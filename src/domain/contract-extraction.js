/** Extracts the agreement number printed after "nr" in the contract heading. */
export function extractAgreementNumber(text) {
  const heading = String(text || '').replace(/\u00a0/g, ' ').slice(0, 4000);
  return heading.match(/\bnr(?:\s+umowy)?\s*[:#]?\s*([A-Z0-9_-]+(?:\/[A-Z0-9_-]+)+)/i)?.[1];
}

const capture = (text, pattern) => text.match(pattern)?.[1]?.trim();

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

const AGREEMENT_DATE_AT_END = /\/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;

/** Extracts the contract date solely from the day/month/year suffix of the agreement number. */
export function extractAgreementDate(agreementNumber) {
  const normalizedAgreementNumber = String(agreementNumber).trim().normalize('NFC').replace(/\u00a0|\u202f/g, ' ');
  const match = normalizedAgreementNumber.match(AGREEMENT_DATE_AT_END);
  if (!match) {
    console.warn('[Data umowy] Nie odczytano daty z końca numeru umowy.', {
      normalizedAgreementNumber,
      last40Characters: normalizedAgreementNumber.slice(-40),
      endingDatePatternFound: false
    });
    return undefined;
  }
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (day < 1 || day > 31 || month < 1 || month > 12
    || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    console.warn('[Data umowy] Końcowy wzorzec daty nie jest poprawną datą kalendarzową.', {
      normalizedAgreementNumber,
      last40Characters: normalizedAgreementNumber.slice(-40),
      endingDatePatternFound: true
    });
    return undefined;
  }
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

/**
 * Extracts the basic data from the one currently supported contract layout.
 * Annex modules receive this result and must not parse these fields from raw text.
 */
export function extractContractData(rawText, agreementNumber = extractAgreementNumber(rawText)) {
  const text = normalizeContractText(rawText);
  const buyer = capture(text, /dane nabywcy\s+(.+?)(?=\s+specyfikacja kursu\b)/i) || '';
  const specification = capture(text, /specyfikacja kursu\s+(.+?)(?=\s+zawartość kursu\b)/i) || '';
  const { coursePriceCents, diagnostic: coursePriceDiagnostic } = extractCoursePrice(text);
  const coursePrice = Number.isInteger(coursePriceCents) ? coursePriceCents / 100 : undefined;
  // Read the longer label first so it can never be confused with the lesson-count label.
  const monthlyLimit = Number(capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:\s*(\d+)/i)) || undefined;
  const lessonCount = Number(capture(specification, /liczba lekcji indywidualnych\s*:\s*(\d+)/i)) || undefined;
  const courseStartDate = capture(specification, /data rozpoczęcia kursu\s*:\s*(\d{1,2}[-.]\d{1,2}[-.]\d{4})/i);
  const bankAccount = capture(text, /(?:numer(?:ze)? rachunku|rachunek bankowy(?: tutlo)?)\s*(?:nr|:)?\s*([\d ]{26,40})/i)?.replace(/\s/g, '');

  // Some agreements print every due date, while §2 of the 24-installment variant
  // defines the first payment and then 23 payments on the same day of successive months.
  const printedDueDates = [...text.matchAll(/(?:termin(?:em)?|płatn\w*|rata\w*)[^.]{0,80}?(\d{1,2}[.-]\d{1,2}[.-]\d{4})/gi)]
    .map(match => match[1]);

  return {
    agreementNumber,
    agreementDate: extractAgreementDate(agreementNumber),
    customerName: capture(buyer, /imię i nazwisko\s*:\s*(.+?)(?=\s+adres\s*:)/i),
    address: capture(buyer, /adres\s*:\s*(.+?)(?=\s+(?:PESEL|NIP)\s*:)/i),
    pesel: capture(buyer, /(?:PESEL|NIP)\s*:\s*([\d-]+)\b/i),
    coursePrice: Number.isFinite(coursePrice) ? coursePrice : undefined,
    coursePriceCents,
    coursePriceDiagnostic,
    monthlyInstallment: Number.isFinite(coursePrice) ? Math.round((coursePrice / 24) * 100) / 100 : undefined,
    ...(/kolejn(?:ych|e)\s+23\s+rat/i.test(text) ? { installmentCount: 24 } : {}),
    ...(printedDueDates.length ? { installmentDueDates: printedDueDates } : {}),
    ...(courseStartDate ? { courseStartDate } : {}),
    ...(bankAccount?.length === 26 ? { bankAccount } : {}),
    lessonCount,
    monthlyLimit,
    teacherTypes: extractTeacherTypes(text)
  };
}
