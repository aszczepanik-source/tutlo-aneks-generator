/** Canonical contract enums. Values are persisted and must not be UI labels. */
export const CONTRACT_TYPES = Object.freeze(['flexible', 'limit']);
export const PAYMENT_TYPES = Object.freeze(['credit', 'internal']);
export const PAYMENT_VARIANTS = Object.freeze(['credit', 'internal_24', 'internal_2', 'internal_13', 'internal_4']);
export const CUSTOMER_TYPES = Object.freeze(['person', 'company']);
export const TEACHER_VARIANTS = Object.freeze(['polish_english_native', 'english_native']);

export function normalizeContractText(rawText) {
  return String(rawText || '').normalize('NFC').replace(/\u00a0|\u202f/g, ' ')
    .replace(/[–—]/g, '-').replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const capture = (text, pattern) => text.match(pattern)?.[1]?.trim();
const digits = value => value?.replace(/\D/g, '');
const isoDate = printed => {
  const match = String(printed || '').match(/^(\d{1,2})[.-](\d{1,2})[.-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d, 12));
  return date.getUTCFullYear() === +y && date.getUTCMonth() === +m - 1 && date.getUTCDate() === +d
    ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null;
};

export function extractAgreementNumber(rawText) {
  const heading = normalizeContractText(rawText).slice(0, 4000).replace(/\s*\/\s*/g, '/');
  return heading.match(/\bUMOWA\b.{0,300}?\bnr(?:\s+umowy)?\s*[:#]?\s*(EL\/[A-ZĄĆĘŁŃÓŚŹŻ]{1,10}\/\d+\/\d+\/\d{1,2}\/\d{1,2}\/\d{4})(?=\s|$|[.,;:])/iu)?.[1];
}

export function parseAgreementDateFromNumber(number) {
  const match = String(number || '').match(/\/(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? isoDate(`${match[1]}.${match[2]}.${match[3]}`) : null;
}
export const extractAgreementDate = parseAgreementDateFromNumber;

export const INTERNAL_INSTALLMENT_ACCOUNT_LABEL = 'rachunek bankowy Tutlo';
export function extractInternalInstallmentAccount(rawText) {
  const match = normalizeContractText(rawText).match(/\brachunek\s+bankowy\s+Tutlo\b\s*:\s*mBank\s+S\.A\.\s*((?:\d[\s-]*){26})(?![\s-]*\d)/iu);
  const account = digits(match?.[1]);
  return /^\d{26}$/.test(account || '') ? account : null;
}

export function extractCoursePrice(rawText) {
  const text = normalizeContractText(rawText);
  const match = text.match(/całkowita\s+cena\s+kursu\s+wynosi\s+(\d{1,3}(?:[ .]\d{3})+|\d+)[,.](\d{2})(?=\s*zł)/iu);
  if (!match) return { coursePriceCents: null };
  const value = Number(`${match[1].replace(/[ .]/g, '')}${match[2]}`);
  return { coursePriceCents: Number.isSafeInteger(value) && value > 0 ? value : null };
}

function classify(text) {
  const lower = text.toLocaleLowerCase('pl');
  const contractType = /niewykorzystane lekcje .* nie przechodzą|zasady korzystania z lekcji/u.test(lower)
    ? 'limit' : /elastyczn(?:y|a).*kurs|lekcje indywidualne w różnej intensywności/u.test(lower) ? 'flexible' : null;
  const credit = /raty 0% przy wykorzystaniu kredytu konsumenckiego|forma płatności:\s*raty 0%|kredyt(?:u|em)?|pożyczk/u.test(lower);
  const internal = /rachunek bankowy tutlo|rat(?:y|ach) wewnętrzn|kolejn(?:ych|e)\s+\d+\s+rat|płatność następuje w/u.test(lower);
  const paymentType = credit ? 'credit' : internal ? 'internal' : null;
  let paymentVariant = paymentType === 'credit' ? 'credit' : null;
  if (paymentType === 'internal') {
    if (/kolejn(?:ych|e)\s+23\s+rat|24\s+(?:równych\s+)?rat/u.test(lower)) paymentVariant = 'internal_24';
    else if (/pierwsz(?:y rok|a płatność|a rata).*z góry.{0,180}(?:12\s+rat|drugi rok)|13\s+(?:rat|płatności)/u.test(lower)) paymentVariant = 'internal_13';
    else if (/płatność następuje w\s*2\s+równych ratach|\b2\s+raty\b/u.test(lower)) paymentVariant = 'internal_2';
    else if (/płatność następuje w\s*4\s+równych ratach|\b4\s+raty\b/u.test(lower)) paymentVariant = 'internal_4';
  }
  return { contractType, paymentType, paymentVariant };
}

function buyerData(text) {
  const buyer = text.match(/dane\s+nabywcy\b\s*:?\s*(.*?)(?=\s+(?:specyfikacja(?:\s+kursu)?|zawartość\s+kursu|warunki\s+płatności)\b|$)/iu)?.[1] || '';
  const end = String.raw`(?=\s+(?:imię\s+i\s+nazwisko|firma|adres|telefon|e-?mail|PESEL|NIP)\s*:?(?:\s|$)|$)`;
  const personName = capture(buyer, new RegExp(String.raw`imię\s+i\s+nazwisko\s*:?\s*(.+?)${end}`, 'iu'));
  const companyName = capture(buyer, new RegExp(String.raw`firma\s*:?\s*(.+?)${end}`, 'iu'));
  const pesel = digits(buyer.match(/(?:^|\s)PESEL\b\s*:?\s*((?:\d[\s-]*){11})(?![\s-]*\d)/iu)?.[1]);
  const nip = digits(buyer.match(/(?:^|\s)NIP\b\s*:?\s*((?:\d[\s-]*){10})(?![\s-]*\d)/iu)?.[1]);
  const customerType = companyName || nip ? 'company' : personName || pesel ? 'person' : null;
  return {
    customerType,
    customerName: customerType === 'company' ? companyName || null : personName || null,
    personalId: customerType === 'company' ? nip || null : pesel || null,
    address: capture(buyer, /adres\s*:\s*(.+?)(?=\s+(?:telefon|e-?mail|PESEL|NIP)\s*:|$)/iu) || null
  };
}

function teacherVariant(text) {
  const section = capture(text, /zawartość kursu\s+(.+?)(?=\s+(?:warunki płatności|całkowita cena kursu)\b)/iu) || '';
  const englishNative = /english\s+expert/iu.test(section) && /native\s+speaker/iu.test(section);
  if (!englishNative) return null;
  return /lektor(?:em)?\s+polsk/iu.test(section) ? 'polish_english_native' : 'english_native';
}

function installmentPlan(text, paymentVariant, coursePriceCents, startDate) {
  const paymentCount = { internal_24: 24, internal_2: 2, internal_13: 13, internal_4: 4 }[paymentVariant] || null;
  const dueDates = [...text.matchAll(/(?:termin(?:em)?|płatn\w*|rata\w*)[^.]{0,80}?(\d{1,2}[.-]\d{1,2}[.-]\d{4})/giu)]
    .map(match => isoDate(match[1])).filter(Boolean);
  return paymentCount ? {
    paymentCount,
    installments: dueDates.map((dueDate, index) => ({ number: index + 1, dueDate, amountCents: null })),
    startDate,
    totalAmountCents: coursePriceCents
  } : null;
}

/** The only parser entry point. It receives PDF text once and returns the canonical DTO. */
export function parseCurrentContract(rawText) {
  const text = normalizeContractText(rawText);
  const agreementNumber = extractAgreementNumber(text) || null;
  const { contractType, paymentType, paymentVariant } = classify(text);
  const { coursePriceCents } = extractCoursePrice(text);
  const specification = capture(text, /specyfikacja kursu\s+(.+?)(?=\s+zawartość kursu\b)/iu) || '';
  const lessonCount = Number(capture(specification, /liczba lekcji indywidualnych\s*:\s*(\d+)/iu)) || null;
  const monthlyLessonLimit = Number(capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:\s*(\d+)/iu)) || null;
  const startDate = isoDate(capture(specification, /data rozpoczęcia kursu\s*:\s*(\d{1,2}[.-]\d{1,2}[.-]\d{4})/iu));
  return Object.freeze({
    rawText: String(rawText || ''), contractType, paymentType, paymentVariant,
    agreementNumber, agreementDate: parseAgreementDateFromNumber(agreementNumber),
    ...buyerData(text), coursePriceCents, lessonCount, monthlyLessonLimit,
    teacherVariant: teacherVariant(text), internalPaymentAccount: extractInternalInstallmentAccount(text),
    installmentPlan: installmentPlan(text, paymentVariant, coursePriceCents, startDate)
  });
}

// Temporary public compatibility name. It returns the canonical model, never aliases.
export const extractContractData = parseCurrentContract;
