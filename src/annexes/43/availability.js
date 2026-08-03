export function isAnnex43Available(contract) {
  return (contract?.contractType === 'flexible' || contract?.contractType === 'limit')
    && contract?.familyGroupVariant === 'paid';
}
