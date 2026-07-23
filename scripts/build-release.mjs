import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url); const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive:true, force:true }); await mkdir(dist, { recursive:true });
for (const file of ['index.html','router.js']) await cp(new URL(`../${file}`,import.meta.url),new URL(`../dist/${file}`,import.meta.url));
await cp(new URL('../src',import.meta.url),new URL('../dist/src',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/config.js',import.meta.url), "window.TUTLO_CONFIG = { appsScriptUrl: 'UZUPELNIJ_ADRES_WDROZENIA' };\n");
let html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');html=html.replace('<script>\n  const GENERATOR_URLS', '<script src="config.js"></script>\n<script>\n  const GENERATOR_URLS');await writeFile(new URL('../dist/index.html',import.meta.url),html);
await cp(new URL('../docs/INSTRUKCJA_KONSULTANTA.md',import.meta.url),new URL('../dist/INSTRUKCJA_KONSULTANTA.md',import.meta.url));
await writeFile(new URL('../dist/VERSION',import.meta.url),'1.0.0\n');
try { execFileSync('zip',['-qr','tutlo-aneks-generator-1.0.0.zip','dist'],{cwd:new URL('../',import.meta.url)}); } catch { console.warn('Nie utworzono ZIP: polecenie zip jest niedostępne.'); }
