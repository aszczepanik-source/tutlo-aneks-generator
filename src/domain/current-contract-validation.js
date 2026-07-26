import { CONTRACT_TYPES, CUSTOMER_TYPES, PAYMENT_TYPES, PAYMENT_VARIANTS, TEACHER_VARIANTS } from './contract-extraction.js';

export const CURRENT_CONTRACT_FIELDS = Object.freeze([
  'rawText', 'contractType', 'paymentType', 'paymentVariant', 'agreementNumber', 'agreementDate',
  'customerType', 'customerName', 'personalId', 'address', 'coursePriceCents', 'lessonCount',
  'monthlyLessonLimit', 'teacherVariant', 'internalPaymentAccount', 'installmentPlan'
]);

export function validateCurrentContract(contract) {
  const issues = [];
  for (const field of CURRENT_CONTRACT_FIELDS) if (!Object.hasOwn(contract || {}, field)) issues.push(`Brak pola currentContract: ${field}.`);
  const required = ['agreementNumber', 'agreementDate', 'customerType', 'customerName', 'personalId', 'address', 'coursePriceCents', 'lessonCount', 'monthlyLessonLimit', 'teacherVariant'];
  for (const field of required) if (contract?.[field] === null || contract?.[field] === '') issues.push(`Brak wymaganej wartości: ${field}.`);
  if (!CONTRACT_TYPES.includes(contract?.contractType)) issues.push('Nieprawidłowy contractType.');
  if (!PAYMENT_TYPES.includes(contract?.paymentType)) issues.push('Nieprawidłowy paymentType.');
  if (!PAYMENT_VARIANTS.includes(contract?.paymentVariant)) issues.push('Nieprawidłowy paymentVariant.');
  if (!CUSTOMER_TYPES.includes(contract?.customerType)) issues.push('Nieprawidłowy customerType.');
  if (!TEACHER_VARIANTS.includes(contract?.teacherVariant)) issues.push('Nieprawidłowy teacherVariant.');
  if (contract?.customerType === 'person' && !/^\d{11}$/.test(contract.personalId || '')) issues.push('PESEL musi zawierać 11 cyfr.');
  if (contract?.customerType === 'company' && !/^\d{10}$/.test(contract.personalId || '')) issues.push('NIP musi zawierać 10 cyfr.');
  if (!Number.isSafeInteger(contract?.coursePriceCents) || contract.coursePriceCents <= 0) issues.push('coursePriceCents musi być dodatnią liczbą całkowitą.');
  if (!Number.isSafeInteger(contract?.lessonCount) || contract.lessonCount <= 0) issues.push('lessonCount musi być dodatnią liczbą całkowitą.');
  if (contract?.paymentType === 'credit' && contract.paymentVariant !== 'credit') issues.push('Kredyt wymaga paymentVariant=credit.');
  if (contract?.paymentType === 'internal') {
    if (!/^internal_(24|2|13|4)$/.test(contract.paymentVariant || '')) issues.push('Raty wewnętrzne wymagają jawnego wariantu.');
    if (!/^\d{26}$/.test(contract.internalPaymentAccount || '')) issues.push('Raty wewnętrzne wymagają rachunku Tutlo (26 cyfr).');
    const expected = Number(contract.paymentVariant?.split('_')[1]);
    if (contract.installmentPlan?.paymentCount !== expected) issues.push('installmentPlan nie odpowiada paymentVariant.');
  }
  if (contract?.paymentType === 'credit' && contract.internalPaymentAccount !== null) issues.push('Umowa kredytowa nie może używać rachunku rat wewnętrznych.');
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function assertValidCurrentContract(contract) {
  const result = validateCurrentContract(contract);
  if (!result.valid) throw new Error(result.issues.join(' '));
  return contract;
}
