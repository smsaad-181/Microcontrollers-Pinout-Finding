import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDiagnostic, runCli } from '../src/index.js';
import { EMPTY_CATALOG, REPO_ROOT, VALID_ROOT, invalidCases, invalidRoot } from './helpers.js';

function run(argv: string[], env: Record<string, string | undefined> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = runCli(argv, {
    cwd: REPO_ROOT,
    env: { SOURCE_DATE_EPOCH: '1767225600', ...env }, // 2026-01-01T00:00:00Z
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const rel = (p: string) => relative(REPO_ROOT, p).replaceAll('\\', '/');

describe('formatDiagnostic', () => {
  it('prints severity, code, root-relative file and dot path', () => {
    expect(
      formatDiagnostic({
        severity: 'error',
        code: 'E_SCHEMA',
        file: 'chips/demo-mcu-1.yaml',
        path: 'pads.GPIO2.gpio',
        message: 'expected number',
      }),
    ).toBe('error E_SCHEMA chips/demo-mcu-1.yaml pads.GPIO2.gpio: expected number');
    expect(
      formatDiagnostic({
        severity: 'error',
        code: 'E_YAML',
        file: 'chips/x.yaml',
        path: '',
        message: 'm',
      }),
    ).toBe('error E_YAML chips/x.yaml (root): m');
  });
});

describe('catalog validate (in-process)', () => {
  it('exits 0 on the valid root and prints a coverage report', () => {
    const r = run(['validate', '--root', rel(VALID_ROOT)]);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain('0 errors');
    expect(r.out).toMatch(/verified\s+39/);
    expect(r.out).toMatch(/interim\s+1/);
    expect(r.out).toMatch(/missing\s+1/);
    expect(r.out).toContain('demo-board-1@r1');
  });

  it('accepts --root=<dir> and absolute paths', () => {
    expect(run(['validate', `--root=${VALID_ROOT}`]).code).toBe(0);
  });

  it('defaults to catalog/ under the working directory (the empty real catalog)', () => {
    const r = run(['validate']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('0 errors');
  });

  it.each(invalidCases().map((c) => [c.case, c] as const))(
    'exits 1 on invalid/%s and prints code, file, path',
    (_n, c) => {
      const r = run(['validate', '--root', rel(invalidRoot(c.case))]);
      expect(r.code).toBe(1);
      const line = r.err.split('\n').find((l) => l.startsWith(`error ${c.code} ${c.file} `));
      expect(line, r.err).toBeDefined();
      expect(line).toContain(c.path_contains);
    },
  );

  it('exits 2 on a missing root, an unknown command or an unknown option', () => {
    expect(run(['validate', '--root', 'no/such/dir']).code).toBe(2);
    expect(run(['frobnicate']).code).toBe(2);
    expect(run([]).code).toBe(2);
    expect(run(['validate', '--bogus']).code).toBe(2);
    expect(run(['validate', '--root']).code).toBe(2);
  });
});

describe('catalog compile (in-process)', () => {
  const dirs: string[] = [];
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'pinout-compile-'));
    dirs.push(d);
    return d;
  };
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('refuses to emit when validation fails', () => {
    const out = tmp();
    const r = run(['compile', '--root', rel(invalidRoot('schema-error')), '--out', out]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('E_SCHEMA');
    expect(readdirSync(out)).toEqual([]);
  });

  it('writes <version>.json and catalog-manifest.json for the valid root', () => {
    const out = tmp();
    const r = run(['compile', '--root', rel(VALID_ROOT), '--out', out]);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    const files = readdirSync(out).sort();
    expect(files).toHaveLength(2);
    expect(files).toContain('catalog-manifest.json');
    const manifest = JSON.parse(readFileSync(join(out, 'catalog-manifest.json'), 'utf8')) as {
      version: string;
      date: string;
      file: string;
    };
    expect(files).toContain(`${manifest.version}.json`);
    expect(manifest.file).toBe(`${manifest.version}.json`);
    expect(manifest.date).toBe('2026-01-01');
  });

  it('is byte-identical across two runs', () => {
    const a = tmp();
    const b = tmp();
    expect(run(['compile', '--root', rel(VALID_ROOT), '--out', a]).code).toBe(0);
    expect(run(['compile', '--root', rel(VALID_ROOT), '--out', b]).code).toBe(0);
    for (const f of readdirSync(a)) {
      expect(readFileSync(join(b, f)).equals(readFileSync(join(a, f))), f).toBe(true);
    }
  });

  it('compiles an empty catalog', () => {
    const out = tmp();
    const r = run(['compile', '--root', rel(EMPTY_CATALOG), '--out', out]);
    expect(r.code).toBe(0);
    expect(readdirSync(out)).toHaveLength(2);
  });
});
