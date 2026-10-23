// Per-assignment assessment (task 2b.5/2b.7): what a signal costs on one pad. Wires the pad-dependent
// rules of @pinout/rules (R4 pin current, R6 strap, R8 ADC fit) to catalog facts, scores the candidate
// on the four lexicographic tiers (skill pin-allocation-engine step 7) and records warnings, required
// parts and the trace lines the explainer prints. Pure and deterministic.
import {
  evaluateRule,
  type Fact,
  type FactStatus,
  type RequiredPart,
  type RestingLevel,
  type RuleId,
  type RuleResult,
  type StrapEffect,
  type WarningLevel,
} from '@pinout/rules';
import type { Board, Chip, Project, Status } from '@pinout/schema';
import { prov, sortedUnique, weakest, type CatalogIndex, type Prov } from './catalog.js';
import type { ComposedPin } from './compose.js';
import type { ExpandedSignal } from './signals.js';
import { normRole } from './wiring.js';

/** Lexicographic score, tier 1 (risk) first; lower is better. */
export type Cost = [number, number, number, number];
export const ZERO_COST: Cost = [0, 0, 0, 0];

export const addCost = (a: Cost, b: Cost): Cost => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
  a[3] + b[3],
];

/** Lexicographic comparison: negative when a is better than b. */
export function compareCost(a: Cost, b: Cost): number {
  for (let i = 0; i < 4; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface WarnItem {
  level: WarningLevel;
  code: string;
  message: string;
  pads: string[];
  evidence: string[];
}

export interface PartItem {
  kind: 'resistor' | 'level-shifter' | 'buffer' | 'transistor' | 'regulator' | 'supply' | 'divider';
  role: string;
  value?: string;
  pad?: string;
  note: string;
}

export interface RuleEntry {
  signal: string;
  result: RuleResult;
}

export interface Assessment {
  cost: Cost;
  rules: RuleEntry[];
  warnings: WarnItem[];
  parts: PartItem[];
  evidence: string[];
  /** Human-readable lines on why the pad costs what it does. */
  notes: string[];
  /** Why the pad cannot be used at all (R6 blocked); a conflict-set token. */
  blocked?: string;
}

export interface AssessContext {
  index: CatalogIndex;
  project: Project;
  chip: Chip;
  board: Board;
  disabled: readonly RuleId[];
}

// ---------- fact helpers shared with the module-level checks ----------

export const toFactStatus = (s: Status): FactStatus =>
  s === 'verified' || s === 'single-source'
    ? 'verified'
    : s === 'community' || s === 'interim'
      ? 'inferred'
      : s;

export const rfact = (p: Prov<number>): Fact => ({
  value: p.value,
  status: toFactStatus(p.status),
  evidence: p.evidence,
});

export const missing = (evidence: readonly string[] = []): Fact => ({
  value: null,
  status: 'missing',
  evidence,
});

export const known = (value: number, evidence: readonly string[] = []): Fact => ({
  value,
  status: 'verified',
  evidence,
});

/** Resolve a catalog voltage expression (`1.2`, `VDD*0.7`, `VDDIO+0.3`, `VDDIO*0.75`) to volts. */
export function resolveExpr(
  p: Prov<number | string>,
  vdd: Prov<number>,
  vddio: Prov<number>,
): Prov<number> {
  const v = p.value;
  if (v === null) return { value: null, status: p.status, evidence: p.evidence };
  if (typeof v === 'number') return { value: v, status: p.status, evidence: p.evidence };
  const m = /^(VDDIO|VDD)([*+])(-?[0-9.]+)$/.exec(v);
  const k = m ? Number(m[3]) : Number.NaN;
  const base = m?.[1] === 'VDDIO' ? vddio : vdd;
  if (!m || Number.isNaN(k) || base.value === null) {
    return {
      value: null,
      status: 'missing',
      evidence: sortedUnique([...p.evidence, ...base.evidence]),
    };
  }
  return {
    value: m[2] === '*' ? base.value * k : base.value + k,
    status: weakest([p.status, base.status]),
    evidence: sortedUnique([...p.evidence, ...base.evidence]),
  };
}

const fmt = (n: number): string => String(Math.round(n * 1e6) / 1e6);

// ---------- the assessment ----------

/** Errata ids with a modelled effect -> warning code (see fixture-vocabulary.ts). */
const ERRATUM_CODES: Readonly<Record<string, string>> = { 'GPIO-3.11': 'ERRATUM_GPIO_3_11' };
/**
 * ESP32 GPIO errata (esp32-errata-v3.1): GPIO-3.6 (pull configuration of RTC pads), GPIO-3.11 (input
 * glitch on GPIO36/39) and GPIO-3.14 (edge interrupts) do not rank pads against each other.
 */
const REPORT_ONLY_ERRATA: ReadonlySet<string> = new Set(['GPIO-3.6', 'GPIO-3.11', 'GPIO-3.14']);
const ERRATUM_TEXT: Readonly<Record<string, string>> = {
  'GPIO-3.11':
    'about 80 ns low pulse on the input when the SAR ADC or amplifier powers on; debounce',
};

/**
 * Pads whose internal pull is limited. The catalog states this only in free text (claim
 * esp8266ex-ds-v7.1#pull-config), so the one known case is keyed by chip and pad here.
 */
const PULL_DOWN_ONLY: Readonly<Record<string, { pads: readonly string[]; evidence: string }>> = {
  esp8266ex: { pads: ['GPIO16'], evidence: 'esp8266ex-ds-v7.1#pull-config' },
};

const wideCache = new WeakMap<Chip, Set<string>>();
/** Errata present on every pad of the chip: they cannot rank one pad against another. */
export function chipWideErrata(chip: Chip): Set<string> {
  const hit = wideCache.get(chip);
  if (hit) return hit;
  const pads = Object.values(chip.pads);
  const wide = new Set<string>();
  const first = pads[0];
  if (first) {
    for (const e of first.errata) if (pads.every((p) => p.errata.includes(e))) wide.add(e);
  }
  wideCache.set(chip, wide);
  return wide;
}

function strapEffect(role: string): StrapEffect {
  const r = role.toLowerCase();
  if (/boot|download/.test(r)) return 'boot-mode';
  if (/flash|vdd_sdio|voltage/.test(r)) return 'flash-voltage';
  return 'other';
}

/** Level the pad itself holds during reset, from the catalog reset state. */
function padResetLevel(rs: ComposedPin['resetState']): 'high' | 'low' | 'float' | null {
  switch (rs.value) {
    case 'pullup':
    case 'output-high':
      return 'high';
    case 'pulldown':
    case 'output-low':
      return 'low';
    case 'input':
    case 'disabled':
      return 'float';
    default:
      return null;
  }
}

function adcRange(chip: Chip, unit: string): { fact: Prov<number>; lo: number; hi: number } | null {
  const per = chip.peripherals[unit];
  if (!per?.adc_effective_range_mv) return null;
  const p = prov(per.adc_effective_range_mv);
  if (p.value === null) return null;
  let best: [number, number] | undefined;
  for (const key of Object.keys(p.value).sort()) {
    const r = p.value[key];
    if (r && (best === undefined || r[1] > best[1])) best = r;
  }
  if (!best) return null;
  return {
    fact: { value: best[1] / 1000, status: p.status, evidence: p.evidence },
    lo: best[0] / 1000,
    hi: best[1] / 1000,
  };
}

/**
 * Assess `members` (the signals of one net) on `pin`. `routing` is the way the pad carries a bus role
 * ('iomux' | 'matrix' | 'fixed'); `busKind` is set for bus nets.
 */
export function assess(
  ctx: AssessContext,
  members: readonly ExpandedSignal[],
  pin: ComposedPin,
  routing: 'iomux' | 'matrix' | 'fixed' | null,
  busKind: 'i2c' | 'spi' | 'uart' | null,
): Assessment {
  const pad = pin.pad ?? '';
  const cost: Cost = [0, 0, 0, 0];
  const rules: RuleEntry[] = [];
  const warnings: WarnItem[] = [];
  const parts: PartItem[] = [];
  const notes: string[] = [];
  const evidence = new Set<string>(pin.evidence);
  let blocked: string | undefined;
  const opts = { disabled: ctx.disabled };
  const run = <K extends RuleId>(
    id: K,
    signal: string,
    c: Parameters<typeof evaluateRule<K>>[1],
  ): RuleResult => {
    const r = evaluateRule(id, c, opts);
    rules.push({ signal, result: r });
    for (const e of r.evidence) evidence.add(e);
    return r;
  };
  const warn = (level: WarningLevel, code: string, message: string, ev: readonly string[] = []) => {
    warnings.push({ level, code, message, pads: [pad], evidence: sortedUnique([...ev]) });
  };

  // ----- tier 1 (risk), pad-level items counted once -----
  const strapObj = pin.strap.value !== null && pin.strap.value !== 'none' ? pin.strap.value : null;
  if (strapObj) {
    cost[0] += 1;
    notes.push(`strap pad (${strapObj.role}): +1 risk`);
  }
  if (pin.jtag !== undefined) {
    cost[0] += 1;
    notes.push(`JTAG pad (${pin.jtag}): +1 risk`);
  }
  if (pin.powerUpGlitch.value !== null && pin.powerUpGlitch.value !== 'none') {
    cost[0] += 1;
    notes.push('documented power-up glitch: +1 risk');
  }
  // Errata: the ESP32 GPIO errata are reported, not scored (the worked example keeps GPIO36/39 at zero
  // risk and asks for a Caution with a debounce workaround); any other erratum that is not chip-wide
  // (e.g. RP2040-E11 on the ADC pads) costs one risk per pad.
  const chipWide = chipWideErrata(ctx.chip);
  const scored = pin.errata.filter((e) => !REPORT_ONLY_ERRATA.has(e) && !chipWide.has(e));
  if (scored.length > 0) {
    cost[0] += 1;
    notes.push(`errata ${scored.join(', ')}: +1 risk`);
  }
  for (const e of pin.errata) {
    const code = ERRATUM_CODES[e];
    if (REPORT_ONLY_ERRATA.has(e)) {
      notes.push(
        `erratum ${e}: reported${code === undefined ? '' : ` as ${code}`}, no tier-1 cost`,
      );
    }
    if (code !== undefined) {
      warn(
        'caution',
        code,
        `pad ${pad} carries erratum ${e} (${ERRATUM_TEXT[e] ?? 'see the errata sheet'})`,
        pin.evidence,
      );
    }
  }
  // the reset state is only relied on for loads and strap pads
  const relied: Prov<unknown>[] = [pin.inputOnly, pin.strap, pin.powerUpGlitch];
  if (strapObj || members.some((m) => m.actsOnLevel)) relied.push(pin.resetState);
  if (members.some((m) => m.actsOnLevel)) relied.push(pin.pinCurrentMaxMa);
  if (members.some((m) => m.peripheral === 'ADC') && pin.adc) relied.push(pin.adc.radioConflict);
  if (relied.some((f) => f.status === 'conflict')) {
    cost[0] += 1;
    notes.push('a fact relied on for this pad is in conflict: +1 risk');
    warn(
      'caution',
      'FACT_CONFLICT_RELIED',
      `pad ${pad} relies on a catalog fact whose sources disagree`,
      pin.evidence,
    );
  }
  if (pin.strap.status === 'missing') {
    // an undocumented strap behaviour cannot be proven harmless: count it as a strap pad
    cost[0] += 1;
    notes.push('strap behaviour not documented in the catalog: +1 risk');
    warn(
      'caution',
      'STRAP_FACT_MISSING',
      `strap behaviour of ${pad} is not documented in the catalog`,
      pin.strap.evidence,
    );
  }
  if (pin.onboard.length > 0) {
    cost[2] += 1;
    notes.push('onboard circuitry shares the pad: +1 convenience');
    warn(
      'caution',
      'ONBOARD_LOAD_ON_PAD',
      `${pad} is shared with onboard hardware: ${pin.onboard.map((o) => o.part).join('; ')}`,
      pin.onboard.flatMap((o) => o.evidence),
    );
    for (const o of pin.onboard) for (const e of o.evidence) evidence.add(e);
  }

  // ----- tier 4 (headroom): scarce capabilities consumed by a signal that does not need them -----
  const isAdcNet = members.some((m) => m.peripheral === 'ADC');
  if (!isAdcNet && pin.adc) cost[3] += 1;
  if (pin.dac) cost[3] += 1;
  if (pin.touch) cost[3] += 1;
  // a chip-select line on an IO_MUX chip-select pad of an SPI instance uses that pad as intended
  const isSpiCs = members.some((m) => m.interface === 'spi' && normRole(m.role) === 'CS');
  if (
    busKind !== 'spi' &&
    pin.carries.some(
      (c) =>
        c.routing === 'iomux' &&
        /^(SPI|HSPI|RSPI)/.test(c.peripheral) &&
        !(isSpiCs && c.role.startsWith('cs')),
    )
  ) {
    cost[3] += 1;
  }

  // ----- tier 2 (performance) -----
  if (busKind === 'spi' && routing === 'matrix') {
    cost[1] += 1;
    notes.push('SPI line routed through the GPIO matrix: lower clock ceiling, +1 performance');
  }

  // ----- signal-level items -----
  for (const s of members) {
    // R6: strap
    if (strapObj) {
      const effect = strapEffect(strapObj.role);
      const required = strapObj.required_at_reset;
      // an unstated resting level is unknown (R6 gives Caution); a stated 'float' follows the strap's own pull
      let resting: RestingLevel = s.restingKnown ? s.restingLevelAtReset : 'unknown';
      const defLevel: 'high' | 'low' = strapObj.default_pull === 'down' ? 'low' : 'high';
      if (
        resting === 'float' &&
        (strapObj.default_pull === undefined || strapObj.default_pull === 'none')
      ) {
        resting = 'unknown';
      }
      if (s.actsOnLevel) {
        // a load on a pad that decides the boot: one more risk, so that loads leave strap pads to logic
        // inputs (worked example: the CS lines take the strap pads)
        cost[0] += 1;
        notes.push(`load ${s.id} on strap pad ${pad}: +1 risk`);
      }
      const r6 = run('R6', s.id, {
        requiredLevel: required,
        defaultLevel: defLevel,
        restingLevel: resting,
        effect,
        evidence: pin.strap.evidence,
      });
      if (r6.level === 'caution') {
        if (effect !== 'other') {
          // R6 would block this pad if the level were known to be wrong; unproven, it is a risk of its own
          cost[0] += 1;
          notes.push(
            `strap pad ${pad} sets ${effect === 'boot-mode' ? 'the boot mode' : 'the flash voltage'} and the level of ${s.id} at reset is unproven: +1 risk`,
          );
        }
        warn(
          'caution',
          'FLOATING_AT_RESET_UNKNOWN',
          `${s.id} on strap pad ${pad}: its level during reset is not documented (the pad requires ${required} at reset)`,
          r6.evidence,
        );
      } else if (!r6.passed && r6.blocked !== true) {
        warn(
          'warning',
          'STRAP_LEVEL_MISMATCH',
          `${s.id} holds strap pad ${pad} at the wrong level during reset`,
          r6.evidence,
        );
      }
      if (r6.blocked === true) blocked = `strap:${pad}`;
    }
    // loads: reset behaviour and pin current
    if (s.actsOnLevel) {
      const lvl = padResetLevel(pin.resetState);
      if (!s.restingKnown) {
        warn(
          'caution',
          'FLOATING_AT_RESET_UNKNOWN',
          `the off level of the load on ${s.id} is not documented, so its state while ${pad} is in reset cannot be proven`,
          pin.resetState.evidence,
        );
      }
      if (lvl === null) {
        warn(
          'caution',
          'FLOATING_AT_RESET_UNKNOWN',
          `reset state of ${pad} is not documented; ${s.id} drives a load`,
          pin.resetState.evidence,
        );
      } else if (lvl === 'float') {
        // a floating pad is fixed with a pull resistor to the off level; with the part counted the pad
        // is pulled, so it adds no risk (worked example: relay inputs on 25/26/27/32 get pull-downs)
        // direction: the catalog's resting level, else the breakout's active level (high-active: a pull-down
        // keeps it off; low-active: a pull-up). Neither stated: the direction is unknown and never guessed.
        const pull = s.restingKnown
          ? s.restingLevelAtReset === 'high'
            ? 'pull-up'
            : 'pull-down'
          : s.activeLevel === 'high'
            ? 'pull-down'
            : s.activeLevel === 'low'
              ? 'pull-up'
              : 'pull';
        const unknownDir = pull === 'pull';
        const basis = s.restingKnown
          ? 'off level'
          : s.activeLevel === undefined
            ? 'off level (active level not documented: direction unknown)'
            : `off level (${s.activeLevel}-active input)`;
        warn(
          'warning',
          'FLOATING_AT_RESET_LOAD',
          `${s.id} drives a load and ${pad} floats during reset; add a ${unknownDir ? 'pull resistor (direction unknown)' : `${pull} resistor`} to the ${basis}`,
          pin.resetState.evidence,
        );
        if (unknownDir) {
          warn(
            'caution',
            'FLOATING_AT_RESET_UNKNOWN',
            `pull direction for ${s.id} on ${pad} cannot be chosen: the catalog states neither the resting level nor the active level of the input`,
            pin.resetState.evidence,
          );
        }
        parts.push({
          kind: 'resistor',
          role: pull,
          pad,
          note: unknownDir
            ? `${pad} floats during reset: pull resistor for ${s.id}, direction unknown (active level not in the catalog); value not asserted`
            : `${pad} floats during reset: ${pull} for ${s.id}; value not asserted by the catalog`,
        });
      } else if (!s.restingKnown) {
        notes.push(`load ${s.id} on a pad pulled ${lvl} at reset with an undocumented off level`);
        warn(
          'warning',
          'FLOATING_AT_RESET_LOAD',
          `${s.id} drives a load whose off level is not documented; ${pad} is pulled ${lvl} during reset`,
          pin.resetState.evidence,
        );
      } else if (lvl !== s.restingLevelAtReset) {
        warn(
          'warning',
          'FLOATING_AT_RESET_LOAD',
          `${pad} is held ${lvl} during reset but ${s.id} is at rest when ${s.restingLevelAtReset}`,
          pin.resetState.evidence,
        );
      }
      const r4 = run('R4', s.id, {
        pin: { loadMa: missing(), limitMa: rfact(pin.pinCurrentMaxMa) },
      });
      if (r4.level === 'caution') {
        warn(
          'caution',
          'PIN_CURRENT_UNVERIFIED',
          `load current of ${s.id} on ${pad} is not in the catalog; pin limit ${pin.pinCurrentMaxMa.value === null ? 'unknown' : `${fmt(pin.pinCurrentMaxMa.value)} mA`}`,
          r4.evidence,
        );
      }
    }
    // pull-up on an input-only pad (no software pull)
    const pdo = PULL_DOWN_ONLY[ctx.chip.id];
    const noPullUp = pdo?.pads.includes(pad) === true;
    if (s.needsPull === 'up' && busKind === null && (pin.inputOnly.value === true || noPullUp)) {
      parts.push({
        kind: 'resistor',
        role: 'pull-up',
        pad,
        note: `${pad} ${noPullUp ? 'has no internal pull-up (pull-down only)' : 'is input-only and has no internal pull-up'}: add an external pull-up for ${s.id}`,
      });
      notes.push(
        `${noPullUp ? 'pull-down-only pad' : 'input-only pad'}: external pull-up required`,
      );
      if (noPullUp) {
        warn(
          'info',
          'NO_INTERNAL_PULL_UP_ON_GPIO16',
          `${pad} supports only an internal pull-down; ${s.id} needs an external pull-up`,
          [pdo.evidence],
        );
      }
    }
    // R8: ADC fit
    if (s.peripheral === 'ADC' && pin.adc) {
      const range = adcRange(ctx.chip, pin.adc.unit);
      const analog = ctx.index.ic(s.ic)?.interfaces.find((i) => i.kind === 'analog')
        ?.limits.analog_range_v;
      const sensor = analog ? prov(analog) : null;
      const logicV = prov(ctx.board.logic_voltage);
      const sensorMax: Fact =
        sensor?.value != null
          ? {
              value: sensor.value[1],
              status: toFactStatus(sensor.status),
              evidence: sensor.evidence,
            }
          : {
              value: logicV.value,
              status: logicV.value === null ? 'missing' : 'inferred',
              evidence: logicV.evidence,
            };
      const compat = pin.adc.radioConflict.value;
      const r8 = run('R8', s.id, {
        sensorMaxV: sensorMax,
        adcMinEffV: range ? known(range.lo, range.fact.evidence) : missing(),
        adcMaxEffV: range ? known(range.hi, range.fact.evidence) : missing(),
        radioActive: ctx.project.wifi === true && compat !== null,
        unitRadioCompatible: compat === null ? undefined : !compat,
      });
      if (!range) {
        cost[1] += 1;
        warn(
          'caution',
          'ADC_RANGE_UNKNOWN',
          `effective input range of ${pin.adc.unit} is not in the catalog; the supply the sensor is wired to is assumed`,
          r8.evidence,
        );
      } else if (r8.level === 'warning' || r8.level === 'critical') {
        cost[1] += 1;
        warn(
          'warning',
          'ADC_OVER_RANGE',
          `${s.id}: sensor up to ${typeof sensorMax.value === 'number' ? fmt(sensorMax.value) : '?'} V exceeds the ${pin.adc.unit} effective maximum ${fmt(range.hi)} V; add a divider`,
          r8.evidence,
        );
        for (const p of r8.requiredParts) {
          if (p.kind === 'divider') {
            parts.push({ kind: 'divider', role: 'adc-attenuation', pad, note: p.note });
          }
        }
      }
      if (ctx.project.wifi === true && compat === null) {
        warn(
          'caution',
          'ADC_RADIO_UNKNOWN',
          `whether ${pin.adc.unit} works while the radio is on is not in the catalog`,
          pin.adc.radioConflict.evidence,
        );
      }
    }
  }

  return {
    cost,
    rules,
    warnings,
    parts,
    evidence: sortedUnique([...evidence]),
    notes,
    ...(blocked === undefined ? {} : { blocked }),
  };
}

export type { RequiredPart };
