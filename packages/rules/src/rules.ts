import type {
  R1Context,
  R2Context,
  R3Context,
  R4Context,
  R5Context,
  R6Context,
  R7Context,
  R8Context,
} from './contexts.js';
import type { Fact, RuleResult } from './types.js';
import { Run, fmt, ge, le, missingFact } from './util.js';

/* ---------- formula constants (not datasheet facts) ---------- */

/** I2C rise-time constant: tr = 0.8473 * Rp * Cb (NXP UM10204 rev 7 section 7.1; TI SLVA689). */
export const I2C_RISE_TIME_FACTOR = 0.8473;

/**
 * Max rise time by bus speed, ns (NXP UM10204 rev 7 Table 10: Sm 1000, Fm 300, Fm+ 120).
 * Sorted by ascending speed; a speed uses the first tier whose fMaxHz >= speed.
 */
export const I2C_TR_MAX_BY_SPEED: readonly { readonly fMaxHz: number; readonly trMaxNs: number }[] =
  [
    { fMaxHz: 100_000, trMaxNs: 1000 },
    { fMaxHz: 400_000, trMaxNs: 300 },
    { fMaxHz: 1_000_000, trMaxNs: 120 },
  ];

/** R5 tolerance on the 5 V source (skill electrical-rules: Vin +/-5 %). */
export const DIVIDER_VIN_TOLERANCE = 0.05;

/* ---------- pure helpers ---------- */

/** Rp,min = (VDD - VOL,max) / IOL. Volts, mA -> ohms. */
export function rpMinOhm(vddV: number, volMaxV: number, iolMa: number): number {
  return (vddV - volMaxV) / (iolMa / 1000);
}
/** Rp,max = tr,max / (0.8473 * Cb). ns, pF -> ohms. */
export function rpMaxOhm(trMaxNs: number, cbPf: number): number {
  return (trMaxNs * 1e-9) / (I2C_RISE_TIME_FACTOR * cbPf * 1e-12);
}
/** Parallel resistance; Infinity for an empty list. */
export function parallelOhm(r: readonly number[]): number {
  if (r.length === 0) return Number.POSITIVE_INFINITY;
  let g = 0;
  for (const x of r) g += 1 / x;
  return 1 / g;
}
/** Resolve a ratio-of-VDD datasheet level to volts; missing when VDD is unknown. */
export function ratioToVolts(ratio: number, vdd: Fact): Fact {
  const v = vdd.value;
  if ((vdd.status !== 'verified' && vdd.status !== 'inferred') || typeof v !== 'number') {
    return missingFact(vdd.evidence);
  }
  return { value: ratio * v, status: vdd.status, evidence: vdd.evidence };
}

const sum = (xs: readonly (number | undefined)[]): number =>
  xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/* ---------- R1 ---------- */

export function evalR1(c: R1Context): RuleResult {
  const run = new Run('R1');
  const drv = run.need('driverMaxV', c.driverMaxV);
  let abs: number | undefined;
  if (c.receiverAbsMax.kind === 'fixed') {
    abs = run.need('receiverAbsMax', c.receiverAbsMax.volts);
  } else {
    const vddio = run.need('receiver VDDIO', c.receiverAbsMax.vddio);
    const off = run.need('receiver abs-max offset', c.receiverAbsMax.offsetV);
    if (vddio !== undefined && off !== undefined) abs = vddio + off;
  }
  if (drv === undefined || abs === undefined) return run.caution();
  run.set('driverMaxV', drv);
  run.set('receiverAbsMaxV', abs);
  run.note(`driver max ${fmt(drv)} V vs receiver absolute max ${fmt(abs)} V (inclusive)`);
  if (le(drv, abs)) return run.pass();
  run.parts.push(
    { kind: 'level-shifter', note: 'level shifter to bring the net within receiver absolute max' },
    { kind: 'divider', note: 'resistor divider (see R5) for a one-way signal' },
  );
  return run.fail('critical');
}

/* ---------- R2 ---------- */

export function evalR2(c: R2Context): RuleResult {
  const run = new Run('R2');
  const voh = run.need('driver VOH,min', c.driverVohMinV);
  const vol = run.need('driver VOL,max', c.driverVolMaxV);
  const vih = run.need('receiver VIH,min', c.receiverVihMinV);
  const vil = run.need('receiver VIL,max', c.receiverVilMaxV);
  if (voh === undefined || vol === undefined || vih === undefined || vil === undefined) {
    return run.caution();
  }
  const highOk = ge(voh, vih);
  const lowOk = le(vol, vil);
  run.note(`VOH,min ${fmt(voh)} V ${highOk ? '>=' : '<'} VIH,min ${fmt(vih)} V`);
  run.note(`VOL,max ${fmt(vol)} V ${lowOk ? '<=' : '>'} VIL,max ${fmt(vil)} V`);
  if (highOk && lowOk) return run.pass();
  run.parts.push({
    kind: 'buffer',
    note: 'logic buffer with TTL-compatible input (74AHCT family) or a level shifter (74LVC family)',
  });
  return run.fail('critical');
}

/* ---------- R3 ---------- */

export function evalR3(c: R3Context): RuleResult {
  const run = new Run('R3');
  const pulls = c.pullUpsOhm.map((p, i) => run.need(`pull-up #${i + 1}`, p));
  const vdd = run.need('VDD', c.vddV);
  const vol = run.need('VOL,max', c.volMaxV);
  const iol = run.need('IOL', c.iolMa);
  const cb = run.need('Cb', c.cbPf);
  const cbMax = c.cbMaxPf === undefined ? undefined : run.need('Cb limit', c.cbMaxPf);
  const tierIdx = I2C_TR_MAX_BY_SPEED.findIndex((t) => c.speedHz <= t.fMaxHz);
  if (tierIdx < 0) {
    run.note(`speed ${c.speedHz} Hz is outside the modes with a known tr,max`);
    run.need('tr,max for this speed', missingFact());
  }
  if (
    run.incomplete ||
    vdd === undefined ||
    vol === undefined ||
    iol === undefined ||
    cb === undefined
  ) {
    return run.caution();
  }
  const tier = I2C_TR_MAX_BY_SPEED[tierIdx];
  if (tier === undefined) return run.caution();
  const rpMin = rpMinOhm(vdd, vol, iol);
  const rpMax = rpMaxOhm(tier.trMaxNs, cb);
  const eff = parallelOhm(pulls as number[]);
  run.set('rpMinOhm', rpMin);
  run.set('rpMaxOhm', rpMax);
  if (Number.isFinite(eff)) run.set('rpEffOhm', eff);
  run.note(`Rp,min = (${fmt(vdd)} - ${fmt(vol)}) / ${fmt(iol)} mA = ${fmt(rpMin)} ohm`);
  run.note(
    `Rp,max = ${tier.trMaxNs} ns / (${I2C_RISE_TIME_FACTOR} * ${fmt(cb)} pF) = ${fmt(rpMax)} ohm`,
  );
  run.note(`Rp,eff = ${Number.isFinite(eff) ? `${fmt(eff)} ohm` : 'none (no pull-up)'}`);

  let ok = true;
  if (cbMax !== undefined && !le(cb, cbMax)) {
    ok = false;
    run.note(`Cb ${fmt(cb)} pF exceeds the mode limit ${fmt(cbMax)} pF`);
    run.parts.push({ kind: 'lower-speed', hz: 100_000, note: 'reduce bus capacitance or speed' });
  }
  if (!ge(eff, rpMin)) {
    ok = false;
    run.note('Rp,eff below Rp,min: too many parallel pull-ups (sink current exceeds IOL)');
    run.parts.push({
      kind: 'remove-pull-up',
      minOhms: rpMin,
      maxOhms: rpMax,
      note: 'remove pull-ups (cut module pull-up jumpers) until Rp,eff is within range',
    });
  } else if (!le(eff, rpMax)) {
    ok = false;
    run.note('Rp,eff above Rp,max: rise time too slow');
    if (rpMax >= rpMin) {
      const add = Number.isFinite(eff) ? 1 / (1 / rpMax - 1 / eff) : rpMax;
      run.parts.push({
        kind: 'pull-up',
        valueOhms: add,
        minOhms: rpMin,
        maxOhms: rpMax,
        note: Number.isFinite(eff)
          ? 'add this pull-up in parallel so Rp,eff reaches Rp,max'
          : 'add a pull-up within [Rp,min, Rp,max]',
      });
    }
    for (let j = tierIdx - 1; j >= 0; j--) {
      const slower = I2C_TR_MAX_BY_SPEED[j];
      if (slower === undefined) break;
      if (le(eff, rpMaxOhm(slower.trMaxNs, cb))) {
        run.parts.push({ kind: 'lower-speed', hz: slower.fMaxHz, note: 'or lower the bus clock' });
        break;
      }
    }
  }
  return ok ? run.pass() : run.fail('warning');
}

/* ---------- R4 ---------- */

export function evalR4(c: R4Context): RuleResult {
  const run = new Run('R4');
  const load = run.need('pin load', c.pin.loadMa);
  const limit = run.need('pin limit', c.pin.limitMa);
  const groups = (c.groups ?? []).map((g) => ({
    name: g.name,
    loads: g.loadsMa.map((l, i) => run.need(`${g.name} load #${i + 1}`, l)),
    limit: run.need(`${g.name} limit`, g.limitMa),
  }));
  if (run.incomplete || load === undefined || limit === undefined) return run.caution();
  let ok = true;
  run.set('pinLoadMa', load);
  run.note(`pin load ${fmt(load)} mA ${le(load, limit) ? '<=' : '>'} limit ${fmt(limit)} mA`);
  if (!le(load, limit)) ok = false;
  for (const g of groups) {
    const total = sum(g.loads);
    const gl = g.limit ?? Number.NaN;
    run.set(`${g.name}.totalMa`, total);
    run.note(`${g.name} total ${fmt(total)} mA ${le(total, gl) ? '<=' : '>'} limit ${fmt(gl)} mA`);
    if (!le(total, gl)) ok = false;
  }
  if (ok) return run.pass();
  run.parts.push(
    { kind: 'series-resistor', note: 'raise series resistance to cut the current' },
    { kind: 'driver-transistor', note: 'drive the load from a transistor / MOSFET instead' },
  );
  return run.fail('critical');
}

/* ---------- R5 ---------- */

export function evalR5(c: R5Context): RuleResult {
  const run = new Run('R5');
  const vin = run.need('Vin', c.vinNomV);
  const r1 = run.need('R1', c.r1Ohm);
  const r2 = run.need('R2', c.r2Ohm);
  const vdd = run.need('receiver VDD', c.receiverVddV);
  const vih = run.need('receiver VIH,min', c.receiverVihMinV);
  const abs =
    c.receiverAbsMaxV === undefined ? undefined : run.need('receiver abs max', c.receiverAbsMaxV);
  if (
    run.incomplete ||
    vin === undefined ||
    r1 === undefined ||
    r2 === undefined ||
    vdd === undefined ||
    vih === undefined
  ) {
    return run.caution();
  }
  const tol = c.tolerance ?? DIVIDER_VIN_TOLERANCE;
  const ratio = r2 / (r1 + r2);
  const hi = vin * (1 + tol) * ratio;
  const lo = vin * (1 - tol) * ratio;
  run.set('ratio', ratio);
  run.set('voutHighV', hi);
  run.set('voutLowV', lo);
  const upperOk = le(hi, vdd) && (abs === undefined || le(hi, abs));
  const lowerOk = ge(lo, vih);
  const absTxt = abs === undefined ? '' : ` / abs max ${fmt(abs)} V`;
  run.note(
    `Vout(+${fmt(tol * 100)}%) = ${fmt(hi)} V ${upperOk ? 'within' : 'above'} VDD ${fmt(vdd)} V${absTxt}`,
  );
  run.note(
    `Vout(-${fmt(tol * 100)}%) = ${fmt(lo)} V ${lowerOk ? '>=' : '<'} VIH,min ${fmt(vih)} V`,
  );
  if (upperOk && lowerOk) return run.pass();
  const upperLimit = Math.min(vdd, abs ?? vdd);
  run.parts.push({
    kind: 'divider',
    note: `choose R1/R2 so ${fmt(vih / (vin * (1 - tol)))} <= R2/(R1+R2) <= ${fmt(upperLimit / (vin * (1 + tol)))}`,
  });
  return run.fail('critical');
}

/* ---------- R6 ---------- */

export function evalR6(c: R6Context): RuleResult {
  const run = new Run('R6');
  run.addEvidence(c.evidence ?? []);
  if (c.requiredLevel === 'any') {
    run.note('strap accepts any level at reset');
    return run.pass({ riskTierDelta: 1 });
  }
  if (c.restingLevel === 'unknown') {
    run.need('resting level at reset', missingFact());
    return run.caution({ riskTierDelta: 1 });
  }
  const level =
    c.restingLevel === 'float'
      ? c.defaultLevel
      : c.restingLevel === 'high' || c.restingLevel === 'driven-high'
        ? 'high'
        : 'low';
  const floatTxt = c.restingLevel === 'float' ? ' (floating: strap default)' : '';
  run.note(`resting level at reset ${level}${floatTxt}, strap requires ${c.requiredLevel}`);
  if (level === c.requiredLevel) return run.pass({ riskTierDelta: 1 });
  const blocked = c.effect === 'boot-mode' || c.effect === 'flash-voltage';
  run.parts.push({
    kind: 'move-pin',
    note: blocked
      ? `wrong level changes ${c.effect}: use another pin`
      : 'move the pin or remove the pull that opposes the strap',
  });
  run.note(blocked ? `BLOCKED: changes ${c.effect}` : 'warning: strap level mismatch');
  return blocked
    ? run.fail('critical', { blocked: true, riskTierDelta: 1 })
    : run.fail('warning', { riskTierDelta: 1 });
}

/* ---------- R7 ---------- */

export function evalR7(c: R7Context): RuleResult {
  const run = new Run('R7');
  const rails = c.rails.map((r) => ({
    name: r.name,
    loads: r.loadsMa.map((l, i) => run.need(`${r.name} load #${i + 1}`, l)),
    reg: run.need(`${r.name} regulator rating`, r.regulatorMa),
  }));
  const usb = c.usbLimitMa === undefined ? undefined : run.need('USB limit', c.usbLimitMa);
  if (run.incomplete) return run.caution();
  let ok = true;
  let grand = 0;
  for (const r of rails) {
    const total = sum(r.loads);
    const reg = r.reg ?? Number.NaN;
    grand += total;
    run.set(`${r.name}.totalMa`, total);
    const pass = le(total, reg);
    run.note(`${r.name} total ${fmt(total)} mA ${pass ? '<=' : '>'} regulator ${fmt(reg)} mA`);
    if (!pass) ok = false;
  }
  run.set('totalMa', grand);
  if (usb !== undefined) {
    const pass = le(grand, usb);
    run.note(`sum ${fmt(grand)} mA ${pass ? '<=' : '>'} USB limit ${fmt(usb)} mA`);
    if (!pass) ok = false;
  }
  if (ok) return run.pass();
  run.parts.push({ kind: 'separate-supply', note: 'power the heavy loads from a separate supply' });
  return run.fail('warning');
}

/* ---------- R8 ---------- */

export function evalR8(c: R8Context): RuleResult {
  const run = new Run('R8');
  const smax = run.need('sensor max', c.sensorMaxV);
  const smin = c.sensorMinV === undefined ? undefined : run.need('sensor min', c.sensorMinV);
  const amin = run.need('ADC effective min', c.adcMinEffV);
  const amax = run.need('ADC effective max', c.adcMaxEffV);
  let ratio = 1;
  if (c.divider !== undefined) {
    const r1 = run.need('divider R1', c.divider.r1Ohm);
    const r2 = run.need('divider R2', c.divider.r2Ohm);
    if (r1 !== undefined && r2 !== undefined) ratio = r2 / (r1 + r2);
  }
  if (c.radioActive && c.unitRadioCompatible === undefined) {
    run.need('ADC unit radio compatibility', missingFact());
  }
  if (run.incomplete || smax === undefined || amin === undefined || amax === undefined) {
    return run.caution();
  }
  const maxIn = smax * ratio;
  const ratioMax = amax / smax;
  const dead = amin / ratio;
  run.set('ratio', ratio);
  run.set('adcMaxInV', maxIn);
  run.set('ratioMax', ratioMax);
  run.set('deadZoneV', dead);
  let ok = true;
  const fits = le(maxIn, amax);
  run.note(
    `sensor ${fmt(smax)} V * ratio ${fmt(ratio)} = ${fmt(maxIn)} V ${fits ? '<=' : '>'} ADC max ${fmt(amax)} V`,
  );
  if (!fits) {
    ok = false;
    run.parts.push({ kind: 'divider', note: `divider ratio must be <= ${fmt(ratioMax)}` });
  }
  run.note(`dead zone (sensor side) = ${fmt(amin)} V / ${fmt(ratio)} = ${fmt(dead)} V`);
  if (smin !== undefined && smin < dead) {
    run.note(
      `sensor minimum ${fmt(smin)} V is below the dead zone ${fmt(dead)} V and cannot be resolved`,
    );
  }
  if (c.radioActive && c.unitRadioCompatible === false) {
    ok = false;
    run.note('selected ADC unit is not usable while the radio is active');
    run.parts.push({ kind: 'move-pin', note: 'use an ADC unit compatible with the radio' });
  }
  return ok ? run.pass() : run.fail('warning');
}
