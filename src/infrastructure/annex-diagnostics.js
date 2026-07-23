const DIAGNOSTIC_KEY_PATTERN = /(date|data|agreement)/i;

export function matchingDiagnosticKeys(value, prefix = '', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const match = DIAGNOSTIC_KEY_PATTERN.test(key) ? [path] : [];
    return match.concat(matchingDiagnosticKeys(child, path, seen));
  });
}

export function logAnnex26Diagnostic(label, value) {
  console.log(`[Aneks 26] ${label}`, value);
  console.log(`[Aneks 26] Klucze date/data/agreement (${label})`, matchingDiagnosticKeys(value));
}
