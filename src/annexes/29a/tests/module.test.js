import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../manifest.json' with { type: 'json' };
import { createGenerationPlan } from '../generator.js';
import { validate } from '../validator.js';

const completeInput = Object.fromEntries(manifest.requiredFields.map((field) => [field, `wartość ${field}`]));

test('aneks 29a: manifest opisuje niezależny moduł', () => {
  assert.equal(manifest.id, '29a');
  assert.equal(manifest.template, 'template.docx');
  assert.ok(manifest.requiredFields.length > 0);
});

test('aneks 29a: walidator zgłasza wszystkie brakujące pola', () => {
  const issues = validate({});
  assert.deepEqual(issues.map((issue) => issue.field), manifest.requiredFields);
});

test('aneks 29a: generator tworzy plan bez modyfikowania wartości', () => {
  const result = createGenerationPlan(completeInput);
  assert.equal(result.ok, true);
  assert.equal(result.annexId, '29a');
  assert.deepEqual(result.values, completeInput);
  assert.match(result.templateUrl.pathname, /29a\/template\.docx$/);
});
