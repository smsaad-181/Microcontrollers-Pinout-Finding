// Phase 1 fix round 3: tests that make every surviving mutant of the round-2 code review fail
// (H21, B6, S9, S11, D3, D4, F2, F4, F5, F6, H2, H10, H15) plus the small checker gaps
// (CR4-R2 symlinks, CR5-R2 not a catalog root, CR6-R2 `Chips/`, CR9 known claims).
// Behaviour is asserted from the README decisions, never from a snapshot of the code's own output.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  byCodeUnit,
  compareDiagnostics,
  compileCatalog,
  loadCatalogSources,
  resolveCatalogDate,
  runCli,
  stableStringify,
  validateCatalog,
  validateRoot,
  type Diagnostic,
  type ErrorCode,
  type SourceFile,
} from '../src/index.js';
import { EMPTY_CATALOG, REAL_CATALOG, REPO_ROOT, VALID_ROOT } from './helpers.js';

const validSources = () => loadCatalogSources(VALID_ROOT).sources;
const errorsOf = (r: ReturnType<typeof validateCatalog>) =>
  r.diagnostics.filter((d) => d.severity === 'error');
const brief = (r: ReturnType<typeof validateCatalog>) =>
  errorsOf(r).map((e) => [e.code, e.file, e.path] as const);
const textOf = (prefix: string) =>
  validSources().find((s) => s.file.startsWith(prefix))?.text ?? '';
const source = (file: string, text: string): SourceFile => ({
  file,
  kind: file.split('/')[0] as SourceFile['kind'],
  text,
});

/** Replace `old` (exactly once) in the source whose file starts with `prefix`. */
function patched(prefix: string, old: string, next: string, from = validSources()): SourceFile[] {
  return from.map((s) => {
    if (!s.file.startsWith(prefix)) return s;
    expect(s.text.split(old).length, `${prefix}: ${old}`).toBe(2);
    return { ...s, text: s.text.replace(old, () => next) };
  });
}

const R2 = 'reviewers: [hardware-researcher, hardware-fact-auditor]';
const NL = String.fromCharCode(10);
const PARTIAL = `${NL}status: partially-verified${NL}`;
const FULLY = PARTIAL.replace('partially', 'fully');
const CLAIM = 'evidence: [demo-datasheet-1#module-pads]';

/** The valid fixture with its one missing board fact and one interim chip fact made verified. */
function allVerified(): SourceFile[] {
  const board = patched(
    'boards/',
    'max_current: { evidence: [], note: "Regulator DEMO-LDO-1 rating not cited yet.", status: missing, unit: mA, value: null }',
    'max_current: { evidence: [demo-datasheet-1#board-pinout], reviewers: [a, b], status: verified, unit: mA, value: 500 }',
  );
  return patched(
    'chips/',
    'internal_pull_ohm: { evidence: [demo-datasheet-1#related-part-pulls], note: "Interim: taken from the related part DEMO-MCU-0; replace when a DEMO-MCU-1 value is cited.", status: interim,',
    'internal_pull_ohm: { evidence: [demo-datasheet-1#related-part-pulls], reviewers: [a, b], status: verified,',
    board,
  );
}
const asFully = (from: SourceFile[]) => patched('boards/', PARTIAL, FULLY, from);

// ---------------------------------------------------------------------------------------------
// CR1-R2 / H21: the board status covers board + variant modules + chips (README decision 7)
// ---------------------------------------------------------------------------------------------
describe('board status covers board, module and chip facts (CR1-R2, H21)', () => {
  const FLASH = `flash_voltage: { ${CLAIM}, ${R2}, status: verified,`;
  const CONSUMED = `GPIO3: { ${CLAIM}, ${R2}, status: verified, value: flash }`;
  const LOGIC = `logic_voltage: { evidence: [demo-datasheet-1#board-pinout], ${R2}, status: verified,`;
  const RESET3 = 'status: verified, value: disabled }';

  const cases: [string, string, string, string][] = [
    [
      'module flash_voltage single-source',
      'modules/',
      FLASH,
      `flash_voltage: { ${CLAIM}, status: single-source,`,
    ],
    [
      'module flash_voltage interim',
      'modules/',
      FLASH,
      `flash_voltage: { ${CLAIM}, status: interim,`,
    ],
    [
      'module consumed fact missing',
      'modules/',
      CONSUMED,
      'GPIO3: { evidence: [], status: missing, value: null }',
    ],
    [
      'module consumed fact single-source',
      'modules/',
      CONSUMED,
      `GPIO3: { ${CLAIM}, status: single-source, value: flash }`,
    ],
    ['chip pad fact single-source', 'chips/', RESET3, 'status: single-source, value: disabled }'],
    ['chip pad fact interim', 'chips/', RESET3, 'status: interim, value: disabled }'],
    [
      'board fact single-source',
      'boards/',
      LOGIC,
      `logic_voltage: { evidence: [demo-datasheet-1#board-pinout], status: single-source,`,
    ],
  ];

  it('the all-verified baseline is accepted as fully-verified', () => {
    const r = validateCatalog(asFully(allVerified()));
    expect(r.diagnostics).toEqual([]);
    expect(r.coverage.boards[0]).toMatchObject({
      declared: 'fully-verified',
      computed: 'fully-verified',
    });
  });

  it.each(cases)('%s: declared fully-verified is E_BOARD_STATUS', (_name, prefix, old, next) => {
    const r = validateCatalog(patched(prefix, old, next, asFully(allVerified())));
    expect(brief(r)).toEqual([['E_BOARD_STATUS', 'boards/demo-board-1@r1.yaml', 'status']]);
    expect(errorsOf(r)[0]?.message).toContain('"partially-verified"');
    expect(r.coverage.boards[0]?.computed).toBe('partially-verified');
  });

  it.each(cases)('%s: partially-verified is accepted', (_name, prefix, old, next) => {
    const r = validateCatalog(patched(prefix, old, next, allVerified()));
    expect(r.diagnostics).toEqual([]);
    expect(r.coverage.boards[0]).toMatchObject({
      declared: 'partially-verified',
      computed: 'partially-verified',
    });
  });

  it('a second variant with its own less-verified module is included', () => {
    const module2 = textOf('modules/')
      .replace('id: demo-module-1', 'id: demo-module-2')
      .replace(FLASH, `flash_voltage: { ${CLAIM}, status: single-source,`);
    const withVariant = patched(
      'boards/',
      '  - { id: demo-variant-a, module: demo-module-1 }\n',
      '  - { id: demo-variant-a, module: demo-module-1 }\n  - { id: demo-variant-b, module: demo-module-2 }\n',
      asFully(allVerified()),
    );
    const r = validateCatalog([...withVariant, source('modules/demo-module-2.yaml', module2)]);
    expect(brief(r)).toEqual([['E_BOARD_STATUS', 'boards/demo-board-1@r1.yaml', 'status']]);
  });

  // CR1-R3: the chip of every variant feeds the status, not only the first variant's chip.
  describe('a second variant with its own chip (CR1-R3)', () => {
    const verifiedChip = allVerified().find((s) => s.file.startsWith('chips/'))?.text ?? '';
    const chip2 = (reset: string) =>
      source(
        'chips/demo-mcu-2.yaml',
        verifiedChip.replace('id: demo-mcu-1', 'id: demo-mcu-2').replace(RESET3, reset),
      );
    const module2 = source(
      'modules/demo-module-2.yaml',
      textOf('modules/')
        .replace('id: demo-module-1', 'id: demo-module-2')
        .replace('chip: demo-mcu-1', 'chip: demo-mcu-2'),
    );
    const twoVariants = (from: SourceFile[]) =>
      patched(
        'boards/',
        '  - { id: demo-variant-a, module: demo-module-1 }\n',
        '  - { id: demo-variant-a, module: demo-module-1 }\n  - { id: demo-variant-b, module: demo-module-2 }\n',
        from,
      );

    it('all verified: declared fully-verified is accepted', () => {
      const r = validateCatalog([...twoVariants(asFully(allVerified())), module2, chip2(RESET3)]);
      expect(r.diagnostics).toEqual([]);
      expect(r.coverage.boards[0]?.computed).toBe('fully-verified');
    });

    it.each(['interim', 'single-source'])(
      'variant B chip fact %s: declared fully-verified is E_BOARD_STATUS',
      (status) => {
        const weaker = `status: ${status}, value: disabled }`;
        const r = validateCatalog([...twoVariants(asFully(allVerified())), module2, chip2(weaker)]);
        expect(brief(r)).toEqual([['E_BOARD_STATUS', 'boards/demo-board-1@r1.yaml', 'status']]);
        expect(r.coverage.boards[0]?.computed).toBe('partially-verified');
      },
    );

    it('variant B chip fact interim: declared partially-verified is accepted', () => {
      const weaker = 'status: interim, value: disabled }';
      const r = validateCatalog([...twoVariants(allVerified()), module2, chip2(weaker)]);
      expect(r.diagnostics).toEqual([]);
      expect(r.coverage.boards[0]?.computed).toBe('partially-verified');
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CR2-R3: a header pad must be bonded out by the module of EVERY variant, not only the first
// ---------------------------------------------------------------------------------------------
describe('header pads are bonded out by the module of every variant (CR2-R3)', () => {
  const FULL = 'bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]';
  const NO_GPIO2 = 'bonded_pads: [GPIO0, GPIO1, GPIO3]';
  const module2 = (bonded: string) =>
    source(
      'modules/demo-module-2.yaml',
      textOf('modules/').replace('id: demo-module-1', 'id: demo-module-2').replace(FULL, bonded),
    );
  const twoVariants = (from: SourceFile[]) =>
    patched(
      'boards/',
      '  - { id: demo-variant-a, module: demo-module-1 }\n',
      '  - { id: demo-variant-a, module: demo-module-1 }\n  - { id: demo-variant-b, module: demo-module-2 }\n',
      from,
    );

  it('both modules bond every header pad: no error', () => {
    expect(validateCatalog([...twoVariants(validSources()), module2(FULL)]).diagnostics).toEqual(
      [],
    );
  });

  it('only variant B module lacks GPIO2: E_PIN_NUMBERING naming variant B', () => {
    const r = validateCatalog([...twoVariants(validSources()), module2(NO_GPIO2)]);
    expect(brief(r)).toEqual([
      ['E_PIN_NUMBERING', 'boards/demo-board-1@r1.yaml', 'connectors.0.pins.4.pad'],
    ]);
    expect(errorsOf(r)[0]?.message).toContain('demo-module-2 (variant demo-variant-b)');
    expect(errorsOf(r)[0]?.message).not.toContain('demo-module-1');
  });

  it('only variant A module lacks GPIO2: E_PIN_NUMBERING naming variant A', () => {
    const r = validateCatalog([...twoVariants(patched('modules/', FULL, NO_GPIO2)), module2(FULL)]);
    expect(brief(r)).toEqual([
      ['E_PIN_NUMBERING', 'boards/demo-board-1@r1.yaml', 'connectors.0.pins.4.pad'],
    ]);
    expect(errorsOf(r)[0]?.message).toContain('demo-module-1 (variant demo-variant-a)');
    expect(errorsOf(r)[0]?.message).not.toContain('demo-module-2');
  });
});

// ---------------------------------------------------------------------------------------------
// S11 community, D3 board_status counts, D4 manifest bytes
// ---------------------------------------------------------------------------------------------
describe('community facts (S11)', () => {
  const community = () =>
    patched(
      'boards/',
      `logic_voltage: { evidence: [demo-datasheet-1#board-pinout], ${R2}, status: verified,`,
      `logic_voltage: { evidence: [demo-datasheet-1#board-pinout], status: community,`,
    );

  it('a community fact is accepted, counted separately, and keeps the board partially-verified', () => {
    const r = validateCatalog(community());
    expect(r.diagnostics).toEqual([]);
    expect(r.coverage.facts).toEqual({
      verified: 38,
      'single-source': 0,
      conflict: 0,
      interim: 1,
      community: 1,
      missing: 1,
    });
    expect(r.coverage.factsByKind.boards.community).toBe(1);
    expect(r.coverage.factsByKind.boards.verified).toBe(1);
    expect(r.coverage.boards[0]?.computed).toBe('partially-verified');
  });

  it('the manifest facts counts include community', () => {
    const m = JSON.parse(
      compileCatalog(validateCatalog(community()), { date: '2026-01-01' }).manifestText,
    ) as { facts: Record<string, number> };
    expect(m.facts).toEqual({
      verified: 38,
      'single-source': 0,
      conflict: 0,
      interim: 1,
      community: 1,
      missing: 1,
    });
  });
});

describe('manifest board_status counts (D3) and bytes (D4)', () => {
  /** A copy of the valid board (all facts as in valid/) under a new revision, edited by `edit`. */
  const boardRev = (rev: string, edit: (t: string) => string) =>
    source(
      `boards/rev-${rev}.yaml`,
      edit(textOf('boards/').replace('revision: r1', `revision: ${rev}`)),
    );
  const noGpio = (t: string) =>
    t
      .replace('      - { kind: gpio, label: "0", pad: GPIO0, position: 3 }\n', '')
      .replace('      - { kind: gpio, label: "1", pad: GPIO1, position: 4 }\n', '')
      .replace('      - { kind: gpio, label: "2", pad: GPIO2, position: 5 }\n', '')
      .replace(PARTIAL, `${NL}status: datasheet-required${NL}`);
  const unsupported = (t: string) => t.replace(PARTIAL, `${NL}status: unsupported${NL}`);

  it('manifest board_status has one exact count per status', () => {
    // Distinct counts per status (1, 2, 3, 4) so no two statuses can be swapped or merged.
    const partialBoard = (rev: string) =>
      boardRev(rev, (t) =>
        t
          // one fact of the board itself is not verified, whatever the chip and module say
          .replace(
            `logic_voltage: { evidence: [demo-datasheet-1#board-pinout], ${R2}, status: verified,`,
            'logic_voltage: { evidence: [demo-datasheet-1#board-pinout], status: single-source,',
          )
          .replace(PARTIAL, `${NL}status: partially-verified${NL}`),
      );
    const sources = [
      ...asFully(allVerified()), // r1 fully-verified (1)
      partialBoard('r2'), // partially-verified (2)
      partialBoard('r3'),
      boardRev('r4', noGpio), // datasheet-required (3)
      boardRev('r5', noGpio),
      boardRev('r6', noGpio),
      boardRev('r7', unsupported), // unsupported (4)
      boardRev('r8', unsupported),
      boardRev('r9', unsupported),
      boardRev('r10', unsupported),
    ];
    const r = validateCatalog(sources);
    expect(brief(r)).toEqual([]);
    const m = JSON.parse(compileCatalog(r, { date: '2026-01-01' }).manifestText) as {
      board_status: Record<string, number>;
      counts: Record<string, number>;
    };
    expect(m.board_status).toEqual({
      'fully-verified': 1,
      'partially-verified': 2,
      'datasheet-required': 3,
      unsupported: 4,
    });
    expect(m.counts.boards).toBe(10);
  });

  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('bytes is the UTF-8 byte length of the written catalog file, not its string length', () => {
    const sources = patched('boards/', 'name: DEMO-BOARD-1', 'name: DEMO-BOARD-µ-é-€');
    const c = compileCatalog(validateCatalog(sources), { date: '2026-01-01' });
    const m = JSON.parse(c.manifestText) as { bytes: number };
    expect(c.catalogText.length).toBeLessThan(Buffer.byteLength(c.catalogText, 'utf8'));
    expect(m.bytes).toBe(Buffer.byteLength(c.catalogText, 'utf8'));
    expect(m.bytes).toBeGreaterThan(c.catalogText.length);

    // ...and equals the size of the file `catalog compile` really writes.
    const root = mkdtempSync(join(tmpdir(), 'pinout-bytes-'));
    dirs.push(root);
    for (const s of sources) {
      mkdirSync(dirname(join(root, s.file)), { recursive: true });
      writeFileSync(join(root, s.file), s.text);
    }
    const out = join(root, 'out');
    const code = runCli(['compile', '--root', root, '--out', out], {
      cwd: REPO_ROOT,
      env: { SOURCE_DATE_EPOCH: '0' },
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(code).toBe(0);
    const manifest = JSON.parse(readFileSync(join(out, 'catalog-manifest.json'), 'utf8')) as {
      bytes: number;
      file: string;
    };
    expect(manifest.bytes).toBe(statSync(join(out, manifest.file)).size);
  });
});

// ---------------------------------------------------------------------------------------------
// F2 stable-json, F6 code-unit order, F4/F5 input-order independence
// ---------------------------------------------------------------------------------------------
describe('stableStringify keeps array order and sorts object keys at every depth (F2)', () => {
  it('does not sort arrays of numbers, strings, nested arrays or objects', () => {
    expect(
      stableStringify({ a: [3, 1, 2], b: ['z', 'a', 'm'], c: [[2, 1], [1]], d: [true, false] }),
    ).toBe('{"a":[3,1,2],"b":["z","a","m"],"c":[[2,1],[1]],"d":[true,false]}');
    expect(stableStringify([{ b: 1 }, { a: 1 }, null, 'x', 0])).toBe(
      '[{"b":1},{"a":1},null,"x",0]',
    );
  });

  it('sorts keys inside array elements and keeps integer-like keys in code-unit order', () => {
    expect(
      stableStringify({
        k: [
          { z: 1, a: { y: 1, x: 2 } },
          { '10': 1, '9': 2, b: 3 },
        ],
      }),
    ).toBe('{"k":[{"a":{"x":2,"y":1},"z":1},{"10":1,"9":2,"b":3}]}');
  });
});

describe('byCodeUnit is locale independent (F6)', () => {
  it('orders by UTF-16 code unit: capitals before lower case, punctuation by code, accents last', () => {
    const items = ['a', 'B', '_', 'Z', 'é', 'e', 'ab', 'a-b', 'a.b', 'a_b'];
    expect([...items].sort(byCodeUnit)).toEqual([
      'B',
      'Z',
      '_',
      'a',
      'a-b',
      'a.b',
      'a_b',
      'ab',
      'e',
      'é',
    ]);
    // A locale-aware comparison orders these differently, which is exactly what must not happen.
    expect([...items].sort((x, y) => x.localeCompare(y, 'en'))).not.toEqual(
      [...items].sort(byCodeUnit),
    );
  });

  it('returns -1, 0, 1 and is antisymmetric', () => {
    expect(byCodeUnit('a', 'b')).toBe(-1);
    expect(byCodeUnit('b', 'a')).toBe(1);
    expect(byCodeUnit('a', 'a')).toBe(0);
    expect(byCodeUnit('Z', 'a')).toBe(-1);
    expect(byCodeUnit('é', 'z')).toBe(1);
  });

  it('compareDiagnostics orders by file, then path, then code, all by code unit', () => {
    const d = (file: string, path: string, code: ErrorCode): Diagnostic => ({
      severity: 'error',
      code,
      file,
      path,
      message: '',
    });
    const list = [
      d('chips/b.yaml', 'a', 'E_SCHEMA'),
      d('chips/B.yaml', 'z', 'E_SCHEMA'),
      d('chips/a_b.yaml', 'a', 'E_SCHEMA'),
      d('chips/a-b.yaml', 'a', 'E_SCHEMA'),
      d('chips/a-b.yaml', 'A', 'E_SCHEMA'),
      d('chips/a-b.yaml', 'A', 'E_PAD_KEY'),
    ];
    expect([...list].sort(compareDiagnostics).map((x) => `${x.file} ${x.path} ${x.code}`)).toEqual([
      'chips/B.yaml z E_SCHEMA',
      'chips/a-b.yaml A E_PAD_KEY',
      'chips/a-b.yaml A E_SCHEMA',
      'chips/a-b.yaml a E_SCHEMA',
      'chips/a_b.yaml a E_SCHEMA',
      'chips/b.yaml a E_SCHEMA',
    ]);
  });

  it('the loader returns sources in code-unit order of their path', () => {
    const root = mkdtempSync(join(tmpdir(), 'pinout-order-'));
    try {
      mkdirSync(join(root, 'chips'));
      for (const n of ['a.yaml', 'B.yaml', '_.yaml', 'é.yaml', 'a-b.yaml', 'ab.yaml'])
        writeFileSync(join(root, 'chips', n), 'id: x\n');
      expect(loadCatalogSources(root).sources.map((s) => s.file)).toEqual([
        'chips/B.yaml',
        'chips/_.yaml',
        'chips/a-b.yaml',
        'chips/a.yaml',
        'chips/ab.yaml',
        'chips/é.yaml',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('compiled entities follow code-unit order of their ids (a-b, a.b, a_b, ab), not locale order', () => {
    const chip = textOf('chips/');
    const extra = ['ab', 'a_b', 'a.b', 'a-b'].map((id) =>
      source(`chips/x-${id}.yaml`, chip.replace('id: demo-mcu-1', `id: ${id}`)),
    );
    const r = validateCatalog([...validSources(), ...extra]);
    expect(r.errorCount).toBe(0);
    expect(r.catalog.chips.map((c) => c.id)).toEqual(['a-b', 'a.b', 'a_b', 'ab', 'demo-mcu-1']);
  });
});

/** Deterministic Fisher-Yates (mulberry32), so a failing order can be reproduced. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

describe('validateCatalog does not depend on input order (F4, F5)', () => {
  /** Three chip files with one id (duplicates) and an ics file with a shape error. */
  const broken = (): SourceFile[] => {
    const chip = textOf('chips/');
    const base = patched('ics/', 'vendor: Demo Corp', 'vendor: 5');
    return [
      ...base,
      source('chips/demo-mcu-1-copy.yaml', chip),
      source('chips/demo-mcu-1-copy2.yaml', chip),
    ];
  };

  it('reports diagnostics sorted by file, path, code, whatever the order they were found in', () => {
    const r = validateCatalog(broken());
    expect(r.diagnostics.map((d) => `${d.file} ${d.path} ${d.code}`)).toEqual([
      'chips/demo-mcu-1-copy.yaml id E_DUPLICATE_ID',
      'chips/demo-mcu-1-copy2.yaml id E_DUPLICATE_ID',
      'chips/demo-mcu-1.yaml id E_DUPLICATE_ID',
      'ics/demo-sensor-1.yaml vendor E_SCHEMA',
    ]);
    expect([...r.diagnostics].sort(compareDiagnostics)).toEqual(r.diagnostics);
  });

  it('names the other files of a duplicate in code-unit order', () => {
    const r = validateCatalog([...broken()].reverse());
    const msg = (file: string) => r.diagnostics.find((d) => d.file === file)?.message ?? '';
    expect(msg('chips/demo-mcu-1.yaml')).toContain(
      '(also in chips/demo-mcu-1-copy.yaml, chips/demo-mcu-1-copy2.yaml)',
    );
    expect(msg('chips/demo-mcu-1-copy.yaml')).toContain(
      '(also in chips/demo-mcu-1-copy2.yaml, chips/demo-mcu-1.yaml)',
    );
  });

  it('gives identical results for 40 shuffled input orders', () => {
    const reference = validateCatalog(broken());
    for (let seed = 1; seed <= 40; seed++) {
      expect(validateCatalog(shuffled(broken(), seed)), `seed ${String(seed)}`).toEqual(reference);
    }
  });

  it('a clean catalog compiles to identical bytes for shuffled inputs', () => {
    const chip = textOf('chips/');
    const sources = [
      ...validSources(),
      ...['zzz', 'a-b', 'a.b', 'a_b', 'ab'].map((id) =>
        source(`chips/${id}.yaml`, chip.replace('id: demo-mcu-1', `id: ${id}`)),
      ),
    ];
    const ref = compileCatalog(validateCatalog(sources), { date: '2026-01-01' });
    for (let seed = 1; seed <= 20; seed++) {
      const c = compileCatalog(validateCatalog(shuffled(sources, seed)), { date: '2026-01-01' });
      expect(c.catalogText, `seed ${String(seed)}`).toBe(ref.catalogText);
      expect(c.manifestText).toBe(ref.manifestText);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// H2 duplicates are never silently resolved
// ---------------------------------------------------------------------------------------------
describe('duplicate ids keep nothing (H2)', () => {
  it('two chips with one id: both files are reported, and the board is NOT given a status from a winner', () => {
    const r = validateCatalog([...validSources(), source('chips/copy.yaml', textOf('chips/'))]);
    expect(brief(r)).toEqual([
      ['E_DUPLICATE_ID', 'chips/copy.yaml', 'id'],
      ['E_DUPLICATE_ID', 'chips/demo-mcu-1.yaml', 'id'],
    ]);
    expect(r.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'partially-verified', computed: null },
    ]);
  });

  it('two modules with one id: both reported, no status, no extra reference error', () => {
    const r = validateCatalog([...validSources(), source('modules/copy.yaml', textOf('modules/'))]);
    expect(brief(r)).toEqual([
      ['E_DUPLICATE_ID', 'modules/copy.yaml', 'id'],
      ['E_DUPLICATE_ID', 'modules/demo-module-1.yaml', 'id'],
    ]);
    expect(r.coverage.boards[0]?.computed).toBeNull();
  });

  it('two evidence files with one id: every citing fact is skipped, nothing is merged', () => {
    const r = validateCatalog([
      ...validSources(),
      source('evidence/copy.yaml', textOf('evidence/')),
    ]);
    expect(brief(r)).toEqual([
      ['E_DUPLICATE_ID', 'evidence/copy.yaml', 'id'],
      ['E_DUPLICATE_ID', 'evidence/demo-datasheet-1.yaml', 'id'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// H10 YAML 1.2, H15 evidence-date fallback
// ---------------------------------------------------------------------------------------------
describe('YAML is parsed as 1.2 (H10)', () => {
  it('no / yes / on / off / y / n stay strings; 010 is decimal; 1:30 and 1_000 stay strings', () => {
    const sources = patched('chips/', 'vendor: Demo Corp', 'vendor: no');
    const edited = sources.map((s) =>
      s.file.startsWith('chips/')
        ? {
            ...s,
            text: s.text
              .replace('family: DEMO-MCU', 'family: yes')
              .replace('series: DEMO-MCU-1', 'series: on')
              .replace('revisions: ["v1"]', 'revisions: [off, y, n, "1", 1:30, 1_000, Yes, NO]')
              .replace('unit: mA, value: 10 }', 'unit: mA, value: 010 }'),
          }
        : s,
    );
    const r = validateCatalog(edited);
    expect(brief(r)).toEqual([]);
    const chip = r.catalog.chips[0];
    expect(chip?.vendor).toBe('no');
    expect(chip?.family).toBe('yes');
    expect(chip?.series).toBe('on');
    expect(chip?.revisions).toEqual(['off', 'y', 'n', '1', '1:30', '1_000', 'Yes', 'NO']);
    expect(chip?.electrical.pin_current_max.value).toBe(10);
  });

  it('explicit tags that would turn a string into another type are shape errors (no 1.1 coercion)', () => {
    for (const tag of ['!!binary aGk=', '!!timestamp 2026-01-01', '!!set { a, b }']) {
      const r = validateCatalog(patched('chips/', 'vendor: Demo Corp', `vendor: ${tag}`));
      expect(brief(r), tag).toEqual([['E_SCHEMA', 'chips/demo-mcu-1.yaml', 'vendor']]);
    }
  });
});

describe('manifest date fallback (H15)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    vi.unstubAllEnvs();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  const evidenceOn = (id: string, accessed: string) =>
    source(
      `evidence/${id}.yaml`,
      textOf('evidence/')
        .replaceAll('demo-datasheet-1#', `${id}#`)
        .replace('id: demo-datasheet-1', `id: ${id}`)
        .replace('accessed: "2026-10-22"', `accessed: "${accessed}"`),
    );

  it('without SOURCE_DATE_EPOCH and without git it takes the LATEST evidence accessed date', () => {
    const root = mkdtempSync(join(tmpdir(), 'pinout-date-'));
    dirs.push(root);
    // Force "not a git repository" whatever the temp directory is nested in.
    vi.stubEnv('GIT_DIR', join(root, 'no-such-git-dir'));
    const sources = [
      ...validSources(),
      evidenceOn('demo-ds-2020', '2020-01-02'),
      evidenceOn('demo-ds-2031', '2031-05-06'),
      evidenceOn('demo-ds-2027', '2027-03-04'),
    ];
    const result = validateCatalog(sources);
    expect(result.errorCount).toBe(0);
    expect(resolveCatalogDate(root, {}, result)).toEqual({
      date: '2031-05-06',
      source: 'evidence',
    });
  });

  it('SOURCE_DATE_EPOCH wins over the evidence dates; no evidence at all gives 1970-01-01', () => {
    const result = validateRoot(VALID_ROOT);
    expect(resolveCatalogDate(VALID_ROOT, { SOURCE_DATE_EPOCH: '86400' }, result)).toEqual({
      date: '1970-01-02',
      source: 'SOURCE_DATE_EPOCH',
    });
    const root = mkdtempSync(join(tmpdir(), 'pinout-date-'));
    dirs.push(root);
    vi.stubEnv('GIT_DIR', join(root, 'no-such-git-dir'));
    expect(resolveCatalogDate(root, {}, validateCatalog([]))).toEqual({
      date: '1970-01-01',
      source: 'none',
    });
  });
});

// ---------------------------------------------------------------------------------------------
// B6: prototype-named pads never resolve (own-property lookups at every pad reference site)
// ---------------------------------------------------------------------------------------------
describe('pad names that exist on Object.prototype are not pads (B6)', () => {
  const NAMES = ['toString', 'hasOwnProperty', 'valueOf', 'constructor', '__proto__'];
  const sites: [string, (name: string) => SourceFile[], string, string, string][] = [
    [
      'board gpio pin',
      (n) => patched('boards/', 'pad: GPIO1, position: 4', `pad: ${n}, position: 4`),
      'E_PIN_NUMBERING',
      'boards/demo-board-1@r1.yaml',
      'connectors.0.pins.3.pad',
    ],
    [
      'board onboard uses_pad',
      (n) => patched('boards/', 'uses_pad: [GPIO1]', `uses_pad: [GPIO1, ${n}]`),
      'E_REF_UNRESOLVED',
      'boards/demo-board-1@r1.yaml',
      'onboard.0.uses_pad.1',
    ],
    [
      'board os_overlays pad',
      (n) =>
        patched(
          'boards/',
          'numbering: { primary: gpio }\n',
          `numbering: { primary: gpio }\nos_overlays:\n  - { evidence: [demo-datasheet-1#board-pinout], name: o, pads: { led: ${n} } }\n`,
        ),
      'E_REF_UNRESOLVED',
      'boards/demo-board-1@r1.yaml',
      'os_overlays.0.pads.led',
    ],
    [
      'module bonded_pads',
      (n) =>
        patched(
          'modules/',
          'bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]',
          `bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3, ${n}]`,
        ),
      'E_REF_UNRESOLVED',
      'modules/demo-module-1.yaml',
      'bonded_pads.4',
    ],
    [
      'chip iomux_pins',
      (n) =>
        patched(
          'chips/',
          'I2C0: { kind: i2c, matrix_routable: true }',
          `I2C0: { kind: i2c, iomux_pins: { sda: ${n} }, matrix_routable: true }`,
        ),
      'E_REF_UNRESOLVED',
      'chips/demo-mcu-1.yaml',
      'peripherals.I2C0.iomux_pins.sda',
    ],
  ];

  for (const [site, make, code, file, path] of sites) {
    it.each(NAMES)(`${site}: "%s" is reported as unknown`, (name) => {
      const r = validateCatalog(make(name));
      const own = errorsOf(r).filter((e) => e.code === code && e.file === file && e.path === path);
      expect(own, JSON.stringify(brief(r))).toHaveLength(1);
      expect(own[0]?.message).toMatch(/is not a pad of chip demo-mcu-1/);
    });
  }

  it('module consumed key "toString" is not a pad', () => {
    const r = validateCatalog(patched('modules/', '\n  GPIO3: {', '\n  toString: {'));
    expect(brief(r)).toEqual([
      ['E_REF_UNRESOLVED', 'modules/demo-module-1.yaml', 'consumed.toString'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// S9: reading evidence ids resolve and have the claim-id shape
// ---------------------------------------------------------------------------------------------
describe('conflict reading evidence (S9)', () => {
  const RESET_OLD = 'status: verified, value: pullup }';
  const conflict = (evidence: string) =>
    patched(
      'chips/',
      RESET_OLD,
      `status: conflict, active: pullup, readings: [{ value: pullup, evidence: [demo-datasheet-1#pad-table] }, { value: input, evidence: [${evidence}] }], value: pullup }`,
    );

  it('a resolvable reading is accepted', () => {
    expect(validateCatalog(conflict('demo-datasheet-1#pad-table')).diagnostics).toEqual([]);
  });

  it('an unknown claim in readings.N.evidence is E_EVIDENCE_UNKNOWN', () => {
    const r = validateCatalog(conflict('demo-datasheet-1#nope'));
    expect(brief(r)).toEqual([
      [
        'E_EVIDENCE_UNKNOWN',
        'chips/demo-mcu-1.yaml',
        'pads.GPIO0.reset_state.readings.1.evidence.0',
      ],
    ]);
  });

  it('an unknown evidence document in a reading is E_EVIDENCE_UNKNOWN', () => {
    const r = validateCatalog(conflict('no-such-doc#x'));
    expect(brief(r)).toEqual([
      [
        'E_EVIDENCE_UNKNOWN',
        'chips/demo-mcu-1.yaml',
        'pads.GPIO0.reset_state.readings.1.evidence.0',
      ],
    ]);
  });

  it('a reading id that is not <doc>#<slug> is a shape error, not an unknown-document lookup', () => {
    const r = validateCatalog(conflict('no-hash'));
    expect(brief(r)).toEqual([
      ['E_SCHEMA', 'chips/demo-mcu-1.yaml', 'pads.GPIO0.reset_state.readings.1.evidence.0'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// CR9: the unknown-claim message lists known claims of that document
// ---------------------------------------------------------------------------------------------
describe('E_EVIDENCE_UNKNOWN lists known claim ids (CR9)', () => {
  const bad = () =>
    patched(
      'modules/',
      `${CLAIM}, ${R2}, status: verified, unit: V, value: 3.3`,
      'evidence: [demo-datasheet-1#typo], ' + `${R2}, status: verified, unit: V, value: 3.3`,
    );

  it('names up to 5 claims of the cited document, sorted, and says there are more', () => {
    const r = validateCatalog(bad());
    const message = errorsOf(r)[0]?.message ?? '';
    expect(message).toContain(
      'unknown claim "demo-datasheet-1#typo" in evidence document "demo-datasheet-1"',
    );
    const known = (textOf('evidence/').match(/id: (demo-datasheet-1#[^\n]+)/g) ?? [])
      .map((l) => l.slice(4))
      .sort(byCodeUnit);
    expect(known.length).toBeGreaterThan(5);
    const listed = /known claims: ([^)]*)\)/.exec(message)?.[1] ?? '';
    expect(listed.replace(/, \.\.\.$/, '').split(', ')).toEqual(known.slice(0, 5));
    expect(listed.endsWith('...')).toBe(true);
  });

  it('lists all claims, without an ellipsis, when the document has at most 5', () => {
    const small = validSources().map((s) =>
      s.file.startsWith('evidence/')
        ? {
            ...s,
            // keep only the claims "pad-table" and "strap-gpio0"
            text: s.text.replace(
              / {2}- id: demo-datasheet-1#(?!pad-table|strap-gpio0)[^\n]*\n(?: {4}[^\n]*\n)+/g,
              '',
            ),
          }
        : s,
    );
    // Only the first two claims remain; every other citation is unknown, so just look at one message.
    const r = validateCatalog(small);
    const message = errorsOf(r).find((e) => e.code === 'E_EVIDENCE_UNKNOWN')?.message ?? '';
    expect(message).toMatch(
      /\(known claims: demo-datasheet-1#pad-table, demo-datasheet-1#strap-gpio0\)$/,
    );
    expect(message).not.toContain('...');
  });

  it('an unknown document has no list (there is nothing to list)', () => {
    const r = validateCatalog(
      patched(
        'modules/',
        `${CLAIM}, ${R2}, status: verified, unit: V`,
        `evidence: [no-such-doc#x], ${R2}, status: verified, unit: V`,
      ),
    );
    expect(errorsOf(r)[0]?.message).toBe(
      'unknown evidence document "no-such-doc" (cited as "no-such-doc#x")',
    );
  });
});

// ---------------------------------------------------------------------------------------------
// CR5-R2 / CR4-R2 / CR6-R2: loader and CLI edges
// ---------------------------------------------------------------------------------------------
describe('catalog root, links and directory names', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const tmp = () => {
    const d = mkdtempSync(join(tmpdir(), 'pinout-root-'));
    dirs.push(d);
    return d;
  };
  const run = (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = runCli(argv, {
      cwd: REPO_ROOT,
      env: { SOURCE_DATE_EPOCH: '0' },
      stdout: (l) => out.push(l),
      stderr: (l) => err.push(l),
    });
    return { code, out: out.join('\n'), err: err.join('\n') };
  };

  describe('CR5-R2: --root must look like a catalog', () => {
    it('an existing directory without any kind directory exits 2, never "0 errors"', () => {
      const root = tmp();
      mkdirSync(join(root, 'docs'));
      writeFileSync(join(root, 'README.md'), 'x');
      for (const command of ['validate', 'compile']) {
        const r = run([
          command,
          '--root',
          root,
          ...(command === 'compile' ? ['--out', join(root, 'o')] : []),
        ]);
        expect(r.code, command).toBe(2);
        expect(r.err).toContain('not a catalog root');
        expect(r.err).toContain('evidence/');
        expect(r.err).toContain('fixtures/');
        expect(r.out).not.toContain('0 errors');
      }
    });

    it('a typo such as the fixture sub-directory "chips" itself is rejected', () => {
      expect(run(['validate', '--root', join(VALID_ROOT, 'chips')]).code).toBe(2);
    });

    it('a root with only an empty kind directory is a valid, empty catalog (exit 0)', () => {
      const root = tmp();
      mkdirSync(join(root, 'ics'));
      const r = run(['validate', '--root', root]);
      expect(r.code).toBe(0);
      expect(r.out).toContain('0 errors, 0 warnings in 0 files');
    });

    it('an empty catalog (only .gitkeep files) validates and compiles (exit 0)', () => {
      expect(run(['validate', '--root', EMPTY_CATALOG]).code).toBe(0);
      const out = join(tmp(), 'out');
      const r = run(['compile', '--root', EMPTY_CATALOG, '--out', out]);
      expect(r.code).toBe(0);
      expect(statSync(join(out, 'catalog-manifest.json')).isFile()).toBe(true);
    });

    it('the real catalog validates and compiles (exit 0), whatever it contains', () => {
      expect(run(['validate', '--root', REAL_CATALOG]).code).toBe(0);
      const out = join(tmp(), 'out-real');
      expect(run(['compile', '--root', REAL_CATALOG, '--out', out]).code).toBe(0);
      expect(statSync(join(out, 'catalog-manifest.json')).isFile()).toBe(true);
    });
  });

  describe('CR6-R2: a wrongly cased kind directory', () => {
    it('is an error that says the name must be lower-case, and is not loaded on any file system', () => {
      const root = tmp();
      mkdirSync(join(root, 'Chips'));
      writeFileSync(join(root, 'Chips', 'a.yaml'), textOf('chips/'));
      mkdirSync(join(root, 'boards'));
      const loaded = loadCatalogSources(root);
      expect(loaded.sources).toEqual([]);
      const d = loaded.diagnostics.filter((x) => x.code === 'E_UNKNOWN_DIR');
      expect(d.map((x) => x.file)).toEqual(['Chips/a.yaml']);
      expect(d[0]?.message).toContain('lower-case "chips/"');
      expect(d[0]?.message).toContain('Linux');
      expect(d[0]?.message).not.toMatch(/is not loaded|this file is not loaded/);
      const r = validateRoot(root);
      expect(r.coverage.entities.chips).toBe(0);
      expect(r.errorCount).toBe(1);
    });

    it('another unknown directory keeps the plain "not loaded" wording', () => {
      const root = tmp();
      mkdirSync(join(root, 'boards'));
      mkdirSync(join(root, 'chip'));
      writeFileSync(join(root, 'chip', 'a.yaml'), 'x: 1');
      const d = loadCatalogSources(root).diagnostics[0];
      expect(d?.code).toBe('E_UNKNOWN_DIR');
      expect(d?.message).toContain('this file is not loaded');
    });
  });

  describe('CR4-R2: links are skipped with a warning', () => {
    const junctionsWork = (() => {
      const d = mkdtempSync(join(tmpdir(), 'pinout-probe-'));
      try {
        mkdirSync(join(d, 't'));
        symlinkSync(join(d, 't'), join(d, 'l'), 'junction');
        return true;
      } catch {
        return false;
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    })();
    const fileLinksWork = (() => {
      const d = mkdtempSync(join(tmpdir(), 'pinout-probe-'));
      try {
        writeFileSync(join(d, 't'), 'x');
        symlinkSync(join(d, 't'), join(d, 'l'), 'file');
        return true;
      } catch {
        return false;
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    })();
    const NO_JUNCTION = 'creating directory symlinks/junctions is not permitted here';
    const NO_FILE_LINK =
      'creating file symlinks is not permitted here (needs privileges on Windows)';

    /** A catalog root with chips/ + a real directory `elsewhere/` holding a chip with a bad file. */
    const base = () => {
      const root = tmp();
      mkdirSync(join(root, 'chips'));
      const elsewhere = tmp();
      writeFileSync(join(elsewhere, 'bad.yaml'), 'id: [unterminated\n');
      return { root, elsewhere };
    };
    const warnings = (root: string) =>
      validateRoot(root).diagnostics.filter((d) => d.code === 'W_SYMLINK_SKIPPED');

    it.skipIf(!junctionsWork)(`a junction/symlink directory in the root: ${NO_JUNCTION}`, () => {
      const { root, elsewhere } = base();
      symlinkSync(elsewhere, join(root, 'chipz'), 'junction');
      const r = validateRoot(root);
      expect(r.diagnostics.map((d) => [d.severity, d.code, d.file])).toEqual([
        ['warning', 'W_SYMLINK_SKIPPED', 'chipz'],
      ]);
      expect(r.errorCount).toBe(0);
      const cli = run(['validate', '--root', root]);
      expect(cli.code).toBe(0);
      expect(cli.out).toContain('warning W_SYMLINK_SKIPPED chipz');
    });

    it.skipIf(!junctionsWork)(
      `a junction inside a kind directory is not followed: ${NO_JUNCTION}`,
      () => {
        const { root, elsewhere } = base();
        symlinkSync(elsewhere, join(root, 'chips', 'linked'), 'junction');
        const r = validateRoot(root);
        expect(r.diagnostics.map((d) => [d.severity, d.code, d.file])).toEqual([
          ['warning', 'W_SYMLINK_SKIPPED', 'chips/linked'],
        ]);
        expect(r.fileCount).toBe(0);
      },
    );

    it.skipIf(!junctionsWork)(
      `a kind directory that is itself a link is skipped: ${NO_JUNCTION}`,
      () => {
        const { root, elsewhere } = base();
        writeFileSync(join(elsewhere, 'ok.yaml'), 'id: x\n');
        symlinkSync(elsewhere, join(root, 'ics'), 'junction');
        const r = validateRoot(root);
        expect(r.diagnostics.map((d) => [d.code, d.file])).toEqual([['W_SYMLINK_SKIPPED', 'ics']]);
        expect(r.fileCount).toBe(0);
      },
    );

    it.skipIf(!junctionsWork)(`a dangling link is reported, not a crash: ${NO_JUNCTION}`, () => {
      const { root, elsewhere } = base();
      symlinkSync(elsewhere, join(root, 'chips', 'gone'), 'junction');
      rmSync(elsewhere, { recursive: true, force: true });
      expect(warnings(root).map((d) => d.file)).toEqual(['chips/gone']);
    });

    it.skipIf(!fileLinksWork)(`a file symlink inside a kind directory: ${NO_FILE_LINK}`, () => {
      const { root, elsewhere } = base();
      symlinkSync(join(elsewhere, 'bad.yaml'), join(root, 'chips', 'a.yaml'), 'file');
      const r = validateRoot(root);
      expect(r.diagnostics.map((d) => [d.severity, d.code, d.file])).toEqual([
        ['warning', 'W_SYMLINK_SKIPPED', 'chips/a.yaml'],
      ]);
      expect(r.fileCount).toBe(0);
    });
  });
});
