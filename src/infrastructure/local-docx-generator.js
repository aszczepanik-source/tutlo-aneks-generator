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
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks ${safeCustomerName}.docx` : 'Aneks.docx';
}

export function annex27Filename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 27 ${safeCustomerName}.docx` : 'Aneks 27.docx';
}

export function annex25Filename(values) {
  return `Aneks_25_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function annex25aFilename(values) {
  return `Aneks_25a_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function annex11Filename(values) {
  return `Aneks_11_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function annex29Filename(values) {
  return `Aneks_29_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function annex29aFilename(values) {
  return `Aneks_29a_${sanitizeFilenamePart(values.NUMER_UMOWY)}_${sanitizeFilenamePart(values.IMIE_NAZWISKO)}.docx`;
}

export function annex43Filename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 43 – ${safeCustomerName}.docx` : 'Aneks 43.docx';
}

export function annex45CFilename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 45C – ${safeCustomerName}.docx` : 'Aneks 45C.docx';
}

export function annex45EFilename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 45e – ${safeCustomerName}.docx` : 'Aneks 45e.docx';
}

export function annex45Filename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 45 – ${safeCustomerName}.docx` : 'Aneks 45.docx';
}

export function annex48Filename(values) {
  const safeCustomerName = String(values.IMIE_NAZWISKO ?? '')
    .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  return safeCustomerName ? `Aneks 48 – ${safeCustomerName}.docx` : 'Aneks 48.docx';
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
  const loopFields = new Set(Object.values(prepared.values).filter(Array.isArray)
    .flatMap(rows => rows.flatMap(row => Object.keys(row))));
  const unknown = remainingPlaceholders(zip).filter(field => !field.startsWith('#') && !field.startsWith('/')
    && !(field in prepared.values) && !loopFields.has(field));
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

export function annex27TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/27/template.docx', moduleUrl).href;
}

export function annex25TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/25/template.docx', moduleUrl).href;
}

export function annex25aTemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/25a/template.docx', moduleUrl).href;
}

export function annex11TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/11/template.docx', moduleUrl).href;
}

export function annex29TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/29/template.docx', moduleUrl).href;
}

export function annex29aTemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/29a/template.docx', moduleUrl).href;
}

export function annex43TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/43/template.docx', moduleUrl).href;
}

export function annex45CTemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/45c/template.docx', moduleUrl).href;
}

export function annex45ETemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/45e/template.docx', moduleUrl).href;
}

export function annex45TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/45/template.docx', moduleUrl).href;
}

export function annex48TemplateUrl(moduleUrl = import.meta.url) {
  return new URL('../annexes/48/template.docx', moduleUrl).href;
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

export function downloadAnnex27(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex27TemplateUrl(), annex27Filename);
}

export function downloadAnnex45E(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex45ETemplateUrl(), annex45EFilename);
}

export async function downloadAnnex25(prepared, options = {}) {
  const input = { ...prepared, requiredFields: options.requiredFields || prepared.requiredFields || [] };
  validateTemplateValues(input.values, input.requiredFields);
  const templateUrl = options.templateUrl
    ? new URL(options.templateUrl, options.baseUrl || globalThis.document?.baseURI || import.meta.url).href
    : annex25TemplateUrl();
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

export async function downloadAnnex11(prepared, options = {}) {
  const input = { ...prepared, requiredFields: options.requiredFields || prepared.requiredFields || [] };
  validateTemplateValues(input.values, input.requiredFields);
  const templateUrl = options.templateUrl
    ? new URL(options.templateUrl, options.baseUrl || globalThis.document?.baseURI || import.meta.url).href
    : annex11TemplateUrl();
  let response;
  try { response = await (options.fetch || globalThis.fetch)(templateUrl); } catch { throw templateFetchError(templateUrl, null); }
  if (!response.ok) throw templateFetchError(templateUrl, response);
  const bytes = renderDocx(await response.arrayBuffer(), input, options.dependencies || globalThis);
  const filename = annex11Filename(input.values);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.appendChild(anchor);
  anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return { filename, bytes };
}

async function downloadAutomaticAnnex(prepared, options, templateUrl, filename) {
  const input = { ...prepared, requiredFields: options.requiredFields || prepared.requiredFields || [] };
  validateTemplateValues(input.values, input.requiredFields);
  const resolvedTemplateUrl = options.templateUrl
    ? new URL(options.templateUrl, options.baseUrl || globalThis.document?.baseURI || import.meta.url).href
    : templateUrl;
  let response;
  try { response = await (options.fetch || globalThis.fetch)(resolvedTemplateUrl); }
  catch { throw templateFetchError(resolvedTemplateUrl, null); }
  if (!response.ok) throw templateFetchError(resolvedTemplateUrl, response);
  const bytes = renderDocx(await response.arrayBuffer(), input, options.dependencies || globalThis);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename(input.values); anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  return { filename: filename(input.values), bytes };
}

export function downloadAnnex29(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex29TemplateUrl(), annex29Filename);
}

export function downloadAnnex29a(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex29aTemplateUrl(), annex29aFilename);
}

export function downloadAnnex43(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex43TemplateUrl(), annex43Filename);
}

export function downloadAnnex45C(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex45CTemplateUrl(), annex45CFilename);
}

export function downloadAnnex45(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex45TemplateUrl(), annex45Filename);
}

export function downloadAnnex48(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex48TemplateUrl(), annex48Filename);
}

export function downloadAnnex25a(prepared, options = {}) {
  return downloadAutomaticAnnex(prepared, options, annex25aTemplateUrl(), annex25aFilename);
}
