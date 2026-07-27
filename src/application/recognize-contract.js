import { parseCurrentContract, validateCurrentContract } from '../domain/contract-extraction.js';

/** Application boundary guaranteeing one parser call per extracted PDF text. */
export function recognizeCurrentContract(rawText, parser = parseCurrentContract) {
  const currentContract = parser(rawText);
  return validateCurrentContract(currentContract);
}
