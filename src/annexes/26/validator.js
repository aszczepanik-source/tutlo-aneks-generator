import manifest from './manifest.json' with { type: 'json' };
import { createRequiredFieldsValidator } from '../shared/validation.js';

export const validate = createRequiredFieldsValidator(manifest.requiredFields);

export const requiredSourceFields = Object.freeze([
  'agreementNumber', 'agreementDate', 'customerName', 'address', 'pesel',
  'coursePriceCents', 'currentInstallmentCents', 'paidInstallments', 'lessonCount',
  'monthlyLimit', 'teacherTypes', 'creditAmountCents', 'creditAgreementDate',
  'newInstallmentCents', 'bank', 'bankAccount'
]);

export const validateSourceData = createRequiredFieldsValidator(requiredSourceFields);
