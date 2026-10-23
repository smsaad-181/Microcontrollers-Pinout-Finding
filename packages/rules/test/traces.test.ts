// Exact results (trace text, parts, values, evidence) of every rule branch. These pin the explanation
// output that the UI shows, and they kill the mutants that only change messages or skip a branch.
// Mutation testing (`pnpm mutation`) is what these tests are for; behaviour tests live in rules.test.ts.
import { describe, expect, it } from 'vitest';
import {
  fact,
  known,
  missingFact,
  parallelOhm,
  ratioToVolts,
  rpMaxOhm,
  rpMinOhm,
  type Fact,
  type RuleResult,
} from '../src/index.js';
import { Run, fmt, ge, le } from '../src/util.js';
import { ev } from './helpers.js';

const f = (v: number, id = 'ev:x'): Fact => fact(v, [id]);
const conflict = (id = 'ev:c'): Fact => ({ value: 1, status: 'conflict', evidence: [id] });
const inferred = (v: number, id = 'ev:i'): Fact => ({
  value: v,
  status: 'inferred',
  evidence: [id],
});
const gap = (r: RuleResult): string | undefined =>
  r.trace.find((t) => t.startsWith('unknown input'));

describe('util', () => {
  it('le/ge are inclusive with a relative tolerance that scales with the limit', () => {
    expect(le(3.6, 3.6)).toBe(true);
    expect(le(1000.0000005, 1000)).toBe(true); // within 1e-9 * 1000
    expect(le(1000.00002, 1000)).toBe(false);
    expect(le(0.001 + 5e-10, 0.001)).toBe(true); // tolerance floor is 1e-9 (max(1, |b|))
    expect(le(0.001 + 2e-9, 0.001)).toBe(false);
    expect(le(-1000.0000005, -1000)).toBe(true); // |b|, not b
    expect(ge(5, 5)).toBe(true);
    expect(ge(4.9, 5)).toBe(false);
    expect(ge(5, 4.9)).toBe(true);
  });
  it('fact and missingFact defaults', () => {
    expect(fact(3)).toEqual({ value: 3, status: 'verified', evidence: [] });
    expect(fact(3, ['e'], 'inferred')).toEqual({ value: 3, status: 'inferred', evidence: ['e'] });
    expect(missingFact()).toEqual({ value: null, status: 'missing', evidence: [] });
    expect(missingFact(['e'])).toEqual({ value: null, status: 'missing', evidence: ['e'] });
  });
  it('known accepts only verified/inferred finite numbers', () => {
    expect(known(undefined)).toBeUndefined();
    expect(known(f(2))).toBe(2);
    expect(known(inferred(2))).toBe(2);
    expect(known(fact(2, [], 'missing'))).toBeUndefined();
    expect(known(conflict())).toBeUndefined();
    expect(known({ value: null, status: 'verified', evidence: [] })).toBeUndefined();
    expect(known({ value: undefined, status: 'verified', evidence: [] })).toBeUndefined();
    expect(known({ value: Number.NaN, status: 'verified', evidence: [] })).toBeUndefined();
    expect(
      known({ value: Number.POSITIVE_INFINITY, status: 'verified', evidence: [] }),
    ).toBeUndefined();
    expect(
      known({ value: '3' as unknown as number, status: 'verified', evidence: [] }),
    ).toBeUndefined();
  });
  it('fmt rounds to 6 decimals and prints non-finite numbers', () => {
    expect(fmt(1.23456789)).toBe('1.234568');
    expect(fmt(2)).toBe('2');
    expect(fmt(1234567.5)).toBe('1234567.5');
    expect(fmt(0.0000004)).toBe('0');
    expect(fmt(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(fmt(Number.NaN)).toBe('NaN');
  });
  it('Run records evidence, gaps and an absent fact', () => {
    const r = new Run('R1');
    expect(r.need('a', f(1, 'ev:a'))).toBe(1);
    expect(r.incomplete).toBe(false);
    expect(r.need('b', undefined)).toBeUndefined();
    expect(r.need('c', conflict('ev:c'))).toBeUndefined();
    expect(r.need('d', missingFact(['ev:d']))).toBeUndefined();
    expect(r.incomplete).toBe(true);
    r.addEvidence(['ev:z', 'ev:a']);
    const res = r.caution();
    expect(res.evidence).toEqual(['ev:a', 'ev:c', 'ev:d', 'ev:z']);
    expect(res.trace).toEqual([
      'unknown input(s): b (not provided), c (conflict), d (missing) -> cannot verify, caution',
    ]);
    expect(res.level).toBe('caution');
    expect(res.passed).toBe(false);
    expect(res.requiredParts).toEqual([]);
    expect(res.values).toEqual({});
  });
  it('ratioToVolts', () => {
    expect(ratioToVolts(0.7, f(3.3, 'ev:v'))).toEqual({
      value: 0.7 * 3.3,
      status: 'verified',
      evidence: ['ev:v'],
    });
    expect(ratioToVolts(0.5, inferred(2))).toEqual({
      value: 1,
      status: 'inferred',
      evidence: ['ev:i'],
    });
    expect(ratioToVolts(0.5, missingFact(['ev:m']))).toEqual(missingFact(['ev:m']));
    expect(ratioToVolts(0.5, conflict('ev:c'))).toEqual(missingFact(['ev:c']));
    expect(ratioToVolts(0.5, { value: null, status: 'verified', evidence: ['ev:n'] })).toEqual(
      missingFact(['ev:n']),
    );
    expect(ratioToVolts(0.5, { value: undefined, status: 'inferred', evidence: [] })).toEqual(
      missingFact(),
    );
  });
  it('pure helpers', () => {
    expect(parallelOhm([])).toBe(Number.POSITIVE_INFINITY);
    expect(parallelOhm([100])).toBeCloseTo(100);
    expect(parallelOhm([100, 100])).toBeCloseTo(50);
    expect(rpMinOhm(3.3, 0.4, 3)).toBeCloseTo(966.6667, 3);
    expect(rpMaxOhm(300, 100)).toBeCloseTo(3540.8, 0);
  });
});

describe('R1 traces', () => {
  const fixed = (drv: Fact, max: Fact) => ({
    driverMaxV: drv,
    receiverAbsMax: { kind: 'fixed' as const, volts: max },
  });
  const plus = (drv: Fact, vddio: Fact, offsetV: Fact) => ({
    driverMaxV: drv,
    receiverAbsMax: { kind: 'vddio-plus' as const, vddio, offsetV },
  });
  it('pass, fail, vddio-plus', () => {
    expect(ev('R1', fixed(f(3.3, 'ev:d'), f(3.6, 'ev:a')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:a",
          "ev:d",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R1",
        "trace": [
          "driver max 3.3 V vs receiver absolute max 3.6 V (inclusive)",
        ],
        "values": {
          "driverMaxV": 3.3,
          "receiverAbsMaxV": 3.6,
        },
      }
    `);
    expect(ev('R1', fixed(f(5, 'ev:d'), f(3.6, 'ev:a')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:a",
          "ev:d",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "level-shifter",
            "note": "level shifter to bring the net within receiver absolute max",
          },
          {
            "kind": "divider",
            "note": "resistor divider (see R5) for a one-way signal",
          },
        ],
        "rule": "R1",
        "trace": [
          "driver max 5 V vs receiver absolute max 3.6 V (inclusive)",
        ],
        "values": {
          "driverMaxV": 5,
          "receiverAbsMaxV": 3.6,
        },
      }
    `);
    expect(ev('R1', plus(f(3.6, 'ev:d'), f(3.3, 'ev:v'), f(0.3, 'ev:o')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:d",
          "ev:o",
          "ev:v",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R1",
        "trace": [
          "driver max 3.6 V vs receiver absolute max 3.6 V (inclusive)",
        ],
        "values": {
          "driverMaxV": 3.6,
          "receiverAbsMaxV": 3.5999999999999996,
        },
      }
    `);
    expect(ev('R1', plus(f(3.7, 'ev:d'), f(3.3, 'ev:v'), f(0.3, 'ev:o')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:d",
          "ev:o",
          "ev:v",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "level-shifter",
            "note": "level shifter to bring the net within receiver absolute max",
          },
          {
            "kind": "divider",
            "note": "resistor divider (see R5) for a one-way signal",
          },
        ],
        "rule": "R1",
        "trace": [
          "driver max 3.7 V vs receiver absolute max 3.6 V (inclusive)",
        ],
        "values": {
          "driverMaxV": 3.7,
          "receiverAbsMaxV": 3.5999999999999996,
        },
      }
    `);
  });
  it('every missing input is named and gives caution', () => {
    expect(gap(ev('R1', fixed(missingFact(), f(3.6))))).toBe(
      'unknown input(s): driverMaxV (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R1', fixed(f(3.3), missingFact())))).toBe(
      'unknown input(s): receiverAbsMax (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R1', plus(f(3.3), missingFact(), f(0.3))))).toBe(
      'unknown input(s): receiver VDDIO (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R1', plus(f(3.3), f(3.3), missingFact())))).toBe(
      'unknown input(s): receiver abs-max offset (missing) -> cannot verify, caution',
    );
    expect(ev('R1', plus(f(3.3), missingFact(), f(0.3))).level).toBe('caution');
    expect(ev('R1', plus(f(3.3), f(3.3), missingFact())).level).toBe('caution');
    expect(ev('R1', plus(f(3.3), f(3.3), missingFact())).values).toEqual({});
  });
});

describe('R2 traces', () => {
  const ctx = (voh: Fact, vol: Fact, vih: Fact, vil: Fact) => ({
    driverVohMinV: voh,
    driverVolMaxV: vol,
    receiverVihMinV: vih,
    receiverVilMaxV: vil,
  });
  const ok = [f(3, 'ev:1'), f(0.4, 'ev:2'), f(2, 'ev:3'), f(0.8, 'ev:4')] as const;
  it('pass, high fail, low fail', () => {
    expect(ev('R2', ctx(...ok))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:1",
          "ev:2",
          "ev:3",
          "ev:4",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R2",
        "trace": [
          "VOH,min 3 V >= VIH,min 2 V",
          "VOL,max 0.4 V <= VIL,max 0.8 V",
        ],
        "values": {},
      }
    `);
    expect(ev('R2', ctx(f(2.64, 'ev:1'), f(0.4, 'ev:2'), f(3, 'ev:3'), f(0.8, 'ev:4'))))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:1",
          "ev:2",
          "ev:3",
          "ev:4",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "buffer",
            "note": "logic buffer with TTL-compatible input (74AHCT family) or a level shifter (74LVC family)",
          },
        ],
        "rule": "R2",
        "trace": [
          "VOH,min 2.64 V < VIH,min 3 V",
          "VOL,max 0.4 V <= VIL,max 0.8 V",
        ],
        "values": {},
      }
    `);
    expect(ev('R2', ctx(f(3, 'ev:1'), f(0.9, 'ev:2'), f(2, 'ev:3'), f(0.8, 'ev:4'))))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:1",
          "ev:2",
          "ev:3",
          "ev:4",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "buffer",
            "note": "logic buffer with TTL-compatible input (74AHCT family) or a level shifter (74LVC family)",
          },
        ],
        "rule": "R2",
        "trace": [
          "VOH,min 3 V >= VIH,min 2 V",
          "VOL,max 0.9 V > VIL,max 0.8 V",
        ],
        "values": {},
      }
    `);
  });
  it('each missing input gives its own caution', () => {
    const names = ['driver VOH,min', 'driver VOL,max', 'receiver VIH,min', 'receiver VIL,max'];
    for (let i = 0; i < 4; i++) {
      const a = [...ok] as Fact[];
      a[i] = missingFact();
      const r = ev('R2', ctx(...(a as [Fact, Fact, Fact, Fact])));
      expect(r.level).toBe('caution');
      expect(r.trace).toEqual([
        `unknown input(s): ${names[i] ?? ''} (missing) -> cannot verify, caution`,
      ]);
    }
  });
});

describe('R3 traces', () => {
  const ctx = (pull: Fact[], hz: number, cb: Fact, extra = {}) => ({
    pullUpsOhm: pull,
    vddV: f(3.3, 'ev:vdd'),
    volMaxV: f(0.4, 'ev:vol'),
    iolMa: f(3, 'ev:iol'),
    speedHz: hz,
    cbPf: cb,
    ...extra,
  });
  it('pass, too strong, too weak with and without a pull-up, Cb over limit', () => {
    expect(ev('R3', ctx([f(4700, 'ev:p')], 100_000, f(50, 'ev:cb')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:cb",
          "ev:iol",
          "ev:p",
          "ev:vdd",
          "ev:vol",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R3",
        "trace": [
          "Rp,min = (3.3 - 0.4) / 3 mA = 966.666667 ohm",
          "Rp,max = 1000 ns / (0.8473 * 50 pF) = 23604.390417 ohm",
          "Rp,eff = 4700 ohm",
        ],
        "values": {
          "rpEffOhm": 4700,
          "rpMaxOhm": 23604.390416617494,
          "rpMinOhm": 966.6666666666666,
        },
      }
    `);
    expect(
      ev(
        'R3',
        ctx(
          [f(4700, 'ev:p'), f(4700, 'ev:q'), f(4700, 'ev:r'), f(4700, 'ev:s'), f(4700, 'ev:t')],
          400_000,
          f(50, 'ev:cb'),
        ),
      ),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:cb",
          "ev:iol",
          "ev:p",
          "ev:q",
          "ev:r",
          "ev:s",
          "ev:t",
          "ev:vdd",
          "ev:vol",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "remove-pull-up",
            "maxOhms": 7081.3171249852485,
            "minOhms": 966.6666666666666,
            "note": "remove pull-ups (cut module pull-up jumpers) until Rp,eff is within range",
          },
        ],
        "rule": "R3",
        "trace": [
          "Rp,min = (3.3 - 0.4) / 3 mA = 966.666667 ohm",
          "Rp,max = 300 ns / (0.8473 * 50 pF) = 7081.317125 ohm",
          "Rp,eff = 940 ohm",
          "Rp,eff below Rp,min: too many parallel pull-ups (sink current exceeds IOL)",
        ],
        "values": {
          "rpEffOhm": 940,
          "rpMaxOhm": 7081.3171249852485,
          "rpMinOhm": 966.6666666666666,
        },
      }
    `);
    expect(ev('R3', ctx([f(10_000, 'ev:p')], 400_000, f(50, 'ev:cb')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:cb",
          "ev:iol",
          "ev:p",
          "ev:vdd",
          "ev:vol",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "pull-up",
            "maxOhms": 7081.3171249852485,
            "minOhms": 966.6666666666666,
            "note": "add this pull-up in parallel so Rp,eff reaches Rp,max",
            "valueOhms": 24262.02992317026,
          },
          {
            "hz": 100000,
            "kind": "lower-speed",
            "note": "or lower the bus clock",
          },
        ],
        "rule": "R3",
        "trace": [
          "Rp,min = (3.3 - 0.4) / 3 mA = 966.666667 ohm",
          "Rp,max = 300 ns / (0.8473 * 50 pF) = 7081.317125 ohm",
          "Rp,eff = 10000 ohm",
          "Rp,eff above Rp,max: rise time too slow",
        ],
        "values": {
          "rpEffOhm": 10000,
          "rpMaxOhm": 7081.3171249852485,
          "rpMinOhm": 966.6666666666666,
        },
      }
    `);
    expect(ev('R3', ctx([], 400_000, f(50, 'ev:cb')))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:cb",
          "ev:iol",
          "ev:vdd",
          "ev:vol",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "pull-up",
            "maxOhms": 7081.3171249852485,
            "minOhms": 966.6666666666666,
            "note": "add a pull-up within [Rp,min, Rp,max]",
            "valueOhms": 7081.3171249852485,
          },
        ],
        "rule": "R3",
        "trace": [
          "Rp,min = (3.3 - 0.4) / 3 mA = 966.666667 ohm",
          "Rp,max = 300 ns / (0.8473 * 50 pF) = 7081.317125 ohm",
          "Rp,eff = none (no pull-up)",
          "Rp,eff above Rp,max: rise time too slow",
        ],
        "values": {
          "rpMaxOhm": 7081.3171249852485,
          "rpMinOhm": 966.6666666666666,
        },
      }
    `);
    expect(ev('R3', ctx([f(4700, 'ev:p')], 400_000, f(450, 'ev:cb'), { cbMaxPf: f(400, 'ev:cm') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:cb",
          "ev:cm",
          "ev:iol",
          "ev:p",
          "ev:vdd",
          "ev:vol",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "hz": 100000,
            "kind": "lower-speed",
            "note": "reduce bus capacitance or speed",
          },
        ],
        "rule": "R3",
        "trace": [
          "Rp,min = (3.3 - 0.4) / 3 mA = 966.666667 ohm",
          "Rp,max = 300 ns / (0.8473 * 450 pF) = 786.813014 ohm",
          "Rp,eff = 4700 ohm",
          "Cb 450 pF exceeds the mode limit 400 pF",
          "Rp,eff above Rp,max: rise time too slow",
        ],
        "values": {
          "rpEffOhm": 4700,
          "rpMaxOhm": 786.8130138872498,
          "rpMinOhm": 966.6666666666666,
        },
      }
    `);
  });
  it('lower-speed suggestion walks to slower modes (1 MHz first, then 400 kHz, then 100 kHz)', () => {
    // 1 MHz, Cb 20 pF: Rp,max = 120 ns / (0.8473 * 20 pF) = 7.08 k; 400 kHz allows 17.7 k; 100 kHz allows 59 k
    const speeds = (pull: number): number[] =>
      ev('R3', ctx([f(pull)], 1_000_000, f(20))).requiredParts.flatMap((p) =>
        p.hz === undefined ? [] : [p.hz],
      );
    expect(speeds(10_000)).toEqual([400_000]); // fits the 400 kHz limit already
    expect(speeds(30_000)).toEqual([100_000]); // skips 400 kHz, fits 100 kHz
    expect(speeds(100_000)).toEqual([]); // nothing slower helps
    expect(ev('R3', ctx([f(10_000)], 100_000, f(100))).requiredParts.map((p) => p.kind)).toEqual(
      [],
    );
    expect(
      ev('R3', ctx([f(30_000)], 400_000, f(20))).requiredParts.flatMap((p) =>
        p.hz === undefined ? [] : [p.hz],
      ),
    ).toEqual([100_000]);
  });
  it('a pull-up is only suggested when Rp,max >= Rp,min (inclusive)', () => {
    // Cb 10 pF at 400 kHz: Rp,max = 35.4 k; choose VDD so that Rp,min equals Rp,max exactly
    const rpMax = rpMaxOhm(300, 10);
    const vdd = rpMax * (1 / 1000);
    expect(rpMinOhm(vdd, 0, 1)).toBe(rpMax);
    const c = {
      pullUpsOhm: [f(100_000)],
      vddV: f(vdd),
      volMaxV: f(0),
      iolMa: f(1),
      speedHz: 400_000,
      cbPf: f(10),
    };
    expect(ev('R3', c).requiredParts.map((p) => p.kind)).toEqual(['pull-up', 'lower-speed']);
    // Rp,max below Rp,min: no pull-up can fix it
    expect(ev('R3', { ...c, vddV: f(vdd * 1.5) }).requiredParts.map((p) => p.kind)).toEqual([
      'lower-speed',
    ]);
  });
  it('unknown inputs are named', () => {
    const base = ctx([f(4700)], 100_000, f(50));
    expect(gap(ev('R3', ctx([missingFact()], 100_000, f(50))))).toBe(
      'unknown input(s): pull-up #1 (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', ctx([f(4700), missingFact()], 100_000, f(50))))).toBe(
      'unknown input(s): pull-up #2 (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', { ...base, vddV: missingFact() }))).toBe(
      'unknown input(s): VDD (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', { ...base, volMaxV: missingFact() }))).toBe(
      'unknown input(s): VOL,max (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', { ...base, iolMa: missingFact() }))).toBe(
      'unknown input(s): IOL (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', { ...base, cbPf: missingFact() }))).toBe(
      'unknown input(s): Cb (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R3', { ...base, cbMaxPf: missingFact() }))).toBe(
      'unknown input(s): Cb limit (missing) -> cannot verify, caution',
    );
    expect(ev('R3', { ...base, cbMaxPf: missingFact() }).level).toBe('caution');
    expect(ev('R3', { ...base, cbMaxPf: undefined }).level).toBe('info');
    expect(ev('R3', { ...base, speedHz: 2_000_000 })).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:iol",
          "ev:vdd",
          "ev:vol",
          "ev:x",
        ],
        "level": "caution",
        "passed": false,
        "requiredParts": [],
        "rule": "R3",
        "trace": [
          "speed 2000000 Hz is outside the modes with a known tr,max",
          "unknown input(s): tr,max for this speed (missing) -> cannot verify, caution",
        ],
        "values": {},
      }
    `);
  });
});

describe('R4 traces', () => {
  it('pass, pin over, group over, group NaN limit', () => {
    const g = (name: string, loads: number[], limit: Fact) => ({
      name,
      loadsMa: loads.map((l) => f(l, `ev:${name}`)),
      limitMa: limit,
    });
    const pin = (l: number, lim: number) => ({ loadMa: f(l, 'ev:l'), limitMa: f(lim, 'ev:m') });
    expect(ev('R4', { pin: pin(6.4, 8) })).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:l",
          "ev:m",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R4",
        "trace": [
          "pin load 6.4 mA <= limit 8 mA",
        ],
        "values": {
          "pinLoadMa": 6.4,
        },
      }
    `);
    expect(ev('R4', { pin: pin(13.6, 8) })).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:l",
          "ev:m",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "series-resistor",
            "note": "raise series resistance to cut the current",
          },
          {
            "kind": "driver-transistor",
            "note": "drive the load from a transistor / MOSFET instead",
          },
        ],
        "rule": "R4",
        "trace": [
          "pin load 13.6 mA > limit 8 mA",
        ],
        "values": {
          "pinLoadMa": 13.6,
        },
      }
    `);
    expect(ev('R4', { pin: pin(5, 8), groups: [g('bank', [5, 6], f(10, 'ev:g'))] }))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:bank",
          "ev:g",
          "ev:l",
          "ev:m",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "series-resistor",
            "note": "raise series resistance to cut the current",
          },
          {
            "kind": "driver-transistor",
            "note": "drive the load from a transistor / MOSFET instead",
          },
        ],
        "rule": "R4",
        "trace": [
          "pin load 5 mA <= limit 8 mA",
          "bank total 11 mA > limit 10 mA",
        ],
        "values": {
          "bank.totalMa": 11,
          "pinLoadMa": 5,
        },
      }
    `);
    expect(ev('R4', { pin: pin(5, 8), groups: [g('bank', [5, 5], f(10, 'ev:g'))] }))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:bank",
          "ev:g",
          "ev:l",
          "ev:m",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R4",
        "trace": [
          "pin load 5 mA <= limit 8 mA",
          "bank total 10 mA <= limit 10 mA",
        ],
        "values": {
          "bank.totalMa": 10,
          "pinLoadMa": 5,
        },
      }
    `);
    expect(
      ev('R4', {
        pin: pin(5, 8),
        groups: [g('a', [1], f(5, 'ev:a')), g('b', [4, 4], f(7, 'ev:b'))],
      }),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:a",
          "ev:b",
          "ev:l",
          "ev:m",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "series-resistor",
            "note": "raise series resistance to cut the current",
          },
          {
            "kind": "driver-transistor",
            "note": "drive the load from a transistor / MOSFET instead",
          },
        ],
        "rule": "R4",
        "trace": [
          "pin load 5 mA <= limit 8 mA",
          "a total 1 mA <= limit 5 mA",
          "b total 8 mA > limit 7 mA",
        ],
        "values": {
          "a.totalMa": 1,
          "b.totalMa": 8,
          "pinLoadMa": 5,
        },
      }
    `);
  });
  it('unknown inputs are named', () => {
    const g = { name: 'bank', loadsMa: [f(1), missingFact()], limitMa: f(10) };
    expect(gap(ev('R4', { pin: { loadMa: missingFact(), limitMa: f(8) } }))).toBe(
      'unknown input(s): pin load (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R4', { pin: { loadMa: f(1), limitMa: missingFact() } }))).toBe(
      'unknown input(s): pin limit (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R4', { pin: { loadMa: f(1), limitMa: f(8) }, groups: [g] }))).toBe(
      'unknown input(s): bank load #2 (missing) -> cannot verify, caution',
    );
    expect(
      gap(
        ev('R4', {
          pin: { loadMa: f(1), limitMa: f(8) },
          groups: [{ ...g, loadsMa: [f(1)], limitMa: missingFact() }],
        }),
      ),
    ).toBe('unknown input(s): bank limit (missing) -> cannot verify, caution');
    expect(ev('R4', { pin: { loadMa: missingFact(), limitMa: f(8) } }).values).toEqual({});
  });
});

describe('R5 traces', () => {
  const ctx = (o: Record<string, unknown> = {}) => ({
    vinNomV: f(5, 'ev:vin'),
    r1Ohm: f(2200, 'ev:r1'),
    r2Ohm: f(3300, 'ev:r2'),
    receiverVddV: f(3.3, 'ev:vdd'),
    receiverVihMinV: f(2.475, 'ev:vih'),
    ...o,
  });
  it('pass, upper fail, lower fail, abs max, tolerance', () => {
    expect(ev('R5', ctx())).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 3.15 V within VDD 3.3 V",
          "Vout(-5%) = 2.85 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6,
          "voutHighV": 3.15,
          "voutLowV": 2.85,
        },
      }
    `);
    expect(ev('R5', ctx({ r1Ohm: f(1000, 'ev:r1'), r2Ohm: f(2000, 'ev:r2') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "divider",
            "note": "choose R1/R2 so 0.521053 <= R2/(R1+R2) <= 0.628571",
          },
        ],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 3.5 V above VDD 3.3 V",
          "Vout(-5%) = 3.166667 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6666666666666666,
          "voutHighV": 3.5,
          "voutLowV": 3.1666666666666665,
        },
      }
    `);
    expect(ev('R5', ctx({ r1Ohm: f(3000, 'ev:r1'), r2Ohm: f(2000, 'ev:r2') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "divider",
            "note": "choose R1/R2 so 0.521053 <= R2/(R1+R2) <= 0.628571",
          },
        ],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 2.1 V within VDD 3.3 V",
          "Vout(-5%) = 1.9 V < VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.4,
          "voutHighV": 2.1,
          "voutLowV": 1.9000000000000001,
        },
      }
    `);
    expect(ev('R5', ctx({ receiverAbsMaxV: f(3.6, 'ev:abs') }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:abs",
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 3.15 V within VDD 3.3 V / abs max 3.6 V",
          "Vout(-5%) = 2.85 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6,
          "voutHighV": 3.15,
          "voutLowV": 2.85,
        },
      }
    `);
    expect(ev('R5', ctx({ receiverAbsMaxV: f(3.0, 'ev:abs') }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:abs",
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "divider",
            "note": "choose R1/R2 so 0.521053 <= R2/(R1+R2) <= 0.571429",
          },
        ],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 3.15 V above VDD 3.3 V / abs max 3 V",
          "Vout(-5%) = 2.85 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6,
          "voutHighV": 3.15,
          "voutLowV": 2.85,
        },
      }
    `);
    expect(
      ev(
        'R5',
        ctx({
          receiverVddV: f(3.6, 'ev:vdd'),
          receiverAbsMaxV: f(3.0, 'ev:abs'),
          r1Ohm: f(1000),
          r2Ohm: f(2000),
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:abs",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
          "ev:x",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "divider",
            "note": "choose R1/R2 so 0.521053 <= R2/(R1+R2) <= 0.571429",
          },
        ],
        "rule": "R5",
        "trace": [
          "Vout(+5%) = 3.5 V above VDD 3.6 V / abs max 3 V",
          "Vout(-5%) = 3.166667 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6666666666666666,
          "voutHighV": 3.5,
          "voutLowV": 3.1666666666666665,
        },
      }
    `);
    expect(ev('R5', ctx({ tolerance: 0.1 }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:r1",
          "ev:r2",
          "ev:vdd",
          "ev:vih",
          "ev:vin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R5",
        "trace": [
          "Vout(+10%) = 3.3 V within VDD 3.3 V",
          "Vout(-10%) = 2.7 V >= VIH,min 2.475 V",
        ],
        "values": {
          "ratio": 0.6,
          "voutHighV": 3.3,
          "voutLowV": 2.6999999999999997,
        },
      }
    `);
  });
  it('each unknown input gives its own caution', () => {
    const names: [string, string][] = [
      ['vinNomV', 'Vin'],
      ['r1Ohm', 'R1'],
      ['r2Ohm', 'R2'],
      ['receiverVddV', 'receiver VDD'],
      ['receiverVihMinV', 'receiver VIH,min'],
      ['receiverAbsMaxV', 'receiver abs max'],
    ];
    for (const [key, label] of names) {
      const r = ev('R5', ctx({ [key]: missingFact() }));
      expect(gap(r)).toBe(`unknown input(s): ${label} (missing) -> cannot verify, caution`);
      expect(r.level).toBe('caution');
      expect(r.values).toEqual({});
    }
  });
});

describe('R6 traces', () => {
  const ctx = (o: Record<string, unknown>) => ({
    requiredLevel: 'low' as const,
    defaultLevel: 'high' as const,
    restingLevel: 'low' as const,
    effect: 'boot-mode' as const,
    evidence: ['ev:s'],
    ...o,
  });
  it('every resting level against both requirements', () => {
    expect(ev('R6', ctx({ requiredLevel: 'any' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "strap accepts any level at reset",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'unknown' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "caution",
        "passed": false,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "unknown input(s): resting level at reset (missing) -> cannot verify, caution",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'low' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset low, strap requires low",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'driven-low' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset low, strap requires low",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'driven-high' }))).toMatchInlineSnapshot(`
      {
        "blocked": true,
        "evidence": [
          "ev:s",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "wrong level changes boot-mode: use another pin",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high, strap requires low",
          "BLOCKED: changes boot-mode",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'high' }))).toMatchInlineSnapshot(`
      {
        "blocked": true,
        "evidence": [
          "ev:s",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "wrong level changes boot-mode: use another pin",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high, strap requires low",
          "BLOCKED: changes boot-mode",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'float', defaultLevel: 'low' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset low (floating: strap default), strap requires low",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'float', defaultLevel: 'high' }))).toMatchInlineSnapshot(`
      {
        "blocked": true,
        "evidence": [
          "ev:s",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "wrong level changes boot-mode: use another pin",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high (floating: strap default), strap requires low",
          "BLOCKED: changes boot-mode",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ requiredLevel: 'high', restingLevel: 'high' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high, strap requires high",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ requiredLevel: 'high', restingLevel: 'driven-low' })))
      .toMatchInlineSnapshot(`
      {
        "blocked": true,
        "evidence": [
          "ev:s",
        ],
        "level": "critical",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "wrong level changes boot-mode: use another pin",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset low, strap requires high",
          "BLOCKED: changes boot-mode",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ effect: 'flash-voltage' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset low, strap requires low",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ restingLevel: 'high', effect: 'other' }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:s",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "move the pin or remove the pull that opposes the strap",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high, strap requires low",
          "warning: strap level mismatch",
        ],
        "values": {},
      }
    `);
    expect(ev('R6', ctx({ evidence: undefined, restingLevel: 'high', effect: 'other' })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "move the pin or remove the pull that opposes the strap",
          },
        ],
        "riskTierDelta": 1,
        "rule": "R6",
        "trace": [
          "resting level at reset high, strap requires low",
          "warning: strap level mismatch",
        ],
        "values": {},
      }
    `);
  });
});

describe('R7 traces', () => {
  const rail = (name: string, loads: number[], reg: Fact) => ({
    name,
    loadsMa: loads.map((l) => f(l, `ev:${name}`)),
    regulatorMa: reg,
  });
  it('pass, rail over, usb over, both', () => {
    expect(ev('R7', { rails: [rail('3V3', [100, 50], f(600, 'ev:r'))] })).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:3V3",
          "ev:r",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R7",
        "trace": [
          "3V3 total 150 mA <= regulator 600 mA",
        ],
        "values": {
          "3V3.totalMa": 150,
          "totalMa": 150,
        },
      }
    `);
    expect(ev('R7', { rails: [rail('3V3', [400, 300], f(600, 'ev:r'))] })).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:3V3",
          "ev:r",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "separate-supply",
            "note": "power the heavy loads from a separate supply",
          },
        ],
        "rule": "R7",
        "trace": [
          "3V3 total 700 mA > regulator 600 mA",
        ],
        "values": {
          "3V3.totalMa": 700,
          "totalMa": 700,
        },
      }
    `);
    expect(
      ev('R7', {
        rails: [rail('3V3', [100], f(600, 'ev:r')), rail('5V', [300], f(1000, 'ev:q'))],
        usbLimitMa: f(500, 'ev:u'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:3V3",
          "ev:5V",
          "ev:q",
          "ev:r",
          "ev:u",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R7",
        "trace": [
          "3V3 total 100 mA <= regulator 600 mA",
          "5V total 300 mA <= regulator 1000 mA",
          "sum 400 mA <= USB limit 500 mA",
        ],
        "values": {
          "3V3.totalMa": 100,
          "5V.totalMa": 300,
          "totalMa": 400,
        },
      }
    `);
    expect(
      ev('R7', {
        rails: [rail('3V3', [100], f(600, 'ev:r')), rail('5V', [300], f(1000, 'ev:q'))],
        usbLimitMa: f(400, 'ev:u'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:3V3",
          "ev:5V",
          "ev:q",
          "ev:r",
          "ev:u",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R7",
        "trace": [
          "3V3 total 100 mA <= regulator 600 mA",
          "5V total 300 mA <= regulator 1000 mA",
          "sum 400 mA <= USB limit 400 mA",
        ],
        "values": {
          "3V3.totalMa": 100,
          "5V.totalMa": 300,
          "totalMa": 400,
        },
      }
    `);
    expect(ev('R7', { rails: [rail('3V3', [700], f(600, 'ev:r'))], usbLimitMa: f(500, 'ev:u') }))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:3V3",
          "ev:r",
          "ev:u",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "separate-supply",
            "note": "power the heavy loads from a separate supply",
          },
        ],
        "rule": "R7",
        "trace": [
          "3V3 total 700 mA > regulator 600 mA",
          "sum 700 mA > USB limit 500 mA",
        ],
        "values": {
          "3V3.totalMa": 700,
          "totalMa": 700,
        },
      }
    `);
  });
  it('unknown inputs are named', () => {
    expect(
      gap(
        ev('R7', { rails: [{ name: '3V3', loadsMa: [f(1), missingFact()], regulatorMa: f(600) }] }),
      ),
    ).toBe('unknown input(s): 3V3 load #2 (missing) -> cannot verify, caution');
    expect(gap(ev('R7', { rails: [rail('5V', [1], missingFact())] }))).toBe(
      'unknown input(s): 5V regulator rating (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R7', { rails: [rail('5V', [1], f(600))], usbLimitMa: missingFact() }))).toBe(
      'unknown input(s): USB limit (missing) -> cannot verify, caution',
    );
  });
});

describe('R8 traces', () => {
  const ctx = (o: Record<string, unknown> = {}) => ({
    sensorMaxV: f(3.3, 'ev:smax'),
    adcMinEffV: f(0.15, 'ev:amin'),
    adcMaxEffV: f(3.1, 'ev:amax'),
    radioActive: false,
    unitRadioCompatible: undefined,
    ...o,
  });
  it('fit, no fit, divider, dead zone, radio', () => {
    expect(ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax') }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(ev('R8', ctx({ sensorMaxV: f(5, 'ev:smax') }))).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "divider",
            "note": "divider ratio must be <= 0.62",
          },
        ],
        "rule": "R8",
        "trace": [
          "sensor 5 V * ratio 1 = 5 V > ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 5,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 0.62,
        },
      }
    `);
    expect(
      ev(
        'R8',
        ctx({
          sensorMaxV: f(5, 'ev:smax'),
          divider: { r1Ohm: f(10_000, 'ev:r1'), r2Ohm: f(9100, 'ev:r2') },
        }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:r1",
          "ev:r2",
          "ev:smax",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 5 V * ratio 0.47644 = 2.382199 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 0.47644 = 0.314835 V",
        ],
        "values": {
          "adcMaxInV": 2.3821989528795813,
          "deadZoneV": 0.3148351648351648,
          "ratio": 0.47643979057591623,
          "ratioMax": 0.62,
        },
      }
    `);
    expect(ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax'), sensorMinV: f(0.1, 'ev:smin') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
          "ev:smin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
          "sensor minimum 0.1 V is below the dead zone 0.15 V and cannot be resolved",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax'), sensorMinV: f(0.15, 'ev:smin') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
          "ev:smin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax'), sensorMinV: f(0.5, 'ev:smin') })))
      .toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
          "ev:smin",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(
      ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax'), radioActive: true, unitRadioCompatible: false })),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
        ],
        "level": "warning",
        "passed": false,
        "requiredParts": [
          {
            "kind": "move-pin",
            "note": "use an ADC unit compatible with the radio",
          },
        ],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
          "selected ADC unit is not usable while the radio is active",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(
      ev('R8', ctx({ sensorMaxV: f(3, 'ev:smax'), radioActive: true, unitRadioCompatible: true })),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
    expect(
      ev(
        'R8',
        ctx({ sensorMaxV: f(3, 'ev:smax'), radioActive: false, unitRadioCompatible: false }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "evidence": [
          "ev:amax",
          "ev:amin",
          "ev:smax",
        ],
        "level": "info",
        "passed": true,
        "requiredParts": [],
        "rule": "R8",
        "trace": [
          "sensor 3 V * ratio 1 = 3 V <= ADC max 3.1 V",
          "dead zone (sensor side) = 0.15 V / 1 = 0.15 V",
        ],
        "values": {
          "adcMaxInV": 3,
          "deadZoneV": 0.15,
          "ratio": 1,
          "ratioMax": 1.0333333333333334,
        },
      }
    `);
  });
  it('unknown inputs are named', () => {
    const d = { r1Ohm: f(10_000), r2Ohm: f(9100) };
    expect(gap(ev('R8', ctx({ sensorMaxV: missingFact() })))).toBe(
      'unknown input(s): sensor max (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ sensorMinV: missingFact() })))).toBe(
      'unknown input(s): sensor min (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ adcMinEffV: missingFact() })))).toBe(
      'unknown input(s): ADC effective min (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ adcMaxEffV: missingFact() })))).toBe(
      'unknown input(s): ADC effective max (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ divider: { ...d, r1Ohm: missingFact() } })))).toBe(
      'unknown input(s): divider R1 (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ divider: { ...d, r2Ohm: missingFact() } })))).toBe(
      'unknown input(s): divider R2 (missing) -> cannot verify, caution',
    );
    expect(gap(ev('R8', ctx({ radioActive: true })))).toBe(
      'unknown input(s): ADC unit radio compatibility (missing) -> cannot verify, caution',
    );
    expect(ev('R8', ctx({ sensorMaxV: f(3), radioActive: false })).level).toBe('info');
    expect(ev('R8', ctx({ sensorMaxV: f(3), sensorMinV: missingFact() })).level).toBe('caution');
    expect(ev('R8', ctx({ divider: { ...d, r1Ohm: missingFact() } })).values).toEqual({});
  });
});
