import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { calculateAnnex25a } from '../../../domain/annex-calculations.js';
import { parseCurrentContract } from '../../../domain/contract-extraction.js';
import { prepareAnnex25a } from '../generator.js';
import { validateAnnex25aData, validate } from '../validator.js';
import manifest from '../manifest.json' with { type: 'json' };
import { extractDocxPlaceholders } from '../../shared/template-inspection.js';

const fixture2Rat = `UMOWA O ŚWIADCZENIE USŁUG EL/TESTG/107/207/06/9/2026
Tutlo sp. z o.o., NIP: 7010701530
DANE NABYWCY
IMIĘ I NAZWISKO: Jan Testowy PESEL: 00210100004
ADRES: ul. Testowa 5, 00-005 Warszawa
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 24 miesiące
Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy
Liczba Lekcji Indywidualnych: 240
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 10
ZAWARTOŚĆ KURSU
240 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert oraz Native Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena kursu wynosi 8856,00 zł brutto. Opłata miesięczna za każdy miesiąc trwania Umowy wynosi: 369,00 zł brutto.
Płatność następuje w 2 równych ratach po 4428.0 zł. Płatność pierwszej raty następuje przelewem elektronicznym za pośrednictwem
Autopay S.A. z siedzibą w Sopocie lub przelewem bankowym na następujący rachunek bankowy Tutlo: mBank S.A. -
28114010104903562502000000 w terminie 1 dnia roboczego od daty zawarcia Umowy. Płatność drugiej raty następuje w terminie 12
miesięcy od daty rozpoczęcia kursu, tj. do dnia 01-09-2027 przelewem bankowym na następujący rachunek bankowy Tutlo: mBank S.A. -
28114010104903562502000000 . W tytule płatności należy podać imię i nazwisko Nabywcy. Płatność uznaje się za dokonaną po
zaksięgowaniu przelewu na ww. rachunku bankowym Tutlo.
§ 3 WARUNKI UMOWY`;

const fixture4Rat = `UMOWA O ŚWIADCZENIE USŁUG EL/TESTF/106/206/15/1/2026
Tutlo sp. z o.o., NIP: 7010701530
DANE NABYWCY
IMIĘ I NAZWISKO: Anna Testowa PESEL: 00210100004
ADRES: ul. Testowa 4, 00-004 Warszawa
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 24 miesiące
Minimalny czas zobowiązania Nabywcy wynikający z Umowy: 12 miesięcy
Liczba Lekcji Indywidualnych: 288
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU
288 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert oraz Native Speakerem realizowanych w platformie internetowej.
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena pakietu kursu wynosi: 10296.0 zł brutto, co oznacza, że wynagrodzenie przysługujące Tutlo za każdy miesiąc trwania
Umowy wynosi 429.0 zł brutto.
Płatność następuje w 4 równych ratach po 2574.0 zł. Płatność pierwszej raty następuje przelewem elektronicznym za pośrednictwem
Autopay S.A. z siedzibą w Sopocie lub przelewem bankowym na następujący rachunek bankowy Tutlo: mBank S.A. -
16114010104903226502000000 w terminie 1 dnia roboczego od daty zawarcia Umowy. Płatność kolejnych rat następuje w terminie 6, 12 i
18 miesięcy od daty rozpoczęcia kursu (druga rata płatna do dnia 06-02-2027, trzecia rata płatna do dnia 06-08-2027, czwarta rata płatna
do dnia 06-02-2028). W tytule płatności należy podać imię i nazwisko Nabywcy. Płatność uznaje się za dokonaną po zaksięgowaniu
przelewu na ww. rachunku bankowym Tutlo.
§ 3 WARUNKI UMOWY`;

test('parser odczytuje harmonogram 2 rat wprost z tekstu umowy (kwoty i terminy)', () => {
  const contract = parseCurrentContract(fixture2Rat);
  assert.equal(contract.contractType, 'flexible');
  assert.equal(contract.paymentType, 'internal');
  assert.equal(contract.paymentVariant, 'internal_2');
  assert.deepEqual(contract.installmentPlan.installments, [
    { nr: 1, dueDate: '2026-09-07', amountCents: 442800 },
    { nr: 2, dueDate: '2027-09-01', amountCents: 442800 }
  ]);
});

test('parser odczytuje harmonogram 4 rat wprost z tekstu umowy (kwoty i terminy)', () => {
  const contract = parseCurrentContract(fixture4Rat);
  assert.equal(contract.contractType, 'flexible');
  assert.equal(contract.paymentVariant, 'internal_4');
  assert.deepEqual(contract.installmentPlan.installments, [
    { nr: 1, dueDate: '2026-01-16', amountCents: 257400 },
    { nr: 2, dueDate: '2027-02-06', amountCents: 257400 },
    { nr: 3, dueDate: '2027-08-06', amountCents: 257400 },
    { nr: 4, dueDate: '2028-02-06', amountCents: 257400 }
  ]);
});

const contract2 = {
  contractType: 'flexible', paymentType: 'internal', paymentVariant: 'internal_2',
  coursePriceCents: 885600, monthlyInstallmentCents: 36900, lessonCount: 240,
  agreementNumber: 'EL/TESTG/107/207/06/9/2026', agreementDate: '2026-09-06', courseStartDate: '2026-09-01',
  customerType: 'person', customerName: 'Jan Testowy', personalId: '00210100004', address: 'ul. Testowa 5, 00-005 Warszawa',
  monthlyLessonLimit: 10, teacherVariant: 'polish_english_native',
  internalPaymentAccount: '28114010104903562502000000',
  installmentPlan: { installments: [
    { nr: 1, dueDate: '2026-09-07', amountCents: 442800 },
    { nr: 2, dueDate: '2027-09-01', amountCents: 442800 }
  ] }
};

test('walidacja wymaga umowy elastycznej z ratami wewnętrznymi 2 lub 4', () => {
  assert.equal(validateAnnex25aData(contract2), contract2);
  assert.throws(() => validateAnnex25aData({ ...contract2, contractType: 'limit' }), /Aneks 25a wymaga umowy elastycznej\./);
  assert.throws(() => validateAnnex25aData({ ...contract2, paymentType: 'credit', paymentVariant: 'credit' }),
    /Aneks 25a wymaga rat wewnętrznych\./);
  for (const paymentVariant of ['internal_1', 'internal_13', 'internal_24']) {
    assert.throws(() => validateAnnex25aData({ ...contract2, paymentVariant }),
      /Aneks 25a wymaga umowy z harmonogramem 2 lub 4 rat wewnętrznych\./);
  }
  assert.deepEqual(validate({ currentContract: contract2 }), []);
});

test('rata 1 zawsze bez zmian; przed 13. miesiącem wszystkie kolejne raty są od razu obniżone', () => {
  const result = calculateAnnex25a(contract2, '2027-03-15', 30000);
  assert.equal(result.installments.length, 13);
  assert.deepEqual(result.installments[0], { nr: 1, dueDate: '2026-09-07', amountCents: 442800 });
  assert.ok(result.installments.slice(1).every(item => item.amountCents === 30000));
  assert.equal(result.installments[1].dueDate, '2027-09-01');
  assert.equal(result.paidInstallments, 1);
  assert.equal(result.remainingInstallments, 12);
});

test('w 13. miesiącu druga rata zostaje po starej cenie z oryginalnym terminem, reszta obniżona', () => {
  const result = calculateAnnex25a(contract2, '2027-09-10', 30000);
  assert.deepEqual(result.installments[0], { nr: 1, dueDate: '2026-09-07', amountCents: 442800 });
  assert.deepEqual(result.installments[1], { nr: 2, dueDate: '2027-09-01', amountCents: 36900 });
  assert.ok(result.installments.slice(2).every(item => item.amountCents === 30000));
  assert.equal(result.paidInstallments, 2);
  assert.equal(result.remainingInstallments, 11);
  assert.equal(result.installments.reduce((sum, item) => sum + item.amountCents, 0), result.newPriceCents);
});

test('nowa rata musi być niższa niż obecna miesięczna opłata', () => {
  assert.throws(() => calculateAnnex25a(contract2, '2027-03-15', 36900), /Nowa rata musi być niższa/);
  assert.throws(() => calculateAnnex25a(contract2, '2027-03-15', 40000), /Nowa rata musi być niższa/);
});

test('prepareAnnex25a wypełnia wszystkie wymagane pola oraz pętlę RATY', () => {
  const prepared = prepareAnnex25a(contract2, { newInstallment: '300' }, '2027-09-10');
  assert.deepEqual(Object.keys(prepared.values).sort(), [...manifest.requiredFields].sort());
  assert.equal(prepared.values.RATY.length, 13);
  assert.deepEqual(prepared.values.RATY[0], { NUMER_RATY: '01', KWOTA: '4428,00', TERMIN: '07.09.2026' });
  assert.deepEqual(prepared.values.RATY[1], { NUMER_RATY: '02', KWOTA: '369,00', TERMIN: '01.09.2027' });
  assert.deepEqual(prepared.values.RATY[2], { NUMER_RATY: '03', KWOTA: '300,00', TERMIN: '01.10.2027' });
});

test('manifest i template.docx mają spójny komplet placeholderów, w tym pętlę RATY', async () => {
  const template = await readFile(new URL('../template.docx', import.meta.url));
  const placeholders = new Set(extractDocxPlaceholders(template));
  for (const field of manifest.requiredFields) {
    if (field === 'RATY') continue;
    assert.ok(placeholders.has(field), `brak pola ${field} w szablonie`);
  }
  for (const field of ['#RATY', '/RATY', 'NUMER_RATY', 'KWOTA', 'TERMIN']) {
    assert.ok(placeholders.has(field), `brak pola pętli ${field} w szablonie`);
  }
});
