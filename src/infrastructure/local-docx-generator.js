const INVALID_TEXT = /(?:NaN|Infinity|undefined|null)/i;
const PLACEHOLDER = /{{\s*([^{}]+?)\s*}}/g;

export function validateTemplateValues(values, requiredFields = []) {
  if (!values || typeof values !== 'object') throw new Error('Brak wartości aneksu.');
  const missing = requiredFields.filter(field => values[field] === undefined
    || values[field] === null || (typeof values[field] === 'string' && values[field].trim() === ''));
  if (missing.length) throw new Error(`Brak wymaganych danych: ${missing.join(', ')}`);

  const invalid = Object.entries(values).filter(([, value]) =>
    (typeof value === 'number' && !Number.isFinite(value)) || INVALID_TEXT.test(String(value))
  ).map(([field]) => field);
  if (invalid.length) throw new Error(`Nieprawidłowe wartości: ${invalid.join(', ')}`);
}

export function sanitizeFilenamePart(value) {
  return String(value).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[._ ]+|[._ ]+$/g, '') || 'brak_danych';
}

export function annex26Filename(values) {
  return `Aneks_26_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function remainingPlaceholders(zip) {
  const names = Object.keys(zip.files).filter(name => /^word\/.+\.xml$/.test(name));
  const found = new Set();
  for (const name of names) {
    const xml = zip.file(name)?.asText?.() || '';
    for (const match of xml.matchAll(PLACEHOLDER)) found.add(match[1].trim());
  }
  return [...found].sort();
}

export function renderDocx(templateBytes, prepared, dependencies = globalThis) {
  const { PizZip, docxtemplater: Docxtemplater } = dependencies;
  if (!PizZip || !Docxtemplater) throw new Error('Biblioteki DOCX nie zostały załadowane. Odśwież stronę i spróbuj ponownie.');
  validateTemplateValues(prepared.values, prepared.requiredFields);
  const zip = new PizZip(templateBytes);
  const unknown = remainingPlaceholders(zip).filter(field => !(field in prepared.values));
  if (unknown.length) throw new Error(`Nieuzupełnione placeholdery: ${unknown.join(', ')}`);
  const document = new Docxtemplater(zip, { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true, linebreaks: true });
  document.render(prepared.values);
  const placeholders = remainingPlaceholders(document.getZip());
  if (placeholders.length) throw new Error(`Nieuzupełnione placeholdery: ${placeholders.join(', ')}`);
  return document.getZip().generate({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function downloadAnnex26(prepared, options = {}) {
  const requiredFields = options.requiredFields || [];
  const input = { ...prepared, requiredFields };
  validateTemplateValues(input.values, requiredFields);
  const response = await (options.fetch || globalThis.fetch)(options.templateUrl || './src/annexes/26/template.docx');
  if (!response.ok) throw new Error('Nie udało się wczytać lokalnego szablonu aneksu 26.');
  const bytes = renderDocx(await response.arrayBuffer(), input, options.dependencies || globalThis);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = annex26Filename(input.values);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return { filename, bytes };
}
