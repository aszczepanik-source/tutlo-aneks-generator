import { parseCurrentContract, validateCurrentContract } from '../domain/contract-extraction.js?v=1.1.1';

/** Application boundary guaranteeing one parser call per extracted PDF text. */
export function recognizeCurrentContract(rawText, parser = parseCurrentContract) {
  const currentContract = parser(rawText);
  return validateCurrentContract(currentContract);
}
