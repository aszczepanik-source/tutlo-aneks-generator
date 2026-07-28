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

function classifyContract(text) {
  const contractType = /niewykorzystane lekcje.{0,100}nie przechodzą|zasady korzystania z lekcji/iu.test(text)
    ? 'limit' : /elastyczny kurs językowy|lekcje indywidualne w różnej intensywności/iu.test(text) ? 'flexible' : undefined;
  const credit = /raty 0%|kredyt(?:u|em|owy)?\s+(?:bankow|konsumenck)|pożyczk\w*\s+bankow/iu.test(text);
  const internal = /rachunek bankowy tutlo|rat(?:a|y|ach) wewnętrzn|kolejn(?:ych|e)\s+23\s+rat|płatność następuje w\s*[24]\s+(?:równych\s+)?ratach/iu.test(text);
  const paymentType = credit && !internal ? 'credit' : internal && !credit ? 'internal' : undefined;
  let paymentVariant;
  if (paymentType === 'credit') paymentVariant = 'credit';
  else if (/kolejn(?:ych|e)\s+23\s+rat|24\s+(?:miesięczn\w*\s+)?rat/iu.test(text)) paymentVariant = 'internal_24';
  else if (/pierwsz\w*\s+rok\w*\s+(?:opłacon\w*\s+)?z\s+góry.{0,180}(?:12|dwanaście)\s+rat/iu.test(text)) paymentVariant = 'internal_13';
  else if (/(?:płatność następuje w\s*)?2\s+(?:równych\s+)?ratach?/iu.test(text)) paymentVariant = 'internal_2';
  else if (/(?:płatność następuje w\s*)?4\s+(?:równych\s+)?ratach?/iu.test(text)) paymentVariant = 'internal_4';
  return { contractType, paymentType, paymentVariant };
}

function extractTeacherVariant(text) {
  const contents = capture(text, /zawartość kursu\s+(.+?)(?=\s+(?:warunki płatności|całkowita cena kursu)\b)/iu) || '';
  const polish = /lektor(?:em)?\s+polsk/iu.test(contents);
  const english = /english\s+expert/iu.test(contents);
  const native = /native\s+speaker(?:em)?/iu.test(contents);
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
  return {
    rawText: String(rawText || ''), ...payment, agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber), ...buyerData(text),
    coursePriceCents: extractPriceCents(text),
    lessonCount: Number(capture(specification, /liczba lekcji indywidualnych\s*:?\s*(\d+)/iu)) || undefined,
    monthlyLessonLimit: monthly ? Number(monthly) : null,
    teacherVariant: extractTeacherVariant(text),
    internalPaymentAccount: payment.paymentType === 'credit' ? null : extractInternalInstallmentAccount(text),
    installmentPlan: extractInstallmentPlan(text, payment.paymentVariant)
  };
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
