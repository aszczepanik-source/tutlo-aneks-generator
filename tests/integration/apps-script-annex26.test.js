import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import manifest from '../../src/annexes/26/manifest.json' with { type: 'json' };

test('istniejący Apps Script generuje aneks 26 i podstawia wszystkie placeholdery', async () => {
  const replacements = [];
  const cache = new Map();
  const body = { replaceText: (pattern, value) => replacements.push([pattern, value]) };
  const context = {
    console,
    Date,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ value, setMimeType() { return this; } }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    DriveApp: {
      getFolderById: () => ({}),
      getFileById: () => ({ makeCopy: () => ({ getId: () => 'copy-id' }) })
    },
    DocumentApp: { openById: () => ({ getBody: () => body, saveAndClose() {}, getUrl: () => 'https://docs.google.com/document/d/copy-id' }) }
  };
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('../../apps-scirpt/Code.gs', import.meta.url), 'utf8'), context);
  const values = Object.fromEntries(manifest.requiredFields.map(field => [field, `wartość ${field}`]));
  const output = context.doPost({ postData: { contents: JSON.stringify({ action: 'generate', annexId: '26', requestId: 'request-26-test', values }) } });
  const result = JSON.parse(output.value);

  assert.equal(result.ok, true);
  assert.equal(result.documentUrl, 'https://docs.google.com/document/d/copy-id');
  assert.equal(replacements.length, manifest.requiredFields.length);
  for (const field of manifest.requiredFields) {
    assert.ok(replacements.some(([pattern, value]) => pattern.includes(field) && value === values[field]), field);
  }
});
