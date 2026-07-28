import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCurrentContract } from '../../src/domain/contract-extraction.js';
import { prepareAnnex26 } from '../../src/annexes/26/index.js';
import { annexModules } from '../../src/annexes/catalog.js';
import { getAvailableAnnexCards } from '../../src/annexes/availability.js';
import { readFile } from 'node:fs/promises';

const raw = buyer => `UMOWA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY ${buyer} ADRES: Testowa 1 TELEFON: 500500500
§ 1 SPECYFIKACJA KURSU Okres trwania kursu: 24 miesiące Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy Liczba Lekcji Indywidualnych: 192 Maksymalna miesięczna liczba lekcji indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU 192 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speakerem realizowanych w platformie internetowej. § 2 WARUNKI PŁATNOŚCI
Całkowita cena kursu wynosi 7 176,00 zł. Opłata miesięczna za każdy miesiąc trwania Umowy wynosi: 299,00 zł. Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego udzielonego przez bank. § 3 WARUNKI UMOWY`;
const form = { newInstallment: '250,00', bank: 'Inbank', bankAccount: '12345678901234567890123456' };

const expectedValues = identity => ({
  NUMER_UMOWY: 'EL/JF/811/192956/3/9/2025', DATA_ANEKSU: '24.07.2026',
  IMIE_NAZWISKO: identity.name, ADRES: 'Testowa 1', PESEL: identity.id,
  DATA_ZAWARCIA_UMOWY: '03.09.2025', NOWA_LICZBA_LEKCJI: '175',
  TYPY_LEKTOROW: 'Lektorem Polskim, English Expert, Native Speakerem', LIMIT_MIESIECZNY: '12',
  NOWA_CENA: '6539,00 zł', NOWA_SREDNIA_RATA: '272,46 zł', KWOTA_KREDYTU: '7176,00 zł',
  BANK: 'Inbank', DATA_UMOWY_KREDYTU: '03.09.2025', SPLACONO_DO_DNIA_ANEKSU: '3289,00 zł',
  KWOTA_DO_ZWROTU_BANKOWI: '637,00 zł', NUMER_RACHUNKU_BANKU: form.bankAccount,
  DATA_WEJSCIA_W_ZYCIE: '25.07.2026'
});

for (const identity of [
  { label: 'osoby', buyer: 'IMIĘ I NAZWISKO: Jan Kowalski PESEL: 12345678901', name: 'Jan Kowalski', id: '12345678901' },
  { label: 'firmy', buyer: 'FIRMA: Acme sp. z o.o. NIP: 1234567890', name: 'Acme sp. z o.o.', id: '1234567890' }
]) {
  test(`prepared.values aneksu 26 — snapshot dla ${identity.label}`, () => {
    const prepared = prepareAnnex26(parseCurrentContract(raw(identity.buyer)), form,
      new Date('2026-07-24T12:00:00Z'));
    assert.deepEqual(prepared.values, expectedValues(identity));
    assert.deepEqual(Object.keys(prepared.values).sort(), [...prepared.requiredFields].sort());
  });
}

test('automatyczny router i katalog eksponują wyłącznie aneks 26', () => {
  assert.deepEqual([...annexModules.keys()], ['26']);
  assert.deepEqual(getAvailableAnnexCards({ contractType: 'flexible', paymentType: 'credit', paymentVariant: 'credit' })
    .map(card => card.no), ['26']);
  assert.deepEqual(getAvailableAnnexCards({ contractType: 'limit', paymentType: 'internal', paymentVariant: 'internal_4' }), []);
});

test('aneks 26 nie parsuje ponownie rawText', async () => {
  const source = await readFile(new URL('../../src/annexes/26/generator.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /parseCurrentContract|extractContractData|contract\.rawText/);
});
