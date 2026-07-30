const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Brak danych umowy: ${label}.`);
  }
  return value;
};

export function validateAnnex45Data(contract) {
  if (contract?.contractType !== 'flexible') throw new Error('Aneks 45 wymaga umowy elastycznej.');
  if (contract.paymentType !== 'internal') throw new Error('Aneks 45 wymaga rat wewnętrznych.');
  if (contract.paymentVariant !== 'internal_24') throw new Error('Aneks 45 wymaga umowy na 24 raty wewnętrzne.');

  required(contract.agreementNumber, 'numer umowy');
  required(contract.agreementDate, 'data zawarcia umowy');
  if (!contract.courseStartDate) throw new Error('Nie udało się odczytać daty rozpoczęcia kursu.');
  required(contract.customerName, contract.customerType === 'company' ? 'nazwa firmy' : 'imię i nazwisko');
  required(contract.address, 'adres');
  required(contract.personalId, contract.customerType === 'company' ? 'NIP' : 'PESEL');
  if (!Number.isSafeInteger(contract.coursePriceCents) || contract.coursePriceCents <= 0) throw new Error('Brak danych umowy: cena kursu.');
  if (!Number.isSafeInteger(contract.monthlyInstallmentCents) || contract.monthlyInstallmentCents <= 0) throw new Error('Brak danych umowy: pierwotna rata miesięczna.');
  if (contract.coursePriceCents !== contract.monthlyInstallmentCents * 24) throw new Error('Cena kursu nie odpowiada 24 pierwotnym ratom.');
  required(contract.lessonCount, 'liczba lekcji');
  required(contract.teacherVariant, 'wariant lektorów');
  required(contract.internalPaymentAccount, 'numer konta Tutlo');
  required(contract.installmentPlan?.firstPaymentDueDate, 'pierwszy termin płatności');
  required(contract.installmentPlan?.recurringStartDate, 'data rozpoczęcia kolejnych rat');
  return contract;
}
