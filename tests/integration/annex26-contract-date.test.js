import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAgreementDateFromNumber } from '../../src/annexes/26/extractor.js';

test('data umowy pochodzi wyłącznie z trzech ostatnich segmentów numeru', () => {
  assert.equal(extractAgreementDateFromNumber('EL/JF/811/192956/3/9/2025'), '2025-09-03');
  assert.equal(extractAgreementDateFromNumber('EL/JF/811/192956/31/2/2025'), undefined);
  assert.equal(extractAgreementDateFromNumber('EL/JF/811/192956/3/13/2025'), undefined);
  assert.equal(extractAgreementDateFromNumber('EL/JF/BEZ/DATY'), undefined);
});
