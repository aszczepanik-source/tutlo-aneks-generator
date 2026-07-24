import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('wczytanie i upuszczenie PDF nie uruchamia TEST POST', async () => {
  let script = await readFile(new URL('../../dist/app.js', import.meta.url), 'utf8');
  const contract = {
    rawText: 'umowa', agreementNumber: 'TEST/1', agreementDate: '03.09.2025',
    customerName: 'Jan Kowalski', address: 'Testowa 1', pesel: '90010112345',
    coursePrice: 1000, monthlyInstallment: 100, lessonCount: 20,
    monthlyLimit: 4, teacherTypes: 'Native Speaker'
  };
  script = script.replace(
    'let currentFile=null,currentContract=null,currentClassification=null;',
    `let currentFile=null,currentContract=${JSON.stringify(contract)},currentClassification=null;`
  );

  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', textContent: '', className: '', disabled: false, innerHTML: '', style: {},
      listeners: {}, classList: { add() {}, remove() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setCustomValidity() {}, showModal() {}, close() {}, appendChild() {},
      querySelector() { return element(`${id}-child`); }, reportValidity() { return true; }
    });
    return elements.get(id);
  };
  element('annex26NewInstallment').value = '80';
  element('annex26Bank').value = 'Inbank';
  element('annex26BankAccount').value = '12345678901234567890123456';

  const submittedForms = [];
  const appendedForms = [];
  let created = 0;
  const document = {
    getElementById: element,
    querySelectorAll: () => [],
    body: { appendChild(node) { appendedForms.push(node); } },
    createElement(tagName) {
      const node = {
        tagName: tagName.toUpperCase(), children: [], removed: false,
        appendChild(child) { this.children.push(child); },
        submit() { submittedForms.push(this); },
        remove() { this.removed = true; },
        addEventListener() {},
        set innerHTML(_value) {},
        querySelector() { return element(`created-${created++}-child`); }
      };
      return node;
    }
  };
  const context = {
    console, Date, Intl, Math, Map, Object, String, Number, RegExp, JSON, Promise, setTimeout,
    crypto: { randomUUID: () => 'pdf-regression' }, document,
    window: { fetch: async () => ({ ok: true, json: async () => ({}) }), open() { assert.fail('window.open nie powinno zostać wywołane'); } },
    alert() {}, pdfjsLib: { GlobalWorkerOptions: {} }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'file:///dist/app.js' });

  const pdf = { name: 'umowa.pdf', type: 'application/pdf' };
  element('pdfInput').listeners.change({ target: { files: [pdf] } });
  assert.equal(element('fileStatus').textContent, 'Wybrano: umowa.pdf');
  assert.equal(submittedForms.length, 0);

  let prevented = 0;
  let stopped = 0;
  element('dropzone').listeners.drop({
    dataTransfer: { files: [pdf] },
    preventDefault() { prevented += 1; },
    stopPropagation() { stopped += 1; }
  });
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  assert.equal(element('fileStatus').textContent, 'Wybrano: umowa.pdf');
  assert.equal(submittedForms.length, 0);

  element('testPostBtn').listeners.click();
  assert.equal(submittedForms.length, 1);
  assert.equal(appendedForms.length, 1);
  assert.equal(submittedForms[0].method, 'POST');
  assert.equal(submittedForms[0].target, '_blank');
  assert.equal(submittedForms[0].removed, true);
  assert.equal(submittedForms[0].children[0].name, 'payload');
});
