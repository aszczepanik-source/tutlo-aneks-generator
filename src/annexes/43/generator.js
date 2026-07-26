import manifest from './manifest.json' with { type: 'json' };
import { addDays, formatDate } from '../../domain/annex-calculations.js';

export function prepareAnnex43(currentContract) {
  const agreementNumber = currentContract?.agreementNumber;
  const annexDate = new Date().toISOString().slice(0, 10);
  const agreementDate = currentContract?.agreementDate;
  const values = {
    NUMER_UMOWY: agreementNumber,
    DATA_ZAWARCIA_UMOWY: formatDate(agreementDate),
    DATA_ANEKSU: formatDate(annexDate),
    DATA_WEJSCIA_W_ZYCIE: formatDate(addDays(annexDate, 3)),
    IMIE_NAZWISKO: currentContract?.customerName,
    ADRES: currentContract?.address,
    PESEL: currentContract?.personalId
  };
  const missing = manifest.requiredFields.filter(field => values[field] === undefined || values[field] === '');
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);

  return { annexId: manifest.id, template: manifest.template, templateVersion: manifest.templateVersion, values };
}
