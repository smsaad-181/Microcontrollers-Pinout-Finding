import { describe, expect, it } from 'vitest';
import {
  loadCatalogSources,
  validateCatalog,
  validateRoot,
  type SourceFile,
} from '../src/index.js';
import { REAL_CATALOG, VALID_ROOT, invalidCases, invalidRoot } from './helpers.js';

const errorsOf = (r: ReturnType<typeof validateCatalog>) =>
  r.diagnostics.filter((d) => d.severity === 'error');

describe('valid fixture catalog', () => {
  const result = validateRoot(VALID_ROOT);

  it('has no errors and no warnings', () => {
    expect(result.diagnostics).toEqual([]);
  });

  it('loads one entity of every kind, identified by directory + id', () => {
    expect(result.coverage.entities).toEqual({
      boards: 1,
      breakouts: 1,
      chips: 1,
      evidence: 1,
      fixtures: 1,
      ics: 1,
      modules: 1,
    });
    expect(result.catalog.boards.map((b) => `${b.id}@${b.revision}`)).toEqual(['demo-board-1@r1']);
  });

  it('counts facts per status exactly as the fixture README states (39/1/1 of 41)', () => {
    expect(result.coverage.facts).toEqual({
      verified: 39,
      'single-source': 0,
      conflict: 0,
      interim: 1,
      community: 0,
      missing: 1,
    });
    expect(result.coverage.factsByKind.chips).toMatchObject({
      verified: 25,
      interim: 1,
      missing: 0,
    });
    expect(result.coverage.factsByKind.modules).toMatchObject({ verified: 2 });
    expect(result.coverage.factsByKind.boards).toMatchObject({ verified: 2, missing: 1 });
    expect(result.coverage.factsByKind.ics).toMatchObject({ verified: 5 });
    expect(result.coverage.factsByKind.breakouts).toMatchObject({ verified: 5 });
  });

  it('reports the computed board status', () => {
    expect(result.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'partially-verified', computed: 'partially-verified' },
    ]);
  });
});

describe('empty real catalog (catalog/ with only .gitkeep + LICENSE)', () => {
  it('validates with no diagnostics and zero counts', () => {
    const r = validateRoot(REAL_CATALOG);
    expect(r.diagnostics).toEqual([]);
    expect(Object.values(r.coverage.entities).every((n) => n === 0)).toBe(true);
  });
});

describe('invalid fixture roots (contract: invalid/cases.yaml)', () => {
  const cases = invalidCases();

  it('covers every case directory', () => {
    expect(cases.length).toBe(12);
  });

  it.each(cases.map((c) => [c.case, c] as const))('%s', (_name, c) => {
    const errors = errorsOf(validateRoot(invalidRoot(c.case)));
    const match = errors.find(
      (e) => e.code === c.code && e.file === c.file && e.path.includes(c.path_contains),
    );
    expect(match, JSON.stringify(errors, null, 2)).toBeDefined();
    // Decision 8: no cascading errors — the case's code is the only code reported.
    expect([...new Set(errors.map((e) => e.code))]).toEqual([c.code]);
  });
});

describe('loader and YAML details', () => {
  const src = (file: string, text: string): SourceFile => ({
    file,
    kind: file.split('/')[0] as SourceFile['kind'],
    text,
  });

  it('reads unquoted dates as strings (YAML 1.2 core schema)', () => {
    const r = validateCatalog([
      src(
        'evidence/x.yaml',
        [
          'id: x',
          'title: T',
          'publisher: P',
          'doc_number: null',
          'revision: "1"',
          'revision_date: null',
          'url: https://example.com/x.pdf',
          'url_original: null',
          'accessed: 2026-10-11',
          'sha256: null',
          'kind: datasheet',
          'secondary: false',
          'manual: false',
          'claims: []',
        ].join('\n'),
      ),
    ]);
    expect(r.diagnostics).toEqual([]);
    expect(r.catalog.evidence[0]?.accessed).toBe('2026-10-11');
  });

  it('reports a YAML syntax error as E_YAML with the file', () => {
    const r = validateCatalog([src('chips/bad.yaml', 'id: [unclosed\n')]);
    expect(errorsOf(r).map((e) => [e.code, e.file])).toEqual([['E_YAML', 'chips/bad.yaml']]);
  });

  it('reports duplicate keys as E_YAML', () => {
    const r = validateCatalog([src('chips/dup.yaml', 'id: a\nid: b\n')]);
    expect(errorsOf(r).map((e) => e.code)).toEqual(['E_YAML']);
  });

  it('says "missing required key" when a required key is absent', () => {
    const r = validateRoot(invalidRoot('bad-fixture'));
    expect(errorsOf(r).map((e) => e.message)).toEqual(['missing required key "status"']);
  });

  it('reports an unknown key as E_SCHEMA at the offending key', () => {
    const r = validateRoot(VALID_ROOT);
    const board = r.catalog.boards[0];
    expect(board).toBeDefined();
    const sources = loadCatalogSources(VALID_ROOT).sources.map((s) =>
      s.file.startsWith('boards/') ? { ...s, text: `${s.text}\nstatuss: x\n` } : s,
    );
    const errors = errorsOf(validateCatalog(sources));
    expect(errors.map((e) => [e.code, e.file, e.path])).toEqual([
      ['E_SCHEMA', 'boards/demo-board-1@r1.yaml', 'statuss'],
    ]);
  });

  it('lists files with root-relative forward-slash paths, sorted, ignoring .gitkeep', () => {
    const { sources } = loadCatalogSources(VALID_ROOT);
    expect(sources.map((s) => s.file)).toEqual([
      'boards/demo-board-1@r1.yaml',
      'breakouts/demo-breakout-1.yaml',
      'chips/demo-mcu-1.yaml',
      'evidence/demo-datasheet-1.yaml',
      'fixtures/demo-board-1-demo-breakout-1.yaml',
      'ics/demo-sensor-1.yaml',
      'modules/demo-module-1.yaml',
    ]);
    expect(loadCatalogSources(REAL_CATALOG).sources).toEqual([]);
  });

  it('warns (does not fail) on dangling references, which have no Phase 1 error code', () => {
    const sources = loadCatalogSources(VALID_ROOT).sources.map((s) =>
      s.file.startsWith('breakouts/')
        ? { ...s, text: s.text.replace('ic: demo-sensor-1', 'ic: nope') }
        : s,
    );
    const r = validateCatalog(sources);
    expect(errorsOf(r)).toEqual([]);
    expect(r.diagnostics.map((d) => [d.severity, d.code, d.file, d.path])).toEqual([
      ['warning', 'W_DANGLING_REF', 'breakouts/demo-breakout-1.yaml', 'ic'],
    ]);
  });

  it('computes datasheet-required for a board without gpio pins', () => {
    const sources = loadCatalogSources(VALID_ROOT).sources.map((s) =>
      s.file.startsWith('boards/')
        ? { ...s, text: s.text.replaceAll('kind: gpio', 'kind: nc') }
        : s,
    );
    const r = validateCatalog(sources);
    expect(errorsOf(r).map((e) => [e.code, e.path])).toEqual([['E_BOARD_STATUS', 'status']]);
    expect(r.coverage.boards[0]?.computed).toBe('datasheet-required');
  });

  it('accepts a hand-set unsupported status without recomputing', () => {
    const sources = loadCatalogSources(VALID_ROOT).sources.map((s) =>
      s.file.startsWith('boards/')
        ? { ...s, text: s.text.replace(/^status: partially-verified$/m, 'status: unsupported') }
        : s,
    );
    const r = validateCatalog(sources);
    expect(r.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'unsupported', computed: null },
    ]);
    expect(errorsOf(r)).toEqual([]);
  });

  it('includes chip facts in the board status (wider scope, README decision 7)', () => {
    // Make every board/module fact verified-looking; the chip's interim fact must still block fully-verified.
    const sources = loadCatalogSources(VALID_ROOT).sources.map((s) => {
      if (!s.file.startsWith('boards/')) return s;
      return {
        ...s,
        text: s.text
          .replace(
            'max_current: { evidence: [], note: "Regulator DEMO-LDO-1 rating not cited yet.", status: missing, unit: mA, value: null }',
            'max_current: { evidence: [demo-datasheet-1#board-pinout], reviewers: [a, b], status: verified, unit: mA, value: 500 }',
          )
          .replace(/^status: partially-verified$/m, 'status: fully-verified'),
      };
    });
    const errors = errorsOf(validateCatalog(sources));
    expect(errors.map((e) => [e.code, e.path])).toEqual([['E_BOARD_STATUS', 'status']]);
  });
});
