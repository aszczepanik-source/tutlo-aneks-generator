/**
 * Creates the common structural validator used at the document boundary.
 * Business rules intentionally remain outside this P0 foundation.
 */
export function createRequiredFieldsValidator(requiredFields) {
  const knownFields = Object.freeze([...requiredFields]);

  return function validate(input) {
    const source = input && typeof input === 'object' ? input : {};
    return knownFields.flatMap((field) => {
      const value = source[field];
      return value === undefined || value === null || value === ''
        ? [{ code: 'REQUIRED_FIELD', field, message: `Pole ${field} jest wymagane.` }]
        : [];
    });
  };
}

export const TUTLO_BANK_ACCOUNT_ERROR = 'Numer rachunku bankowego Tutlo musi zawierać dokładnie 26 cyfr.';

export function normalizeTutloBankAccount(value) {
  const normalized = String(value ?? '').replaceAll(' ', '');
  if (!/^\d{26}$/.test(normalized)) throw new Error(TUTLO_BANK_ACCOUNT_ERROR);
  return normalized;
}
