// `pnpm check:size`: bundle budgets on the built app (run `pnpm --filter web build` first).
// App JS (every script the browser or service worker loads) <= 250 kB gzip; the catalog <= 300 kB gzip.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dist = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));
const KB = 1000;
const JS_BUDGET = 250 * KB;
const CATALOG_BUDGET = 300 * KB;

if (!existsSync(dist)) {
  console.error('check:size: apps/web/dist not found; run `pnpm --filter web build` first.');
  process.exit(1);
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const jsFiles = [
  ...readdirSync(join(dist, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dist, 'assets', f)),
  ...readdirSync(dist)
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(dist, f)),
];
const catalogDir = join(dist, 'catalog');
const catalogFiles = existsSync(catalogDir)
  ? readdirSync(catalogDir)
      .filter((f) => f.endsWith('.json') && f !== 'catalog-manifest.json')
      .map((f) => join(catalogDir, f))
  : [];

const report = (label, files) => {
  let total = 0;
  for (const f of files) {
    const n = gz(f);
    total += n;
    console.log(`  ${(n / KB).toFixed(1).padStart(7)} kB  ${f.slice(dist.length)}`);
  }
  console.log(`${label}: ${(total / KB).toFixed(1)} kB gzip`);
  return total;
};

const js = report('app JS', jsFiles);
const catalog = report('catalog', catalogFiles);
let failed = false;
if (jsFiles.length === 0 || js > JS_BUDGET) {
  console.error(`check:size: app JS must be present and <= ${JS_BUDGET / KB} kB gzip`);
  failed = true;
}
if (catalogFiles.length === 0 || catalog > CATALOG_BUDGET) {
  console.error(`check:size: catalog must be present and <= ${CATALOG_BUDGET / KB} kB gzip`);
  failed = true;
}
process.exit(failed ? 1 : 0);
