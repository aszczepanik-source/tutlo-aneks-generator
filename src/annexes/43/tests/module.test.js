import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { prepareAnnex43 } from '../index.js';
import { extractContractData } from '../../../domain/contract-extraction.js';

const rawText = `
UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU Liczba lekcji: 450 Limit miesięczny: 57
ZAWARTOŚĆ KURSU Typy lektorów: Native Speaker
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9576,00 zł brutto.
Kurs Tutlo Plus: możliwość korzystania z kursu max. przez 2 dodatkowych Użytkowników za dodatkową opłatą`;
const contract = { ...extractContractData(rawText, 'EL/JF/811/192956/3/9/2025'), rawText };

test('aneks 43 odczytuje dane umowy i buduje komplet placeholderów', () => {
  const prepared = prepareAnnex43(contract);
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.deepEqual({
    number: prepared.values.NUMER_UMOWY,
    agreementDate: prepared.values.DATA_ZAWARCIA_UMOWY,
    name: prepared.values.IMIE_NAZWISKO,
    address: prepared.values.ADRES,
    pesel: prepared.values.PESEL
  }, {
    number: 'EL/JF/811/192956/3/9/2025', agreementDate: '03.09.2025',
    name: 'Monika Wójcik', address: 'Galileusza 10/13, 67-200 Głogów', pesel: '82111304868'
  });
  assert.match(prepared.values.DATA_ANEKSU, /^\d{2}\.\d{2}\.\d{4}$/);
  assert.match(prepared.values.DATA_WEJSCIA_W_ZYCIE, /^\d{2}\.\d{2}\.\d{4}$/);
});

test('publiczne API aneksu 43 zawiera wyłącznie manifest i prepareAnnex43', async () => {
  assert.deepEqual(Object.keys(await import('../index.js')).sort(), ['manifest', 'prepareAnnex43']);
});
