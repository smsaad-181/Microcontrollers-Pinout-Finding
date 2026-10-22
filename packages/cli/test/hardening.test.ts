// Phase 1 fix round 1: duplicate ids, unresolved references, mutation-killing tests (CR2/CR6), hostile
// YAML, CLI error handling. Fixture-driven cases live in fixtures/invalid/ (see make-invalid.py).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compileCatalog,
  loadCatalogSources,
  resolveCatalogDate,
  runCli,
  toPosix,
  validateCatalog,
  validateRoot,
  type SourceFile,
} from '../src/index.js';
import { REPO_ROOT, VALID_ROOT, invalidRoot } from './helpers.js';

const validSources = () => loadCatalogSources(VALID_ROOT).sources;
const errorsOf = (r: ReturnType<typeof validateCatalog>) =>
  r.diagnostics.filter((d) => d.severity === 'error');
const brief = (r: ReturnType<typeof validateCatalog>) =>
  errorsOf(r).map((e) => [e.code, e.file, e.path] as const);

/** Replace `old` (exactly once) in the source whose file starts with `prefix`. */
function patched(prefix: string, old: string, next: string, from = validSources()): SourceFile[] {
  return from.map((s) => {
    if (!s.file.startsWith(prefix)) return s;
    expect(s.text.split(old).length, `${prefix}: ${old}`).toBe(2);
    return { ...s, text: s.text.replace(old, () => next) };
  });
}
const PARTIAL = String.fromCharCode(10) + 'status: partially-verified' + String.fromCharCode(10);
const FULLY = PARTIAL.replace('partially', 'fully');
const source = (file: string, text: string): SourceFile => ({
  file,
  kind: file.split('/')[0] as SourceFile['kind'],
  text,
});
const textOf = (prefix: string) =>
  validSources().find((s) => s.file.startsWith(prefix))?.text ?? '';

describe('duplicate ids (F2): both files are reported, nothing is merged', () => {
  it('reports every file that shares an id, at path "id"', () => {
    const r = validateRoot(invalidRoot('duplicate-chip-id'));
    expect(brief(r)).toEqual([
      ['E_DUPLICATE_ID', 'chips/demo-mcu-1-copy.yaml', 'id'],
      ['E_DUPLICATE_ID', 'chips/demo-mcu-1.yaml', 'id'],
    ]);
  });

  it('boards clash on id@revision, not on id alone', () => {
    const r = validateRoot(invalidRoot('duplicate-board-id'));
    expect(brief(r).map((e) => e[1])).toEqual([
      'boards/demo-board-1@r1-copy.yaml',
      'boards/demo-board-1@r1.yaml',
    ]);
    // Same id, other revision: allowed.
    const other = source(
      'boards/demo-board-1@r2.yaml',
      textOf('boards/').replace('revision: r1', 'revision: r2'),
    );
    expect(validateCatalog([...validSources(), other]).errorCount).toBe(0);
  });

  it('reports a repeated claim id inside one evidence document at claims.N.id', () => {
    const r = validateRoot(invalidRoot('duplicate-claim-id'));
    expect(brief(r)).toEqual([['E_DUPLICATE_ID', 'evidence/demo-datasheet-1.yaml', 'claims.1.id']]);
  });

  it('does not merge the claim sets of two evidence files with one id', () => {
    const second = source(
      'evidence/other-file.yaml',
      textOf('evidence/').replace('demo-datasheet-1#pad-table', 'demo-datasheet-1#extra-claim'),
    );
    const r = validateCatalog([...validSources(), second]);
    expect(brief(r).map((e) => e[0])).toEqual(['E_DUPLICATE_ID', 'E_DUPLICATE_ID']);
    expect(r.errorCount).toBe(2);
  });
});

describe('unresolved references are errors (F3, CR1)', () => {
  it('a board with an unresolved variant module gets NO computed status and exits non-zero', () => {
    const r = validateRoot(invalidRoot('ref-variant-module'));
    expect(r.errorCount).toBe(1);
    expect(r.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'partially-verified', computed: null },
    ]);
    const out: string[] = [];
    const code = runCli(['validate', '--root', invalidRoot('ref-variant-module')], {
      cwd: REPO_ROOT,
      env: {},
      stdout: (l) => out.push(l),
      stderr: (l) => out.push(l),
    });
    expect(code).toBe(1);
  });

  it('a module with an unresolved chip blocks the board status without a second error', () => {
    const r = validateRoot(invalidRoot('ref-module-chip'));
    expect(brief(r)).toEqual([['E_REF_UNRESOLVED', 'modules/demo-module-1.yaml', 'chip']]);
    expect(r.coverage.boards[0]?.computed).toBeNull();
  });

  it('a board declared fully-verified with a nonexistent module is not accepted', () => {
    const sources = patched(
      'boards/',
      PARTIAL,
      FULLY,
      patched('boards/', 'module: demo-module-1 }', 'module: nope }'),
    );
    const r = validateCatalog(sources);
    expect(brief(r)).toEqual([
      ['E_REF_UNRESOLVED', 'boards/demo-board-1@r1.yaml', 'variants.0.module'],
    ]);
    expect(r.coverage.boards[0]?.computed).toBeNull();
  });

  it('a board with variants: [] is a shape error, not a vacuous pass', () => {
    const r = validateRoot(invalidRoot('board-no-variants'));
    expect(brief(r)).toEqual([['E_SCHEMA', 'boards/demo-board-1@r1.yaml', 'variants']]);
  });

  it('a reference to a file that is itself broken adds no second error', () => {
    // The chip fails its shape check; the module that cites it must not also report E_REF_UNRESOLVED.
    const sources = patched('chips/', 'gpio: 2\n', 'gpio: "four"\n');
    expect(brief(validateCatalog(sources)).map((e) => e[0])).toEqual(['E_SCHEMA']);
  });
});

describe('board status (M5, M18): the positive paths are pinned', () => {
  const allVerified = () => {
    const board = patched(
      'boards/',
      'max_current: { evidence: [], note: "Regulator DEMO-LDO-1 rating not cited yet.", status: missing, unit: mA, value: null }',
      'max_current: { evidence: [demo-datasheet-1#board-pinout], reviewers: [a, b], status: verified, unit: mA, value: 500 }',
    );
    const chip = patched(
      'chips/',
      'internal_pull_ohm: { evidence: [demo-datasheet-1#related-part-pulls], note: "Interim: taken from the related part DEMO-MCU-0; replace when a DEMO-MCU-1 value is cited.", status: interim,',
      'internal_pull_ohm: { evidence: [demo-datasheet-1#related-part-pulls], reviewers: [a, b], status: verified,',
      board,
    );
    return patched('boards/', PARTIAL, FULLY, chip);
  };

  it('accepts a board whose every fact is verified as fully-verified', () => {
    const r = validateCatalog(allVerified());
    expect(r.diagnostics).toEqual([]);
    expect(r.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'fully-verified', computed: 'fully-verified' },
    ]);
  });

  it('rejects partially-verified when every fact is verified (computed is fully-verified)', () => {
    const sources = patched('boards/', FULLY, PARTIAL, allVerified());
    expect(brief(validateCatalog(sources)).map((e) => e[0])).toEqual(['E_BOARD_STATUS']);
  });

  it('keeps partially-verified accepted for the valid fixture', () => {
    expect(validateRoot(VALID_ROOT).coverage.boards[0]).toMatchObject({
      declared: 'partially-verified',
      computed: 'partially-verified',
    });
  });

  it('compiled version follows content: unchanged content keeps it, one changed fact value changes it', () => {
    const opts = { date: '2026-01-01' };
    const base = compileCatalog(validateCatalog(validSources()), opts);
    const again = compileCatalog(validateCatalog(validSources()), opts);
    expect(again.version).toBe(base.version);
    expect(again.fileName).toBe(base.fileName);

    const changed = compileCatalog(
      validateCatalog(
        patched(
          'boards/',
          '    voltage: { evidence: [demo-datasheet-1#board-pinout], reviewers: [hardware-researcher, hardware-fact-auditor], status: verified, unit: V, value: 3.3 }',
          '    voltage: { evidence: [demo-datasheet-1#board-pinout], reviewers: [hardware-researcher, hardware-fact-auditor], status: verified, unit: V, value: 5 }',
        ),
      ),
      opts,
    );
    expect(changed.version).not.toBe(base.version);
    expect(changed.fileName).not.toBe(base.fileName);
    expect(changed.sha256).not.toBe(base.sha256);
    const manifest = JSON.parse(changed.manifestText) as { file: string; version: string };
    expect(manifest.file).toBe(changed.fileName);
    expect(manifest.version).toBe(changed.version);
    expect(changed.catalogText).toContain(`"version":"${changed.version}"`);
  });
});

describe('identification by id, claim split and ordering (M3, M10, M16, M24)', () => {
  it('M3: evidence is found by its id field, not by its file name', () => {
    const sources = validSources().map((s) =>
      s.file === 'evidence/demo-datasheet-1.yaml'
        ? { ...s, file: 'evidence/some-other-name.yaml' }
        : s,
    );
    expect(validateCatalog(sources).diagnostics).toEqual([]);
  });

  it('M16: a claim id with a second "#" resolves; the doc is the text before the FIRST "#"', () => {
    const withClaim = patched(
      'evidence/',
      'claims:\n',
      'claims:\n  - id: demo-datasheet-1#module-pads#v2\n    locator: "x"\n    quote: "x"\n    supports: "x"\n',
    );
    const sources = patched(
      'modules/',
      'flash_voltage: { evidence: [demo-datasheet-1#module-pads],',
      'flash_voltage: { evidence: [demo-datasheet-1#module-pads#v2],',
      withClaim,
    );
    expect(validateCatalog(sources).diagnostics).toEqual([]);
    // And an unknown second-level claim is still reported against its document.
    const bad = patched(
      'modules/',
      'flash_voltage: { evidence: [demo-datasheet-1#module-pads],',
      'flash_voltage: { evidence: [demo-datasheet-1#module-pads#nope],',
    );
    expect(brief(validateCatalog(bad))).toEqual([
      ['E_EVIDENCE_UNKNOWN', 'modules/demo-module-1.yaml', 'flash_voltage.evidence.0'],
    ]);
  });

  it('M10: compiled entities are ordered by id, whatever the file names or input order', () => {
    const chip = textOf('chips/');
    const mk = (id: string) => chip.replace('id: demo-mcu-1', `id: ${id}`);
    const base = validSources().filter((s) => !s.file.startsWith('chips/'));
    // file order (a, b) is the reverse of id order (zzz, aaa)
    const a = [
      ...base,
      source('chips/a.yaml', mk('zzz-mcu')),
      source('chips/b.yaml', mk('aaa-mcu')),
    ];
    // modules/boards still point at demo-mcu-1, so keep an extra valid chip out of the way
    const withOriginal = [...a, source('chips/c.yaml', chip)];
    const r1 = validateCatalog(withOriginal);
    expect(r1.catalog.chips.map((c) => c.id)).toEqual(['aaa-mcu', 'demo-mcu-1', 'zzz-mcu']);
    const r2 = validateCatalog([...withOriginal].reverse());
    expect(compileCatalog(r2, { date: '2026-01-01' }).catalogText).toBe(
      compileCatalog(r1, { date: '2026-01-01' }).catalogText,
    );
  });

  it('M10: boards are ordered by id@revision', () => {
    const board = textOf('boards/');
    const sources = [
      ...validSources(),
      source('boards/aaa.yaml', board.replace('revision: r1', 'revision: r2')),
      source('boards/zzz.yaml', board.replace('id: demo-board-1', 'id: demo-board-0')),
    ];
    const refs = validateCatalog(sources).catalog.boards.map((b) => `${b.id}@${b.revision}`);
    expect(refs).toEqual(['demo-board-0@r1', 'demo-board-1@r1', 'demo-board-1@r2']);
  });

  it('M24: every variant must have the pad in its chip, not just one of them', () => {
    const chip2 = textOf('chips/')
      .replace('id: demo-mcu-1', 'id: demo-mcu-2')
      .replace('\n  GPIO2:\n', '\n  GPIO9:\n')
      .replace('    gpio: 2\n', '    gpio: 9\n');
    const module2 = textOf('modules/')
      .replace('id: demo-module-1', 'id: demo-module-2')
      .replace('chip: demo-mcu-1', 'chip: demo-mcu-2')
      .replace('[GPIO0, GPIO1, GPIO2, GPIO3]', '[GPIO0, GPIO1, GPIO9, GPIO3]');
    const base = patched(
      'boards/',
      '  - { id: demo-variant-a, module: demo-module-1 }\n',
      '  - { id: demo-variant-a, module: demo-module-1 }\n  - { id: demo-variant-b, module: demo-module-2 }\n',
    );
    const sources = [
      ...base,
      source('chips/demo-mcu-2.yaml', chip2),
      source('modules/demo-module-2.yaml', module2),
    ];
    const r = validateCatalog(sources);
    expect(brief(r)).toEqual([
      ['E_PIN_NUMBERING', 'boards/demo-board-1@r1.yaml', 'connectors.0.pins.4.pad'],
    ]);
    expect(errorsOf(r)[0]?.message).toContain('demo-mcu-2 (variant demo-variant-b)');
    expect(errorsOf(r)[0]?.message).not.toContain('demo-mcu-1 (variant');
  });

  it('M24: ...and a module that does not bond the pad is reported per variant', () => {
    const r = validateRoot(invalidRoot('pin-pad-not-bonded'));
    expect(brief(r)).toEqual([
      ['E_PIN_NUMBERING', 'boards/demo-board-1@r1.yaml', 'connectors.0.pins.4.pad'],
    ]);
  });
});

describe('loader (M6, CR7)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'pinout-load-'));
    dirs.push(d);
    return d;
  };

  it('M6: toPosix turns backslashes into forward slashes', () => {
    expect(toPosix('sub\\dir\\x.yaml')).toBe('sub/dir/x.yaml');
    expect(toPosix('already/posix.yaml')).toBe('already/posix.yaml');
  });

  it('reads nested files with forward-slash names on every platform', () => {
    const root = tmp();
    mkdirSync(join(root, 'chips', 'sub', 'deeper'), { recursive: true });
    writeFileSync(join(root, 'chips', 'sub', 'deeper', 'x.yaml'), 'id: x\n');
    const { sources } = loadCatalogSources(root);
    expect(sources.map((s) => s.file)).toEqual(['chips/sub/deeper/x.yaml']);
  });

  it('a .yml / .YAML file in a kind directory is an error; a root-level YAML file stays a warning', () => {
    const root = tmp();
    mkdirSync(join(root, 'chips'));
    writeFileSync(join(root, 'chips', 'a.yml'), 'id: a\n');
    writeFileSync(join(root, 'chips', 'b.YAML'), 'id: b\n');
    writeFileSync(join(root, 'chips', 'c.Yml'), 'id: c\n');
    writeFileSync(join(root, 'chips', 'notes.txt'), 'not yaml\n');
    writeFileSync(join(root, 'chips.yaml'), 'id: root\n');
    const r = validateRoot(root);
    expect(r.diagnostics.map((d) => [d.severity, d.code, d.file])).toEqual([
      ['warning', 'W_IGNORED_FILE', 'chips.yaml'],
      ['error', 'E_FILE_EXTENSION', 'chips/a.yml'],
      ['error', 'E_FILE_EXTENSION', 'chips/b.YAML'],
      ['error', 'E_FILE_EXTENSION', 'chips/c.Yml'],
    ]);
    expect(r.errorCount).toBe(3);
    expect(r.warningCount).toBe(1);
  });

  it('a root-level YAML file alone stays a warning (exit 0)', () => {
    const root = tmp();
    writeFileSync(join(root, 'chips.yaml'), 'id: root\n');
    const out: string[] = [];
    const code = runCli(['validate', '--root', root], {
      cwd: REPO_ROOT,
      env: {},
      stdout: (l) => out.push(l),
      stderr: (l) => out.push(l),
    });
    expect(code).toBe(0);
    expect(out.join('\n')).toContain('W_IGNORED_FILE');
  });
});

describe('hostile YAML (CR3, CR4)', () => {
  const chipWith = (edit: (t: string) => string) =>
    validateCatalog(patchedChip(edit(textOf('chips/'))));
  const patchedChip = (text: string) =>
    validSources().map((s) => (s.file.startsWith('chips/') ? { ...s, text } : s));

  it('rejects __proto__ / constructor / prototype keys instead of dropping them', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const r = chipWith((t) =>
        t.replace(
          'peripherals:\n',
          `peripherals:\n  ${key}: { kind: adc, matrix_routable: false }\n`,
        ),
      );
      expect(brief(r)).toEqual([['E_SCHEMA', 'chips/demo-mcu-1.yaml', `peripherals.${key}`]]);
    }
  });

  it("rejects a forbidden pad key and counts none of that file's facts", () => {
    const r = chipWith((t) =>
      t.replace(
        'pads:\n',
        'pads:\n  __proto__:\n    gpio: 7\n    reviewers: [x]\n    evidence: [nodoc#zzz]\n',
      ),
    );
    expect(brief(r)).toEqual([['E_SCHEMA', 'chips/demo-mcu-1.yaml', 'pads.__proto__']]);
    // 39 verified facts in valid/, 25 of them in the (now rejected) chip file.
    expect(r.coverage.facts.verified).toBe(14);
    expect(r.coverage.entities.chips).toBe(0);
  });

  it('rejects anchors, aliases and merge keys with E_YAML and no stack trace', () => {
    const cases: [string, (t: string) => string][] = [
      ['anchor', (t) => t.replace('family: DEMO-MCU\n', 'family: &f DEMO-MCU\n')],
      [
        'alias',
        (t) =>
          t
            .replace('family: DEMO-MCU\n', 'family: &f DEMO-MCU\n')
            .replace('series: DEMO-MCU-1\n', 'series: *f\n'),
      ],
      ['merge', (t) => t.replace('peripherals:\n', 'peripherals:\n  <<: { a: 1 }\n')],
    ];
    for (const [name, edit] of cases) {
      const r = chipWith(edit);
      const e = errorsOf(r).find((d) => d.code === 'E_YAML');
      expect(e, name).toBeDefined();
      expect(e?.file).toBe('chips/demo-mcu-1.yaml');
      expect(e?.message).toMatch(/not allowed/);
      expect(e?.message).not.toMatch(/\bat\b.*\.js/);
    }
  });

  it('survives an alias bomb: one E_YAML, no throw, CLI exit 1', () => {
    const lines = ['a0: &a0 [x, x, x, x, x, x, x, x, x]'];
    for (let i = 1; i < 12; i++) {
      const prev = `*a${String(i - 1)}`;
      lines.push(`a${String(i)}: &a${String(i)} [${Array(9).fill(prev).join(', ')}]`);
    }
    const bomb = `${lines.join('\n')}\n`;
    const r = validateCatalog([source('chips/bomb.yaml', bomb)]);
    expect(brief(r)).toEqual([['E_YAML', 'chips/bomb.yaml', '']]);

    const root = mkdtempSync(join(tmpdir(), 'pinout-bomb-'));
    try {
      mkdirSync(join(root, 'chips'));
      writeFileSync(join(root, 'chips', 'bomb.yaml'), bomb);
      const err: string[] = [];
      const code = runCli(['validate', '--root', root], {
        cwd: REPO_ROOT,
        env: {},
        stdout: () => undefined,
        stderr: (l) => err.push(l),
      });
      expect(code).toBe(1);
      expect(err.join('\n')).toContain('error E_YAML chips/bomb.yaml');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('survives absurd nesting without throwing', () => {
    const deep = `${'['.repeat(20000)}${']'.repeat(20000)}\n`;
    const r = validateCatalog([source('chips/deep.yaml', deep)]);
    expect(errorsOf(r).map((e) => e.code)).toEqual(['E_YAML']);
  });
});

describe('CLI error handling (CR4, CR5)', () => {
  const io = (env: Record<string, string | undefined>) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        cwd: REPO_ROOT,
        env,
        stdout: (l: string) => out.push(l),
        stderr: (l: string) => err.push(l),
      },
    };
  };
  const compile = (env: Record<string, string | undefined>) => {
    const h = io(env);
    const dir = mkdtempSync(join(tmpdir(), 'pinout-epoch-'));
    try {
      const code = runCli(['compile', '--root', VALID_ROOT, '--out', dir], h.io);
      return { code, err: h.err.join('\n'), out: h.out.join('\n') };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it.each(['abc', '-1', '1.5', '1e9', '99999999999999', '253402300800', ' 5'])(
    'an invalid SOURCE_DATE_EPOCH (%s) is a usage error (exit 2), not a RangeError',
    (v) => {
      const r = compile({ SOURCE_DATE_EPOCH: v });
      expect(r.code).toBe(2);
      expect(r.err).toContain('SOURCE_DATE_EPOCH');
      expect(r.err).not.toMatch(/RangeError|\n\s+at /);
    },
  );

  it('accepts the largest valid epoch and an empty value (treated as unset)', () => {
    const max = compile({ SOURCE_DATE_EPOCH: '253402300799' });
    expect(max.code).toBe(0);
    expect(max.out).toContain('date 9999-12-31');
    expect(compile({ SOURCE_DATE_EPOCH: '' }).code).toBe(0);
    expect(compile({ SOURCE_DATE_EPOCH: '0' }).out).toContain('date 1970-01-01');
  });

  it('resolveCatalogDate throws for a bad epoch', () => {
    expect(() =>
      resolveCatalogDate(VALID_ROOT, { SOURCE_DATE_EPOCH: 'x' }, validateRoot(VALID_ROOT)),
    ).toThrow(/SOURCE_DATE_EPOCH/);
  });

  it('an unexpected exception becomes one "error: ..." line and exit 2', () => {
    const h = io({});
    h.io.stdout = () => {
      throw new Error('boom');
    };
    const code = runCli(['validate', '--root', VALID_ROOT], h.io);
    expect(code).toBe(2);
    expect(h.err).toEqual(['error: boom']);
  });
});
