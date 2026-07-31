const required = (value, message) => {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error(message);
};

export function validateAnnex48Data(contract) {
  if (contract?.contractType !== 'limit') throw new Error('Aneks 48 wymaga umowy z limitem.');
  required(contract.agreementNumber, 'Brak danych umowy: numer umowy.');
  required(contract.agreementDate, 'Brak danych umowy: data zawarcia umowy.');
  required(contract.courseStartDate, 'Nie udało się odczytać daty rozpoczęcia kursu.');
  required(contract.customerName, `Brak danych umowy: ${contract.customerType === 'company' ? 'nazwa firmy' : 'imię i nazwisko'}.`);
  required(contract.address, 'Brak danych umowy: adres.');
  required(contract.personalId, `Brak danych umowy: ${contract.customerType === 'company' ? 'NIP' : 'PESEL'}.`);
  if (!Number.isSafeInteger(contract.monthlyInstallmentCents) || contract.monthlyInstallmentCents <= 0) {
    throw new Error('Nie udało się odczytać miesięcznej raty.');
  }
  if (!Number.isSafeInteger(contract.monthlyLessonLimit) || contract.monthlyLessonLimit <= 0) {
    throw new Error('Nie udało się odczytać miesięcznego limitu lekcji.');
  }
  return contract;
}
