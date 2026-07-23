const APP_VERSION = '1.0.0';
const CONFIG = Object.freeze({
  // Identyfikator folderu docelowego (nie cały adres URL).
  DRIVE_FOLDER_ID: 'UZUPELNIJ_ID_FOLDERU',
  // Identyfikatory szablonów skonwertowanych do formatu Dokumentów Google.
  TEMPLATE_IDS: Object.freeze({ '11': 'UZUPELNIJ', '29': 'UZUPELNIJ', '29a': 'UZUPELNIJ' })
});
const REQUIRED = Object.freeze({
  '11': ['ADRES','DATA-WZNOWIENIA-PŁATNOŚCI','DATA_ANEKSU','DATA_WEJSCIA_W_ZYCIE','DATA_ZAWARCIA_UMOWY','DŁUGOŚĆ_ZAWIESZENIA','IMIE_NAZWISKO','KONIEC_ZAWIESZENIA','NOWY_KONIEC_UMOWY','NUMER_UMOWY','PESEL','START_ZAWIESZENIA'],
  '29': ['ADRES','DATA_ANEKSU','DATA_WEJSCIA_W_ZYCIE','DATA_ZAWARCIA_UMOWY','IMIE_NAZWISKO','NOWA_CENA','NUMER_UMOWY','PESEL'],
  '29a': ['ADRES','DATA_ANEKSU','DATA_WEJSCIA_W_ZYCIE','DATA_ZAWARCIA_UMOWY','IMIE_NAZWISKO','NOWA_CENA','NUMER_UMOWY','PESEL']
});

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, version: APP_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const started = Date.now();
  let request;
  try {
    request = JSON.parse(event.postData.contents);
    const result = generate_(request);
    safeLog_({ event: 'generation', annexId: request.annexId, requestId: request.requestId, ok: true, durationMs: Date.now() - started });
    return json_(result);
  } catch (error) {
    safeLog_({ event: 'generation', annexId: request && request.annexId, requestId: request && request.requestId, ok: false, code: error.name || 'ERROR', durationMs: Date.now() - started });
    return json_({ ok: false, requestId: request && request.requestId, message: String(error.message || error) });
  }
}

function generate_(request) {
  if (!request || request.action !== 'generate' || !/^[A-Za-z0-9-]{8,100}$/.test(request.requestId || '')) throw new Error('Nieprawidłowe żądanie.');
  const fields = REQUIRED[request.annexId];
  if (!fields) throw new Error('Ten aneks jest zablokowany albo nieobsługiwany.');
  const missing = fields.filter(field => !request.values || request.values[field] === undefined || request.values[field] === '');
  if (request.annexId === '11') {
    for (let i = 1; i <= 24; i++) { const n = String(i).padStart(2, '0'); missing.push(...[`RATA_${n}_KWOTA`,`RATA_${n}_TERMIN`].filter(k => !request.values || !request.values[k])); }
  }
  if (missing.length) throw new Error('Brak wymaganych pól: ' + missing.join(', '));
  const cache = CacheService.getScriptCache();
  const cached = cache.get('request:' + request.requestId);
  if (cached) return JSON.parse(cached);
  const templateId = CONFIG.TEMPLATE_IDS[request.annexId];
  if (!templateId || templateId === 'UZUPELNIJ') throw new Error('Administrator nie skonfigurował szablonu.');
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const copy = DriveApp.getFileById(templateId).makeCopy(`Aneks ${request.annexId} ${request.requestId}`, folder);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();
  Object.keys(request.values).forEach(key => body.replaceText(escapeRegex_('{{' + key + '}}'), String(request.values[key])));
  doc.saveAndClose();
  const result = { ok: true, requestId: request.requestId, documentUrl: doc.getUrl(), version: APP_VERSION };
  cache.put('request:' + request.requestId, JSON.stringify(result), 21600);
  return result;
}

function escapeRegex_(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
// Wyłącznie metadane techniczne z jawnej listy; nigdy values, PDF ani dane klienta.
function safeLog_(metadata) { console.log(JSON.stringify(metadata)); }
