// The fixture vocabulary registry (packages/schema/src/fixture-vocabulary.ts) is derived from the
// catalog fixtures: every entry must be used by at least one fixture (no stale entries), and all
// fixtures must validate against it.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-plus-operands -- test documents are dynamic YAML/JSON */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFLICT_TOKEN_PREFIXES,
  FixtureSchema,
  PROPERTY_KEYS,
  RELAXATION_BARE_TOKENS,
  RELAXATION_TOKEN_PREFIXES,
  WARNING_CODES,
} from '@pinout/schema';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const dir = join(__dirname, '..', '..', '..', 'catalog', 'fixtures');
const docs = readdirSync(dir)
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => ({ f, y: parse(readFileSync(join(dir, f), 'utf8')) as Record<string, any> }));

describe('catalog fixtures vs the vocabulary registry', () => {
  it('has the 24 hand-written fixtures and all validate', () => {
    expect(docs.length).toBe(25);
    for (const { f, y } of docs) {
      const r = FixtureSchema.safeParse(y);
      expect(r.success, `${f} ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it('every registry entry is used by a fixture', () => {
    const props = new Set<string>();
    const codes = new Set<string>();
    const conflict = new Set<string>();
    const relax = new Set<string>();
    const bare = new Set<string>();
    for (const { y } of docs) {
      for (const p of y.expect.properties ?? []) {
        for (const k of Object.keys(p)) props.add(k);
        if (p.no_warning_code) for (const c of p.no_warning_code) codes.add(c);
      }
      for (const w of y.expect.warnings_include ?? []) codes.add(w.code);
      for (const t of y.expect.minimal_conflict_includes ?? [])
        conflict.add(t.slice(0, t.indexOf(':') + 1));
      for (const t of y.expect.relaxations_include ?? [])
        if (t.includes(':')) relax.add(t.slice(0, t.indexOf(':') + 1));
        else bare.add(t);
    }
    expect([...PROPERTY_KEYS].sort()).toEqual([...props].sort());
    expect([...WARNING_CODES].sort()).toEqual([...codes].sort());
    expect([...CONFLICT_TOKEN_PREFIXES].sort()).toEqual([...conflict].sort());
    expect([...RELAXATION_TOKEN_PREFIXES].sort()).toEqual([...relax].sort());
    expect([...RELAXATION_BARE_TOKENS].sort()).toEqual([...bare].sort());
  });
});
