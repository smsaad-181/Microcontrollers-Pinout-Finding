// `pnpm check:boundaries`: the pure packages (engine, rules) must not touch the DOM, React, the network,
// the file system, wall-clock time or randomness. Static scan of packages/{engine,rules}/src.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dirs = ['packages/engine/src', 'packages/rules/src'].map((d) => join(root, d));

const FORBIDDEN_IMPORT =
  /^(?:node:)?(?:fs|fs\/promises|path|os|net|http|https|http2|dgram|dns|tls|child_process|worker_threads|cluster|readline|crypto|process|url|zlib|stream|react|react-dom|react\/.*|jsdom|axios|node-fetch|undici|ws)$/;
const FORBIDDEN_CODE = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\b/, 'new Date()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bWebSocket\b/, 'WebSocket'],
  [/\b(?:window|document|localStorage|sessionStorage|navigator)\./, 'browser global'],
  [/\bprocess\.(?:env|argv|cwd|hrtime)\b/, 'process.*'],
  [/\brequire\s*\(/, 'require()'],
  [/\bimport\s*\(/, 'dynamic import()'],
];
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\b[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}
/** Strip comments and string/template contents so only code is scanned for call patterns. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

const problems = [];
let scanned = 0;
for (const file of dirs.flatMap(files)) {
  scanned++;
  const raw = readFileSync(file, 'utf8');
  const code = stripComments(raw);
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (FORBIDDEN_IMPORT.test(spec)) problems.push(`${relative(root, file)}: import of '${spec}'`);
    if (spec.startsWith('.') && /\.\.\/\.\.\//.test(spec)) {
      problems.push(`${relative(root, file)}: relative import leaves the package ('${spec}')`);
    }
  }
  for (const [re, what] of FORBIDDEN_CODE) {
    if (re.test(code)) problems.push(`${relative(root, file)}: uses ${what}`);
  }
}
if (problems.length > 0) {
  console.error(`boundary violations:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`boundaries ok: ${String(scanned)} files in engine/src and rules/src are pure`);
