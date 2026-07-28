import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractPdfText } from '../../src/infrastructure/pdf-text-extractor.js';

test('extractPdfText odczytuje wszystkie strony i zachowuje kolejność elementów', async () => {
  const calls = [];
  const pages = [[{ str: 'Pierwsza' }, { str: 'strona' }], [{ str: 'Druga' }, { str: 'strona' }]];
  const pdfjs = { getDocument: ({ data }) => ({ promise: Promise.resolve({ numPages: 2,
    getPage: async number => { calls.push(number); return { getTextContent: async () => ({ items: pages[number - 1] }) }; }
  }) }) };
  const file = { arrayBuffer: async () => new Uint8Array([1, 2]).buffer };
  assert.equal(await extractPdfText(file, pdfjs), 'Pierwsza strona\nDruga strona');
  assert.deepEqual(calls, [1, 2]);
});

test('extractPdfText odrzuca pusty PDF dokładnym komunikatem', async () => {
  const pdfjs = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [{ str: '   ' }] }) })
  }) }) };
  await assert.rejects(extractPdfText({ arrayBuffer: async () => new ArrayBuffer(0) }, pdfjs),
    { message: 'Nie udało się odczytać tekstu z PDF.' });
});

test('kliknięcie i drop używają handlePdfFile, a wszystkie zdarzenia blokują nawigację', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /function handlePdfFile\(file\)/);
  assert.match(html, /addEventListener\('change',e=>handlePdfFile\(e\.target\.files\[0\]\)\)/);
  assert.match(html, /addEventListener\('drop',e=>\{e\.preventDefault\(\);e\.stopPropagation\(\).*handlePdfFile/);
  for (const event of ['dragover', 'dragenter', 'drop']) {
    assert.match(html, new RegExp(`addEventListener\\('${event}',e=>\\{e\\.preventDefault\\(\\);e\\.stopPropagation\\(\\)`));
  }
});

test('błędy ekstrakcji i parsera mają oddzielne komunikaty', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /setStatus\('Nie udało się odczytać tekstu z PDF\.','error'\)/);
  assert.match(html, /error instanceof Error\?error\.message:'Nie udało się rozpoznać umowy\.'/);
  assert.doesNotMatch(html, /Nie udało się odczytać PDF\./);
});
