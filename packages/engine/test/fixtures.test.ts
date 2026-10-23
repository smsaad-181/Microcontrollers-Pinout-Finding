// Golden-fixture harness (tasks 2b.5 start, 2b.9 finish). Runs each catalog/fixtures entry through
// `solveDetailed` and reports pass / fail / disputed / unchecked per fixture. Fixtures are edited only on an
// owner ruling (docs/validation/phase-2b/dispute-resolution.md).
//   pass       every assertion was checked and held
//   fail       an assertion was checked and does not hold (engine bug until proven otherwise)
//   disputed   the only deviations are listed in DISPUTES and in docs/validation/phase-2b/fixture-disputes.md:
//              the owner decides whether the fixture or the engine changes
//   unchecked  the harness has no check for an assertion (never counted as a pass)
// Ratchet: every fixture must be `pass` or `disputed`; a fixture that fails or has unchecked keys fails the
// suite, and so does a disputed fixture that is not described in the disputes document.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { I2C_TR_MAX_BY_SPEED, rpMaxOhm } from '@pinout/rules';
import type { Fixture, Recommendation } from '@pinout/schema';
import { validateRoot } from '../../cli/src/index.js';
import { solveDetailed, type SolveDetails } from '../src/solver.js';
import { normRole } from '../src/wiring.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function loadFixtures(): Fixture[] {
  return validateRoot(`${ROOT}catalog`).catalog.fixtures;
}

export type FixtureState = 'pass' | 'fail' | 'disputed' | 'partial';

export interface FixtureReport {
  id: string;
  state: FixtureState;
  pass: boolean;
  failures: string[];
  disputed: string[];
  unchecked: string[];
}

/** A deviation the owner has to rule on. `pattern` matches the failure/unchecked message. */
interface Dispute {
  pattern: RegExp;
  why: string;
}

/** Fixture id -> disputed assertions (details in docs/validation/phase-2b/fixture-disputes.md). */
export const DISPUTES: Readonly<Record<string, readonly Dispute[]>> = {};

const padOf = (r: Recommendation, sid: string): string | undefined => {
  const i = sid.indexOf('.');
  const inst = sid.slice(0, i);
  const role = sid.slice(i + 1);
  if (inst === 'bus') {
    // pseudo-instance for the shared SPI bus lines
    return r.assignments.find(
      (a) => a.peripheral_instance?.startsWith('SPI') && normRole(a.role) === normRole(role),
    )?.pad;
  }
  return r.assignments.find((a) => a.instance === inst && a.role === role)?.pad;
};
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const hex = (n: number | null): string => (n === null ? '?' : `0x${n.toString(16).toUpperCase()}`);
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

interface Run {
  r: Recommendation;
  d: SolveDetails;
  fx: Fixture;
}

function i2cAddressesOfStraps(
  fx: Fixture,
  instances: readonly string[],
  straps: readonly string[],
) {
  const m = fx.project.modules.find((x) => x.instance === instances[0]);
  const ic = m ? index.ic(index.breakout(m.breakout)?.ic ?? '') : undefined;
  const list = ic?.interfaces.find((i) => i.kind === 'i2c')?.limits.addresses ?? [];
  return straps.map((s) => hex(list.find((a) => a.strap === s)?.value ?? null));
}

function r3(d: SolveDetails) {
  return d.moduleRules.find((e) => e.rule === 'R3');
}

function checkProperty(
  run: Run,
  key: string,
  v: unknown,
  fail: (m: string) => void,
  unchecked: (m: string) => void,
): void {
  const { r, d, fx } = run;
  const o = (v ?? {}) as Record<string, unknown>;
  const riskPads = (): string[] => [
    ...new Set(
      r.assignments.filter((a) => a.trace.some((t) => t.includes('+1 risk'))).map((a) => a.pad),
    ),
  ];
  switch (key) {
    case 'interface_of':
      for (const [inst, kind] of Object.entries(o)) {
        if (r.interfaces[inst]?.kind !== kind)
          fail(`interface_of ${inst}: ${r.interfaces[inst]?.kind ?? 'none'} != ${String(kind)}`);
      }
      return;
    case 'interface_decided_by_rule': {
      const want = Number(v);
      if (!Object.values(r.interfaces).some((i) => i.decided_by_rule === want))
        fail(`no interface decided by rule ${String(want)}`);
      return;
    }
    case 'bus_shared':
      for (const group of v as string[][]) {
        const pads = new Set(group.map((s) => padOf(r, s)));
        if (pads.size !== 1 || pads.has(undefined))
          fail(`bus_shared ${group.join(',')} -> ${[...pads].join('/')}`);
      }
      return;
    case 'signal_pad_in':
      for (const s of asArr(o.signals)) {
        const p = padOf(r, s);
        if (p === undefined || !asArr(o.pads).includes(p))
          fail(`${s} on ${p ?? 'nothing'} not in allowed pads`);
      }
      return;
    case 'signal_pad_set_equals': {
      const got = asArr(o.signals).map((s) => padOf(r, s) ?? '?');
      if (!sameSet(got, asArr(o.pads)))
        fail(`signal_pad_set ${got.sort().join(',')} != ${asArr(o.pads).sort().join(',')}`);
      return;
    }
    case 'no_pad_in': {
      const bad = r.assignments.filter((a) => asArr(v).includes(a.pad)).map((a) => a.pad);
      if (bad.length > 0) fail(`forbidden pads used: ${[...new Set(bad)].join(',')}`);
      return;
    }
    case 'outputs_not_in': {
      // an output role on an input-only pad is a solver invariant; check it on the result
      const bad = r.assignments
        .filter((a) => asArr(v).includes(a.pad))
        .filter((a) => !/^(SW|IRQ|INT|MISO|ECHO|WIPER|OUT|DOUT)$/.test(normRole(a.role)))
        .map((a) => `${a.instance}.${a.role}=${a.pad}`);
      if (bad.length > 0) fail(`outputs on input-only pads: ${bad.join(',')}`);
      return;
    }
    case 'risk_tier1_equals':
      if (r.score[0] !== Number(v))
        fail(`risk tier 1 is ${String(r.score[0])}, expected ${String(v)}`);
      return;
    case 'risk_pads_subset_of': {
      const bad = riskPads().filter((p) => !asArr(v).includes(p));
      if (bad.length > 0) fail(`risk pads outside ${asArr(v).join(',')}: ${bad.join(',')}`);
      return;
    }
    case 'if_used': {
      const pad = String(o.pad);
      const roles = asArr(o.role_in);
      for (const a of r.assignments.filter((x) => x.pad === pad)) {
        if (!roles.includes(`${a.instance}.${a.role}`))
          fail(`${pad} used by ${a.instance}.${a.role}, expected one of ${roles.join(',')}`);
      }
      return;
    }
    case 'switches_on': {
      const got = r.assignments.filter((a) => a.role === 'SW').map((a) => a.pad);
      if (!sameSet(got, asArr(v)))
        fail(`switch pads ${got.sort().join(',')} != ${asArr(v).sort().join(',')}`);
      return;
    }
    case 'no_warning_at_level':
      for (const lvl of asArr(v)) {
        const bad = r.warnings.filter((w) => w.level === lvl).map((w) => w.code);
        if (bad.length > 0) fail(`warnings at level ${lvl}: ${bad.join(',')}`);
      }
      return;
    case 'no_warning_code':
      for (const c of asArr(v))
        if (r.warnings.some((w) => w.code === c)) fail(`unexpected warning ${c}`);
      return;
    case 'i2c_collision': {
      const per = new Map<number, (number | null)[]>();
      for (const a of d.i2c) per.set(a.bus, [...(per.get(a.bus) ?? []), a.address]);
      const clash = [...per.values()].some((l) =>
        l.some((x) => x === null) && l.length > 1 ? false : new Set(l).size !== l.length,
      );
      if (v === 'none' && (r.status !== 'ok' || clash)) fail('an I2C address collision exists');
      return;
    }
    case 'address_set_on_one_bus_distinct': {
      const per = new Map<number, (number | null)[]>();
      for (const a of d.i2c) per.set(a.bus, [...(per.get(a.bus) ?? []), a.address]);
      for (const [bus, l] of per) {
        const known = l.filter((x): x is number => x !== null);
        if (new Set(known).size !== known.length) fail(`duplicate addresses on bus ${String(bus)}`);
      }
      return;
    }
    case 'max_per_i2c_bus': {
      const part = String(o.part);
      const per = new Map<number, number>();
      for (const a of d.i2c) {
        const m = fx.project.modules.find((x) => x.instance === a.instance);
        if (m && (index.breakout(m.breakout)?.ic ?? '') === part)
          per.set(a.bus, (per.get(a.bus) ?? 0) + 1);
      }
      const most = Math.max(0, ...per.values());
      if (most > Number(o.count))
        fail(`${String(most)} ${part} on one bus, limit ${String(o.count)}`);
      return;
    }
    case 'one_of': {
      const ok = (v as Record<string, unknown>[]).some((opt) => {
        const k = Object.keys(opt).find((x) => x.endsWith('_interface'));
        if (!k) return false;
        const inst = k.slice(0, -'_interface'.length);
        const kind = r.interfaces[inst]?.kind;
        if (kind !== opt[k]) return false;
        if (opt.bus === 'second_i2c_controller') {
          const mine = d.i2c.find((a) => a.instance === inst);
          return mine !== undefined && mine.bus > 0;
        }
        return true;
      });
      if (!ok) fail('none of the one_of alternatives holds');
      return;
    }
    case 'i2c_pair_in': {
      const [sda, scl] = asArr(o.signals);
      const pair = (o.pairs as { sda: string; scl: string }[]).some(
        (p) => p.sda === padOf(r, sda ?? '') && p.scl === padOf(r, scl ?? ''),
      );
      if (!pair)
        fail(`I2C pair ${padOf(r, sda ?? '') ?? '?'}/${padOf(r, scl ?? '') ?? '?'} not allowed`);
      return;
    }
    case 'i2c_max_hz': {
      const hz = d.i2c.map((a) => d.maxHz[a.instance]).filter((x): x is number => x !== undefined);
      const got = hz.length === 0 ? undefined : Math.min(...hz);
      if (got !== Number(v)) fail(`i2c max Hz ${String(got)} != ${String(v)}`);
      return;
    }
    case 'max_hz':
      for (const [inst, hz] of Object.entries(o)) {
        if (d.maxHz[inst] !== Number(hz))
          fail(`max Hz of ${inst} is ${String(d.maxHz[inst])}, expected ${String(hz)}`);
      }
      return;
    case 'locked_pad_unchanged':
      for (const sid of asArr(v)) {
        const lock = fx.project.locked.find((l) => `${l.instance}.${l.role}` === sid);
        if (lock && padOf(r, sid) !== lock.pad) fail(`${sid} moved from ${lock.pad}`);
      }
      return;
    case 'separate_i2c_instances': {
      const inst = asArr(v).map(
        (i) => r.assignments.find((a) => a.instance === i && a.role === 'SDA')?.peripheral_instance,
      );
      if (new Set(inst).size !== inst.length || inst.includes(undefined))
        fail(`I2C instances not separate: ${inst.join(',')}`);
      return;
    }
    case 'all_used': {
      const used = new Set(r.assignments.map((a) => a.pad));
      const missing = asArr(v).filter((p) => !used.has(p));
      if (missing.length > 0) fail(`pads not used: ${missing.join(',')}`);
      return;
    }
    case 'header_label_of_pad':
      for (const [pad, label] of Object.entries(o)) {
        const a = r.assignments.find((x) => x.pad === pad);
        if (!a || a.label !== label)
          fail(`label of ${pad} is ${a?.label ?? 'unassigned'}, expected ${String(label)}`);
      }
      return;
    case 'address_straps_distinct': {
      const insts = asArr(o.instances);
      const got = insts.map((i) => hex(d.i2c.find((a) => a.instance === i)?.address ?? null));
      const want = i2cAddressesOfStraps(fx, insts, asArr(o.values));
      if (new Set(got).size !== got.length || !sameSet(got, want))
        fail(`address straps give ${got.join(',')}, expected ${want.join(',')}`);
      return;
    }
    case 'i2c_addresses_resolved': {
      const got = d.i2c.map((a) => hex(a.address));
      if (
        !sameSet(
          got,
          asArr(o.values).map((x) => hex(Number(x))),
        )
      )
        fail(`addresses ${got.sort().join(',')} != ${asArr(o.values).join(',')}`);
      return;
    }
    case 'i2c_known_address':
      for (const [inst, addr] of Object.entries(o)) {
        const got = hex(d.i2c.find((a) => a.instance === inst)?.address ?? null);
        if (got !== hex(Number(addr)))
          fail(`address of ${inst} is ${got}, expected ${String(addr)}`);
      }
      return;
    case 'pin_current_limit_used_mA':
      if (d.currents.pinMa !== Number(v))
        fail(`pin current limit used ${String(d.currents.pinMa)} mA != ${String(v)}`);
      return;
    case 'port_group_total_mA_limit':
      if (d.currents.portMa !== Number(o.mA))
        fail(`port group limit ${String(d.currents.portMa)} mA != ${String(o.mA)}`);
      // the pad list of the group only exists in the fact's note text (2b ruling 8): not a fixture key
      if (o.pads !== undefined) unchecked('port_group_total_mA_limit pads list (note text only)');
      return;
    case 'cumulative_mA_limit':
      if (d.currents.cumulativeMa !== Number(v))
        fail(`cumulative limit ${String(d.currents.cumulativeMa)} mA != ${String(v)}`);
      return;
    case 'supply_split': {
      const hit = r.required_parts.find((p) => p.role === 'jd-vcc');
      if (!hit) fail('no separate coil supply part (jd-vcc)');
      return;
    }
    case 'required_parts_exclude':
      for (const p of v as { kind: string; role: string }[]) {
        const hit = r.required_parts.find((x) => x.kind === p.kind && x.role === p.role);
        if (hit) fail(`excluded part present: ${p.kind}/${p.role}`);
      }
      return;
    case 'pullup_rp_eff_ohm': {
      const got = r3(d)?.values.rpEffOhm;
      if (got === undefined || Math.abs(got - Number(v)) > 0.5)
        fail(`Rp,eff ${String(got)} != ${String(v)}`);
      return;
    }
    case 'rp_min_ohm_at_3v3': {
      const got = r3(d)?.values.rpMinOhm;
      if (got === undefined || Math.abs(got - Number(v)) > 0.1)
        fail(`Rp,min ${String(got)} != ${String(v)}`);
      return;
    }
    case 'rp_max_ohm':
      for (const [k, want] of Object.entries(o)) {
        const m = /^(\d+)kHz_(\d+)pF$/.exec(k);
        const tier = m
          ? I2C_TR_MAX_BY_SPEED.find((t) => Number(m[1]) * 1000 <= t.fMaxHz)
          : undefined;
        if (!m || !tier) {
          fail(`rp_max_ohm case ${k} not understood`);
          continue;
        }
        const got = rpMaxOhm(tier.trMaxNs, Number(m[2]));
        if (Math.abs(got - Number(want)) > 1) fail(`Rp,max ${k} ${String(got)} != ${String(want)}`);
      }
      return;
    case 'r3_result': {
      const e = r3(d);
      if (v === 'within_range' && !(e?.passed === true))
        fail(`R3 is ${e?.level ?? 'missing'}, not within range`);
      return;
    }
    default:
      unchecked(`property ${key}`);
  }
}

/** Fixture part kinds the schema does not know, mapped onto the nearest schema kind where one exists. */
const SCHEMA_KINDS = [
  'resistor',
  'capacitor',
  'level-shifter',
  'buffer',
  'transistor',
  'diode',
  'regulator',
  'supply',
  'divider',
];

export function runFixture(fx: Fixture): FixtureReport {
  const failures: string[] = [];
  const unchecked: string[] = [];
  const fail = (m: string) => failures.push(m);
  const unk = (m: string) => unchecked.push(m);
  let out: ReturnType<typeof solveDetailed>;
  try {
    out = solveDetailed(index, fx.project);
  } catch (e) {
    return finish(fx.id, [`threw: ${String(e)}`], unchecked);
  }
  const r = out.recommendation;
  const ex = fx.expect;
  if (r.status !== ex.status) fail(`status ${r.status}, expected ${ex.status}`);
  for (const [sid, pad] of Object.entries(ex.exact ?? {})) {
    if (padOf(r, sid) !== pad) fail(`${sid} on ${padOf(r, sid) ?? 'nothing'}, expected ${pad}`);
  }
  for (const w of ex.warnings_include ?? []) {
    const hit = r.warnings.find((x) => x.code === w.code);
    if (!hit) fail(`missing warning ${w.code}`);
    else if (hit.level !== w.level) fail(`warning ${w.code} is ${hit.level}, expected ${w.level}`);
  }
  if (out.details) {
    const run: Run = { r, d: out.details, fx };
    for (const p of ex.properties ?? []) {
      const key = Object.keys(p as object)[0] ?? '';
      checkProperty(run, key, (p as Record<string, unknown>)[key], fail, unk);
    }
  } else if ((ex.properties ?? []).length > 0 && ex.status === 'ok') {
    fail('no solution details to check properties against');
  }
  for (const part of ex.required_parts_include ?? []) {
    const pt = part as { kind: string; role: string; count?: number };
    const kind = pt.kind;
    if (!SCHEMA_KINDS.includes(kind)) {
      unk(`required part kind "${pt.kind}" is outside the schema vocabulary`);
      continue;
    }
    const hit = r.required_parts.find((x) => x.kind === kind && x.role === pt.role);
    if (!hit) fail(`missing required part ${pt.kind}/${pt.role}`);
    else if (pt.count !== undefined && hit.count !== pt.count)
      fail(`part ${pt.kind}/${pt.role} count ${String(hit.count)} != ${String(pt.count)}`);
  }
  for (const t of ex.minimal_conflict_includes ?? []) {
    if (!(r.unsat?.minimal_conflict ?? []).includes(t)) fail(`conflict token ${t} missing`);
  }
  for (const t of ex.relaxations_include ?? []) {
    if (!(r.unsat?.relaxations ?? []).includes(t)) fail(`relaxation ${t} missing`);
  }
  return finish(fx.id, failures, unchecked);
}

function finish(id: string, failures: string[], unchecked: string[]): FixtureReport {
  const disputes = DISPUTES[id] ?? [];
  const isDisputed = (m: string) => disputes.some((d) => d.pattern.test(m));
  const realFail = failures.filter((m) => !isDisputed(m));
  const realUnchecked = unchecked.filter((m) => !isDisputed(m));
  const disputed = [...failures, ...unchecked].filter(isDisputed);
  const state: FixtureState =
    realFail.length > 0
      ? 'fail'
      : realUnchecked.length > 0
        ? 'partial'
        : disputed.length > 0
          ? 'disputed'
          : 'pass';
  return {
    id,
    state,
    pass: state === 'pass',
    failures: realFail,
    disputed,
    unchecked: realUnchecked,
  };
}

describe('golden fixtures (2b.9)', () => {
  const fixtures = loadFixtures();
  const reports = fixtures.map(runFixture);
  const disputesDoc = readFileSync(`${ROOT}docs/validation/phase-2b/fixture-disputes.md`, 'utf8');

  it('loads the 24 fixtures', () => {
    expect(fixtures.length).toBe(24);
  });
  it('prints the per-fixture table', () => {
    const lines = reports.map((x) => {
      const mark = x.state.toUpperCase();
      return `${mark.padEnd(9)}${x.id}${x.failures.length > 0 ? `\n          fail: ${x.failures.join(' | ')}` : ''}${x.disputed.length > 0 ? `\n          disputed: ${x.disputed.join(' | ')}` : ''}${x.unchecked.length > 0 ? `\n          unchecked: ${x.unchecked.join(' | ')}` : ''}`;
    });
    const n = (s: FixtureState) => reports.filter((x) => x.state === s).length;
    console.log(
      `fixtures: ${String(n('pass'))} pass, ${String(n('disputed'))} disputed, ${String(n('fail'))} fail, ${String(n('partial'))} unchecked-keys (of ${String(reports.length)})\n${lines.join('\n')}`,
    );
    expect(reports.length).toBe(fixtures.length);
  });
  // ratchet: no fixture may fail or carry an unchecked key; a disputed one must be documented
  it.each(fixtures.map((f) => f.id))('is pass or documented dispute: %s', (id) => {
    const rep = reports.find((x) => x.id === id);
    expect(rep, id).toBeDefined();
    expect(rep?.failures ?? ['missing']).toEqual([]);
    expect(rep?.unchecked ?? ['missing']).toEqual([]);
    if (rep?.state === 'disputed') expect(disputesDoc).toContain(id);
  });
  it('every disputed pattern still matches something (no stale disputes)', () => {
    for (const [id, list] of Object.entries(DISPUTES)) {
      const rep = reports.find((x) => x.id === id);
      for (const d of list) {
        expect(
          rep?.disputed.some((m) => d.pattern.test(m)) ?? false,
          `${id}: dispute ${String(d.pattern)} no longer matches; remove it`,
        ).toBe(true);
      }
    }
  });
});

/** Claim ids cited by any structured `evidence` array of the catalog (chips, modules, boards, ics, breakouts). */
function citedByCatalog(): Set<string> {
  const out = new Set<string>();
  const walk = (o: unknown, key: string): void => {
    if (Array.isArray(o)) {
      for (const x of o) {
        if (typeof x === 'string' && key === 'evidence') out.add(x);
        else walk(x, key);
      }
    } else if (o !== null && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) walk(v, k);
    }
  };
  walk(realCatalog().catalog, '');
  return out;
}

describe('worked example evidence (DevKitC V4)', () => {
  const fx = loadFixtures().find(
    (f) => f.id === 'devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches',
  );
  const seen = (): Set<string> => {
    if (!fx) return new Set();
    const r = solveDetailed(index, fx.project).recommendation;
    return new Set<string>([
      ...r.assignments.flatMap((a) => a.evidence),
      ...r.warnings.flatMap((w) => w.evidence),
    ]);
  };
  it('every evidence id of the fixture that a catalog fact cites appears in the engine trace', () => {
    expect(fx).toBeDefined();
    const cited = citedByCatalog();
    const trace = seen();
    const missing = (fx?.evidence ?? []).filter((e) => cited.has(e) && !trace.has(e));
    expect(missing).toEqual([]);
  });
  it('every evidence id of the fixture is cited by a catalog fact (2b ruling 9)', () => {
    const cited = citedByCatalog();
    expect((fx?.evidence ?? []).filter((e) => !cited.has(e))).toEqual([]);
  });
});
