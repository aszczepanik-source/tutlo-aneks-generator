const capture = (text, pattern) => text.match(pattern)?.[1]?.trim();

export const CURRENT_CONTRACT_FIELDS = Object.freeze([
  'rawText', 'contractType', 'paymentType', 'paymentVariant', 'agreementNumber',
  'agreementDate', 'customerType', 'customerName', 'personalId', 'address',
  'coursePriceCents', 'lessonCount', 'monthlyLessonLimit', 'teacherVariant',
  'internalPaymentAccount', 'installmentPlan'
]);

export const CONTRACT_TYPES = Object.freeze(['flexible', 'limit']);
export const PAYMENT_TYPES = Object.freeze(['credit', 'internal']);
export const PAYMENT_VARIANTS = Object.freeze([
  'credit', 'internal_24', 'internal_2', 'internal_13', 'internal_4'
]);
export const TEACHER_VARIANTS = Object.freeze(['polish_english_native', 'english_native']);

/**
 * Zmiana schematu currentContract wymaga świadomej migracji wszystkich
 * konsumentów i aktualizacji testu kontraktowego.
 */

export function normalizeContractText(rawText) {
  return String(rawText || '').normalize('NFC').replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractAgreementNumber(rawText) {
  const text = normalizeContractText(rawText).replace(/\s*\/\s*/g, '/').slice(0, 4000);
  return text.match(/\bUMOWA\b.{0,300}?\bnr(?:\s+umowy)?\s*[:#]?\s*(EL\/[A-ZĄĆĘŁŃÓŚŹŻ]{1,10}\/\d+\/\d+\/\d{1,2}\/\d{1,2}\/\d{4})(?=\s|$|[.,;:])/iu)?.[1];
}

export function parseAgreementDateFromNumber(number) {
  const match = [...String(number || '').matchAll(/\/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].at(-1);
  if (!match) return undefined;
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1
    || date.getUTCDate() !== Number(d)) return undefined;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
export const extractAgreementDate = parseAgreementDateFromNumber;

function buyerData(text) {
  const section = capture(text, /dane\s+nabywcy\b\s*:?\s*(.*?)(?=\s+(?:specyfikacja(?:\s+kursu)?|zawartość\s+kursu|warunki\s+płatności)\b|$)/iu) || '';
  const end = String.raw`(?=\s+(?:imię\s+i\s+nazwisko|firma|adres|telefon|e-?mail|PESEL|NIP)\s*:?(?:\s|$)|$)`;
  const personName = capture(section, new RegExp(String.raw`imię\s+i\s+nazwisko\s*:?\s*(.+?)${end}`, 'iu'));
  const companyName = capture(section, new RegExp(String.raw`firma\s*:?\s*(.+?)${end}`, 'iu'));
  const pesel = section.match(/(?:^|\s)PESEL\b\s*:?\s*((?:\d[\s\p{Cf}]*){11})(?![\s\p{Cf}]*\d)/iu)?.[1]
    ?.replace(/[\s\p{Cf}]/gu, '');
  const nip = section.match(/(?:^|\s)NIP\b\s*:?\s*((?:\d[\s\p{Cf}-]*){10})(?![\s\p{Cf}-]*\d)/iu)?.[1]
    ?.replace(/[\s\p{Cf}-]/gu, '');
  const personComplete = Boolean(personName && /^\d{11}$/.test(pesel || ''));
  const companyComplete = Boolean(companyName && /^\d{10}$/.test(nip || ''));
  const identity = personComplete && !companyComplete
    ? { customerType: 'person', customerName: personName, personalId: pesel }
    : companyComplete && !personComplete
      ? { customerType: 'company', customerName: companyName, personalId: nip }
      : { customerType: undefined, customerName: personName || companyName, personalId: pesel || nip };
  return { ...identity, address: capture(section, new RegExp(String.raw`adres\s*:?\s*(.+?)${end}`, 'iu')) };
}

function classifyContract(text) {
  const lower = text.toLocaleLowerCase('pl');
  const contractType = /niewykorzystane lekcje.{0,80}nie przechodzą|zasady korzystania z lekcji/iu.test(lower)
    ? 'limit' : /elastyczny kurs językowy|lekcje indywidualne w różnej intensywności/iu.test(lower) ? 'flexible' : undefined;
  const credit = /raty 0%|kredyt(?:u|em)? konsumenck|pożyczk/iu.test(lower);
  const internal = /rachunek bankowy tutlo|rat(?:a|y|ach) wewnętrzn|kolejn(?:ych|e)\s+23\s+rat|płatność następuje w\s+2\s+równych ratach/iu.test(lower);
  const paymentType = credit && !internal ? 'credit' : internal && !credit ? 'internal' : undefined;
  let paymentVariant;
  if (paymentType === 'credit') paymentVariant = 'credit';
  else if (/kolejn(?:ych|e)\s+23\s+rat/iu.test(lower) || /24\s+(?:miesięczn\w*\s+)?rat/iu.test(lower)) paymentVariant = 'internal_24';
  else if (/pierwsz\w+\s+rok\w*\s+z\s+góry.{0,160}(?:12|dwanaście)\s+rat/iu.test(lower)) paymentVariant = 'internal_13';
  else if (/(?:płatność następuje w\s+)?2\s+(?:równych\s+)?rat/iu.test(lower)) paymentVariant = 'internal_2';
  else if (/(?:płatność następuje w\s+)?4\s+(?:równych\s+)?rat/iu.test(lower)) paymentVariant = 'internal_4';
  return { contractType, paymentType, paymentVariant };
}

function teacherVariant(text) {
  const contents = capture(text, /zawartość kursu\s+(.+?)(?=\s+(?:warunki płatności|całkowita cena kursu)\b)/iu) || '';
  const polish = /lektor(?:em)?\s+polsk/iu.test(contents);
  const english = /english\s+expert/iu.test(contents);
  const native = /native\s+speaker/iu.test(contents);
  if (polish && english && native) return 'polish_english_native';
  if (!polish && english && native) return 'english_native';
  return undefined;
}

function priceCents(text) {
  const value = text.match(/całkowita cena kursu wynosi\s*(\d{1,3}(?:[ .]\d{3})*|\d+)[,.](\d{2})\s*zł/iu);
  return value ? Number(`${value[1].replace(/[ .]/g, '')}${value[2]}`) : undefined;
}

export function extractInternalInstallmentAccount(text) {
  const value = normalizeContractText(text).match(/rachunek bankowy Tutlo\s*:\s*mBank\s+S\.A\.\s*((?:\d[\s-]*){26})(?![\s-]*\d)/iu)?.[1]
    ?.replace(/[\s-]/g, '');
  return /^\d{26}$/.test(value || '') ? value : undefined;
}

/** The sole raw-text parser. Consumers receive its result and never parse rawText. */
export function parseCurrentContract(rawText) {
  const text = normalizeContractText(rawText);
  const agreementNumber = extractAgreementNumber(text);
  const specification = capture(text, /specyfikacja(?:\s+kursu)?\s+(.+?)(?=\s+zawartość kursu\b)/iu) || '';
  const payment = classifyContract(text);
  const dueDates = [...text.matchAll(/(?:termin(?:em)?|płatn\w*|rata\w*)[^.]{0,80}?(\d{1,2}[.-]\d{1,2}[.-]\d{4})/giu)].map(x => x[1]);
  const count = payment.paymentVariant === 'internal_24' ? 24
    : payment.paymentVariant === 'internal_13' ? 13
      : payment.paymentVariant === 'internal_2' ? 2 : payment.paymentVariant === 'internal_4' ? 4 : undefined;
  return {
    rawText: String(rawText || ''), ...payment, agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber), ...buyerData(text),
    coursePriceCents: priceCents(text),
    lessonCount: Number(capture(specification, /liczba lekcji indywidualnych\s*:\s*(\d+)/iu)) || undefined,
    monthlyLessonLimit: Number(capture(specification, /maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania\s*:\s*(\d+)/iu)) || undefined,
    teacherVariant: teacherVariant(text),
    internalPaymentAccount: extractInternalInstallmentAccount(text),
    installmentPlan: count ? { count, dueDates } : undefined
  };
}

export function validateCurrentContract(contract) {
  if (!CONTRACT_TYPES.includes(contract?.contractType)) throw new Error('Nie rozpoznano typu umowy.');
  if (!PAYMENT_TYPES.includes(contract?.paymentType)) throw new Error('Nie rozpoznano formy płatności.');
  if (!PAYMENT_VARIANTS.includes(contract?.paymentVariant)) throw new Error('Nie rozpoznano wariantu płatności.');
  if (!contract?.customerType) throw new Error('Nie rozpoznano kompletnego zestawu danych klienta (nazwa oraz poprawny PESEL/NIP).');
  if (!contract.customerName) throw new Error('Nie odczytano nazwy klienta.');
  const idPattern = contract.customerType === 'company' ? /^\d{10}$/ : /^\d{11}$/;
  if (!idPattern.test(contract.personalId || '')) throw new Error(contract.customerType === 'company'
    ? 'Nie odczytano poprawnego numeru NIP.' : 'Nie odczytano poprawnego numeru PESEL.');
  if (!TEACHER_VARIANTS.includes(contract.teacherVariant)) throw new Error('Nie rozpoznano prawidłowego wariantu lektorów.');
  return contract;
}

// Temporary compatibility name; it returns exactly the canonical schema.
export const extractContractData = parseCurrentContract;
