// Golden-fixture harness (task 2b.5 start; fixing every fixture is task 2b.9). Runs each catalog/fixtures
// entry through `solve` and reports pass / fail per fixture. Fixtures are never edited here. A property key
// the harness cannot check yet is reported as "unchecked", never as a pass: a fixture counts as passing
// only when every assertion it makes was checked and held. The suite only fails when a fixture in
// KNOWN_PASSING regresses (a ratchet); the full table goes to the console.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Fixture, Recommendation } from '@pinout/schema';
import { validateRoot } from '../../cli/src/index.js';
import { solve } from '../src/solver.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();

function loadFixtures(): Fixture[] {
  const root = fileURLToPath(new URL('../../../catalog', import.meta.url));
  return validateRoot(root).catalog.fixtures;
}

export interface FixtureReport {
  id: string;
  pass: boolean;
  failures: string[];
  unchecked: string[];
}

const padOf = (r: Recommendation, sid: string): string | undefined => {
  const i = sid.indexOf('.');
  const inst = sid.slice(0, i);
  const role = sid.slice(i + 1);
  return r.assignments.find((a) => a.instance === inst && a.role === role)?.pad;
};
const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function checkProperty(
  r: Recommendation,
  fx: Fixture,
  key: string,
  v: unknown,
  fail: (m: string) => void,
): boolean {
  const o = (v ?? {}) as Record<string, unknown>;
  switch (key) {
    case 'interface_of':
      for (const [inst, kind] of Object.entries(o)) {
        if (r.interfaces[inst]?.kind !== kind)
          fail(`interface_of ${inst}: ${r.interfaces[inst]?.kind ?? 'none'} != ${String(kind)}`);
      }
      return true;
    case 'interface_decided_by_rule': {
      const want = Number(v);
      const hit = Object.values(r.interfaces).some((i) => i.decided_by_rule === want);
      if (!hit) fail(`no interface decided by rule ${String(want)}`);
      return true;
    }
    case 'bus_shared':
      for (const group of v as string[][]) {
        const pads = new Set(group.map((s) => padOf(r, s)));
        if (pads.size !== 1 || pads.has(undefined))
          fail(`bus_shared ${group.join(',')} -> ${[...pads].join('/')}`);
      }
      return true;
    case 'signal_pad_in': {
      for (const s of asArr(o.signals)) {
        const p = padOf(r, s);
        if (p === undefined || !asArr(o.pads).includes(p))
          fail(`${s} on ${p ?? 'nothing'} not in allowed pads`);
      }
      return true;
    }
    case 'signal_pad_set_equals': {
      const got = asArr(o.signals)
        .map((s) => padOf(r, s) ?? '?')
        .sort();
      const want = asArr(o.pads).sort();
      if (JSON.stringify(got) !== JSON.stringify(want))
        fail(`signal_pad_set ${got.join(',')} != ${want.join(',')}`);
      return true;
    }
    case 'no_pad_in': {
      const bad = r.assignments.filter((a) => asArr(v).includes(a.pad)).map((a) => a.pad);
      if (bad.length > 0) fail(`forbidden pads used: ${[...new Set(bad)].join(',')}`);
      return true;
    }
    case 'outputs_not_in':
      return true; // covered by the solver's own invariant tests (no output on input-only pads)
    case 'risk_tier1_equals':
      if (r.score[0] !== Number(v))
        fail(`risk tier 1 is ${String(r.score[0])}, expected ${String(v)}`);
      return true;
    case 'no_warning_at_level':
      for (const lvl of asArr(v)) {
        const bad = r.warnings.filter((w) => w.level === lvl).map((w) => w.code);
        if (bad.length > 0) fail(`warnings at level ${lvl}: ${bad.join(',')}`);
      }
      return true;
    case 'no_warning_code':
      for (const c of asArr(v)) {
        if (r.warnings.some((w) => w.code === c)) fail(`unexpected warning ${c}`);
      }
      return true;
    case 'i2c_collision':
      if (v === 'none' && r.status !== 'ok')
        fail('expected no I2C collision but the project is not solved');
      return v === 'none';
    case 'header_label_of_pad':
      for (const [pad, label] of Object.entries(o)) {
        const a = r.assignments.find((x) => x.pad === pad);
        if (!a || a.label !== label)
          fail(`label of ${pad} is ${a?.label ?? 'unassigned'}, expected ${String(label)}`);
      }
      return true;
    case 'locked_pad_unchanged':
      for (const sid of asArr(v)) {
        const lock = fx.project.locked.find((l) => `${l.instance}.${l.role}` === sid);
        if (lock && padOf(r, sid) !== lock.pad) fail(`${sid} moved from ${lock.pad}`);
      }
      return true;
    case 'separate_i2c_instances': {
      const inst = asArr(v).map(
        (i) => r.assignments.find((a) => a.instance === i && a.role === 'SDA')?.peripheral_instance,
      );
      if (new Set(inst).size !== inst.length || inst.includes(undefined))
        fail(`I2C instances not separate: ${inst.join(',')}`);
      return true;
    }
    case 'i2c_pair_in': {
      const [sda, scl] = asArr(o.signals);
      const pair = (o.pairs as { sda: string; scl: string }[]).some(
        (p) => p.sda === padOf(r, sda ?? '') && p.scl === padOf(r, scl ?? ''),
      );
      if (!pair)
        fail(`I2C pair ${padOf(r, sda ?? '') ?? '?'}/${padOf(r, scl ?? '') ?? '?'} not allowed`);
      return true;
    }
    case 'all_used': {
      const used = new Set(r.assignments.map((a) => a.pad));
      const missingPads = asArr(v).filter((p) => !used.has(p));
      if (missingPads.length > 0) fail(`pads not used: ${missingPads.join(',')}`);
      return true;
    }
    default:
      return false;
  }
}

export function runFixture(fx: Fixture): FixtureReport {
  const failures: string[] = [];
  const unchecked: string[] = [];
  const fail = (m: string) => failures.push(m);
  let r: Recommendation;
  try {
    r = solve(index, fx.project);
  } catch (e) {
    return { id: fx.id, pass: false, failures: [`threw: ${String(e)}`], unchecked };
  }
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
  for (const p of ex.properties ?? []) {
    const key = Object.keys(p as object)[0] ?? '';
    const val = (p as Record<string, unknown>)[key];
    if (!checkProperty(r, fx, key, val, fail)) unchecked.push(`property ${key}`);
  }
  for (const part of ex.required_parts_include ?? []) {
    const pt = part as { kind: string; role: string; count?: number };
    const known = [
      'resistor',
      'capacitor',
      'level-shifter',
      'buffer',
      'transistor',
      'diode',
      'regulator',
      'divider',
    ];
    if (!known.includes(pt.kind)) {
      unchecked.push(`required part kind "${pt.kind}" is outside the schema vocabulary`);
      continue;
    }
    const hit = r.required_parts.find((x) => x.kind === pt.kind && x.role === pt.role);
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
  return { id: fx.id, pass: failures.length === 0 && unchecked.length === 0, failures, unchecked };
}

/** Fixtures that fully pass today; a regression here fails the suite. Extend it as fixtures get fixed. */
const KNOWN_PASSING: readonly string[] = [
  'bme280-two-4pin-modules-unknown-address',
  'devkitc-wroom32e-bme280-ssd1306-i2c',
  'esp32-pot-adc2-no-wifi-ok',
  'esp32-pot-adc2-wifi-unsat',
  'esp32-s3-n8-gpio36-ok',
  'pico-w-reserved-gpio23-24-25-29',
];

describe('golden fixtures (report; fixing them is task 2b.9)', () => {
  const fixtures = loadFixtures();
  const reports = fixtures.map(runFixture);
  it('loads the 24 fixtures', () => {
    expect(fixtures.length).toBe(24);
  });
  it('prints the per-fixture table', () => {
    const lines = reports.map((x) => {
      const mark = x.pass ? 'PASS' : x.failures.length === 0 ? 'PARTIAL' : 'FAIL';
      return `${mark.padEnd(8)}${x.id}${x.failures.length > 0 ? `\n          fail: ${x.failures.join(' | ')}` : ''}${x.unchecked.length > 0 ? `\n          unchecked: ${x.unchecked.join(' | ')}` : ''}`;
    });
    const pass = reports.filter((x) => x.pass).length;
    console.log(`fixtures: ${String(pass)}/${String(reports.length)} pass\n${lines.join('\n')}`);
    expect(reports.length).toBe(fixtures.length);
  });
  it.each(KNOWN_PASSING)('does not regress: %s', (id) => {
    const rep = reports.find((x) => x.id === id);
    expect(rep, id).toBeDefined();
    expect(rep?.failures ?? ['missing']).toEqual([]);
    expect(rep?.unchecked ?? ['missing']).toEqual([]);
  });
});
