import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('dist file:// wykonuje formularz 26 aż do AppsScriptClient bez ReferenceError', async () => {
  let script = await readFile(new URL('../../dist/app.js', import.meta.url), 'utf8');
  const rawText = `Imię i nazwisko: Monika Wójcik Adres: Galileusza 10/13, 67-200 Głogów PESEL: 82111304868
    Liczba lekcji: 450 Limit miesięczny: 57 Typy lektorów: Lektor Polski, English Expert, Native Speaker
    Cena kursu: 11250,00 zł Rata miesięczna: 468,80 zł`;
  script = script.replace('let currentFile=null,currentContract=null,currentClassification=null;',
    `let currentFile=null,currentContract=${JSON.stringify({ rawText, agreementNumber: 'EL/JF/811/192956/3/9/2025' })},currentClassification=null;`);

  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', textContent: '', className: '', disabled: false, innerHTML: '', style: {},
      listeners: {}, classList: { add() {}, remove() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setCustomValidity() {}, showModal() {}, close() {}, appendChild() {},
      querySelector() { return element(`${id}-child`); }
    });
    return elements.get(id);
  };
  element('annex26NewInstallment').value = '400,00';
  element('annex26Bank').value = 'Test Bank';
  element('annex26BankAccount').value = '12345678901234567890123456';

  let request;
  let opened;
  const context = {
    console, Date, Intl, Math, Map, Object, String, Number, RegExp, JSON, Promise, setTimeout,
    crypto: { randomUUID: () => 'runtime-26' },
    fetch: async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true, documentUrl: 'https://docs.google.com/document/d/runtime-26' }) };
    },
    window: { open: url => { opened = url; } }, alert() {},
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      createElement: () => element(`created-${elements.size}`)
    },
    pdfjsLib: { GlobalWorkerOptions: {} }
  };
  context.globalThis = context;
  vm.createContext(context);
  assert.doesNotThrow(() => vm.runInContext(script, context, { filename: 'file:///dist/app.js' }));
  await element('annex26Form').listeners.submit({ preventDefault() {} });

  assert.equal(request.annexId, '26');
  assert.equal(request.values.NUMER_UMOWY, 'EL/JF/811/192956/3/9/2025');
  assert.equal(request.values.NUMER_RACHUNKU_BANKU, '12345678901234567890123456');
  assert.equal(opened, 'https://docs.google.com/document/d/runtime-26');
  assert.equal(element('annex26Status').textContent, 'Aneks został wygenerowany.');
});
