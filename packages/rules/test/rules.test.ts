import { describe, expect, it } from 'vitest';
import {
  RULE_IDS,
  WARNING_LEVELS,
  fact,
  missingFact,
  parallelOhm,
  ratioToVolts,
  rpMaxOhm,
  rpMinOhm,
  runRules,
  type Fact,
} from '../src/index.js';
import { ev } from './helpers.js';

const f = (v: number, id = 'ev:x'): Fact => fact(v, [id]);
const near = (a: number | undefined, b: number, d = 3): void => {
  expect(a).toBeCloseTo(b, d);
};

/** I2C context: 3.3 V, VOL 0.4 V @ 3 mA (test inputs, as facts). */
const i2c = (pull: number[], hz: number, cb: number, extra = {}) => ({
  pullUpsOhm: pull.map((p) => f(p, 'ev:pu')),
  vddV: f(3.3, 'ev:vdd'),
  volMaxV: f(0.4, 'ev:vol'),
  iolMa: f(3, 'ev:iol'),
  speedHz: hz,
  cbPf: f(cb, 'ev:cb'),
  ...extra,
});

describe('exports', () => {
  it('has the 4 warning levels and 8 rules', () => {
    expect(WARNING_LEVELS).toEqual(['critical', 'warning', 'caution', 'info']);
    expect(RULE_IDS).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
  });
});

describe('R1 absolute max', () => {
  const fixed = (drv: number, max: number) => ({
    driverMaxV: f(drv, 'ev:d'),
    receiverAbsMax: { kind: 'fixed' as const, volts: f(max, 'ev:a') },
  });
  it('passes at the inclusive boundary', () => {
    const r = ev('R1', fixed(3.6, 3.6));
    expect(r.level).toBe('info');
    expect(r.passed).toBe(true);
    expect(r.evidence).toEqual(['ev:a', 'ev:d']);
  });
  it('is critical just above, with level shifter / divider', () => {
    const r = ev('R1', fixed(5.0, 3.6));
    expect(r.level).toBe('critical');
    expect(r.passed).toBe(false);
    expect(r.requiredParts.map((p) => p.kind)).toEqual(['level-shifter', 'divider']);
    expect(ev('R1', fixed(3.6001, 3.6)).level).toBe('critical');
  });
  it('supports VDDIO+0.3 expressions (inclusive)', () => {
    const ctx = (drv: number) => ({
      driverMaxV: f(drv),
      receiverAbsMax: { kind: 'vddio-plus' as const, vddio: f(3.3), offsetV: f(0.3) },
    });
    expect(ev('R1', ctx(3.6)).passed).toBe(true);
    expect(ev('R1', ctx(3.7)).level).toBe('critical');
  });
  it('unknown value is caution, never a pass', () => {
    const r = ev('R1', { ...fixed(3.3, 3.6), driverMaxV: missingFact(['ev:d']) });
    expect(r.level).toBe('caution');
    expect(r.passed).toBe(false);
    const c = ev('R1', {
      ...fixed(3.3, 3.6),
      driverMaxV: { value: 3.3, status: 'conflict', evidence: [] },
    });
    expect(c.level).toBe('caution');
  });
});

describe('R2 logic thresholds', () => {
  const ctx = (voh: number, vol: number, vih: number, vil: number) => ({
    driverVohMinV: f(voh),
    driverVolMaxV: f(vol),
    receiverVihMinV: f(vih),
    receiverVilMaxV: f(vil),
  });
  it('inclusive boundaries pass', () => {
    expect(ev('R2', ctx(2.0, 0.8, 2.0, 0.8)).passed).toBe(true);
  });
  it('T10 ESP32 -> ATmega328P: 2.64 V < 3.0 V fails with buffer', () => {
    const r = ev('R2', ctx(ratioToVolts(0.8, f(3.3)).value ?? Number.NaN, 0.33, 3.0, 1.5));
    expect(r.level).toBe('critical');
    expect(r.requiredParts[0]?.kind).toBe('buffer');
  });
  it('T11 Raspberry Pi 4 -> 5 V AVR: 2.9 V < 3.0 V fails', () => {
    expect(ev('R2', ctx(3.3 - 0.4, 0.4, 3.0, 1.5)).level).toBe('critical');
  });
  it('VOL above VIL,max fails even if VOH is fine', () => {
    expect(ev('R2', ctx(3.0, 0.9, 2.0, 0.8)).level).toBe('critical');
  });
  it('missing receiver threshold is caution', () => {
    const r = ev('R2', { ...ctx(3, 0.4, 2, 0.8), receiverVihMinV: missingFact() });
    expect(r.level).toBe('caution');
    expect(r.passed).toBe(false);
  });
  it('ratioToVolts is missing when VDD is missing', () => {
    expect(ratioToVolts(0.8, missingFact()).status).toBe('missing');
    near(ratioToVolts(0.75, f(3.3)).value ?? Number.NaN, 2.475);
  });
});

describe('R3 I2C pull-ups', () => {
  it('T1 Rp,min @3.3 V = 966.7 ohm', () => {
    near(rpMinOhm(3.3, 0.4, 3), 966.667, 2);
  });
  it('T2 Rp,max 400 kHz Cb 50 pF = 7.08 k; 10 k FAILS', () => {
    near(rpMaxOhm(300, 50), 7080.9, 0);
    const r = ev('R3', i2c([10000], 400_000, 50));
    expect(r.level).toBe('warning');
    expect(r.passed).toBe(false);
    near(r.values.rpMaxOhm, 7080.9, 0);
  });
  it('T3 Rp,max 100 kHz Cb 50 pF = 23.6 k; 10 k PASSES', () => {
    near(rpMaxOhm(1000, 50), 23603, -1);
    expect(ev('R3', i2c([10000], 100_000, 50)).passed).toBe(true);
  });
  it('T4 400 kHz Cb 100 pF = 3.54 k; 4.7 k FAILS', () => {
    near(rpMaxOhm(300, 100), 3540.5, 0);
    expect(ev('R3', i2c([4700], 400_000, 100)).level).toBe('warning');
  });
  it('T5 5 x 4.7 k = 940 ohm < 966.7 FAILS Rp,min', () => {
    near(parallelOhm([4700, 4700, 4700, 4700, 4700]), 940, 6);
    const r = ev('R3', i2c([4700, 4700, 4700, 4700, 4700], 100_000, 50));
    expect(r.level).toBe('warning');
    near(r.values.rpEffOhm, 940, 6);
    expect(r.requiredParts.some((p) => p.kind === 'remove-pull-up')).toBe(true);
  });
  it('T6 10 k || 4.7 k = 3.20 k passes at 400 kHz Cb 50 pF', () => {
    near(parallelOhm([10000, 4700]), 3197.3, 1);
    expect(ev('R3', i2c([10000, 4700], 400_000, 50)).passed).toBe(true);
  });
  it('2000 ohm passes; Rp,min boundary inclusive', () => {
    expect(ev('R3', i2c([2000], 100_000, 50)).passed).toBe(true);
    const min = rpMinOhm(3.3, 0.4, 3);
    expect(ev('R3', i2c([min], 100_000, 50)).passed).toBe(true);
    expect(ev('R3', i2c([min - 0.01], 100_000, 50)).passed).toBe(false);
  });
  it('Rp,max boundary inclusive', () => {
    const max = rpMaxOhm(300, 50);
    expect(ev('R3', i2c([max], 400_000, 50)).passed).toBe(true);
    expect(ev('R3', i2c([max + 1], 400_000, 50)).passed).toBe(false);
  });
  it('suggests a parallel resistor and slower speed when too weak', () => {
    const r = ev('R3', i2c([10000], 400_000, 50));
    const add = r.requiredParts.find((p) => p.kind === 'pull-up');
    const v = add?.valueOhms ?? Number.NaN;
    expect(v).toBeGreaterThan(0);
    near(parallelOhm([10000, v]), 7080.9, 0);
    expect(r.requiredParts.find((p) => p.kind === 'lower-speed')?.hz).toBe(100_000);
  });
  it('no pull-up at all is a warning (floating bus)', () => {
    const r = ev('R3', i2c([], 100_000, 50));
    expect(r.level).toBe('warning');
    expect(r.requiredParts[0]?.kind).toBe('pull-up');
  });
  it('Cb above spec limit warns (inclusive)', () => {
    const r = ev('R3', i2c([2000], 100_000, 500, { cbMaxPf: f(400) }));
    expect(r.level).toBe('warning');
    expect(ev('R3', i2c([2000], 100_000, 400, { cbMaxPf: f(400) })).passed).toBe(true);
  });
  it('unknown pull-up, Cb or electrical limits give caution; no invented numbers', () => {
    const c1 = ev('R3', { ...i2c([10000], 100_000, 50), cbPf: missingFact() });
    expect(c1.level).toBe('caution');
    expect(c1.values.rpMaxOhm).toBeUndefined();
    const c2 = ev('R3', { ...i2c([10000], 100_000, 50), pullUpsOhm: [missingFact()] });
    expect(c2.level).toBe('caution');
    expect(ev('R3', { ...i2c([10000], 100_000, 50), iolMa: missingFact() }).level).toBe('caution');
  });
  it('unsupported speed (> 1 MHz) is caution', () => {
    expect(ev('R3', i2c([2000], 3_400_000, 50)).level).toBe('caution');
  });
});

describe('R4 current', () => {
  const pin = (load: number, limit: number) => ({ pin: { loadMa: f(load), limitMa: f(limit) } });
  it('T9 Uno R4 LED 220 ohm Vf 2.0 -> 13.6 mA > 8 mA critical; 470 ohm 6.4 mA passes', () => {
    const r = ev('R4', pin(((5 - 2.0) / 220) * 1000, 8));
    expect(r.level).toBe('critical');
    expect(r.requiredParts.map((p) => p.kind)).toEqual(['series-resistor', 'driver-transistor']);
    expect(ev('R4', pin(((5 - 2.0) / 470) * 1000, 8)).passed).toBe(true);
  });
  it('limit inclusive', () => {
    expect(ev('R4', pin(8, 8)).passed).toBe(true);
    expect(ev('R4', pin(8.001, 8)).level).toBe('critical');
  });
  it('group sums are inclusive and critical when exceeded', () => {
    const g = (loads: number[], lim: number) => ({
      ...pin(1, 8),
      groups: [{ name: 'port', loadsMa: loads.map((l) => f(l)), limitMa: f(lim) }],
    });
    expect(ev('R4', g([10, 10], 20)).passed).toBe(true);
    expect(ev('R4', g([10, 10.5], 20)).level).toBe('critical');
  });
  it('missing values give caution', () => {
    expect(ev('R4', { pin: { loadMa: missingFact(), limitMa: f(8) } }).level).toBe('caution');
    expect(ev('R4', { pin: { loadMa: f(1), limitMa: missingFact() } }).passed).toBe(false);
    const gm = ev('R4', {
      ...pin(1, 8),
      groups: [{ name: 'p', loadsMa: [missingFact()], limitMa: f(20) }],
    });
    expect(gm.level).toBe('caution');
  });
});

describe('R5 divider', () => {
  const div = (r1: number, r2: number, extra = {}) => ({
    vinNomV: f(5),
    r1Ohm: f(r1),
    r2Ohm: f(r2),
    receiverVddV: f(3.3),
    receiverVihMinV: f(0.75 * 3.3),
    ...extra,
  });
  it('T7 HC-SR04 1k/2k: 3.50 V > 3.3 V REJECT', () => {
    const r = ev('R5', div(1000, 2000));
    expect(r.level).toBe('critical');
    near(r.values.voutHighV, 3.5, 6);
    expect(r.requiredParts[0]?.kind).toBe('divider');
  });
  it('T8 HC-SR04 2.2k/3.3k: 3.15 V / 2.85 V >= 2.475 ACCEPT', () => {
    const r = ev('R5', div(2200, 3300));
    expect(r.passed).toBe(true);
    near(r.values.voutHighV, 3.15, 6);
    near(r.values.voutLowV, 2.85, 6);
  });
  it('upper limit inclusive: Vout(+5%) == VDD passes', () => {
    const r2 = 10000 * (3.3 / 5.25);
    expect(ev('R5', div(10000 - r2, r2)).passed).toBe(true);
  });
  it('lower limit inclusive and failing below', () => {
    const vih = 4.75 * 0.6;
    expect(ev('R5', div(4000, 6000, { receiverVihMinV: f(vih) })).passed).toBe(true);
    expect(ev('R5', div(4000, 6000, { receiverVihMinV: f(vih + 0.01) })).level).toBe('critical');
  });
  it('abs max is also enforced', () => {
    expect(ev('R5', div(2200, 3300, { receiverAbsMaxV: f(3.0) })).level).toBe('critical');
  });
  it('custom tolerance is honoured', () => {
    near(ev('R5', div(2200, 3300, { tolerance: 0.1 })).values.voutHighV, 3.3, 6);
  });
  it('missing input is caution', () => {
    expect(ev('R5', { ...div(2200, 3300), r1Ohm: missingFact() }).level).toBe('caution');
    expect(ev('R5', { ...div(2200, 3300), receiverVihMinV: missingFact() }).passed).toBe(false);
  });
});

describe('R6 strap at reset', () => {
  const s = (over = {}) => ({
    requiredLevel: 'low' as 'low' | 'high' | 'any',
    defaultLevel: 'low' as 'low' | 'high',
    restingLevel: 'float' as 'high' | 'low' | 'float' | 'driven-high' | 'driven-low' | 'unknown',
    effect: 'flash-voltage' as 'boot-mode' | 'flash-voltage' | 'other',
    evidence: ['ev:strap'],
    ...over,
  });
  it('T17 GPIO12 with 10k pull-up (resting high, requires low) is BLOCKED', () => {
    const r = ev('R6', s({ restingLevel: 'high' }));
    expect(r.level).toBe('critical');
    expect(r.blocked).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.requiredParts[0]?.kind).toBe('move-pin');
    expect(r.evidence).toEqual(['ev:strap']);
  });
  it('mismatch that does not change boot mode / flash voltage is only a warning', () => {
    const r = ev('R6', s({ restingLevel: 'high', effect: 'other' }));
    expect(r.level).toBe('warning');
    expect(r.blocked).toBeFalsy();
  });
  it('boot-mode change is blocked', () => {
    expect(ev('R6', s({ restingLevel: 'driven-high', effect: 'boot-mode' })).blocked).toBe(true);
  });
  it('T18 SPI CS idle high on strap default high passes with risk tier +1', () => {
    const r = ev(
      'R6',
      s({
        requiredLevel: 'high',
        defaultLevel: 'high',
        restingLevel: 'driven-high',
        effect: 'boot-mode',
      }),
    );
    expect(r.passed).toBe(true);
    expect(r.riskTierDelta).toBe(1);
  });
  it('floating net takes the strap default', () => {
    expect(ev('R6', s({ restingLevel: 'float', defaultLevel: 'low' })).passed).toBe(true);
    expect(ev('R6', s({ restingLevel: 'float', defaultLevel: 'high' })).blocked).toBe(true);
  });
  it('requiredLevel any always passes', () => {
    expect(ev('R6', s({ requiredLevel: 'any', restingLevel: 'high' })).passed).toBe(true);
  });
  it('unknown resting level is caution, not pass', () => {
    const r = ev('R6', s({ restingLevel: 'unknown' }));
    expect(r.level).toBe('caution');
    expect(r.passed).toBe(false);
  });
});

describe('R7 power budget', () => {
  const rail = (loads: number[], reg: number, usb?: number) => ({
    rails: [{ name: '5V', loadsMa: loads.map((l) => f(l)), regulatorMa: f(reg) }],
    ...(usb === undefined ? {} : { usbLimitMa: f(usb) }),
  });
  it('T12 4 x 89.3 mA = 357.2 mA (0.36 W variant 4 x 71.4 = 285.6)', () => {
    const r = ev('R7', rail([89.3, 89.3, 89.3, 89.3], 1000, 500));
    near(r.values['5V.totalMa'], 357.2, 6);
    expect(r.passed).toBe(true);
    near(ev('R7', rail([71.4, 71.4, 71.4, 71.4], 1000)).values['5V.totalMa'], 285.6, 6);
  });
  it('T14 MFRC522 119 mA sums 100 + 9 + 10', () => {
    near(ev('R7', rail([100, 9, 10], 500)).values['5V.totalMa'], 119, 9);
  });
  it('regulator and USB limits inclusive; warning above', () => {
    expect(ev('R7', rail([250, 250], 500, 500)).passed).toBe(true);
    const r = ev('R7', rail([250, 250.5], 600, 500));
    expect(r.level).toBe('warning');
    expect(r.requiredParts[0]?.kind).toBe('separate-supply');
    expect(ev('R7', rail([300], 299)).level).toBe('warning');
  });
  it('missing load or limit is caution', () => {
    const m = [{ name: 'r', loadsMa: [missingFact()], regulatorMa: f(500) }];
    expect(ev('R7', { rails: m }).level).toBe('caution');
    const n = [{ name: 'r', loadsMa: [f(1)], regulatorMa: missingFact() }];
    expect(ev('R7', { rails: n }).passed).toBe(false);
    expect(ev('R7', { ...rail([1], 500), usbLimitMa: missingFact() }).level).toBe('caution');
  });
});

describe('R8 ADC fit', () => {
  const adc = (over = {}) => ({
    sensorMaxV: f(5),
    adcMinEffV: f(0.15),
    adcMaxEffV: f(2.45),
    divider: { r1Ohm: f(10000), r2Ohm: f(9100) } as { r1Ohm: Fact; r2Ohm: Fact } | undefined,
    radioActive: true,
    unitRadioCompatible: true as boolean | undefined,
    ...over,
  });
  it('T16 0-5 V on ADC1 with 10k/9.1k: ratio 0.4764, 2.38 V, dead zone 0.315 V', () => {
    const r = ev('R8', adc());
    expect(r.passed).toBe(true);
    near(r.values.ratio, 0.4764, 4);
    near(r.values.adcMaxInV, 2.382, 3);
    near(r.values.deadZoneV, 0.315, 3);
    expect(r.trace.join(' ')).toMatch(/dead zone/);
  });
  it('without a divider 5 V exceeds the ADC range and warns with divider values', () => {
    const r = ev('R8', adc({ divider: undefined }));
    expect(r.level).toBe('warning');
    expect(r.requiredParts.find((x) => x.kind === 'divider')).toBeDefined();
  });
  it('max range boundary inclusive', () => {
    const r2 = 10000 * (2.45 / 5);
    expect(ev('R8', adc({ divider: { r1Ohm: f(10000 - r2), r2Ohm: f(r2) } })).passed).toBe(true);
  });
  it('ADC2-like unit while radio active warns', () => {
    expect(ev('R8', adc({ unitRadioCompatible: false })).level).toBe('warning');
    expect(ev('R8', adc({ unitRadioCompatible: false, radioActive: false })).passed).toBe(true);
  });
  it('unknown radio compatibility is caution', () => {
    expect(ev('R8', adc({ unitRadioCompatible: undefined })).level).toBe('caution');
  });
  it('sensor minimum inside the dead zone is noted, still passes', () => {
    const r = ev('R8', adc({ sensorMinV: f(0.1) }));
    expect(r.passed).toBe(true);
    expect(r.trace.join(' ')).toMatch(/below the dead zone/);
  });
  it('missing ADC limit is caution', () => {
    const r = ev('R8', adc({ adcMaxEffV: missingFact() }));
    expect(r.level).toBe('caution');
    expect(r.values.adcMaxInV).toBeUndefined();
  });
});

describe('runRules and disable support', () => {
  const bad = {
    driverMaxV: f(5),
    receiverAbsMax: { kind: 'fixed' as const, volts: f(3.6) },
  };
  it('runs only supplied contexts in rule-id order', () => {
    const res = runRules({ R1: bad });
    expect(res.map((r) => r.rule)).toEqual(['R1']);
    expect(res[0]?.level).toBe('critical');
  });
  it('disabled rules never fail', () => {
    const res = runRules({ R1: bad }, { disabled: ['R1'] });
    expect(res[0]?.passed).toBe(true);
    expect(res[0]?.trace[0]).toMatch(/disabled/);
    expect(runRules({ R1: bad }, { disabled: new Set(['R2' as const]) })[0]?.passed).toBe(false);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(runRules({ R1: bad }))).toBe(JSON.stringify(runRules({ R1: bad })));
  });
});
