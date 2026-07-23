import assert from 'node:assert/strict';
import test from 'node:test';
import { extractAgreementDate } from '../../src/domain/contract-extraction.js';

test('data umowy pochodzi wyłącznie z trzech ostatnich segmentów numeru', () => {
  assert.equal(extractAgreementDate('EL/JF/811/192956/3/9/2025'), '03.09.2025');
  assert.equal(extractAgreementDate('EL/JF/811/192956/31/2/2025'), undefined);
  assert.equal(extractAgreementDate('EL/JF/811/192956/3/13/2025'), undefined);
  assert.equal(extractAgreementDate('EL/JF/BEZ/DATY'), undefined);
});
