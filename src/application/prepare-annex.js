import manifest11 from '../annexes/11/manifest.json' with { type: 'json' };
import manifest26 from '../annexes/26/manifest.json' with { type: 'json' };
import manifest29 from '../annexes/29/manifest.json' with { type: 'json' };
import manifest29a from '../annexes/29a/manifest.json' with { type: 'json' };
import { validateSourceData as validateAnnex26SourceData } from '../annexes/26/index.js';
import { BLOCKED_RULES, calculateAnnex11, calculateAnnex26, calculateAnnex29, calculateAnnex29a, formatDate, money } from '../domain/annex-calculations.js';

const manifests = { '11': manifest11, '26': manifest26, '29': manifest29, '29a': manifest29a };
const base = contract => ({
  ADRES: contract.address,
  DATA_ZAWARCIA_UMOWY: formatDate(
    contract.agreementDate,
    'data zawarcia umowy'
  ),
  IMIE_NAZWISKO: contract.customerName, NUMER_UMOWY: contract.agreementNumber, PESEL: contract.pesel
});
const scheduleValues = installments => Object.fromEntries(installments.flatMap((item, index) => {
  const key = String(index + 1).padStart(2, '0');
  return [[`RATA_${key}_KWOTA`, money(item.amountCents)], [`RATA_${key}_TERMIN`, formatDate(item.dueDate)]];
}));

export function prepareAnnex(annexId, contract, inputs = {}, today = new Date().toISOString().slice(0, 10)) {
  if (BLOCKED_RULES[annexId]) return { blocked: true, reason: BLOCKED_RULES[annexId] };
  let calculation;
  let values = base(contract);
  if (annexId === '11') {
    calculation = calculateAnnex11(contract, inputs.annexDate || today, Number(inputs.suspensionMonths));
    values = { ...values, DATA_ANEKSU: formatDate(calculation.annexDate), DATA_WEJSCIA_W_ZYCIE: formatDate(calculation.annexDate),
      'DATA-WZNOWIENIA-PŁATNOŚCI': formatDate(calculation.paymentResumeDate), 'DŁUGOŚĆ_ZAWIESZENIA': String(calculation.suspensionMonths),
      START_ZAWIESZENIA: formatDate(calculation.suspensionStart), KONIEC_ZAWIESZENIA: formatDate(calculation.suspensionEnd),
      NOWY_KONIEC_UMOWY: formatDate(calculation.newContractEndDate), ...scheduleValues(calculation.installments) };
  } else if (annexId === '26') {
    const sourceIssues = validateAnnex26SourceData({ ...contract, ...inputs });
    if (sourceIssues.length) throw new Error(`Brak wymaganych pól aneksu 26: ${sourceIssues.map(issue => issue.field).join(', ')}`);
    calculation = calculateAnnex26(contract, today, Number(inputs.newInstallmentCents));
    values = { ...values,
      BANK: inputs.bank,
      DATA_ANEKSU: formatDate(today, 'data aneksu'),
      DATA_UMOWY_KREDYTU: formatDate(contract.creditAgreementDate, 'data umowy kredytu'),
      DATA_WEJSCIA_W_ZYCIE: formatDate(calculation.effectiveDate, 'data wejścia w życie'),
      KWOTA_DO_ZWROTU_BANKOWI: money(calculation.bankRefundCents),
      KWOTA_KREDYTU: money(contract.creditAmountCents),
      LIMIT_MIESIECZNY: String(contract.monthlyLimit),
      NOWA_CENA: money(calculation.newPriceCents),
      NOWA_LICZBA_LEKCJI: String(calculation.newLessonCount),
      NOWA_SREDNIA_RATA: money(calculation.newAverageInstallmentCents),
      NUMER_RACHUNKU_BANKU: inputs.bankAccount,
      SPLACONO_DO_DNIA_ANEKSU: money(calculation.paidToAnnexDateCents),
      TYPY_LEKTOROW: contract.teacherTypes
    };
  } else {
    calculation = annexId === '29' ? calculateAnnex29(contract, today) : calculateAnnex29a(contract, today);
    values = { ...values, DATA_ANEKSU: formatDate(today), DATA_WEJSCIA_W_ZYCIE: formatDate(calculation.effectiveDate), NOWA_CENA: money(calculation.newPriceCents) };
  }
  const missing = manifests[annexId].requiredFields.filter(field => values[field] === undefined || values[field] === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);
  return { annexId, template: manifests[annexId].template, templateVersion: manifests[annexId].templateVersion, values, calculation };
}
