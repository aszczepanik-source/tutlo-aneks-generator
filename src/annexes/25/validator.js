export function validateAnnex25Data(contract) {
  if (contract?.contractType !== 'flexible') {
    throw new Error('Aneks 25 wymaga umowy elastycznej.');
  }

  if (contract.paymentType !== 'internal') {
    throw new Error('Aneks 25 wymaga rat wewnętrznych.');
  }

  if (contract.paymentVariant !== 'internal_24') {
    throw new Error('Aneks 25 wymaga umowy na 24 raty wewnętrzne.');
  }

  return contract;
}
