/** Extracts the agreement number printed after "nr" in the contract heading. */
export function extractAgreementNumber(text) {
  const heading = String(text || '').replace(/\u00a0/g, ' ').slice(0, 4000);
  return heading.match(/\bnr(?:\s+umowy)?\s*[:#]?\s*([A-Z0-9_-]+(?:\/[A-Z0-9_-]+)+)/i)?.[1];
}
