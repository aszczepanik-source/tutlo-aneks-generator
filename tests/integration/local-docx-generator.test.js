import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../../src/annexes/26/manifest.json' with { type: 'json' };
import { annex25TemplateUrl, annex26Filename, annex26TemplateUrl, downloadAnnex26, remainingPlaceholders, renderDocx, validateTemplateValues } from '../../src/infrastructure/local-docx-generator.js';

const values = Object.fromEntries(manifest.requiredFields.map(field => [field, `wartość-${field}`]));
values.NUMER_UMOWY = 'EL/12:34?';
values.IMIE_NAZWISKO = 'Jan Kowalski';

class FakeZip {
  constructor(input) {
    this.files = { 'word/document.xml': true };
    this.xml = typeof input === 'string' ? input : '{{NUMER_UMOWY}} {{IMIE_NAZWISKO}} {{NOWA_CENA}}';
  }
  file() { return { asText: () => this.xml }; }
  generate() { return new TextEncoder().encode(this.xml); }
}
class FakeDocxtemplater {
  constructor(zip) { this.zip = zip; }
  render(data) { this.zip.xml = this.zip.xml.replace(/{{([^{}]+)}}/g, (_, key) => data[key]); return this; }
  getZip() { return this.zip; }
}
const dependencies = { PizZip: FakeZip, docxtemplater: FakeDocxtemplater };

test('podmienia wszystkie pola aneksu 26', () => {
  const xml = manifest.requiredFields.map(field => `{{${field}}}`).join('|');
  const output = new TextDecoder().decode(renderDocx(xml, { values, requiredFields: manifest.requiredFields }, dependencies));
  assert.doesNotMatch(output, /{{/);
  assert.equal(output, manifest.requiredFields.map(field => values[field]).join('|'));
});

test('blokuje brakujące pole', () => {
  assert.throws(() => validateTemplateValues({ ...values, NOWA_CENA: '' }, manifest.requiredFields), /NOWA_CENA/);
});

test('blokuje NaN i pozostały placeholder', () => {
  assert.throws(() => validateTemplateValues({ ...values, NOWA_CENA: NaN }, manifest.requiredFields), /NOWA_CENA/);
  const zip = new FakeZip('{{BRAK_W_SZABLONIE}}');
  assert.deepEqual(remainingPlaceholders(zip), ['BRAK_W_SZABLONIE']);
  assert.throws(() => renderDocx('{{BRAK_W_SZABLONIE}}', { values, requiredFields: manifest.requiredFields }, dependencies), /BRAK_W_SZABLONIE/);
});

test('tworzy bezpieczną nazwę pobieranego pliku', () => {
  assert.equal(annex26Filename(values), 'Aneks Jan Kowalski.docx');
  assert.equal(annex26Filename({ IMIE_NAZWISKO: 'ABC Sp. z o.o.' }), 'Aneks ABC Sp. z o.o..docx');
  assert.equal(annex26Filename({ IMIE_NAZWISKO: 'Firma: Test / Warszawa' }), 'Aneks Firma Test Warszawa.docx');
  assert.equal(annex26Filename({ IMIE_NAZWISKO: '   ' }), 'Aneks.docx');
});

test('to samo wejście daje tę samą treść dokumentu', () => {
  const prepared = { values, requiredFields: manifest.requiredFields };
  assert.deepEqual(renderDocx('Umowa {{NUMER_UMOWY}}', prepared, dependencies), renderDocx('Umowa {{NUMER_UMOWY}}', prepared, dependencies));
});

test('aktywny przepływ nie zawiera Apps Script ani formularza POST', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /AppsScriptClient|APPS_SCRIPT_URL|TEST POST|method=['"]POST/i);
  assert.match(html, /downloadAnnex26/);
});

test('URL szablonu zachowuje podkatalog wdrożenia GitHub Pages', () => {
  const url = annex26TemplateUrl('https://aszczepanik-source.github.io/tutlo-aneks-generator/src/infrastructure/local-docx-generator.js');
  assert.equal(url, 'https://aszczepanik-source.github.io/tutlo-aneks-generator/src/annexes/26/template.docx');
  assert.notEqual(new URL(url).pathname, '/src/annexes/26/template.docx');
});

test('URL szablonu aneksu 25 używa tego samego mechanizmu i zachowuje podkatalog wdrożenia', () => {
  const url = annex25TemplateUrl('https://aszczepanik-source.github.io/tutlo-aneks-generator/src/infrastructure/local-docx-generator.js');
  assert.equal(url, 'https://aszczepanik-source.github.io/tutlo-aneks-generator/src/annexes/25/template.docx');
  assert.notEqual(new URL(url).pathname, '/src/annexes/25/template.docx');
});

test('błąd sieci przy pobieraniu szablonu podaje nazwę i pełny URL', async () => {
  const templateUrl = 'https://aszczepanik-source.github.io/tutlo-aneks-generator/src/annexes/26/template.docx';
  await assert.rejects(
    downloadAnnex26({ values }, { fetch: async () => { throw new TypeError('Failed to fetch'); }, templateUrl }),
    error => error.message.includes('template.docx') && error.message.includes(templateUrl)
      && error.message.includes('HTTP status: niedostępny') && error.message.includes('statusText: niedostępny')
  );
});

test('odpowiedź HTTP szablonu podaje status i statusText', async () => {
  await assert.rejects(
    downloadAnnex26({ values }, { fetch: async () => ({ ok: false, status: 404, statusText: 'Not Found' }) }),
    /template\.docx.*HTTP status: 404.*statusText: Not Found/
  );
});

test('brak biblioteki CDN wskazuje nazwę brakującej biblioteki', () => {
  const prepared = { values, requiredFields: manifest.requiredFields };
  assert.throws(() => renderDocx('szablon', prepared, {}), /Nie udało się załadować biblioteki PizZip/);
  assert.throws(() => renderDocx('szablon', prepared, { PizZip: FakeZip }), /Nie udało się załadować biblioteki docxtemplater/);
});
