import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url); const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive:true, force:true }); await mkdir(dist, { recursive:true });
for (const file of ['config.js','index.html','router.js']) await cp(new URL(`../${file}`,import.meta.url),new URL(`../dist/${file}`,import.meta.url));
await cp(new URL('../src',import.meta.url),new URL('../dist/src',import.meta.url),{recursive:true});
await cp(new URL('../docs/INSTRUKCJA_KONSULTANTA.md',import.meta.url),new URL('../dist/INSTRUKCJA_KONSULTANTA.md',import.meta.url));
await writeFile(new URL('../dist/VERSION',import.meta.url),'1.0.0\n');
try { execFileSync('zip',['-qr','tutlo-aneks-generator-1.0.0.zip','dist'],{cwd:new URL('../',import.meta.url)}); } catch { console.warn('Nie utworzono ZIP: polecenie zip jest niedostępne.'); }
