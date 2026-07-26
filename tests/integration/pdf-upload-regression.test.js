import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindPdfFileUpload, isPdfFile } from '../../src/application/pdf-file-upload.js';

class FakeElement {
  constructor() {
    this.listeners = {};
    this.value = '';
    this.classList = { add() {}, remove() {} };
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  dispatch(type, event = {}) {
    event.target ||= this;
    this.listeners[type](event);
  }
}

function setup(handlePdfFile = () => {}) {
  const input = new FakeElement();
  const dropzone = new FakeElement();
  bindPdfFileUpload({ input, dropzone, handlePdfFile });
  return { input, dropzone };
}

function dragEvent(file) {
  let prevented = false;
  let stopped = false;
  return {
    dataTransfer: { files: file ? [file] : [] },
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
    get prevented() { return prevented; },
    get stopped() { return stopped; }
  };
}

const pdf = { name: 'umowa.pdf', type: 'application/pdf' };

test('drag events suppress the browser default, including opening a dropped PDF', () => {
  const { dropzone } = setup();
  for (const type of ['dragover', 'dragenter', 'drop']) {
    const event = dragEvent(pdf);
    dropzone.dispatch(type, event);
    assert.equal(event.prevented, true, `${type} must be prevented`);
    assert.equal(event.stopped, true, `${type} propagation must be stopped`);
  }
});

test('drop passes the PDF to the file handler', () => {
  let selected;
  const { dropzone } = setup(file => { selected = file; });
  dropzone.dispatch('drop', dragEvent(pdf));
  assert.equal(selected, pdf);
});

test('input selection passes the PDF to the file handler', () => {
  let selected;
  const { input } = setup(file => { selected = file; });
  input.dispatch('change', { target: { files: [pdf], value: 'C:\\fakepath\\umowa.pdf' } });
  assert.equal(selected, pdf);
});

test('drop and input use the exact same handler', () => {
  const handled = [];
  const handler = file => handled.push(file);
  const { input, dropzone } = setup(handler);
  input.dispatch('change', { target: { files: [pdf], value: 'selected' } });
  dropzone.dispatch('drop', dragEvent(pdf));
  assert.deepEqual(handled, [pdf, pdf]);
});

test('input is reset so selecting the same PDF again is supported', () => {
  let calls = 0;
  const { input } = setup(() => { calls += 1; });
  const target = { files: [pdf], value: 'selected' };
  input.dispatch('change', { target });
  assert.equal(target.value, '');
  target.value = 'selected';
  input.dispatch('change', { target });
  assert.equal(calls, 2);
});

test('PDF validation accepts MIME or extension and rejects other files', () => {
  assert.equal(isPdfFile(pdf), true);
  assert.equal(isPdfFile({ name: 'skan.PDF', type: '' }), true);
  assert.equal(isPdfFile({ name: 'umowa.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), false);
});

test('page stores the file, shows its name and clears it without starting analysis', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /function handlePdfFile\(file\)/);
  assert.match(html, /currentFile=file;/);
  assert.match(html, /setStatus\(`Wybrano: \$\{file\.name\}`,'ok'\)/);
  assert.match(html, /bindPdfFileUpload\(\{input:els\.input,dropzone:els\.dropzone,handlePdfFile\}\)/);
  assert.match(html, /currentFile=null;currentContract=null;currentClassification=null;els\.input\.value=''/);
  assert.doesNotMatch(html, /function handlePdfFile\(file\)[\s\S]*?\n  \}\n[\s\S]*?analyze\(\)/);
});

test('invalid files produce the PDF error and the input remains enabled and labelled', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /if\(!isPdfFile\(file\)\)\{setStatus\('Wybierz plik PDF\.','error'\);return;\}/);
  assert.match(html, /<label class="dropzone" id="dropzone" for="pdfInput">/);
  assert.match(html, /<input id="pdfInput" type="file" accept="application\/pdf,\.pdf"/);
  assert.doesNotMatch(html, /<input id="pdfInput"[^>]*disabled/);
});
