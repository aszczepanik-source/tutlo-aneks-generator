import manifest from './manifest.json' with { type: 'json' };
import { addDays, formatDate, parseDate } from '../../domain/annex-calculations.js';
import { validateAnnex43Data } from './validator.js';

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function annexDate(options) {
  const value = options?.today;
  if (value instanceof Date) return localIsoDate(value);
  if (value !== undefined) {
    parseDate(value, 'data aneksu');
    return value;
  }
  return localIsoDate();
}

export function prepareAnnex43(currentContract, options = {}) {
  const data = validateAnnex43Data(currentContract);
  const date = annexDate(options);
  const agreementDate = data.agreementDate ?? data.dataZawarciaUmowy ?? data.contractDate;
  const values = {
    NUMER_UMOWY: data.agreementNumber,
    DATA_ZAWARCIA_UMOWY: formatDate(agreementDate, 'data zawarcia umowy'),
    DATA_ANEKSU: formatDate(date, 'data aneksu'),
    IMIE_NAZWISKO: data.customerName,
    ADRES: data.address,
    IDENTYFIKATOR_LABEL: data.customerType === 'company' ? 'NIP' : 'PESEL',
    IDENTYFIKATOR: data.personalId,
    DATA_WEJSCIA_W_ZYCIE: formatDate(addDays(date, 1))
  };

  return {
    annexId: manifest.id,
    template: manifest.template,
    templateVersion: manifest.templateVersion,
    requiredFields: manifest.requiredFields,
    values,
    calculation: { annexDate: date, effectiveDate: addDays(date, 1) }
  };
}
