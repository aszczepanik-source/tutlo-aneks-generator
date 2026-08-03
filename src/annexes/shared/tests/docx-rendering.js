import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import Docxtemplater from 'docxtemplater';
import { renderDocx } from '../../../infrastructure/local-docx-generator.js';
import { readZipEntry } from '../template-inspection.js';

const decodeXml = text => text
  .replace(/<w:tab\/?\s*>/g, '\t')
  .replace(/<w:br\/?\s*>/g, '\n')
  .replace(/<\/w:p>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/\s+/g, ' ').trim();

export async function renderActualTemplate(templateUrl, prepared) {
  const context = { window: {} };
  runInNewContext(await readFile(new URL('../../../../node_modules/pizzip/dist/pizzip.min.js', import.meta.url), 'utf8'), context);
  const PizZip = context.window.PizZip;
  const template = await readFile(templateUrl);
  const output = renderDocx(template, prepared, { PizZip, docxtemplater: Docxtemplater });
  const xml = readZipEntry(Buffer.from(output), 'word/document.xml').toString('utf8');
  const text = decodeXml(xml);

  assert.doesNotMatch(text, /\{\{/);
  assert.doesNotMatch(text, /\}\}/);
  assert.doesNotMatch(text, /zł\s*zł/i);
  assert.doesNotMatch(text, /r\.\s*r\./i);
  return text;
}

export function assertRenderedValues(text, expected) {
  for (const value of expected) assert.ok(text.includes(String(value)), `Brak wyrenderowanej wartości: ${value}`);
}
