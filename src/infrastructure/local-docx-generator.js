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

export function annex25Filename(values) {
  return `Aneks_25_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
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
  if (!PizZip) throw new Error('Nie udało się załadować biblioteki PizZip. Odśwież stronę i spróbuj ponownie.');
  if (!Docxtemplater) throw new Error('Nie udało się załadować biblioteki docxtemplater. Odśwież stronę i spróbuj ponownie.');
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

export function annex26TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/26/template.docx', moduleUrl).href;
}

function templateFetchError(url, response) {
  const status = response ? String(response.status) : 'niedostępny (błąd sieci)';
  const statusText = response?.statusText || 'niedostępny';
  return new Error(`Nie udało się pobrać zasobu template.docx. URL: ${url}. HTTP status: ${status}. statusText: ${statusText}.`);
}

export async function downloadAnnex26(prepared, options = {}) {
  const requiredFields = options.requiredFields || [];
  const input = { ...prepared, requiredFields };
  validateTemplateValues(input.values, requiredFields);
  const templateUrl = options.templateUrl
    ? new URL(options.templateUrl, options.baseUrl || globalThis.document?.baseURI || import.meta.url).href
    : annex26TemplateUrl();
  let response;
  try {
    response = await (options.fetch || globalThis.fetch)(templateUrl);
  } catch (cause) {
    throw templateFetchError(templateUrl, null, cause);
  }
  if (!response.ok) throw templateFetchError(templateUrl, response);
  const bytes = renderDocx(await response.arrayBuffer(), input, options.dependencies || globalThis);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = annex26Filename(input.values);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return { filename, bytes };
}

export async function downloadAnnex25(prepared, options = {}) {
  const input = { ...prepared, requiredFields: options.requiredFields || prepared.requiredFields || [] };
  validateTemplateValues(input.values, input.requiredFields);
  const templateUrl = new URL(options.templateUrl || '../annexes/25/template.docx',
    options.baseUrl || globalThis.document?.baseURI || import.meta.url).href;
  let response;
  try { response = await (options.fetch || globalThis.fetch)(templateUrl); } catch { throw templateFetchError(templateUrl, null); }
  if (!response.ok) throw templateFetchError(templateUrl, response);
  const bytes = renderDocx(await response.arrayBuffer(), input, options.dependencies || globalThis);
  const filename = annex25Filename(input.values);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.appendChild(anchor);
  anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return { filename, bytes };
}
