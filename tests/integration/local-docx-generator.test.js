import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import manifest from '../../src/annexes/26/manifest.json' with { type: 'json' };
import { annex26Filename, remainingPlaceholders, renderDocx, validateTemplateValues } from '../../src/infrastructure/local-docx-generator.js';

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
  assert.equal(annex26Filename(values), 'Aneks_26_EL_12_34_Jan_Kowalski.docx');
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
