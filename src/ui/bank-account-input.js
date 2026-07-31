export const normalizeBankAccountInput = value => String(value ?? '').replace(/\D/g, '').slice(0, 26);

export function bindBankAccountInput(input, validationMessage) {
  input.addEventListener('input', () => {
    input.value = normalizeBankAccountInput(input.value);
    input.setCustomValidity(input.value.length === 26 ? '' : validationMessage);
  });
}
