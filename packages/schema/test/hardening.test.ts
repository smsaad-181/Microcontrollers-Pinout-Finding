// Phase 1 fix round 1: stricter shapes and reviewer identity (validator findings F4, F5, F9, CR1, CR9).
import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  ChipSchema,
  EvidenceSchema,
  checkFactRules,
  normalizeReviewer,
} from '../src/index.js';
import * as sample from './samples.js';

const paths = (r: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map((i) => i.path.map(String).join('.'));

const claim = (over: Record<string, unknown>) => ({
  ...sample.evidence,
  claims: [{ ...sample.evidence.claims[0], ...over }],
});

describe('reviewer identity (F4)', () => {
  const f = (reviewers: string[]) => ({
    e: { vih_min: { value: 1, evidence: ['d#1'], status: 'verified', reviewers } },
  });

  it('normalises by trim + lower-case', () => {
    expect(normalizeReviewer('  Hardware-Researcher ')).toBe('hardware-researcher');
  });

  it.each([[['hardware-researcher', 'Hardware-Researcher']], [['a ', 'a']], [[' A', 'a ']]])(
    '%j counts as one distinct reviewer',
    (reviewers) => {
      expect(checkFactRules(f(reviewers)).map((i) => i.code)).toEqual(['E_VERIFIED_REVIEWERS']);
    },
  );

  it('still accepts two genuinely different reviewers', () => {
    expect(checkFactRules(f(['a', 'B']))).toEqual([]);
  });

  it('an empty / blank reviewer key never counts as a reviewer', () => {
    expect(checkFactRules(f(['a', ''])).map((i) => i.code)).toEqual(['E_VERIFIED_REVIEWERS']);
    expect(checkFactRules(f(['a', '  '])).map((i) => i.code)).toEqual(['E_VERIFIED_REVIEWERS']);
  });

  it('a blank reviewer key is a shape error (E_SCHEMA) on any fact', () => {
    const chip = structuredClone(sample.chip);
    chip.vdd_io.reviewers = ['hardware-researcher', ''];
    const r = ChipSchema.safeParse(chip);
    expect(r.success).toBe(false);
    expect(paths(r)).toEqual(['vdd_io.reviewers.1']);
    chip.vdd_io.reviewers = ['hardware-researcher', '   '];
    expect(ChipSchema.safeParse(chip).success).toBe(false);
  });
});

describe('evidence claims (F5)', () => {
  it('accepts a 25-word quote and rejects 26 words', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${String(i)}`).join(' ');
    expect(EvidenceSchema.safeParse(claim({ quote: words(25) })).success).toBe(true);
    const r = EvidenceSchema.safeParse(claim({ quote: words(26) }));
    expect(r.success).toBe(false);
    expect(paths(r)).toEqual(['claims.0.quote']);
  });

  it('counts words across any whitespace, ignoring leading/trailing space', () => {
    const q = `  ${Array.from({ length: 25 }, () => 'w').join('\n\t ')}  `;
    expect(EvidenceSchema.safeParse(claim({ quote: q })).success).toBe(true);
  });

  it('caps a quote at 400 characters even with few words', () => {
    expect(EvidenceSchema.safeParse(claim({ quote: 'x'.repeat(400) })).success).toBe(true);
    expect(EvidenceSchema.safeParse(claim({ quote: 'x'.repeat(401) })).success).toBe(false);
  });

  it.each(['quote', 'locator', 'supports'])('%s must be non-empty after trim', (key) => {
    for (const v of ['', '   ', '\n']) {
      const r = EvidenceSchema.safeParse(claim({ [key]: v }));
      expect(r.success).toBe(false);
      expect(paths(r)).toEqual([`claims.0.${key}`]);
    }
  });
});

describe('evidence URL scheme (F9)', () => {
  it.each(['https://example.com/a.pdf', 'http://example.com/a.pdf'])('accepts %s', (url) => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url, url_original: url }).success).toBe(
      true,
    );
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.example/a'])(
    'rejects %s in url and url_original',
    (bad) => {
      const a = EvidenceSchema.safeParse({ ...sample.evidence, url: bad });
      expect(a.success).toBe(false);
      expect(paths(a)).toEqual(['url']);
      const b = EvidenceSchema.safeParse({ ...sample.evidence, url_original: bad });
      expect(b.success).toBe(false);
      expect(paths(b)).toEqual(['url_original']);
    },
  );
});

describe('Board.variants (CR1)', () => {
  it('needs at least one variant', () => {
    const r = BoardSchema.safeParse({ ...sample.board, variants: [] });
    expect(r.success).toBe(false);
    expect(paths(r)).toEqual(['variants']);
  });
});

describe('Expr error text (CR9)', () => {
  it('lists the accepted forms', () => {
    const chip = structuredClone(sample.chip) as unknown as {
      electrical: { vih_min: { value: unknown } };
    };
    chip.electrical.vih_min.value = 'VDDIO*abc';
    const r = ChipSchema.safeParse(chip);
    const msg = r.error?.issues[0]?.message ?? '';
    expect(msg).toContain('VDD*<k>');
    expect(msg).toContain('VDDIO+<v>');
    expect(msg).toContain('VDDIO*<k>');
  });
});
