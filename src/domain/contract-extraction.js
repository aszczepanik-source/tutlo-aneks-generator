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

function classifyContract(text, contractDescription) {
  const contractType = /niewykorzystane lekcje.{0,100}nie przechodzą|zasady korzystania z lekcji/iu.test(contractDescription)
    ? 'limit' : /umowa\s+elastyczna|elastyczny kurs językowy|lekcje indywidualne w różnej intensywności/iu.test(contractDescription) ? 'flexible' : undefined;
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

function extractPriceCents(payment) {
  // The amount is accepted only directly after a total-course-price label. This prevents
  // installments, deposits and credit amounts from becoming the course price.
  const label = String.raw`(?:całkowita\s+cena\s+kursu|cena\s+kursu|wynagrodzenie\s+za\s+cały\s+kurs|łączna\s+cena\s+usługi)`;
  const match = payment.match(new RegExp(`${label}(?:\\s+wynosi)?\\s*:?\\s*(\\d{1,3}(?:[ .]\\d{3})*|\\d+)(?:[,.](\\d{2}))?\\s*zł`, 'iu'));
  if (!match) return undefined;
  return (Number(match[1].replace(/[ .]/g, '')) * 100) + Number(match[2] || '00');
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
  const specification = capture(text, /specyfikacja(?:\s+kursu)?\s+(.+?)(?=\s+zawarto(?:ść|sc)\s+kursu\b)/iu) || '';
  const header = text.split(/\bdane\s+nabywcy\b/iu, 1)[0];
  const payment = classifyContract(text, `${header} ${specification}`);
  const monthly = capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:?\s*(\d+)/iu);
  const paymentText = paymentSection(text);
  const contract = {
    rawText: String(rawText || ''), ...payment, agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber), ...buyerData(text),
    coursePriceCents: extractPriceCents(paymentText),
    lessonCount: Number(capture(specification, /liczba lekcji indywidualnych\s*:?\s*(\d+)/iu)) || undefined,
    monthlyLessonLimit: monthly ? Number(monthly) : null,
    teacherVariant: extractTeacherVariant(text),
    internalPaymentAccount: payment.paymentType === 'credit' ? null : extractInternalInstallmentAccount(paymentText),
    installmentPlan: extractInstallmentPlan(paymentText, payment.paymentVariant)
  };
  delete contract.matchedRule;
  const diagnosticMode = typeof process !== 'undefined'
    ? process.env?.NODE_ENV !== 'production'
    : typeof location !== 'undefined' && /^(?:localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (diagnosticMode) console.table({
    contractType: contract.contractType, paymentType: contract.paymentType,
    paymentVariant: contract.paymentVariant, agreementNumber: Boolean(contract.agreementNumber),
    agreementDate: Boolean(contract.agreementDate), customerType: contract.customerType,
    customerName: Boolean(contract.customerName), personalId: Boolean(contract.personalId),
    address: Boolean(contract.address), coursePriceCents: contract.coursePriceCents,
    lessonCount: contract.lessonCount, monthlyLessonLimit: contract.monthlyLessonLimit,
    teacherVariant: contract.teacherVariant,
    internalPaymentAccount: Boolean(contract.internalPaymentAccount),
    installmentPlanLength: contract.installmentPlan?.length ?? 0
  });
  return contract;
}

export function validateCurrentContract(contract) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!CONTRACT_TYPES.includes(contract?.contractType)) add('contractType', 'Nie rozpoznano rodzaju umowy.');
  if (!PAYMENT_TYPES.includes(contract?.paymentType)) add('paymentType', 'Nie rozpoznano formy płatności.');
  if (contract?.paymentType === 'internal' && !PAYMENT_VARIANTS.slice(1).includes(contract.paymentVariant)) add('paymentVariant', 'Nie rozpoznano wariantu rat wewnętrznych.');
  if (contract?.paymentType === 'credit' && contract.paymentVariant !== 'credit') add('paymentVariant', 'Nie rozpoznano wariantu płatności kredytowej.');
  if (!contract?.agreementNumber) add('agreementNumber', 'Nie odczytano poprawnego numeru umowy.');
  if (!contract?.agreementDate) add('agreementDate', 'Nie odczytano poprawnej daty umowy.');
  if (!contract?.customerType) add('customerType', 'Nie rozpoznano typu klienta.');
  if (!contract?.customerName) add('customerName', 'Nie odczytano nazwy klienta.');
  if (contract?.customerType === 'person' && !/^\d{11}$/.test(contract.personalId || '')) add('personalId', 'Nie odczytano poprawnego numeru PESEL.');
  if (contract?.customerType === 'company' && !/^\d{10}$/.test(contract.personalId || '')) add('personalId', 'Nie odczytano poprawnego numeru NIP.');
  if (!contract?.address) add('address', 'Nie odczytano adresu klienta.');
  if (!Number.isInteger(contract?.coursePriceCents) || contract.coursePriceCents <= 0) add('coursePriceCents', 'Nie odczytano całkowitej ceny kursu.');
  if (!Number.isInteger(contract?.lessonCount) || contract.lessonCount <= 0) add('lessonCount', 'Nie odczytano liczby lekcji.');
  if (!TEACHER_VARIANTS.includes(contract?.teacherVariant)) add('teacherVariant', 'Nie rozpoznano prawidłowego wariantu lektorów.');
  if (contract?.paymentType === 'internal' && !/^\d{26}$/.test(contract.internalPaymentAccount || '')) add('internalPaymentAccount', 'Nie odczytano poprawnego rachunku rat wewnętrznych.');
  if (contract?.paymentType === 'internal' && (!Array.isArray(contract.installmentPlan) || !contract.installmentPlan.length)) add('installmentPlan', 'Nie odczytano harmonogramu płatności.');
  if (errors.length) {
    const error = new Error(`Nie odczytano wymaganych danych:\n${errors.map(item => `- ${item.message.replace(/^Nie (?:odczytano|rozpoznano) /, '').replace(/\.$/, '')}`).join('\n')}`);
    error.name = 'CurrentContractValidationError';
    error.errors = errors;
    throw error;
  }
  return contract;
}

export const extractContractData = parseCurrentContract;
