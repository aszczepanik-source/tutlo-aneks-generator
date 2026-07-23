import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const version = '1.0.1';

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const sourceHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const moduleMatch = sourceHtml.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!moduleMatch) throw new Error('Nie znaleziono skryptu aplikacji w index.html.');

const uiScript = moduleMatch[1]
  .replace(/^\s*import .*?;\s*$/gm, '')
  .replace(/\s*pdfjsLib\.GlobalWorkerOptions\.workerSrc\s*=\s*\n?\s*['"][^'"]+['"];?/, "\n  pdfjsLib.GlobalWorkerOptions.workerSrc =\n    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';");

const configSource = await readFile(new URL('../config.js', import.meta.url), 'utf8');
const endpoint = configSource.match(/APPS_SCRIPT_URL\s*=\s*\n?\s*['"]([^'"]+)['"]/i)?.[1];
if (!endpoint) throw new Error('Nie znaleziono APPS_SCRIPT_URL w config.js.');

const annexIds = ['11', '25', '26', '29', '29a', '43'];
const manifests = await Promise.all(annexIds.map(async id =>
  JSON.parse(await readFile(new URL(`../src/annexes/${id}/manifest.json`, import.meta.url), 'utf8'))
));
const calculationSource = (await readFile(new URL('../src/domain/annex-calculations.js', import.meta.url), 'utf8'))
  .replace(/^export\s+/gm, '');
const extractionSource = (await readFile(new URL('../src/domain/contract-extraction.js', import.meta.url), 'utf8'))
  .replace(/^export\s+/gm, '');
const annex26ExtractionSource = (await readFile(new URL('../src/annexes/26/extractor.js', import.meta.url), 'utf8'))
  .replace(/^export\s+/gm, '');
const validationSource = (await readFile(new URL('../src/annexes/shared/validation.js', import.meta.url), 'utf8'))
  .replace(/^export\s+/gm, '');
const annex26ValidationSource = (await readFile(new URL('../src/annexes/26/validator.js', import.meta.url), 'utf8'))
  .replace(/^export\s+/gm, '');
const annex26GeneratorSource = (await readFile(new URL('../src/annexes/26/generator.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/manifest\.(id|template|templateVersion)/g, (_, key) => `annexManifests.get('26').${key}`);
const annex43GeneratorSource = (await readFile(new URL('../src/annexes/43/generator.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '')
  .replace(/^export\s+/gm, '')
  .replace(/manifest\.(id|template|templateVersion|requiredFields)/g, (_, key) => `annexManifests.get('43').${key}`);
const preparationSource = (await readFile(new URL('../src/application/prepare-annex.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\s*$/gm, '')
  .replace("const manifests = { '11': manifest11, '26': manifest26, '29': manifest29, '29a': manifest29a };", 'const manifests = Object.fromEntries(annexManifests);')
  .replace(/^export\s+/gm, '');

const runtime = `/* Wygenerowany bundle release ${version}. Bez ES Modules. */
(() => {
  'use strict';
  const APPS_SCRIPT_URL = ${JSON.stringify(endpoint)};
  const annexManifests = new Map(${JSON.stringify(manifests.map(manifest => [manifest.id, manifest]))});

  function getAnnexRoute(annexId, contract) {
    const manifest = annexManifests.get(String(annexId));
    if (!manifest || manifest.available !== true) return undefined;
    if (manifest.id === '43'
      && !String(contract?.rawText || '').toLowerCase().includes(manifest.availabilityText)) return undefined;
    const createGenerationPlan = input => {
      const source = input && typeof input === 'object' ? input : {};
      const issues = manifest.requiredFields.flatMap(field => {
        const value = source[field];
        return value === undefined || value === null || value === ''
          ? [{ code: 'REQUIRED_FIELD', field, message: \`Pole \${field} jest wymagane.\` }]
          : [];
      });
      return issues.length
        ? Object.freeze({ ok: false, annexId: manifest.id, issues: Object.freeze(issues) })
        : Object.freeze({ ok: true, annexId: manifest.id, templateUrl: manifest.template, values: Object.freeze({ ...source }) });
    };
    return Object.freeze({
      number: manifest.id, name: manifest.label, available: manifest.available,
      template: manifest.template, requiredPlaceholders: Object.freeze([...manifest.requiredFields]),
      status: manifest.status, blockingReason: manifest.blockingReason, createGenerationPlan
    });
  }

  class AppsScriptClient {
    constructor(endpoint, fetchImpl = globalThis.fetch) {
      this.endpoint = endpoint; this.fetch = fetchImpl; this.inFlight = new Map();
    }
    generate(prepared, requestId = globalThis.crypto?.randomUUID?.() || \`req-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`) {
      if (this.inFlight.has(requestId)) return this.inFlight.get(requestId);
      const operation = this.fetch(this.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'generate', requestId, ...prepared })
      }).then(async response => {
        if (!response.ok) throw new Error('Usługa generowania jest niedostępna.');
        return response.json();
      }).then(result => {
        if (!result.ok || !result.documentUrl) throw new Error(result.message || 'Nie udało się utworzyć dokumentu.');
        return result;
      }).finally(() => this.inFlight.delete(requestId));
      this.inFlight.set(requestId, operation);
      return operation;
    }
  }
${calculationSource}
${extractionSource}
${annex26ExtractionSource}
${validationSource}
${annex26ValidationSource}
${annex26GeneratorSource}
${annex43GeneratorSource}
${preparationSource}
${uiScript}
})();
`;

const releaseScripts = `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="app.js"></script>`;
const releaseHtml = sourceHtml
  .replace(moduleMatch[0], releaseScripts)
  .replaceAll('Wersja 1.0.0', `Wersja ${version}`);

await writeFile(new URL('../dist/index.html', import.meta.url), releaseHtml);
await writeFile(new URL('../dist/app.js', import.meta.url), runtime);
await cp(new URL('../docs/INSTRUKCJA_KONSULTANTA.md', import.meta.url), new URL('../dist/INSTRUKCJA_KONSULTANTA.md', import.meta.url));
await writeFile(new URL('../dist/VERSION', import.meta.url), `${version}\n`);

const archive = `tutlo-aneks-generator-${version}.zip`;
await rm(new URL(`../${archive}`, import.meta.url), { force: true });
try {
  execFileSync('zip', ['-qr', archive, 'dist'], { cwd: root });
} catch {
  console.warn('Nie utworzono ZIP: polecenie zip jest niedostępne.');
}
