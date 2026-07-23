export function createRequestId(cryptoApi = globalThis.crypto) {
  return cryptoApi?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class AppsScriptClient {
  constructor(endpoint, request) { this.endpoint = endpoint; this.request = request; this.inFlight = new Map(); }
  generate(prepared, requestId = createRequestId()) {
    if (this.inFlight.has(requestId)) return this.inFlight.get(requestId);
    const options = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'generate', requestId, ...prepared })
    };
    const operation = (this.request ? this.request(this.endpoint, options) : window.fetch(this.endpoint, options))
      .then(async response => { if (!response.ok) throw new Error('Usługa generowania jest niedostępna.'); return response.json(); })
      .then(result => { if (!result.ok || !result.documentUrl) throw new Error(result.message || 'Nie udało się utworzyć dokumentu.'); return result; })
      .finally(() => this.inFlight.delete(requestId));
    this.inFlight.set(requestId, operation);
    return operation;
  }
}

export function createGenerateHandler(client, prepare, onStage = () => {}) {
  let busy = false;
  return async (...args) => {
    if (busy) return { ignored: true };
    busy = true;
    try {
      onStage('Obliczenia'); const prepared = await prepare(...args);
      onStage('Tworzenie dokumentu'); const result = await client.generate(prepared);
      onStage('Zapis na Google Drive'); return result;
    } finally { busy = false; }
  };
}
