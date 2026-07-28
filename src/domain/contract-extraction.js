const normalized = value => String(value || '').normalize('NFC')
  .replace(/[\u00a0\u202f\u200b-\u200f\u2060\ufeff]/g, ' ')
  .replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

export const CURRENT_CONTRACT_FIELDS = Object.freeze([
  'rawText', 'contractType', 'paymentType', 'paymentVariant', 'agreementNumber',
  'agreementDate', 'customerType', 'customerName', 'personalId', 'address',
  'coursePriceCents', 'monthlyInstallmentCents', 'lessonCount',
  'monthlyLessonLimit', 'teacherVariant', 'internalPaymentAccount', 'installmentPlan'
]);
export const CONTRACT_TYPES = Object.freeze(['flexible', 'limit']);
export const PAYMENT_TYPES = Object.freeze(['credit', 'internal']);
export const PAYMENT_VARIANTS = Object.freeze(['credit', 'internal_24', 'internal_2', 'internal_13', 'internal_4']);
export const TEACHER_VARIANTS = Object.freeze(['polish_english_native', 'english_native']);
export const INTERNAL_INSTALLMENT_ACCOUNT_LABEL = 'na następujący rachunek bankowy Tutlo';

export const normalizeContractText = normalized;

const sliceBetween = (text, startPattern, endPattern) => {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const rest = text.slice(start);
  const heading = rest.match(startPattern)?.[0] || '';
  const contentStart = start + heading.length;
  const tail = text.slice(contentStart);
  const end = endPattern ? tail.search(endPattern) : -1;
  return text.slice(contentStart, end < 0 ? text.length : contentStart + end).trim();
};

/** Splits the fixed Tutlo layout before any field extraction takes place. */
export function extractContractSections(rawText) {
  const text = normalized(rawText);
  const buyerStart = text.search(/\bDANE\s+NABYWCY\b/iu);
  return {
    text,
    header: buyerStart < 0 ? text : text.slice(0, buyerStart),
    buyer: sliceBetween(text, /\bDANE\s+NABYWCY\b\s*:?/iu,
      /\bDANE\s+UŻYTKOWNIKA\b|(?:§\s*1\s*)?\bSPECYFIKACJA\s+KURSU\b/iu),
    specification: sliceBetween(text, /(?:§\s*1\s*)?\bSPECYFIKACJA\s+KURSU\b\s*:?/iu,
      /\bZAWARTOŚĆ\s+KURSU\b|§\s*2\b/iu),
    contents: sliceBetween(text, /\bZAWARTOŚĆ\s+KURSU\b\s*:?/iu,
      /§\s*2\b|\bWARUNKI\s+PŁATNOŚCI\b|§\s*\d+\b/iu),
    payment: sliceBetween(text, /(?:§\s*2\s*)?\bWARUNKI\s+PŁATNOŚCI\b\s*:?/iu,
      /§\s*3\s*(?:\bWARUNKI\s+UMOWY\b)?/iu)
  };
}

export function extractAgreementNumber(header) {
  return normalized(header).replace(/\s*\/\s*/g, '/')
    .match(/\bEL\/[\p{L}\d]+(?:\/[\p{L}\d]+){2}\/\d{1,2}\/\d{1,2}\/\d{4}\b/iu)?.[0];
}

export function parseAgreementDateFromNumber(number) {
  const match = String(number || '').match(/\/(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return undefined;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
export const extractAgreementDate = parseAgreementDateFromNumber;

const field = (section, label, nextLabels) => section.match(
  new RegExp(`${label}\\s*:?\\s*(.+?)(?=\\s+(?:${nextLabels})\\s*:?|$)`, 'iu'))?.[1]?.trim();

function extractBuyer(section) {
  const next = String.raw`IMIĘ\s+I\s+NAZWISKO|FIRMA|ADRES|TELEFON|E-?MAIL|PESEL|NIP`;
  const personName = field(section, String.raw`IMIĘ\s+I\s+NAZWISKO`, next);
  const companyName = field(section, 'FIRMA', next);
  const pesel = section.match(/\bPESEL\s*:?\s*((?:\d[\s\p{Cf}]*){11})(?![\s\p{Cf}]*\d)/iu)?.[1]?.replace(/[\s\p{Cf}]/gu, '');
  const nip = section.match(/\bNIP\s*:?\s*((?:\d[\s\p{Cf}-]*){10})(?![\s\p{Cf}-]*\d)/iu)?.[1]?.replace(/[\s\p{Cf}-]/gu, '');
  const person = personName && /^\d{11}$/.test(pesel || '');
  const company = companyName && /^\d{10}$/.test(nip || '');
  return {
    customerType: person && !company ? 'person' : company && !person ? 'company' : undefined,
    customerName: person && !company ? personName : company && !person ? companyName : undefined,
    personalId: person && !company ? pesel : company && !person ? nip : undefined,
    address: field(section, 'ADRES', next)
  };
}

const integerAfter = (text, label) => Number(text.match(new RegExp(`${label}\\s*:?\\s*(\\d+)`, 'iu'))?.[1]) || undefined;
const money = value => {
  const match = value?.match(/(\d+(?:[ .]\d{3})*|\d+)(?:[,.](\d{1,2}))?/);
  if (!match) return undefined;
  return Number(match[1].replace(/[ .]/g, '')) * 100 + Number((match[2] || '').padEnd(2, '0'));
};
const moneyAfter = (text, label) => money(text.match(new RegExp(`${label}\\s*:?\\s*(\\d+(?:[ .]\\d{3})*(?:[,.]\\d{1,2})?)`, 'iu'))?.[1]);

function extractTeacherVariant(contents) {
  const courseContents = normalized(contents);
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log(courseContents);
  }

  const polish = /\blektor(?:em)?\s+polsk(?:i|im)\b/iu.test(courseContents);
  const english = /\benglish\s+expert\b/iu.test(courseContents);
  const native = /\bnative\s+speaker(?:em)?\b/iu.test(courseContents);
  return english && native ? (polish ? 'polish_english_native' : 'english_native') : undefined;
}

export function extractInternalInstallmentAccount(paymentSection) {
  const candidate = normalized(paymentSection).match(/na\s+następujący\s+rachunek\s+bankowy\s+Tutlo\b.{0,100}?((?:\d[\s-]*){26})(?![\s-]*\d)/iu)?.[1]?.replace(/[\s-]/g, '');
  return /^\d{26}$/.test(candidate || '') ? candidate : undefined;
}

function extractPayment(payment) {
  const credit = /Forma\s+płatności\s*:\s*raty\s*0\s*%\s*przy\s+wykorzystaniu\s+kredytu\s+konsumenckiego\s+udzielonego/iu.test(payment);
  const internal = !credit && /(?:bezpośrednio\s+)?na\s+następujący\s+rachunek\s+bankowy\s+Tutlo/iu.test(payment);
  if (credit) return { paymentType: 'credit', paymentVariant: 'credit', internalPaymentAccount: null, installmentPlan: undefined };
  if (!internal) return { paymentType: undefined, paymentVariant: undefined, internalPaymentAccount: undefined, installmentPlan: undefined };
  let followingPaymentsCount = Number(payment.match(/\bkolejn(?:ych|e)\s+(\d+)\s+(?:miesięcznych\s+)?(?:rat|płatności)/iu)?.[1]);
  let paymentCount = followingPaymentsCount ? followingPaymentsCount + 1 : undefined;
  if (!paymentCount && /pierwsz\p{L}*\s+rok\p{L}*.{0,100}(?:z\s+góry|jednorazow\p{L}*).{0,220}drugi\p{L}*\s+rok\p{L}*.{0,100}(?:12|dwanaście)\s+(?:miesięcznych\s+)?rat/iu.test(payment)) {
    followingPaymentsCount = 12; paymentCount = 13;
  }
  if (!paymentCount) paymentCount = Number(payment.match(/\b(?:w|łącznie)\s+(2|4|13|24)\s+(?:równych\s+|miesięcznych\s+)?(?:ratach|rat|płatnościach|płatności)/iu)?.[1]);
  const paymentVariant = [2, 4, 13, 24].includes(paymentCount) ? `internal_${paymentCount}` : undefined;
  const firstPaymentAmountCents = money(payment.match(/pierwsz(?:a|ej)\s+rat(?:a|y)\b.{0,80}?(\d+(?:[ .]\d{3})*(?:[,.]\d{1,2})?)\s*zł/iu)?.[1]);
  const recurringPaymentAmountCents = money(payment.match(/kolejn(?:ych|e)\s+\d+\s+rat\p{L}*.{0,80}?(\d+(?:[ .]\d{3})*(?:[,.]\d{1,2})?)\s*zł/iu)?.[1]);
  return { paymentType: 'internal', paymentVariant,
    internalPaymentAccount: extractInternalInstallmentAccount(payment),
    installmentPlan: paymentCount ? { paymentCount, firstPaymentAmountCents,
      recurringPaymentAmountCents, followingPaymentsCount: followingPaymentsCount || Math.max(0, paymentCount - 1), paymentVariant } : undefined };
}

export function parseCurrentContract(rawText) {
  const sections = extractContractSections(rawText);
  const agreementNumber = extractAgreementNumber(sections.header);
  const specification = sections.specification;
  const hasMinimum = /Minimalny\s+czas\s+zobowiązania\s+Nabywcy\s+wynikający\s+z\s+Umowy/iu.test(specification);
  const lessonCount = integerAfter(specification, String.raw`Liczba\s+Lekcji\s+Indywidualnych`);
  const monthlyLessonLimit = integerAfter(specification, String.raw`Maksymalna\s+miesięczna\s+liczba\s+Lekcji\s+Indywidualnych\s+do\s+wykorzystania`);
  const hasPeriod = /okres\s+trwania\s+kursu|data\s+rozpoczęcia\s+kursu.{0,100}data\s+zakończenia\s+kursu/iu.test(specification);
  const contractType = hasMinimum ? 'flexible' : hasPeriod && lessonCount && monthlyLessonLimit ? 'limit' : undefined;
  const payment = extractPayment(sections.payment);
  return {
    rawText: String(rawText || ''), contractType, paymentType: payment.paymentType,
    paymentVariant: payment.paymentVariant, agreementNumber,
    agreementDate: parseAgreementDateFromNumber(agreementNumber), ...extractBuyer(sections.buyer),
    coursePriceCents: moneyAfter(sections.payment, String.raw`Całkowita\s+cena\s+(?:pakietu\s+)?kursu\s+wynosi`),
    monthlyInstallmentCents: moneyAfter(sections.payment, String.raw`(?:Opłata\s+miesięczna|wynagrodzenie\s+przysługujące\s+Tutlo)\s+(?:za\s+każdy\s+miesiąc\s+trwania\s+Umowy\s+)?wynosi`),
    lessonCount, monthlyLessonLimit, teacherVariant: extractTeacherVariant(sections.contents),
    internalPaymentAccount: payment.internalPaymentAccount, installmentPlan: payment.installmentPlan
  };
}

export function validateCurrentContract(contract) {
  const errors = [];
  const required = [
    ['contractType', CONTRACT_TYPES.includes(contract?.contractType), 'rodzaju umowy'],
    ['paymentType', PAYMENT_TYPES.includes(contract?.paymentType), 'formy płatności'],
    ['paymentVariant', PAYMENT_VARIANTS.includes(contract?.paymentVariant), 'wariantu płatności'],
    ['agreementNumber', Boolean(contract?.agreementNumber), 'numeru umowy'], ['agreementDate', Boolean(contract?.agreementDate), 'daty umowy'],
    ['customerType', ['person', 'company'].includes(contract?.customerType), 'typu klienta'], ['customerName', Boolean(contract?.customerName), 'nazwy klienta'],
    ['personalId', contract?.customerType === 'person' ? /^\d{11}$/.test(contract?.personalId || '') : contract?.customerType === 'company' && /^\d{10}$/.test(contract?.personalId || ''), 'identyfikatora klienta'],
    ['address', Boolean(contract?.address), 'adresu klienta'], ['coursePriceCents', Number.isInteger(contract?.coursePriceCents) && contract.coursePriceCents > 0, 'ceny kursu'],
    ['monthlyInstallmentCents', Number.isInteger(contract?.monthlyInstallmentCents) && contract.monthlyInstallmentCents > 0, 'miesięcznej opłaty'],
    ['lessonCount', Number.isInteger(contract?.lessonCount) && contract.lessonCount > 0, 'liczby lekcji'],
    ['monthlyLessonLimit', Number.isInteger(contract?.monthlyLessonLimit) && contract.monthlyLessonLimit > 0, 'miesięcznego limitu lekcji'],
    ['teacherVariant', TEACHER_VARIANTS.includes(contract?.teacherVariant), 'wariantu lektorów']
  ];
  for (const [fieldName, valid, label] of required) if (!valid) errors.push({ field: fieldName, message: `Nie odczytano ${label}.` });
  if (contract?.paymentType === 'internal' && !/^\d{26}$/.test(contract.internalPaymentAccount || '')) errors.push({ field: 'internalPaymentAccount', message: 'Nie odczytano rachunku rat wewnętrznych.' });
  if (contract?.paymentType === 'internal' && !(Number.isInteger(contract.installmentPlan?.paymentCount) && contract.installmentPlan.paymentCount > 0)) errors.push({ field: 'installmentPlan/paymentCount', message: 'Nie odczytano liczby płatności harmonogramu.' });
  if (errors.length) {
    const error = new Error(`Nie odczytano wymaganych danych:\n${errors.map(({ message }) => `- ${message.replace(/^Nie odczytano /, '').replace(/\.$/, '')}`).join('\n')}`);
    error.name = 'CurrentContractValidationError'; error.errors = errors; throw error;
  }
  return contract;
}

export const extractContractData = parseCurrentContract;
