const capture = (text, pattern) => text.match(pattern)?.[1]?.trim();

export const CURRENT_CONTRACT_FIELDS = Object.freeze([
  'rawText', 'contractType', 'paymentType', 'paymentVariant', 'agreementNumber',
  'agreementDate', 'customerType', 'customerName', 'personalId', 'address',
  'coursePriceCents', 'lessonCount', 'monthlyLessonLimit', 'teacherVariant',
  'internalPaymentAccount', 'installmentPlan'
]);
export const CONTRACT_TYPES = Object.freeze(['flexible', 'limit']);
export const PAYMENT_TYPES = Object.freeze(['credit', 'internal']);
export const PAYMENT_VARIANTS = Object.freeze(['credit', 'internal_24', 'internal_2', 'internal_13', 'internal_4']);
export const TEACHER_VARIANTS = Object.freeze(['polish_english_native', 'english_native']);

// Parser i schemat currentContract są zamrożone. Zmiana wymaga jawnej migracji wszystkich konsumentów.

export function normalizeContractText(rawText) {
  return String(rawText || '').normalize('NFC').replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractAgreementNumber(rawText) {
  const text = normalizeContractText(rawText).replace(/\s*\/\s*/g, '/').slice(0, 5000);
  return text.match(/\bUMOWA\b.{0,300}?\bnr(?:\s+umowy)?\s*[:#]?\s*(EL\/[A-ZĄĆĘŁŃÓŚŹŻ]+(?:\/\d+){5})(?=\s|$|[.,;:])/iu)?.[1];
}

export function parseAgreementDateFromNumber(number) {
  const match = String(number || '').match(/\/(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)) return undefined;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
export const extractAgreementDate = parseAgreementDateFromNumber;

function buyerData(text) {
  const section = capture(text, /dane\s+nabywcy\b\s*:?\s*(.*?)(?=\s+(?:specyfikacja(?:\s+kursu)?|zawartość\s+kursu|warunki\s+płatności)\b|$)/iu) || '';
  const boundary = String.raw`(?=\s+(?:imię\s+i\s+nazwisko|firma|adres|telefon|e-?mail|PESEL|NIP)\s*:?(?:\s|$)|$)`;
  const personName = capture(section, new RegExp(String.raw`imię\s+i\s+nazwisko\s*:?\s*(.+?)${boundary}`, 'iu'));
  const companyName = capture(section, new RegExp(String.raw`firma\s*:?\s*(.+?)${boundary}`, 'iu'));
  const pesel = section.match(/(?:^|\s)PESEL\b\s*:?\s*((?:\d[\s\p{Cf}]*){11})(?![\s\p{Cf}]*\d)/iu)?.[1]?.replace(/[\s\p{Cf}]/gu, '');
  const nip = section.match(/(?:^|\s)NIP\b\s*:?\s*((?:\d[\s\p{Cf}-]*){10})(?![\s\p{Cf}-]*\d)/iu)?.[1]?.replace(/[\s\p{Cf}-]/gu, '');
  const personComplete = Boolean(personName && /^\d{11}$/.test(pesel || ''));
  const companyComplete = Boolean(companyName && /^\d{10}$/.test(nip || ''));
  const identity = personComplete && !companyComplete
    ? { customerType: 'person', customerName: personName, personalId: pesel }
    : companyComplete && !personComplete
      ? { customerType: 'company', customerName: companyName, personalId: nip }
      : { customerType: undefined, customerName: personName || companyName, personalId: pesel || nip };
  return { ...identity, address: capture(section, new RegExp(String.raw`adres\s*:?\s*(.+?)${boundary}`, 'iu')) };
}

function paymentSection(text) {
  const heading = /(?:warunki|forma|harmonogram)\s+płatności\b/giu;
  const starts = [...text.matchAll(heading)].map(match => match.index);
  if (!starts.length) return '';
  const start = Math.min(...starts);
  const followingSection = text.slice(start + 1).search(/\s(?:dane\s+nabywcy|specyfikacja(?:\s+kursu)?|zawartość\s+kursu|postanowienia\s+końcowe|podpisy)\b/iu);
  return text.slice(start, followingSection < 0 ? Math.min(text.length, start + 8000) : start + 1 + followingSection);
}

function classifyContract(text) {
  const contractType = /niewykorzystane lekcje.{0,100}nie przechodzą|zasady korzystania z lekcji/iu.test(text)
    ? 'limit' : /elastyczny kurs językowy|lekcje indywidualne w różnej intensywności/iu.test(text) ? 'flexible' : undefined;
  const section = paymentSection(text);
  const credit = /raty\s+0%|kredyt\w*|pożyczk\w*|kredytodawc\w*|instytucj\w*\s+finansując\w*|finansowan\w*.{0,60}\bbank\w*|\bbank\w*.{0,60}finansowan\w*|raty\s+kredytow\w*/iu.test(section);
  const internal = /rachunek(?:\s+bankowy)?\s+tutlo|rat(?:a|y|ach)\s+wewnętrzn\w*|harmonogram(?:u|em)?\s+(?:rat|płatności)\s+wewnętrzn\w*|płatnoś\w*.{0,80}bezpośrednio.{0,80}(?:tutlo|rachunek)/iu.test(section);
  const paymentType = credit ? 'credit' : internal ? 'internal' : undefined;
  let paymentVariant;
  let matchedRule = 'unrecognized';
  if (paymentType === 'credit') {
    paymentVariant = 'credit';
    matchedRule = 'credit-financing-in-payment-section';
  } else if (paymentType === 'internal') {
    if (/pierwsz\w*\s+rok\w*.{0,80}(?:z\s+góry|jednorazow\w*).{0,240}(?:drugi\w*\s+rok\w*.{0,100})?(?:12|dwanaście)\s+(?:miesięczn\w*\s+)?rat/iu.test(section)) {
      paymentVariant = 'internal_13'; matchedRule = 'internal-first-year-plus-12';
    } else if (/kolejn(?:ych|e)\s+23\s+(?:miesięczn\w*\s+)?(?:rat|płatności)|24\s+(?:miesięczn\w*\s+)?(?:rat|płatności)/iu.test(section)) {
      paymentVariant = 'internal_24'; matchedRule = 'internal-24-monthly';
    } else if (/(?:liczba\s+rat\s*:?\s*|płatność\s+następuje\s+w\s*|raty\s+wewnętrzne.{0,40}?\s+w\s*|harmonogram.{0,60})2\s+(?:równych\s+)?(?:ratach?|płatnościach?)/iu.test(section)) {
      paymentVariant = 'internal_2'; matchedRule = 'internal-2-payments';
    } else if (/(?:liczba\s+rat\s*:?\s*|płatność\s+następuje\s+w\s*|raty\s+wewnętrzne.{0,40}?\s+w\s*|harmonogram.{0,60})4\s+(?:równych\s+)?(?:ratach?|płatnościach?)/iu.test(section)) {
      paymentVariant = 'internal_4'; matchedRule = 'internal-4-payments';
    } else matchedRule = 'internal-without-recognized-schedule';
  }
  return { contractType, paymentType, paymentVariant, matchedRule };
}

function extractTeacherVariant(text) {
  // Teacher names elsewhere in an agreement describe neither the purchased course nor its variant.
  // Keep this deliberately section-scoped: the supported layouts put payment details immediately next.
  const contents = capture(text,
    /zawarto(?:ść|sc)\s+kursu\b\s*:?[\s-]*(.*?)(?=\s+(?:(?:warunki|forma|harmonogram)\s+płatności|całkowita\s+cena\s+kursu|postanowienia\s+końcowe|podpisy)\b|$)/iu) || '';
  const polish = /(?:lektor\p{L}*\s+polsk\p{L}*|polsk\p{L}*\s+lektor\p{L}*)/iu.test(contents);
  const english = /english\s+expert\p{L}*/iu.test(contents);
  const native = /native\s+speaker\p{L}*/iu.test(contents);
  if (polish && english && native) return 'polish_english_native';
  if (!polish && english && native) return 'english_native';
  return undefined;
}

function extractPriceCents(text) {
  const value = text.match(/całkowita cena kursu(?:\s+wynosi)?\s*:?\s*(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})\s*zł/iu);
  return value ? Number(`${value[1].replace(/[ .]/g, '')}${value[2]}`) : undefined;
}

export function extractInternalInstallmentAccount(text) {
  const value = normalizeContractText(text).match(/rachunek bankowy Tutlo\s*:?\s*(?:mBank\s+S\.A\.\s*)?((?:\d[\s-]*){26})(?![\s-]*\d)/iu)?.[1]?.replace(/[\s-]/g, '');
  return /^\d{26}$/.test(value || '') ? value : undefined;
}

const isoDate = value => {
  const match = value.match(/(\d{1,2})[.-](\d{1,2})[.-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return parseAgreementDateFromNumber(`EL/X/0/0/${day}/${month}/${year}`) || null;
};
const amountCents = value => {
  const match = value?.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})\s*zł/iu);
  return match ? Number(`${match[1].replace(/[ .]/g, '')}${match[2]}`) : null;
};

function extractInstallmentPlan(text, variant) {
  const count = { internal_24: 24, internal_13: 13, internal_2: 2, internal_4: 4 }[variant];
  if (!count) return undefined;
  const rows = [...text.matchAll(/(?:rata\s*(?:nr\s*)?(\d+)|(?:termin|płatność)\s*(?:nr\s*)?(\d+)?)[^.;]{0,130}?(\d{1,2}[.-]\d{1,2}[.-]\d{4})([^.;]{0,80})/giu)]
    .map((match, index) => ({ number: Number(match[1] || match[2]) || index + 1,
      dueDate: isoDate(match[3]), amountCents: amountCents(match[4]), type: 'internal' }));
  const byNumber = new Map(rows.filter(row => row.number <= count).map(row => [row.number, row]));
  return Array.from({ length: count }, (_, index) => byNumber.get(index + 1)
    || { number: index + 1, dueDate: null, amountCents: null, type: 'internal' });
}

/** The only raw-text parser. Annexes receive currentContract and must not inspect rawText. */
export function parseCurrentContract(rawText) {
  const text = normalizeContractText(rawText);
  const agreementNumber = extractAgreementNumber(text);
  const specification = capture(text, /specyfikacja(?:\s+kursu)?\s+(.+?)(?=\s+zawartość kursu\b)/iu) || '';
  const payment = classifyContract(text);
  const monthly = capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:?\s*(\d+)/iu);
  const contract = {
    rawText: String(rawText || ''), ...payment, agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber), ...buyerData(text),
    coursePriceCents: extractPriceCents(text),
    lessonCount: Number(capture(specification, /liczba lekcji indywidualnych\s*:?\s*(\d+)/iu)) || undefined,
    monthlyLessonLimit: monthly ? Number(monthly) : null,
    teacherVariant: extractTeacherVariant(text),
    internalPaymentAccount: payment.paymentType === 'credit' ? null : extractInternalInstallmentAccount(text),
    installmentPlan: extractInstallmentPlan(text, payment.paymentVariant)
  };
  delete contract.matchedRule;
  console.debug('Payment classification', {
    paymentType: payment.paymentType,
    paymentVariant: payment.paymentVariant,
    matchedRule: payment.matchedRule,
    installmentCount: contract.installmentPlan?.length ?? null
  });
  return contract;
}

export function validateCurrentContract(contract) {
  if (!CONTRACT_TYPES.includes(contract?.contractType)) throw new Error('Nie rozpoznano rodzaju umowy.');
  if (!PAYMENT_TYPES.includes(contract?.paymentType)) throw new Error('Nie rozpoznano formy płatności.');
  if (contract.paymentType === 'internal' && !PAYMENT_VARIANTS.slice(1).includes(contract.paymentVariant)) throw new Error('Nie rozpoznano wariantu rat wewnętrznych.');
  if (contract.paymentType === 'credit' && contract.paymentVariant !== 'credit') throw new Error('Nie rozpoznano formy płatności.');
  if (!contract.agreementNumber) throw new Error('Nie odczytano poprawnego numeru umowy.');
  if (!contract.agreementDate) throw new Error('Nie odczytano poprawnej daty umowy.');
  if (!contract.customerType) throw new Error('Nie rozpoznano typu klienta.');
  if (!contract.customerName) throw new Error('Nie odczytano nazwy klienta.');
  if (contract.customerType === 'person' && !/^\d{11}$/.test(contract.personalId || '')) throw new Error('Nie odczytano poprawnego numeru PESEL.');
  if (contract.customerType === 'company' && !/^\d{10}$/.test(contract.personalId || '')) throw new Error('Nie odczytano poprawnego numeru NIP.');
  if (!contract.address) throw new Error('Nie odczytano adresu klienta.');
  if (!Number.isInteger(contract.coursePriceCents) || contract.coursePriceCents <= 0) throw new Error('Nie odczytano całkowitej ceny kursu.');
  if (!Number.isInteger(contract.lessonCount) || contract.lessonCount <= 0) throw new Error('Nie odczytano liczby lekcji.');
  if (!TEACHER_VARIANTS.includes(contract.teacherVariant)) throw new Error('Nie rozpoznano prawidłowego wariantu lektorów.');
  if (contract.paymentType === 'internal' && !/^\d{26}$/.test(contract.internalPaymentAccount || '')) throw new Error('Nie odczytano poprawnego rachunku rat wewnętrznych.');
  if (contract.paymentType === 'internal' && (!Array.isArray(contract.installmentPlan) || !contract.installmentPlan.length)) throw new Error('Nie odczytano harmonogramu płatności.');
  return contract;
}

export const extractContractData = parseCurrentContract;
