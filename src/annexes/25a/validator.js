const LUMP_VARIANTS = ['internal_2', 'internal_4'];

export function validateAnnex25aData(currentContract) {
  if (currentContract?.contractType !== 'flexible') {
    throw new Error('Aneks 25a wymaga umowy elastycznej.');
  }
  if (currentContract?.paymentType !== 'internal') {
    throw new Error('Aneks 25a wymaga rat wewnętrznych.');
  }
  if (!LUMP_VARIANTS.includes(currentContract?.paymentVariant)) {
    throw new Error('Aneks 25a wymaga umowy z harmonogramem 2 lub 4 rat wewnętrznych.');
  }
  return currentContract;
}

export function validate(input) {
  try { validateAnnex25aData(input?.currentContract ?? input); return []; }
  catch (error) { return [{ message: error.message }]; }
}
