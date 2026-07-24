import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dist = new URL('../dist/', import.meta.url);
const version = '1.1.0';

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8'))
  .replaceAll('Wersja 1.0.0', `Wersja ${version}`);
await writeFile(new URL('../dist/index.html', import.meta.url), html);
await cp(new URL('../router.js', import.meta.url), new URL('../dist/router.js', import.meta.url));
await cp(new URL('../src/', import.meta.url), new URL('../dist/src/', import.meta.url), { recursive: true });
await cp(new URL('../docs/INSTRUKCJA_KONSULTANTA.md', import.meta.url), new URL('../dist/INSTRUKCJA_KONSULTANTA.md', import.meta.url));
await writeFile(new URL('../dist/VERSION', import.meta.url), `${version}\n`);

const archive = `tutlo-aneks-generator-${version}.zip`;
await rm(new URL(`../${archive}`, import.meta.url), { force: true });
try {
  execFileSync('zip', ['-qr', archive, 'dist'], { cwd: root });
} catch {
  console.warn('Nie utworzono ZIP: polecenie zip jest niedostępne.');
}
