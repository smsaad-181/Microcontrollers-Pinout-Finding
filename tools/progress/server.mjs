// Local build-progress dashboard. Zero dependencies; reads docs/STATE.md, the phase files and git.
// Usage: node tools/progress/server.mjs [port]   → http://localhost:4300
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4300);
const PHASES = ['0', '1', '2a', '2b', '3', '4', '5'];

function read(rel) {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function section(md, title) {
  const m = md.match(new RegExp(`^## ${title}\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 4000 }).trim();
  } catch {
    return '';
  }
}

function parseTable(text) {
  return text
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
    .map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
    .slice(1);
}

function parseChecklist(text) {
  const tasks = [];
  let phase = null;
  for (const line of text.split('\n')) {
    const ph = line.match(/^\*\*Phase (\S+)\*\*/);
    if (ph) phase = ph[1];
    const t = line.match(/^- \[(.)\] (\S+) · (.+?) · _(.+)_$/);
    if (t && phase) tasks.push({ phase, mark: t[1], id: t[2], desc: t[3], owner: t[4] });
  }
  return tasks;
}

function validationReports() {
  const dir = join(root, 'docs', 'validation');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of readdirSync(join(dir, d.name))) {
      if (!f.endsWith('.md')) continue;
      const txt = readFileSync(join(dir, d.name, f), 'utf8');
      const v = txt.match(/VERDICT:\s*(PASS|FAIL)/g);
      out.push({ phase: d.name, file: f, verdict: v ? v[v.length - 1].split(/\s+/)[1] : '—' });
    }
  }
  return out;
}

async function probe(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(800) });
    return r.ok;
  } catch {
    return false;
  }
}

async function state() {
  const md = read('docs/STATE.md');
  const tasks = parseChecklist(section(md, 'Task checklist'));
  const phases = parseTable(section(md, 'Phases')).map(([id, name, status, branch, validation, notes]) => {
    const t = tasks.filter((x) => x.phase === id);
    return {
      id, name, status, branch, validation, notes,
      total: t.length,
      done: t.filter((x) => x.mark === 'x').length,
      doing: t.filter((x) => x.mark === '~').length,
      deferred: t.filter((x) => x.mark === '-').length,
    };
  });
  const total = tasks.length;
  const done = tasks.filter((t) => t.mark === 'x').length;
  return {
    updated: new Date().toISOString(),
    lastUpdated: (md.match(/Last updated: ([^\n]+)/) ?? [])[1] ?? '',
    percent: total ? Math.round((done / total) * 100) : 0,
    totals: {
      total, done,
      doing: tasks.filter((t) => t.mark === '~').length,
      deferred: tasks.filter((t) => t.mark === '-').length,
    },
    phases,
    tasks,
    current: section(md, 'Current task'),
    decisions: section(md, 'Decisions needed'),
    log: parseTable(section(md, 'Log')).slice(-12).reverse(),
    branch: git('branch', '--show-current'),
    commits: git('log', '--all', '-15', '--date=format:%m-%d %H:%M', '--pretty=%h\t%ad\t%d\t%s')
      .split('\n').filter(Boolean).map((l) => l.split('\t')),
    dirty: git('status', '--porcelain').split('\n').filter(Boolean).length,
    working: git('status', '--porcelain', '--untracked-files=all')
      .split('\n').filter(Boolean)
      .map((l) => /^\s*(\S+)\s+(.*)$/.exec(l))
      .filter((m) => m !== null)
      .map((m) => ({ st: m[1], path: m[2] }))
      .slice(0, 40),
    reports: validationReports(),
    webDev: await probe('http://localhost:5173/Microcontrollers-Pinout-Finding/'),
    phaseOrder: PHASES,
  };
}

const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

createServer(async (req, res) => {
  if (req.url === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(await state()));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(page);
}).listen(port, '127.0.0.1', () => {
  console.log(`Progress dashboard: http://localhost:${port}`);
});
