import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCurrentContract, validateCurrentContract } from '../../src/domain/contract-extraction.js';

const rawText = `UMOWA O ŚWIADCZENIE USŁUG EL/TESTD/104/204/23/6/2026
DANE NABYWCY
IMIĘ I NAZWISKO: Jan Testowy PESEL: 02270812343
ADRES: ul. Testowa 2, 00-002 Warszawa
DANE UŻYTKOWNIKA
§ 1 SPECYFIKACJA KURSU
Okres trwania kursu: 24 miesiące
Liczba Lekcji Indywidualnych: 288
Maksymalna miesięczna liczba Lekcji Indywidualnych do wykorzystania: 12
ZAWARTOŚĆ KURSU
288 Lekcji Indywidualnych o długości 20 minut każda w formie spotkań indywidualnych z Lektorem Polskim, English Expert, Native Speakerem realizowanych w platformie internetowej
§ 2 WARUNKI PŁATNOŚCI
Całkowita cena pakietu kursu wynosi: 9576,00 zł brutto.
Opłata miesięczna wynosi: 399,00 zł brutto.
Forma płatności: raty 0% przy wykorzystaniu kredytu konsumenckiego udzielonego przez bank.
§ 3 WARUNKI UMOWY`;

test('teacherVariant przechodzi od surowego tekstu przez currentContract do walidacji', () => {
  const currentContract = parseCurrentContract(rawText);

  assert.equal(currentContract.teacherVariant, 'polish_english_native');
  assert.doesNotThrow(() => validateCurrentContract(currentContract));
});
