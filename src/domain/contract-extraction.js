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
  return String(rawText || '').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extracts the contract date from the final day/month/year agreement-number segments. */
export function extractAgreementDate(agreementNumber) {
  const parts = String(agreementNumber || '').split('/').slice(-3);
  if (parts.length !== 3 || !parts.every((part, index) => new RegExp(index === 2 ? '^\\d{4}$' : '^\\d{1,2}$').test(part))) {
    return undefined;
  }
  const [day, month, year] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
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
  const amount = capture(text, /całkowita cena kursu wynosi\s+([\d ]+(?:,\d{1,2})?)\s*zł\s+brutto/i);
  const coursePrice = amount === undefined ? undefined : Number(amount.replace(/\s/g, '').replace(',', '.'));
  // Read the longer label first so it can never be confused with the lesson-count label.
  const monthlyLimit = Number(capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:\s*(\d+)/i)) || undefined;
  const lessonCount = Number(capture(specification, /liczba lekcji indywidualnych\s*:\s*(\d+)/i)) || undefined;

  return {
    agreementNumber,
    agreementDate: extractAgreementDate(agreementNumber),
    customerName: capture(buyer, /imię i nazwisko\s*:\s*(.+?)(?=\s+adres\s*:)/i),
    address: capture(buyer, /adres\s*:\s*(.+?)(?=\s+(?:PESEL|NIP)\s*:)/i),
    pesel: capture(buyer, /(?:PESEL|NIP)\s*:\s*([\d-]+)\b/i),
    coursePrice: Number.isFinite(coursePrice) ? coursePrice : undefined,
    monthlyInstallment: Number.isFinite(coursePrice) ? Math.round((coursePrice / 24) * 100) / 100 : undefined,
    lessonCount,
    monthlyLimit,
    teacherTypes: extractTeacherTypes(text)
  };
}
