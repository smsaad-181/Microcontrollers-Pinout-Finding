// Module- and bus-level rule wiring (R1, R2, R3, R5, R7) and catalog-gap warnings. These checks do not
// depend on which pad was chosen, so they run once on the final solution (task 2b.5). Missing or
// conflicting inputs give Caution through the rules themselves, never a silent pass.
import {
  evaluateRule,
  type Fact,
  type RequiredPart,
  type RuleId,
  type RuleResult,
  type WarningLevel,
} from '@pinout/rules';
import type { Breakout, IC, Project } from '@pinout/schema';
import { prov, sortedUnique, type Prov } from './catalog.js';
import type { I2cAddress } from './interfaces.js';
import type { ExpandedSignal } from './signals.js';
import { normRole } from './wiring.js';
import {
  known,
  missing,
  resolveExpr,
  rfact,
  toFactStatus,
  type AssessContext,
  type PartItem,
  type WarnItem,
} from './assess.js';

/** I2C spec (UM10204) standard-mode sink current; a bus constant, not a catalog fact. */
export const I2C_IOL_MA = 3;
/** I2C spec (UM10204) VOL,max of a bus device at IOL: the sink voltage the pull-up window is sized for. */
export const I2C_VOL_MAX_V = 0.4;
/** Bus capacitance estimate: per attached device (pF) and per metre of wire (pF). Engine assumption. */
export const I2C_CB_PER_DEVICE_PF = 10;
export const I2C_CB_PER_METRE_PF = 100;
/** MCU pin capacitance, I2C spec UM10204 upper bound (assumption; no catalog fact yet). */
export const I2C_CB_MCU_PIN_PF = 10;
export const I2C_DEFAULT_WIRE_M = 0.2;
export const I2C_DEFAULT_MAX_HZ = 400_000;

export interface ModuleRuleEntry {
  /** Instance or bus the rule was evaluated for. */
  scope: string;
  result: RuleResult;
}

export interface ModuleChecks {
  rules: ModuleRuleEntry[];
  warnings: WarnItem[];
  parts: PartItem[];
  budgets: { rail: string; demand_ma: number; limit_ma: number | null }[];
  /** Scope -> printable trace lines (instance or `i2c<n>`). */
  traces: Map<string, string[]>;
  /** Instance -> claim ids of the device facts the checks relied on (supply range). */
  facts: Map<string, string[]>;
}

const fmt = (n: number): string => String(Math.round(n * 1e6) / 1e6);

function mapParts(
  scope: string,
  pad: string | undefined,
  parts: readonly RequiredPart[],
): PartItem[] {
  const out: PartItem[] = [];
  for (const p of parts) {
    const base = { note: p.note, ...(pad === undefined ? {} : { pad }) };
    switch (p.kind) {
      case 'level-shifter':
        out.push({ kind: 'level-shifter', role: `level-shift:${scope}`, ...base });
        break;
      case 'buffer':
        out.push({ kind: 'buffer', role: `logic-buffer:${scope}`, ...base });
        break;
      case 'divider':
        out.push({ kind: 'divider', role: `divider:${scope}`, ...base });
        break;
      case 'pull-up':
        out.push({
          kind: 'resistor',
          role: 'pull-up',
          ...(p.valueOhms === undefined ? {} : { value: `${String(Math.round(p.valueOhms))} ohm` }),
          ...base,
        });
        break;
      case 'series-resistor':
        out.push({ kind: 'resistor', role: 'series', ...base });
        break;
      case 'driver-transistor':
        out.push({ kind: 'transistor', role: 'driver', ...base });
        break;
      case 'separate-supply':
        out.push({ kind: 'supply', role: 'separate-supply', ...base });
        break;
      default:
        break; // lower-speed, remove-pull-up, move-pin: advice carried in the rule trace
    }
  }
  return out;
}

interface DeviceSupply {
  vdd: Prov<number>;
  /** True when the device cannot run from the board's logic rail. */
  separate: boolean;
}

function deviceSupply(ic: IC, logic: Prov<number>): DeviceSupply {
  const r = prov(ic.vdd_range);
  if (r.value === null)
    return { vdd: { value: null, status: 'missing', evidence: r.evidence }, separate: false };
  const [lo, hi] = r.value;
  if (logic.value !== null && logic.value >= lo && logic.value <= hi)
    return { vdd: logic, separate: false };
  return { vdd: { value: hi, status: r.status, evidence: r.evidence }, separate: true };
}

function railFits(v: Prov<number | { min: number; max: number }>, ic: IC): boolean | null {
  const r = prov(ic.vdd_range);
  if (v.value === null || r.value === null) return null;
  const [lo, hi] = r.value;
  const [a, b] = typeof v.value === 'number' ? [v.value, v.value] : [v.value.min, v.value.max];
  return a >= lo && b <= hi;
}

export function moduleChecks(
  ctx: AssessContext,
  signals: readonly ExpandedSignal[],
  addresses: readonly I2cAddress[],
  padOf: (signalId: string) => string | undefined,
): ModuleChecks {
  const { index, project, chip, board } = ctx;
  const opts = { disabled: ctx.disabled };
  const rules: ModuleRuleEntry[] = [];
  const warnings: WarnItem[] = [];
  const parts: PartItem[] = [];
  const traces = new Map<string, string[]>();
  const facts = new Map<string, string[]>();
  const trace = (scope: string, lines: readonly string[]) => {
    traces.set(scope, [...(traces.get(scope) ?? []), ...lines]);
  };
  const run = <K extends RuleId>(
    id: K,
    scope: string,
    c: Parameters<typeof evaluateRule<K>>[1],
  ): RuleResult => {
    const r = evaluateRule(id, c, opts);
    rules.push({ scope, result: r });
    trace(scope, [`${id} [${r.level}]: ${r.trace.join('; ')}`]);
    return r;
  };
  const warn = (
    level: WarningLevel,
    code: string,
    message: string,
    pads: string[],
    evidence: readonly string[],
  ) => {
    warnings.push({ level, code, message, pads, evidence: sortedUnique([...evidence]) });
  };

  const logic = prov(board.logic_voltage);
  const vddio = logic; // MCU I/O supply as the header presents it
  const el = chip.electrical;
  const mcu = {
    voh: resolveExpr(prov(el.voh_min), vddio, vddio),
    vol: resolveExpr(prov(el.vol_max), vddio, vddio),
    vih: resolveExpr(prov(el.vih_min), vddio, vddio),
    vil: resolveExpr(prov(el.vil_max), vddio, vddio),
    abs: resolveExpr(prov(el.abs_max_vin), vddio, vddio),
  };
  const f = (p: Prov<number>): Fact => rfact(p);

  // ---------- per module: R1 / R2 (and R5 when a divider can solve R1) ----------
  const modules = [...new Set(signals.map((s) => s.instance))];
  for (const inst of modules) {
    const mine = signals.filter((s) => s.instance === inst);
    const first = mine[0];
    if (!first) continue;
    const breakout = index.breakout(first.breakout);
    const ic = index.ic(first.ic);
    if (!breakout || !ic) continue;
    const dev = deviceSupply(ic, logic);
    facts.set(inst, [...prov(ic.vdd_range).evidence]);
    const ll = ic.logic_levels;
    const devL = ll
      ? {
          voh: ll.voh_min ? resolveExpr(prov(ll.voh_min), dev.vdd, dev.vdd) : null,
          vol: ll.vol_max ? resolveExpr(prov(ll.vol_max), dev.vdd, dev.vdd) : null,
          vih: resolveExpr(prov(ll.vih_min), dev.vdd, dev.vdd),
          vil: resolveExpr(prov(ll.vil_max), dev.vdd, dev.vdd),
        }
      : null;
    const devAbs = resolveExpr(prov(ic.input_abs_max), dev.vdd, dev.vdd);
    const absExpr = prov(ic.input_abs_max).value;
    const into = mine.some((s) => s.deviceDir === 'in' || s.deviceDir === 'io');
    const outof = mine.some((s) => s.deviceDir === 'out' || s.deviceDir === 'io');
    const shifter = prov(breakout.level_shifter);
    const results: RuleResult[] = [];
    const pads = mine.flatMap((s) => padOf(s.id) ?? []);

    if (into) {
      results.push(
        run('R1', `${inst}:mcu->device`, {
          driverMaxV: f(vddio),
          receiverAbsMax:
            typeof absExpr === 'string' && absExpr.startsWith('VDDIO+')
              ? {
                  kind: 'vddio-plus',
                  vddio: f(dev.vdd),
                  offsetV: known(Number(absExpr.slice(6)), devAbs.evidence),
                }
              : { kind: 'fixed', volts: f(devAbs) },
        }),
        run('R2', `${inst}:mcu->device`, {
          driverVohMinV: f(mcu.voh),
          driverVolMaxV: f(mcu.vol),
          receiverVihMinV: devL ? f(devL.vih) : missing(),
          receiverVilMaxV: devL ? f(devL.vil) : missing(),
        }),
      );
    }
    if (outof) {
      const r1 = run('R1', `${inst}:device->mcu`, {
        driverMaxV: f(dev.vdd),
        receiverAbsMax: { kind: 'fixed', volts: f(mcu.abs) },
      });
      results.push(
        r1,
        run('R2', `${inst}:device->mcu`, {
          driverVohMinV: devL?.voh ? f(devL.voh) : missing(),
          driverVolMaxV: devL?.vol ? f(devL.vol) : missing(),
          receiverVihMinV: f(mcu.vih),
          receiverVilMaxV: f(mcu.vil),
        }),
      );
      if (r1.level === 'critical' && dev.vdd.value !== null) {
        const r5 = run('R5', `${inst}:device->mcu`, {
          vinNomV: f(dev.vdd),
          r1Ohm: known(1000),
          r2Ohm: known(2000),
          receiverVddV: f(vddio),
          receiverVihMinV: f(mcu.vih),
          receiverAbsMaxV: f(mcu.abs),
        });
        if (r5.passed) {
          for (const s of mine.filter((x) => x.deviceDir === 'out')) {
            const sPad = padOf(s.id);
            parts.push({
              kind: 'divider',
              role: 'level-divider',
              value: '1 kohm / 2 kohm',
              ...(sPad === undefined ? {} : { pad: sPad }),
              note: `${s.id}: 5 V output into a ${fmt(vddio.value ?? 0)} V pad through 1 kohm over 2 kohm (R5 checked)`,
            });
          }
        }
      }
    }
    const worst = (lvl: WarningLevel) => results.some((r) => r.level === lvl);
    const ev = results.flatMap((r) => [...r.evidence]);
    if (worst('critical')) {
      if (shifter.status === 'conflict') {
        warn(
          'caution',
          'LEVEL_SHIFTER_CONFLICT_RELIED',
          `${inst}: level-shifter fact of ${breakout.id} is in conflict`,
          pads,
          [...ev, ...shifter.evidence],
        );
      } else if (shifter.value === true) {
        trace(inst, [
          'the breakout carries a level shifter; R1/R2 mismatch is handled on the module',
        ]);
      } else {
        if (shifter.value === null) {
          warn(
            'caution',
            'LEVEL_SHIFTER_UNKNOWN',
            `${inst}: logic levels need a level shifter and the breakout's shifter fact is missing`,
            pads,
            [...ev, ...shifter.evidence],
          );
        }
        const r1c = results.some((r) => r.rule === 'R1' && r.level === 'critical');
        warn(
          'critical',
          r1c ? 'R1_ABS_MAX_EXCEEDED' : 'R2_LOGIC_LEVEL_MISMATCH',
          `${inst}: ${r1c ? 'a driver exceeds the receiver absolute maximum' : 'logic levels do not match'}; see required parts`,
          pads,
          ev,
        );
        for (const r of results) parts.push(...mapParts(inst, undefined, r.requiredParts));
      }
    } else if (worst('caution')) {
      warn(
        'caution',
        'LOGIC_LEVEL_UNKNOWN',
        `${inst}: logic-level facts are incomplete; levels cannot be verified`,
        pads,
        ev,
      );
      // the levels cannot be proven compatible, so the breakout's level-shifter fact is relied on
      if (shifter.status === 'conflict') {
        warn(
          'caution',
          'LEVEL_SHIFTER_CONFLICT_RELIED',
          `${inst}: the level-shifter fact of ${breakout.id} is in conflict and the logic levels cannot be verified`,
          pads,
          [...ev, ...shifter.evidence],
        );
      } else if (shifter.value === null || shifter.status !== 'verified') {
        warn(
          'caution',
          'LEVEL_SHIFTER_UNKNOWN',
          `${inst}: the level-shifter fact of ${breakout.id} is ${shifter.value === null ? 'missing' : 'not verified'} and the logic levels cannot be verified`,
          pads,
          [...ev, ...shifter.evidence],
        );
      }
    }

    // regulator / supply facts
    const reg = prov(breakout.regulator);
    if (reg.value === null && prov(ic.vdd_range).value !== null) {
      warn(
        'caution',
        'MODULE_REGULATOR_UNKNOWN',
        `${inst}: onboard regulator of ${breakout.id} is not documented`,
        [],
        reg.evidence,
      );
    }
  }

  // ---------- I2C buses: R3 ----------
  const i2cBuses = [...new Set(addresses.map((a) => a.bus))].sort((a, b) => a - b);
  for (const bus of i2cBuses) {
    const members = addresses.filter((a) => a.bus === bus).map((a) => a.instance);
    const scope = `i2c${String(bus)}`;
    const pulls: Fact[] = [];
    let speed = I2C_DEFAULT_MAX_HZ;
    for (const inst of members) {
      const sig = signals.find((s) => s.instance === inst && normRole(s.role) === 'SDA');
      const b: Breakout | undefined = sig ? index.breakout(sig.breakout) : undefined;
      for (const p of b?.pullups ?? []) {
        const line = normRole(p.line);
        if (line === 'SDA' || line === 'SCL') {
          if (line === 'SDA') pulls.push(f(prov(p.value_ohm)));
        }
      }
      if (sig?.maxHz != null) speed = Math.min(speed, sig.maxHz);
    }
    const wire = project.wiring_length_m ?? I2C_DEFAULT_WIRE_M;
    const cb =
      I2C_CB_MCU_PIN_PF + members.length * I2C_CB_PER_DEVICE_PF + wire * I2C_CB_PER_METRE_PF;
    const r3 = run('R3', scope, {
      pullUpsOhm: pulls,
      vddV: f(logic),
      volMaxV:
        mcu.vol.value !== null && mcu.vol.value > I2C_VOL_MAX_V
          ? f(mcu.vol)
          : known(I2C_VOL_MAX_V, mcu.vol.evidence),
      iolMa: known(I2C_IOL_MA),
      speedHz: speed,
      cbPf: { value: cb, status: 'inferred', evidence: [] },
    });
    trace(scope, [
      `bus capacitance estimated at ${fmt(cb)} pF (MCU pin ${String(I2C_CB_MCU_PIN_PF)} pF assumed + ${String(members.length)} devices x ${String(I2C_CB_PER_DEVICE_PF)} pF + ${fmt(wire)} m x ${String(I2C_CB_PER_METRE_PF)} pF/m); IOL ${String(I2C_IOL_MA)} mA (I2C spec)`,
    ]);
    const pads = ['SDA', 'SCL'].flatMap((role) => {
      const sig = signals.find((s) => s.instance === members[0] && normRole(s.role) === role);
      const sp = sig ? padOf(sig.id) : undefined;
      return sp === undefined ? [] : [sp];
    });
    if (r3.level === 'caution') {
      warn(
        'caution',
        'I2C_PULLUP_UNKNOWN',
        `${scope}: pull-up resistance of the attached modules is not documented; R3 cannot be verified`,
        pads,
        r3.evidence,
      );
    } else if (!r3.passed) {
      warn(
        r3.level,
        'I2C_PULLUP_OUT_OF_RANGE',
        `${scope}: effective pull-up is outside the R3 window`,
        pads,
        r3.evidence,
      );
    }
    parts.push(...mapParts(scope, undefined, r3.requiredParts));
  }
  for (const a of addresses) {
    // an address pin tied to SDA needs SDA held low for a set time after SCL falls (ADS1115 ADDR=SDA)
    const sig = signals.find((x) => x.instance === a.instance);
    const strapText = (sig ? index.ic(sig.ic) : undefined)?.interfaces
      .find((i) => i.kind === 'i2c')
      ?.limits.addresses?.find((x) => x.value === a.address)?.strap;
    if (strapText !== undefined && /=SDA$/i.test(strapText.replace(/s+/g, ''))) {
      warn(
        'info',
        'I2C_ADDRESS_SDA_STRAP_TIMING',
        `${a.instance}: address strap ${strapText} needs SDA held low for the minimum time after SCL falls (see the IC datasheet)`,
        [],
        a.evidence,
      );
    }
    if (a.status === 'unknown') {
      warn(
        'caution',
        'I2C_ADDRESS_UNKNOWN',
        `${a.instance}: I2C address cannot be proven (strap level of the module not documented)`,
        [],
        a.evidence,
      );
    }
  }

  // ---------- supply: R7 ----------
  const railOf = new Map<string, string>();
  const dualSupply = new Set<string>();
  const railLoads = new Map<string, Fact[]>();
  for (const inst of modules) {
    const first = signals.find((s) => s.instance === inst);
    const breakout = first ? index.breakout(first.breakout) : undefined;
    const ic = first ? index.ic(first.ic) : undefined;
    if (!breakout || !ic) continue;
    const dev = deviceSupply(ic, logic);
    // a second supply pin of its own (JD-VCC): the coil side can be fed apart from the logic side
    if (breakout.pins.filter((p) => p.maps_to === 'VCC').length >= 2) dualSupply.add(inst);
    let rail = board.rails.find((r) => railFits(prov(r.voltage), ic) === true);
    if (!rail && !dev.separate)
      rail = board.rails.find((r) => prov(r.voltage).value === logic.value);
    const load = prov(breakout.supply_current);
    const icLoad = prov(ic.supply_current);
    const src = load.value?.max !== undefined || load.value?.typ !== undefined ? load : icLoad;
    const amp = src.value?.max ?? src.value?.typ;
    const fact: Fact =
      amp === undefined
        ? missing(src.evidence)
        : { value: amp, status: toFactStatus(src.status), evidence: src.evidence };
    if (rail) {
      railOf.set(inst, rail.name);
      railLoads.set(rail.name, [...(railLoads.get(rail.name) ?? []), fact]);
    } else {
      parts.push({
        kind: 'supply',
        role: 'separate-supply',
        value: dev.vdd.value === null ? undefined : `${fmt(dev.vdd.value)} V`,
        note: `${inst} needs ${dev.vdd.value === null ? 'its own' : `${fmt(dev.vdd.value)} V`} supply; no board rail fits (supply split)`,
      } as PartItem);
      trace(inst, ['supply split: no board rail matches the device supply range']);
    }
  }
  const budgets: ModuleChecks['budgets'] = [];
  for (const r of board.rails) {
    const loads = railLoads.get(r.name);
    if (!loads) continue;
    const limit = prov(r.max_current);
    const r7 = run('R7', `rail:${r.name}`, {
      rails: [{ name: r.name, loadsMa: loads, regulatorMa: rfact(limit) }],
    });
    const total = r7.values[`${r.name}.totalMa`];
    budgets.push({
      rail: r.name,
      demand_ma:
        total ?? loads.reduce((a, l) => a + (typeof l.value === 'number' ? l.value : 0), 0),
      limit_ma: limit.value,
    });
    if (r7.level === 'caution' || !r7.passed) {
      for (const [inst, rail] of railOf) {
        if (rail === r.name && dualSupply.has(inst)) {
          parts.push({
            kind: 'supply',
            role: 'jd-vcc',
            note: `${inst}: feed the coil supply (second supply pin) from a separate 5 V source with a common GND, jumper removed; value not asserted (${r7.level === 'caution' ? 'coil current or rail rating missing' : 'rail over capacity'})`,
          });
          trace(inst, [
            'supply split: separate coil supply recommended while the rail budget cannot be proven',
          ]);
        }
      }
    }
    if (r7.level === 'caution') {
      warn(
        'caution',
        'RAIL_BUDGET_UNKNOWN',
        `rail ${r.name}: load or capacity not documented; budget cannot be verified`,
        [],
        r7.evidence,
      );
    } else if (!r7.passed) {
      warn(
        r7.level,
        'RAIL_BUDGET_EXCEEDED',
        `rail ${r.name} is over its capacity`,
        [],
        r7.evidence,
      );
      parts.push(...mapParts(`rail:${r.name}`, undefined, r7.requiredParts));
    }
  }

  // ---------- SPI sharing ----------
  const spiMiso = signals.filter((s) => s.interface === 'spi' && s.miso !== undefined);
  const spiDevices = new Set(signals.filter((s) => s.interface === 'spi').map((s) => s.instance));
  if (spiDevices.size > 1 && spiMiso.some((s) => s.miso?.shareProven !== true)) {
    // two devices that both drive MISO: Caution; one reader beside write-only devices: Info
    warn(
      spiMiso.length > 1 ? 'caution' : 'info',
      'MISO_SHARE_UNPROVEN',
      `MISO is used by ${spiMiso.map((s) => s.instance).join(', ')} on a bus shared with ${[...spiDevices].join(', ')} and the catalog does not prove the MISO driver releases it when deselected`,
      [...new Set(spiMiso.flatMap((s) => padOf(s.id) ?? []))],
      [],
    );
  }
  return { rules, warnings, parts, budgets, traces, facts };
}

export type { Project };
