import { describe, expect, it } from 'vitest';
import { checkFactRules, collectClaimRefs, collectFacts } from '../src/index.js';
import * as sample from './samples.js';

const R2 = ['hardware-researcher', 'hardware-fact-auditor'];

describe('collectFacts', () => {
  it('finds every mapping with both status and evidence, with dot paths', () => {
    const paths = collectFacts(sample.board).map((f) => f.path);
    expect(paths).toEqual(['logic_voltage', 'rails.0.voltage', 'rails.0.max_current']);
  });

  it('does not treat onboard[] / fixture evidence lists as facts', () => {
    const b = {
      ...sample.board,
      onboard: [{ part: 'LED', uses_pad: ['GPIO0'], effect: 'e', evidence: ['demo-ds#a'] }],
    };
    expect(collectFacts(b)).toHaveLength(3);
    expect(collectFacts(sample.fixture)).toHaveLength(0);
  });

  it('uses record keys as they are and array indices as numbers', () => {
    const paths = collectFacts(sample.chip).map((f) => f.path);
    expect(paths).toContain('pads.GPIO1.reset_state');
    expect(paths).toContain('electrical.vih_min');
  });

  it('returns facts in a stable document order', () => {
    expect(collectFacts(sample.chip)).toEqual(collectFacts(structuredClone(sample.chip)));
  });
});

describe('collectClaimRefs', () => {
  it('collects every evidence id: facts, readings, onboard and fixture lists', () => {
    const refs = collectClaimRefs({
      a: {
        value: 1,
        status: 'conflict',
        evidence: ['d#1'],
        readings: [{ value: 1, evidence: ['d#2'] }],
        active: 1,
      },
      onboard: [{ evidence: ['d#3'] }],
      evidence: ['d#4'],
    });
    expect(refs).toEqual([
      { path: 'a.evidence.0', claim: 'd#1' },
      { path: 'a.readings.0.evidence.0', claim: 'd#2' },
      { path: 'onboard.0.evidence.0', claim: 'd#3' },
      { path: 'evidence.0', claim: 'd#4' },
    ]);
  });
});

describe('checkFactRules', () => {
  it('passes the valid samples', () => {
    for (const e of [sample.chip, sample.module_, sample.board, sample.ic, sample.breakout]) {
      expect(checkFactRules(e)).toEqual([]);
    }
  });

  it('E_EVIDENCE_MISSING: non-missing fact with evidence []', () => {
    const e = { vdd_range: { value: [1, 2], evidence: [], status: 'verified', reviewers: R2 } };
    expect(checkFactRules(e)).toEqual([
      {
        code: 'E_EVIDENCE_MISSING',
        path: 'vdd_range.evidence',
        message: expect.any(String) as string,
      },
    ]);
  });

  it('a missing fact may have evidence []', () => {
    expect(checkFactRules({ f: { value: null, evidence: [], status: 'missing' } })).toEqual([]);
  });

  it('E_FACT_STATUS: value set while missing', () => {
    const r = checkFactRules({
      rails: [{ max_current: { value: 500, evidence: [], status: 'missing' } }],
    });
    expect(r.map((i) => [i.code, i.path])).toEqual([
      ['E_FACT_STATUS', 'rails.0.max_current.value'],
    ]);
  });

  it('E_FACT_STATUS: value null while not missing', () => {
    const r = checkFactRules({ f: { value: null, evidence: ['d#1'], status: 'single-source' } });
    expect(r.map((i) => [i.code, i.path])).toEqual([['E_FACT_STATUS', 'f.value']]);
  });

  it('E_FACT_STATUS: conflict needs both readings and active', () => {
    const base = { value: 'input', evidence: ['d#1'], status: 'conflict' };
    const readings = [{ value: 'input', evidence: ['d#1'] }];
    expect(checkFactRules({ f: base }).map((i) => [i.code, i.path])).toEqual([
      ['E_FACT_STATUS', 'f.readings'],
    ]);
    expect(checkFactRules({ f: { ...base, readings } }).map((i) => i.code)).toEqual([
      'E_FACT_STATUS',
    ]);
    expect(checkFactRules({ f: { ...base, active: 'input' } }).map((i) => i.code)).toEqual([
      'E_FACT_STATUS',
    ]);
    expect(checkFactRules({ f: { ...base, readings, active: 'input' } })).toEqual([]);
  });

  it('E_VERIFIED_REVIEWERS: fewer than 2 distinct reviewers', () => {
    const f = (reviewers?: string[]) => ({
      e: {
        vih_min: {
          value: 1,
          evidence: ['d#1'],
          status: 'verified',
          ...(reviewers ? { reviewers } : {}),
        },
      },
    });
    for (const r of [undefined, [], ['a'], ['a', 'a']]) {
      expect(checkFactRules(f(r)).map((i) => [i.code, i.path])).toEqual([
        ['E_VERIFIED_REVIEWERS', 'e.vih_min.reviewers'],
      ]);
    }
    expect(checkFactRules(f(['a', 'b']))).toEqual([]);
  });

  it('non-verified statuses need no reviewers', () => {
    for (const status of ['single-source', 'interim', 'community']) {
      expect(checkFactRules({ f: { value: 1, evidence: ['d#1'], status } })).toEqual([]);
    }
  });
});
