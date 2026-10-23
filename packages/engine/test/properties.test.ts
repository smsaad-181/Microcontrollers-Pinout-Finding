// Property tests (task 2b.8). Random projects on the six MVP boards, modules drawn from the real catalog.
// Seed: FC_SEED (default fixed, so CI is reproducible); runs per property: FC_RUNS (default 1000).
// Re-run a failure with `FC_SEED=<seed> pnpm --filter @pinout/engine test properties`.
import { afterAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Project, Recommendation } from '@pinout/schema';
import { indexCatalog, type Catalog, type CatalogIndex } from '../src/catalog.js';
import { composePinView, type ComposedPin, type ComposedView } from '../src/compose.js';
import { expandSignals, type ExpandedSignal } from '../src/signals.js';
import { solveDetailed, type SolveOutcome } from '../src/solver.js';
import { allMembers, analyzeUnsat, subproject } from '../src/unsat.js';
import { normRole } from '../src/wiring.js';
import { bruteForceMinimum } from './bruteforce.js';
import { realCatalog } from './helpers.js';

const { catalog, index } = realCatalog();
/** Indexed read that fails loudly (generators only produce valid indices). */
const at = <T>(xs: readonly T[], i: number): T => {
  const v = xs[i];
  if (v === undefined) throw new Error(`index ${String(i)} out of range`);
  return v;
};
const SEED = Number(process.env.FC_SEED ?? 20260601);
const RUNS = Number(process.env.FC_RUNS ?? 1000);
const params = { numRuns: RUNS, seed: SEED };
const SLOW = 15 * 60_000;

// ---------- scenario generator ----------

const BOARDS = catalog.boards.flatMap((b) =>
  b.variants.map((v) => ({ ref: `${b.id}@${b.revision}`, variant: v.id })),
);
const BREAKOUTS = catalog.breakouts.map((b) => b.id).sort();
const KINDS = new Map(catalog.breakouts.map((b) => [b.id, [...b.interfaces_exposed] as string[]]));

const viewCache = new Map<string, ComposedView>();
function viewOf(ref: string, variant: string): ComposedView {
  const k = `${ref}/${variant}`;
  let v = viewCache.get(k);
  if (!v) {
    const r = composePinView(index, ref, variant);
    if (r.status !== 'ok') throw new Error(`compose ${k}`);
    v = r.view;
    viewCache.set(k, v);
  }
  return v;
}

/** Seeds only; `build` is a pure function of them, so fast-check shrinks the seeds. */
interface Scenario {
  board: number;
  wifi: boolean;
  modules: { breakout: number; override: number }[];
  reserved: number[];
  lockPicks: { pick: number; pad: number; keep: boolean }[];
}

const scenarioArb = (maxModules: number): fc.Arbitrary<Scenario> =>
  fc.record({
    board: fc.nat(BOARDS.length - 1),
    wifi: fc.boolean(),
    modules: fc.array(
      fc.record({
        breakout: fc.nat(BREAKOUTS.length - 1),
        // 0 = no override (weighted), 4..7 = the (n-4)th exposed interface of the breakout
        override: fc.oneof(
          { weight: 4, arbitrary: fc.constant(0) },
          { weight: 1, arbitrary: fc.integer({ min: 4, max: 7 }) },
        ),
      }),
      { maxLength: maxModules },
    ),
    reserved: fc.array(fc.nat(255), { maxLength: 3 }),
    lockPicks: fc.array(fc.record({ pick: fc.nat(63), pad: fc.nat(255), keep: fc.boolean() }), {
      maxLength: 2,
    }),
  });

const padsOf = (view: ComposedView): string[] => [
  ...new Set(view.pins.flatMap((p) => (p.pad === undefined ? [] : [p.pad]))),
];

const solveCache = new Map<string, SolveOutcome>();
function solveCached(p: Project): SolveOutcome {
  const k = JSON.stringify(p);
  let r = solveCache.get(k);
  if (!r) {
    r = solveDetailed(index, p);
    solveCache.set(k, r);
  }
  return r;
}

function signalsOf(project: Project, rec: Recommendation): ExpandedSignal[] {
  const kinds: Record<string, never> = {};
  for (const [k, v] of Object.entries(rec.interfaces)) kinds[k] = v.kind as never;
  const ex = expandSignals(index, project, kinds);
  return ex.status === 'ok' ? ex.signals : [];
}

function build(s: Scenario): Project {
  const b = at(BOARDS, s.board);
  const view = viewOf(b.ref, b.variant);
  const pads = padsOf(view);
  const modules = s.modules.map((m, i) => {
    const breakout = at(BREAKOUTS, m.breakout);
    const out: Project['modules'][number] = { breakout, instance: `m${String(i + 1)}` };
    const kinds = KINDS.get(breakout) ?? [];
    if (m.override >= 4 && kinds.length > 0) {
      out.interface = kinds[(m.override - 4) % kinds.length] as never;
    }
    return out;
  });
  const reserved = [...new Set(s.reserved.map((n) => at(pads, n % pads.length)))];
  const project: Project = {
    board: b.ref,
    variant: b.variant,
    wifi: s.wifi,
    modules,
    locked: [],
    reserved,
  };
  // Locks: take signals of the unlocked project; keep the solver's pad or move to a random one.
  const base = solveCached(project);
  if (base.recommendation.status !== 'ok' || s.lockPicks.length === 0) return project;
  const sigs = signalsOf(project, base.recommendation);
  if (sigs.length === 0) return project;
  const locked: Project['locked'] = [];
  const taken = new Set<string>();
  for (const lp of s.lockPicks) {
    const sig = at(sigs, lp.pick % sigs.length);
    const role = sig.id.slice(sig.instance.length + 1);
    if (taken.has(sig.id)) continue;
    taken.add(sig.id);
    const asg = base.recommendation.assignments.find(
      (a) => a.instance === sig.instance && a.role === role,
    );
    const pad = lp.keep && asg ? asg.pad : at(pads, lp.pad % pads.length);
    locked.push({ instance: sig.instance, role, pad });
  }
  const lockPads = new Set(locked.map((l) => l.pad));
  return { ...project, locked, reserved: reserved.filter((p) => !lockPads.has(p)) };
}

/** Locks whose signal exists under the interfaces the solver chose. */
function liveLocks(project: Project, signals: readonly ExpandedSignal[]): Project['locked'] {
  const ids = new Set(signals.map((s) => s.id));
  return project.locked.filter((l) => ids.has(`${l.instance}.${l.role}`));
}

// ---------- hard-constraint checker (independent of the solver internals) ----------

const BUS = new Set(['SDA', 'SCL', 'SCK', 'MOSI', 'MISO']);
const pinsByPad = (view: ComposedView): Map<string, ComposedPin> => {
  const m = new Map<string, ComposedPin>();
  for (const p of view.pins) if (p.pad !== undefined && !m.has(p.pad)) m.set(p.pad, p);
  return m;
};

/** Violations of the hard constraints for an `ok` outcome (empty = fine). */
function violations(project: Project, out: SolveOutcome): string[] {
  const rec = out.recommendation;
  const v: string[] = [];
  const view = viewOf(project.board, project.variant);
  const byPad = pinsByPad(view);
  const signals = signalsOf(project, rec);
  const roleOf = (s: ExpandedSignal): string => s.id.slice(s.instance.length + 1);

  // (1) exclusive pads: a pad serves one net; bus lines of one peripheral instance are one net.
  const nets = new Map<string, Set<string>>();
  for (const a of rec.assignments) {
    const role = normRole(a.role);
    const net =
      BUS.has(role) && a.peripheral_instance !== undefined
        ? `${a.peripheral_instance}.${role}`
        : `${a.instance}.${a.role}`;
    let set = nets.get(a.pad);
    if (!set) nets.set(a.pad, (set = new Set()));
    set.add(net);
  }
  for (const [pad, n] of nets) if (n.size > 1) v.push(`pad ${pad} shared by ${[...n].join(',')}`);
  // every signal is placed exactly once
  // (interrupt outputs are optional wiring: placed only when locked)
  const locked = new Set(project.locked.map((l) => `${l.instance}.${l.role}`));
  for (const s of signals) {
    if (s.peripheral === 'GPIO.IRQ' && !locked.has(s.id)) continue;
    const n = rec.assignments.filter((a) => a.instance === s.instance && a.role === roleOf(s));
    if (n.length !== 1) v.push(`signal ${s.id} assigned ${String(n.length)} times`);
  }

  // (2) consumed / unavailable / reserved pads never used
  const reserved = new Set(project.reserved);
  for (const a of rec.assignments) {
    const pin = byPad.get(a.pad);
    if (!pin) v.push(`${a.pad} is not a pad of the board`);
    else if (!pin.usable) v.push(`${a.pad} unusable (${pin.unusableReason ?? '?'}) but assigned`);
    if (reserved.has(a.pad)) v.push(`${a.pad} reserved but assigned to ${a.instance}.${a.role}`);
  }

  // (3) locked pads unmoved
  for (const l of liveLocks(project, signals)) {
    const a = rec.assignments.find((x) => x.instance === l.instance && x.role === l.role);
    if (a?.pad !== l.pad) v.push(`lock ${l.instance}.${l.role}=${l.pad} moved to ${a?.pad ?? '-'}`);
  }

  // (4) I2C addresses unique per bus
  const seen = new Map<string, string>();
  for (const d of out.details?.i2c ?? []) {
    if (d.address === null) continue;
    const k = `${String(d.bus)}:${String(d.address)}`;
    const prev = seen.get(k);
    if (prev !== undefined) v.push(`I2C address ${k} used by ${prev} and ${d.instance}`);
    seen.set(k, d.instance);
  }

  // (5) ADC signals sit on ADC pads and avoid the Wi-Fi conflict; (6) input-only pads never drive outputs
  for (const s of signals) {
    const a = rec.assignments.find((x) => x.instance === s.instance && x.role === roleOf(s));
    const pin = a ? byPad.get(a.pad) : undefined;
    if (!a || !pin) continue;
    if (s.peripheral === 'ADC') {
      if (!pin.adc) v.push(`${s.id} on ${a.pad} which has no ADC channel`);
      else if (project.wifi === true && pin.adc.radioConflict.value === true)
        v.push(`${s.id} on ${a.pad} (${pin.adc.unit}) conflicts with Wi-Fi`);
    }
    if ((s.dir === 'out' || s.dir === 'io') && pin.inputOnly.value === true)
      v.push(`${s.id} drives ${a.pad} which is input-only`);
  }

  // (7) SPI clock <= the carries limit of the chosen SCK pad
  for (const a of rec.assignments) {
    if (normRole(a.role) !== 'SCK' || a.peripheral_instance?.startsWith('SPI') !== true) continue;
    const pin = byPad.get(a.pad);
    const hz = out.details?.maxHz[a.instance];
    if (!pin || hz === undefined) continue;
    for (const c of pin.carries) {
      const lim = c.maxHz?.value;
      if (
        c.peripheral === a.peripheral_instance &&
        c.routing === a.routing &&
        (c.role === 'sck' || c.role === '*') &&
        lim !== null &&
        lim !== undefined &&
        hz > lim
      )
        v.push(`${a.instance} SPI clock ${String(hz)} > carries ${String(lim)} on ${a.pad}`);
    }
  }
  return v;
}

// ---------- shuffled catalog ----------

function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const a = [...xs];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}
const shuffledIndex = (seed: number): CatalogIndex => {
  const c: Catalog = {
    chips: shuffled(catalog.chips, seed),
    modules: shuffled(catalog.modules, seed + 1),
    boards: shuffled(catalog.boards, seed + 2),
    ics: shuffled(catalog.ics, seed + 3),
    breakouts: shuffled(catalog.breakouts, seed + 4),
  };
  return indexCatalog(c);
};

// ---------- properties ----------

const stats = { runs: 0, ok: 0, unsat: 0, other: 0, locked: 0, brute: 0, irreducible: 0 };
const scenarios = scenarioArb(4);
const unsatArb = scenarioArb(4);
const solveFn = (q: Project, o: Parameters<typeof solveDetailed>[2]): SolveOutcome =>
  solveDetailed(index, q, o);

describe('solver properties (fast-check)', () => {
  afterAll(() => {
    console.info(
      `[properties] seed=${String(SEED)} runs=${String(RUNS)} stats=${JSON.stringify(stats)}`,
    );
  });

  it(
    '(a) every ok solution satisfies all hard constraints',
    () => {
      fc.assert(
        fc.property(scenarios, (s) => {
          const p = build(s);
          const out = solveCached(p);
          stats.runs++;
          if (out.recommendation.status === 'ok') {
            stats.ok++;
            if (p.locked.length > 0) stats.locked++;
            expect(violations(p, out)).toEqual([]);
          } else if (out.recommendation.status === 'unsat') stats.unsat++;
          else stats.other++;
        }),
        params,
      );
      expect(stats.ok).toBeGreaterThan(RUNS / 4);
    },
    SLOW,
  );

  it(
    '(e) locked pins never move',
    () => {
      fc.assert(
        fc.property(scenarios, (s) => {
          const p = build(s);
          if (p.locked.length === 0) return;
          const out = solveCached(p);
          if (out.recommendation.status !== 'ok') return;
          for (const l of liveLocks(p, signalsOf(p, out.recommendation))) {
            const hits = out.recommendation.assignments.filter(
              (a) => a.instance === l.instance && a.role === l.role,
            );
            expect(
              hits.map((h) => h.pad),
              JSON.stringify(p),
            ).toEqual([l.pad]);
          }
        }),
        params,
      );
    },
    SLOW,
  );

  it(
    '(d) determinism: same input gives identical JSON, also with a shuffled catalog',
    () => {
      fc.assert(
        fc.property(scenarios, fc.integer({ min: 1, max: 2 ** 30 }), (s, seed) => {
          const p = build(s);
          const a = JSON.stringify(solveCached(p));
          expect(JSON.stringify(solveDetailed(index, p))).toBe(a);
          expect(JSON.stringify(solveDetailed(shuffledIndex(seed), p))).toBe(a);
        }),
        params,
      );
    },
    SLOW,
  );

  it(
    '(b) unsat is confirmed by brute force over the members (small instances)',
    () => {
      fc.assert(
        fc.property(unsatArb, (s) => {
          const p = build(s);
          const out = solveCached(p);
          if (out.recommendation.status !== 'unsat' || out.stats.budgetExhausted) return;
          const members = allMembers(p);
          if (members.length > 9) return;
          stats.brute++;
          const isUnsat = (sub: readonly (typeof members)[number][]): boolean =>
            solveCached(subproject(p, sub)).recommendation.status !== 'ok';
          const min = bruteForceMinimum(members, isUnsat);
          // The full member set is unsat, so a minimum exists and its size bounds the reported set.
          expect(min).not.toBeNull();
          const reported = analyzeUnsat(index, p, solveFn, {});
          expect(reported.members.length).toBeGreaterThanOrEqual(min?.size ?? 0);
          expect(out.recommendation.unsat?.minimal_conflict.length).toBeGreaterThan(0);
        }),
        params,
      );
      expect(stats.brute).toBeGreaterThanOrEqual(1);
    },
    SLOW,
  );

  it(
    '(c) the conflict set is irreducible: unsat as a whole, satisfiable without any one member',
    () => {
      fc.assert(
        fc.property(unsatArb, (s) => {
          const p = build(s);
          const out = solveCached(p);
          if (out.recommendation.status !== 'unsat' || out.stats.budgetExhausted) return;
          stats.irreducible++;
          const a = analyzeUnsat(index, p, solveFn, {});
          expect(solveCached(subproject(p, a.members)).recommendation.status).not.toBe('ok');
          for (let i = 0; i < a.members.length; i++) {
            const rest = a.members.filter((_, j) => j !== i);
            expect(solveCached(subproject(p, rest)).recommendation.status).toBe('ok');
          }
        }),
        params,
      );
    },
    SLOW,
  );
});

describe('user locks are never dropped silently', () => {
  // Two modules share one I2C bus (one SCL net); locking their SCL lines to different pads is contradictory.
  it('contradictory locks on one shared bus line give unsat naming both locks', () => {
    const p: Project = {
      board: 'esp32-devkitc-v4@V4',
      variant: 'esp32-devkitc-32e',
      wifi: false,
      modules: [
        { breakout: 'adafruit-bme280', instance: 'm1' },
        { breakout: 'adafruit-bme280', instance: 'm2' },
      ],
      locked: [
        { instance: 'm1', role: 'SCL', pad: 'GPIO17' },
        { instance: 'm2', role: 'SCL', pad: 'GPIO16' },
      ],
      reserved: [],
    };
    const rec = solveDetailed(index, p).recommendation;
    expect(rec.status).toBe('unsat');
    const mc = rec.unsat?.minimal_conflict ?? [];
    expect(mc).toContain('locked:m1.SCL=GPIO17');
    expect(mc).toContain('locked:m2.SCL=GPIO16');
  });

  // A lock on an I2C signal that would force a fallback to SPI is reported (unsat), not dropped.
  it('a lock that matches no signal of the chosen interface is not dropped silently', () => {
    const p: Project = {
      board: 'esp32-s3-devkitc-1@V1.1',
      variant: 'esp32-s3-devkitc-1-n8',
      wifi: false,
      modules: [{ breakout: 'adafruit-bme280', instance: 'm1' }],
      locked: [{ instance: 'm1', role: 'SDA', pad: 'GPIO43' }],
      reserved: [],
    };
    const rec = solveDetailed(index, p).recommendation;
    const kept = rec.assignments.some(
      (a) => a.instance === 'm1' && a.role === 'SDA' && a.pad === 'GPIO43',
    );
    expect(rec.status === 'unsat' || kept).toBe(true);
    if (rec.status === 'unsat')
      expect(rec.unsat?.minimal_conflict.some((t) => t.startsWith('locked:m1.SDA'))).toBe(true);
  });
});

// ---------- independent oracle: potentiometer counting ----------
// Satisfiable iff the pots can be matched to distinct usable, non-reserved ADC pads (bipartite matching).
// It does not reuse the solver, so it confirms unsat (and ok) verdicts from first principles.

function matchable(candidates: string[][]): boolean {
  const owner = new Map<string, number>();
  const tryAssign = (i: number, seen: Set<string>): boolean => {
    for (const pad of at(candidates, i)) {
      if (seen.has(pad)) continue;
      seen.add(pad);
      const o = owner.get(pad);
      if (o === undefined || tryAssign(o, seen)) {
        owner.set(pad, i);
        return true;
      }
    }
    return false;
  };
  return candidates.every((_, i) => tryAssign(i, new Set()));
}

describe('independent oracle (potentiometers need distinct ADC pads)', () => {
  const potArb = fc.record({
    board: fc.nat(BOARDS.length - 1),
    wifi: fc.boolean(),
    pots: fc.integer({ min: 1, max: 9 }),
    reserved: fc.array(fc.nat(255), { maxLength: 6 }),
  });
  it(
    'ok iff the pots match distinct usable, non-reserved ADC pads',
    () => {
      fc.assert(
        fc.property(potArb, (s) => {
          const b = at(BOARDS, s.board);
          const view = viewOf(b.ref, b.variant);
          const pads = padsOf(view);
          const reserved = [...new Set(s.reserved.map((n) => at(pads, n % pads.length)))];
          const p: Project = {
            board: b.ref,
            variant: b.variant,
            wifi: s.wifi,
            modules: Array.from({ length: s.pots }, (_, i) => ({
              breakout: 'potentiometer-10k',
              instance: `pot${String(i + 1)}`,
            })),
            locked: [],
            reserved,
          };
          const adc = [...pinsByPad(view).values()]
            .filter(
              (x) =>
                x.usable &&
                x.adc !== undefined &&
                !reserved.includes(x.pad ?? '') &&
                !(s.wifi && x.adc.radioConflict.value === true),
            )
            .map((x) => x.pad ?? '');
          const expectOk = matchable(Array.from({ length: s.pots }, () => adc));
          expect(solveCached(p).recommendation.status).toBe(expectOk ? 'ok' : 'unsat');
        }),
        params,
      );
    },
    SLOW,
  );
});
