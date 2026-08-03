import manifest from './manifest.json' with { type: 'json' };
import { addDays, formatDate, parseDate } from '../../domain/annex-calculations.js';
import { validateAnnex29Data } from './validator.js';
import { getLocalIsoDate } from '../shared/local-date.js';

const amount = cents => `${Math.floor(cents / 100)}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  + `,${String(cents % 100).padStart(2, '0')}`;

export function prepareAnnex29(currentContract, options = {}) {
  validateAnnex29Data(currentContract, options);
  const mode = options.mode ?? 'standard';
  const annexDate = options.today || getLocalIsoDate();
  parseDate(annexDate, 'data aneksu');
  const effectiveDate = addDays(annexDate, 1);
  const newCoursePriceCents = currentContract.coursePriceCents - currentContract.monthlyInstallmentCents;
  const values = {
    ADRES: currentContract.address,
    DATA_ANEKSU: formatDate(annexDate),
    DATA_WEJSCIA_W_ZYCIE: formatDate(effectiveDate),
    DATA_ZAWARCIA_UMOWY: formatDate(currentContract.agreementDate, 'data zawarcia umowy'),
    IMIE_NAZWISKO: currentContract.customerName,
    NOWA_CENA: amount(newCoursePriceCents),
    NUMER_UMOWY: currentContract.agreementNumber,
    IDENTYFIKATOR_LABEL: currentContract.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: currentContract.personalId
  };
  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields, values,
    calculation: { annexDate, effectiveDate, newCoursePriceCents },
    context: { mode } };
}

export function createGenerationPlan(input) {
  try {
    const prepared = prepareAnnex29(input?.currentContract, input?.options);
    return { ok: true, ...prepared, templateUrl: new URL(manifest.template, import.meta.url) };
  } catch (error) {
    return { ok: false, annexId: manifest.id, issues: [{ message: error.message }] };
  }
}
