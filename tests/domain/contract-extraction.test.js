import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractContractData } from '../../src/domain/contract-extraction.js';

const rawText = `UMOWA ELASTYCZNA nr EL/JF/811/192956/3/9/2025
DANE NABYWCY Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
SPECYFIKACJA KURSU Liczba lekcji: 450 Limit miesięczny: 57
ZAWARTOŚĆ KURSU Typy lektorów: Lektor Polski, English Expert, Native Speaker
WARUNKI PŁATNOŚCI Całkowita cena kursu wynosi 9576,00 zł brutto.`;

test('wspólny extractor zwraca komplet podstawowych danych umowy', () => {
  assert.deepEqual(extractContractData(rawText), {
    agreementNumber: 'EL/JF/811/192956/3/9/2025', agreementDate: '03.09.2025',
    customerName: 'Monika Wójcik', address: 'Galileusza 10/13, 67-200 Głogów', pesel: '82111304868',
    coursePrice: 9576, monthlyInstallment: 399, lessonCount: 450, monthlyLimit: 57,
    teacherTypes: 'Lektor Polski, English Expert, Native Speaker'
  });
});

test('analyze odczytuje PDF raz i zapisuje pełny currentContract', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const analyze = html.match(/async function analyze\(\)\{([\s\S]*?)\n  \}/)?.[1];
  assert.equal((analyze.match(/extractText\(currentFile\)/g) || []).length, 1);
  assert.match(analyze, /\.\.\.extractContractData\(text,extractAgreementNumber\(text\)\)/);
  for (const field of ['contractType', 'paymentType', 'paymentVariant', 'rawText']) assert.match(analyze, new RegExp(`${field}:`));
});

test('aneksy nie parsują podstawowych danych z rawText ani nie zależą od extractorów aneksów', async () => {
  for (const id of ['11', '26', '29', '29a', '43']) {
    const sources = await Promise.all(['index.js', 'generator.js'].map(name => readFile(new URL(`../../src/annexes/${id}/${name}`, import.meta.url), 'utf8')));
    const source = sources.join('\n');
    assert.doesNotMatch(source, /currentContract\?*\.rawText|contract\?*\.rawText|extractAnnex\d+Contract/);
  }
});
