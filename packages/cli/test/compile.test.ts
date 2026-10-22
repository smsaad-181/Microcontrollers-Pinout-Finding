import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileCatalog, stableStringify, validateRoot } from '../src/index.js';
import { EMPTY_CATALOG, VALID_ROOT, invalidRoot } from './helpers.js';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('stableStringify', () => {
  it('sorts keys lexicographically at every depth, including integer-like keys', () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null }, '11': 0, '2': 0 })).toBe(
      '{"11":0,"2":0,"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}',
    );
  });

  it('pretty-prints with an indent', () => {
    expect(stableStringify({ b: [1], a: {} }, 2)).toBe('{\n  "a": {},\n  "b": [\n    1\n  ]\n}');
  });

  it('skips undefined object values like JSON.stringify', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe('compileCatalog', () => {
  const valid = validateRoot(VALID_ROOT);

  it('throws when the validation result has errors', () => {
    expect(() =>
      compileCatalog(validateRoot(invalidRoot('pin-numbering')), { date: '2026-01-01' }),
    ).toThrow(/refusing/i);
  });

  it('is deterministic: same input gives identical bytes and hashes', () => {
    const a = compileCatalog(valid, { date: '2026-01-01' });
    const b = compileCatalog(validateRoot(VALID_ROOT), { date: '2026-01-01' });
    expect(b.catalogText).toBe(a.catalogText);
    expect(b.manifestText).toBe(a.manifestText);
    expect(b.version).toBe(a.version);
  });

  it('manifest sha256 matches the catalog bytes; version names the file', () => {
    const c = compileCatalog(valid, { date: '2026-01-01' });
    const m = JSON.parse(c.manifestText) as Record<string, unknown>;
    expect(m.sha256).toBe(sha(c.catalogText));
    expect(c.fileName).toBe(`${c.version}.json`);
    expect(m.file).toBe(c.fileName);
    expect(m.version).toBe(c.version);
    expect(m.date).toBe('2026-01-01');
    expect(c.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('manifest carries counts per fact status, per board status and per entity kind', () => {
    const m = JSON.parse(compileCatalog(valid, { date: '2026-01-01' }).manifestText) as Record<
      string,
      unknown
    >;
    expect(m.facts).toEqual({
      community: 0,
      conflict: 0,
      interim: 1,
      missing: 1,
      'single-source': 0,
      verified: 39,
    });
    expect(m.counts).toEqual({
      boards: 1,
      breakouts: 1,
      chips: 1,
      evidence: 1,
      ics: 1,
      modules: 1,
    });
    expect(m.board_status).toEqual({
      'datasheet-required': 0,
      'fully-verified': 0,
      'partially-verified': 1,
      unsupported: 0,
    });
  });

  it('the version depends on catalog content only, not on the date', () => {
    const a = compileCatalog(valid, { date: '2026-01-01' });
    const b = compileCatalog(valid, { date: '2030-12-31' });
    expect(b.version).toBe(a.version);
    expect(b.catalogText).toBe(a.catalogText);
    expect(b.manifestText).not.toBe(a.manifestText);
  });

  it('the catalog JSON has sorted keys and holds the compiled entities', () => {
    const c = compileCatalog(valid, { date: '2026-01-01' });
    const parsed = JSON.parse(c.catalogText) as Record<string, unknown>;
    expect(stableStringify(parsed) + '\n').toBe(c.catalogText);
    expect(Object.keys(parsed)).toEqual([
      'boards',
      'breakouts',
      'chips',
      'evidence',
      'format',
      'ics',
      'modules',
      'version',
    ]);
    expect((parsed.boards as { id: string }[])[0]?.id).toBe('demo-board-1');
  });

  it('compiles the empty catalog', () => {
    const c = compileCatalog(validateRoot(EMPTY_CATALOG), { date: '2026-01-01' });
    const parsed = JSON.parse(c.catalogText) as Record<string, unknown[]>;
    expect(parsed.chips).toEqual([]);
    expect(JSON.parse(c.manifestText)).toMatchObject({ counts: { boards: 0 } });
  });
});
