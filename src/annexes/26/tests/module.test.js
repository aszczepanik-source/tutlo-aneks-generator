import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { createGenerationPlan } from '../generator.js';
import { validate } from '../validator.js';

const completeInput = Object.fromEntries(manifest.requiredFields.map((field) => [field, `wartość ${field}`]));

test('aneks 26: manifest opisuje niezależny moduł', () => {
  assert.equal(manifest.id, '26');
  assert.equal(manifest.template, 'template.docx');
  assert.ok(manifest.requiredFields.length > 0);
});

test('aneks 26: walidator zgłasza wszystkie brakujące pola', () => {
  const issues = validate({});
  assert.deepEqual(issues.map((issue) => issue.field), manifest.requiredFields);
});

test('aneks 26: generator tworzy plan bez modyfikowania wartości', () => {
  const result = createGenerationPlan(completeInput);
  assert.equal(result.ok, true);
  assert.equal(result.annexId, '26');
  assert.deepEqual(result.values, completeInput);
  assert.match(result.templateUrl.pathname, /26\/template\.docx$/);
});
