// Evidence link checker. Reads every `url:` / `url_original:` in catalog/evidence/*.yaml and asks the
// server whether it still answers. Dead links (404, 410, DNS failure) fail the run; links that block
// robots (401, 403, 429, 5xx, timeouts) are reported as "unverified" and do not fail it.
// Usage: node tools/check-links.mjs [--json out.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'catalog/evidence';
const UA = 'Mozilla/5.0 (compatible; pinout-finder-link-check; +https://github.com/smsaad-181/Microcontrollers-Pinout-Finding)';
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

const links = new Map(); // url -> evidence ids
for (const f of readdirSync(DIR).filter((n) => n.endsWith('.yaml'))) {
  const id = f.replace(/\.yaml$/, '');
  for (const m of readFileSync(join(DIR, f), 'utf8').matchAll(/^(?:url|url_original):\s*"?(https?:\/\/[^\s"]+)"?\s*$/gm)) {
    const set = links.get(m[1]) ?? new Set();
    set.add(id);
    links.set(m[1], set);
  }
}

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return { state: 'ok', status: res.status };
      if (res.status === 404 || res.status === 410) {
        if (method === 'GET') return { state: 'dead', status: res.status };
        continue; // some servers answer HEAD wrongly: retry with GET
      }
      if (method === 'GET') return { state: 'unverified', status: res.status };
    } catch (e) {
      const code = e?.cause?.code ?? e?.name ?? 'error';
      if (code === 'ENOTFOUND') return { state: 'dead', status: code };
      if (method === 'GET') return { state: 'unverified', status: String(code) };
    }
  }
  return { state: 'unverified', status: '?' };
}

const urls = [...links.keys()];
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      results.push({ url, evidence: [...links.get(url)], ...(await probe(url)) });
    }
  }),
);
results.sort((a, b) => a.url.localeCompare(b.url));

const by = (s) => results.filter((r) => r.state === s);
for (const r of [...by('dead'), ...by('unverified')]) {
  console.log(`${r.state.toUpperCase().padEnd(10)} ${String(r.status).padEnd(8)} ${r.url}  (${r.evidence.join(', ')})`);
}
console.log(`\n${urls.length} links: ${by('ok').length} ok, ${by('unverified').length} unverified, ${by('dead').length} dead`);
const j = process.argv.indexOf('--json');
if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(results, null, 2));
process.exit(by('dead').length > 0 ? 1 : 0);
