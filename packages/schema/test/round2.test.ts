// Phase 1 fix round 2: conflict facts (N1b), reviewer key charset (N5), evidence text and URLs (N4, N8).
import { describe, expect, it } from 'vitest';
import { ChipSchema, EvidenceSchema, checkFactRules, jsonSchemas } from '../src/index.js';
import * as sample from './samples.js';

const paths = (r: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map((i) => i.path.map(String).join('.'));
const rule = (f: Record<string, unknown>) =>
  checkFactRules({ f }).map((i) => [i.code, i.path] as const);

describe('conflict facts (N1b)', () => {
  const rd = (value: unknown, evidence: string[] = ['d#1']) => ({ value, evidence });
  const conflict = (over: Record<string, unknown>) => ({
    value: 3.3,
    evidence: ['d#1'],
    status: 'conflict',
    readings: [rd(3.3), rd(5)],
    active: 3.3,
    ...over,
  });

  it('accepts two readings, evidence on each, active among them and value equal to active', () => {
    expect(rule(conflict({}))).toEqual([]);
  });

  it('needs at least two readings', () => {
    expect(rule(conflict({ readings: [rd(3.3)] }))).toEqual([['E_FACT_STATUS', 'f.readings']]);
    expect(rule(conflict({ readings: [] }))).toEqual([['E_FACT_STATUS', 'f.readings']]);
  });

  it('every reading needs at least one evidence id', () => {
    expect(rule(conflict({ readings: [rd(3.3), rd(5, [])] }))).toEqual([
      ['E_FACT_STATUS', 'f.readings.1.evidence'],
    ]);
  });

  it('active must be one of the readings', () => {
    expect(rule(conflict({ active: 4, value: 4 }))).toEqual([['E_FACT_STATUS', 'f.active']]);
  });

  it('value must equal active', () => {
    expect(rule(conflict({ value: 5 }))).toEqual([['E_FACT_STATUS', 'f.value']]);
  });

  it('compares with deep equality for objects, arrays and strings, regardless of key order', () => {
    const a = { min: 1, max: 2 };
    const ok = conflict({
      readings: [rd(a), rd({ min: 1, max: 3 })],
      active: { max: 2, min: 1 },
      value: { max: 2, min: 1 },
    });
    expect(rule(ok)).toEqual([]);
    const arr = conflict({ readings: [rd([1, 2]), rd([2, 1])], active: [2, 1], value: [2, 1] });
    expect(rule(arr)).toEqual([]);
    expect(rule({ ...arr, active: [1, 2, 3] }).map((i) => i[1])).toContain('f.active');
    const str = conflict({
      readings: [rd('pullup'), rd('input')],
      active: 'input',
      value: 'input',
    });
    expect(rule(str)).toEqual([]);
    expect(rule({ ...str, value: 'pullup' })).toEqual([['E_FACT_STATUS', 'f.value']]);
  });

  it('booleans: false is a real value, not "absent"', () => {
    const b = conflict({ readings: [rd(false), rd(true)], active: true, value: true });
    expect(rule(b)).toEqual([]);
    expect(rule({ ...b, value: false })).toEqual([['E_FACT_STATUS', 'f.value']]);
  });

  it('does not report value twice when it is null', () => {
    expect(rule(conflict({ value: null }))).toEqual([['E_FACT_STATUS', 'f.value']]);
  });
});

describe('reviewer key charset (N5)', () => {
  const withReviewer = (r: string) => {
    const chip = structuredClone(sample.chip);
    chip.vdd_io.reviewers = ['hardware-researcher', r];
    return ChipSchema.safeParse(chip);
  };

  it.each(['hardware-researcher​', 'hаrdware-researcher', '​x', 'a b', '-a', 'é'])(
    'rejects %j',
    (r) => {
      const res = withReviewer(r);
      expect(res.success).toBe(false);
      expect(paths(res)).toEqual(['vdd_io.reviewers.1']);
    },
  );

  it.each(['hardware-fact-auditor', 'a', 'Hardware-Auditor ', 'user.name_1', '0day'])(
    'accepts %j',
    (r) => {
      expect(withReviewer(r).success).toBe(true);
    },
  );
});

describe('evidence title / publisher / claim prefix (N4)', () => {
  it.each(['title', 'publisher'])('%s must not be blank', (key) => {
    for (const v of ['', '  ']) {
      const r = EvidenceSchema.safeParse({ ...sample.evidence, [key]: v });
      expect(r.success).toBe(false);
      expect(paths(r)).toEqual([key]);
    }
  });

  it('a claim id must start with the evidence id and a #', () => {
    const bad = {
      ...sample.evidence,
      claims: [{ ...sample.evidence.claims[0], id: 'other-doc#x' }],
    };
    const r = EvidenceSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(paths(r)).toEqual(['claims.0.id']);
    expect(EvidenceSchema.safeParse(sample.evidence).success).toBe(true);
  });
});

describe('evidence URL hygiene (N8)', () => {
  it.each([
    'https://user:pass@example.com/a.pdf',
    'https://user@example.com/a.pdf',
    'https://@example.com/a.pdf',
    ' https://example.com/a.pdf',
    'https://example.com/a.pdf ',
    'https://example.com/a b.pdf',
    'https://example.com/a\n.pdf',
    'HTTPS://example.com/a.pdf',
  ])('rejects %j in url and url_original', (bad) => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url: bad }).success).toBe(false);
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url_original: bad }).success).toBe(false);
  });

  it('allows an @ after the authority (path/query) and a port', () => {
    const url = 'https://example.com:8443/a@b.pdf?x=a@b';
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url }).success).toBe(true);
  });

  it('the emitted JSON Schema carries the ^https?:// pattern for url and url_original', () => {
    const props = jsonSchemas().evidence.properties as Record<string, unknown>;
    const patterns = (node: unknown): string[] => {
      if (typeof node !== 'object' || node === null) return [];
      const n = node as Record<string, unknown>;
      const own = typeof n.pattern === 'string' ? [n.pattern] : [];
      return [
        ...own,
        ...Object.values(n).flatMap((v) => (Array.isArray(v) ? v.flatMap(patterns) : patterns(v))),
      ];
    };
    for (const key of ['url', 'url_original']) {
      const found = patterns(props[key]).map((p) => new RegExp(p));
      const accepts = (u: string) => found.every((re) => re.test(u));
      expect(found.length, key).toBeGreaterThan(0);
      expect(accepts('https://example.com/a.pdf'), key).toBe(true);
      expect(accepts('http://example.com/a.pdf'), key).toBe(true);
      expect(accepts('javascript:alert(1)'), key).toBe(false);
      expect(accepts('file:///etc/passwd'), key).toBe(false);
      expect(accepts(' https://example.com/'), key).toBe(false);
    }
  });
});
