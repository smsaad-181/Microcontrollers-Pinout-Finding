// CSP solver (task 2b.5) and explanation traces (task 2b.7).
//
// Model: variables are NETS (a bus line shared by several modules is one net; every other signal is its
// own net), values are pads. Hard constraints: all-different pads, locked pads fixed, pad capability
// (function, direction, ADC unit vs radio), per-peripheral-instance bus grouping (one instance per bus,
// distinct instances for distinct buses), R6 "blocked" strap pads, reserved and consumed pads. I2C address
// uniqueness is decided before the search (it fixes the bus count). The outer loop iterates the interface
// branches of `enumerateBranches`; the first branch (best first) that has a solution wins.
// Search: backtracking + forward checking + MRV, branch and bound on the lexicographic cost (tier 1 first).
// Determinism: candidates are ordered by (cost, connector, position); the first complete solution of a
// given cost wins; the node budget counts search nodes, not time. A wall-clock guard only exists when the
// caller injects `options.now` (this package never reads a clock).
import type { RuleId } from '@pinout/rules';
import type { Recommendation, Project } from '@pinout/schema';
import { minAssignment, scalarCost } from './assignment.js';
import {
  addCost,
  assess,
  compareCost,
  type AssessContext,
  type Assessment,
  type Cost,
  type PartItem,
  type WarnItem,
} from './assess.js';
import { prov, sortedUnique, type CatalogIndex, type InterfaceKind } from './catalog.js';
import {
  composePinView,
  type CarryOption,
  type ComposedPin,
  type ComposedView,
} from './compose.js';
import {
  assignI2c,
  enumerateBranches,
  resolveAddress,
  selectInterfaces,
  type InterfaceBranch,
  type InterfaceSelection,
} from './interfaces.js';
import { moduleChecks } from './modulechecks.js';
import { expandSignals, type ExpandedSignal } from './signals.js';
import { analyzeUnsat } from './unsat.js';
import { normRole } from './wiring.js';

export const RULESET_VERSION = 'r1-r8@2b';
export const DEFAULT_MAX_NODES = 200_000;
export const DEFAULT_TIME_LIMIT_MS = 2000;
export const DEFAULT_BRANCH_LIMIT = 16;

export interface SolveOptions {
  /** Search-node budget across all branches (deterministic). */
  maxNodes?: number;
  /** Interface branches tried at most. */
  branchLimit?: number;
  /** Injected clock in ms (e.g. performance.now). Without it no wall-clock cap applies. */
  now?: () => number;
  /** Secondary wall-clock cap (needs `now`). Default 2000 ms. */
  timeLimitMs?: number;
  /** Rules treated as removed (rule-disable gate). */
  disabledRules?: readonly RuleId[];
  /**
   * Model an I2C multiplexer (8 channels, one set of MCU pads): addresses must be unique per channel
   * only. Used to verify the `add-i2c-multiplexer` relaxation; leave unset for a normal solve.
   */
  i2cMux?: boolean;
  catalogVersion?: string;
  catalogSha256?: string;
}

export interface SolveStats {
  nodes: number;
  branchesTried: number;
  budgetExhausted: boolean;
}

/** Numbers behind a solution that the Recommendation schema has no field for (golden fixtures, tests, UI). */
export interface SolveDetails {
  /** I2C placement: address, bus, status and the strap text per instance. */
  i2c: { instance: string; address: number | null; bus: number; status: string }[];
  /** Module- and bus-level rule results (scope = `inst:direction`, `i2c<n>`, `rail:<name>`). */
  moduleRules: {
    scope: string;
    rule: string;
    level: string;
    passed: boolean;
    values: Record<string, number>;
  }[];
  /** Clock ceiling per instance: min(device maximum, routing limit of the chosen pad). */
  maxHz: Record<string, number>;
  /** Current limits that applied to the loads (active reading when the pin figure is in conflict). */
  currents: { pinMa: number | null; portMa: number | null; cumulativeMa: number | null };
}

export interface SolveOutcome {
  recommendation: Recommendation;
  stats: SolveStats;
  /** Present when the status is ok. */
  details?: SolveDetails;
}

// ---------- model ----------

type BusKind = 'i2c' | 'spi' | 'uart';
type Routing = 'iomux' | 'matrix' | 'fixed';

interface Net {
  id: string;
  members: ExpandedSignal[];
  /** Bus group id (`i2c0`, `spi`, `uart:<instance>`), null for a plain pin. */
  group: string | null;
  busKind: BusKind | null;
  /** Lower-case role on the peripheral (sda, sck, tx ...), null for a plain pin. */
  role: string | null;
  kind: 'adc' | 'gpio' | 'bus';
  needsOutput: boolean;
  lockedPad: string | undefined;
  lockConflict: boolean;
}

interface Cand {
  pin: ComposedPin;
  pad: string;
  routing: Routing | null;
  instance: string | null;
  carryMaxHz: number | null;
  carryEvidence: string[];
  a: Assessment;
}

interface Exclusion {
  pad: string;
  /** False when the pad could not have served this net anyway (e.g. a consumed pad without an ADC). */
  rel: boolean;
  /** Conflict-set token for this exclusion, e.g. `adc2-wifi:GPIO25`; null when it is not a conflict cause. */
  token: string | null;
  why: string;
  /** Claim ids behind the exclusion. */
  evidence: string[];
}

interface NetDomain {
  cands: Cand[];
  excluded: Exclusion[];
}

interface Group {
  id: string;
  kind: BusKind;
  options: string[];
}

const MUX_CHANNELS = 8;

/**
 * Conflict tokens of an I2C address/controller shortage:
 * `i2c-address:<breakout>:<n>-devices-vs-<m>-addresses` (m = distinct addresses x controllers) and
 * `i2c-controllers:<chip>:<count>`. Mixed breakouts fall back to the instance list.
 */
function i2cConflictTokens(
  ctx: Pick<Ctx, 'project' | 'view'>,
  instances: readonly string[],
  optionsOf: (instance: string) => number[],
  controllers: number,
): string[] {
  const breakouts = new Set(
    instances.flatMap((i) =>
      ctx.project.modules.filter((m) => m.instance === i).map((m) => m.breakout),
    ),
  );
  const only = breakouts.size === 1 ? [...breakouts][0] : undefined;
  const addrs = new Set(instances.flatMap((i) => optionsOf(i))).size;
  return [
    only !== undefined && addrs > 0
      ? `i2c-address:${only}:${String(instances.length)}-devices-vs-${String(addrs * controllers)}-addresses`
      : `i2c-address:${[...instances].sort(cmp).join(',')}`,
    `i2c-controllers:${ctx.view.variant.chip}:${String(controllers)}`,
  ];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const pinOrder = (a: ComposedPin, b: ComposedPin): number =>
  cmp(a.connector, b.connector) || a.position - b.position;

const roleOf = (s: ExpandedSignal): string | null => {
  const dot = s.peripheral.indexOf('.');
  return dot < 0 || s.peripheral === 'GPIO.IRQ' ? null : s.peripheral.slice(dot + 1).toLowerCase();
};

function carryFor(pin: ComposedPin, instance: string, role: string): CarryOption | undefined {
  const exact = pin.carries.filter((c) => c.peripheral === instance && c.role === role);
  const exactBest = exact.find((c) => c.routing !== 'matrix') ?? exact[0];
  if (exactBest) return exactBest;
  return pin.carries.find((c) => c.peripheral === instance && c.role === '*');
}

/** Primary connector pin per pad (a pad shared by alias pins keeps the primary, then the lowest position). */
function padPins(view: ComposedView): ComposedPin[] {
  const best = new Map<string, ComposedPin>();
  for (const p of [...view.pins].sort(pinOrder)) {
    if (p.pad === undefined) continue;
    const cur = best.get(p.pad);
    if (!cur || (cur.aliasOf !== undefined && p.aliasOf === undefined)) best.set(p.pad, p);
  }
  return [...best.values()];
}

// ---------- solving one interface branch ----------

interface Ctx {
  index: CatalogIndex;
  project: Project;
  view: ComposedView;
  ac: AssessContext;
  pins: ComposedPin[];
  selection: InterfaceSelection;
  chipPeripherals: [string, { kind: string; matrix: boolean; iomux: boolean }][];
  usbUarts: Set<string>;
  /** Pads of the UART the board wires to its USB bridge: the console link, never a free pin. */
  usbPads: Set<string>;
  /** Claim ids of the onboard parts that tie those pads up. */
  usbEvidence: string[];
  budget: Budget;
  i2cMux: boolean;
  /** ADC pads of the chip that the board uses internally and does not route to a header (e.g. Pico W GPIO29). */
  hiddenAdc: string[];
}

class Budget {
  nodes = 0;
  exhausted = false;
  private tick = 0;
  constructor(
    readonly maxNodes: number,
    private readonly now: (() => number) | undefined,
    private readonly limitMs: number,
  ) {
    this.start = now?.() ?? 0;
  }
  private readonly start: number;
  /** Count one node; false when the budget is spent. */
  step(): boolean {
    if (this.exhausted) return false;
    this.nodes++;
    if (this.nodes > this.maxNodes) {
      this.exhausted = true;
      return false;
    }
    if (this.now && ++this.tick % 256 === 0 && this.now() - this.start > this.limitMs) {
      this.exhausted = true;
      return false;
    }
    return true;
  }
}

interface Solution {
  cost: Cost;
  pick: Map<string, Cand>;
  groupInstance: Map<string, string>;
}

interface BranchResult {
  solution: Solution | null;
  nets: Net[];
  domains: Map<string, NetDomain>;
  groups: Group[];
  signals: ExpandedSignal[];
  addresses: ReturnType<typeof assignI2c>;
  /** Failure information when there is no solution. */
  failure?: { tokens: string[]; nets: string[]; reason: string };
}

function buildNets(
  signals: readonly ExpandedSignal[],
  busOf: (instance: string) => number,
  project: Project,
): { nets: Net[]; groups: Map<string, BusKind> } {
  const nets = new Map<string, Net>();
  const groups = new Map<string, BusKind>();
  for (const s of signals) {
    // An interrupt output (IRQ/INT/ALERT) is optional wiring: it gets a pad only when the user locks one
    // (the worked example leaves the RC522 IRQ unconnected).
    if (s.peripheral === 'GPIO.IRQ' && s.lockedPad === undefined) continue;
    let id = s.id;
    let group: string | null = null;
    let busKind: BusKind | null = null;
    const role = roleOf(s);
    if (s.shareable === 'bus' && s.interface === 'i2c') {
      group = `i2c${String(busOf(s.instance))}`;
      busKind = 'i2c';
      id = `${group}.${normRole(s.role)}`;
    } else if (s.shareable === 'bus' && s.interface === 'spi') {
      group = 'spi';
      busKind = 'spi';
      id = `spi.${normRole(s.role)}`;
    } else if (s.peripheral === 'UART.TX' || s.peripheral === 'UART.RX') {
      group = `uart:${s.instance}`;
      busKind = 'uart';
    }
    if (group !== null && busKind !== null) groups.set(group, busKind);
    let n = nets.get(id);
    if (!n) {
      n = {
        id,
        members: [],
        group,
        busKind,
        role: busKind === null ? null : role,
        kind: s.peripheral === 'ADC' ? 'adc' : busKind === null ? 'gpio' : 'bus',
        needsOutput: false,
        lockedPad: undefined,
        lockConflict: false,
      };
      nets.set(id, n);
    }
    n.members.push(s);
    if (s.dir !== 'in') n.needsOutput = true;
    if (s.lockedPad !== undefined && project.allow_reassign !== true) {
      if (n.lockedPad !== undefined && n.lockedPad !== s.lockedPad) n.lockConflict = true;
      n.lockedPad = s.lockedPad;
    }
  }
  return { nets: [...nets.values()], groups };
}

function groupOptions(ctx: Ctx, kind: BusKind): string[] {
  return ctx.chipPeripherals
    .filter(([name, p]) => p.kind === kind && !(kind === 'uart' && ctx.usbUarts.has(name)))
    .map(([name]) => name)
    .sort(cmp);
}

/** Two peripheral instances are interchangeable when they carry no dedicated pads and are both matrix-routed. */
function equivalent(ctx: Ctx, a: string, b: string): boolean {
  const pa = ctx.chipPeripherals.find(([n]) => n === a)?.[1];
  const pb = ctx.chipPeripherals.find(([n]) => n === b)?.[1];
  return !!pa && !!pb && pa.kind === pb.kind && !pa.iomux && !pb.iomux && pa.matrix === pb.matrix;
}

function domainFor(
  ctx: Ctx,
  net: Net,
  instance: string | null,
  reservedPads: ReadonlySet<string>,
  lockedElsewhere: ReadonlyMap<string, string>,
): NetDomain {
  const cands: Cand[] = [];
  const excluded: Exclusion[] = [];
  const wifi = ctx.project.wifi === true;
  for (const pin of ctx.pins) {
    const pad = pin.pad ?? '';
    if (net.lockConflict || (net.lockedPad !== undefined && net.lockedPad !== pad)) continue;
    const rel = net.kind !== 'adc' || pin.adc !== undefined;
    const ex = (token: string | null, why: string, evidence: readonly string[] = []) => {
      excluded.push({ pad, rel, token, why, evidence: [...evidence] });
    };
    if (!pin.usable) {
      ex(
        pin.unusableReason === 'consumed' ? `consumed:${pad}` : null,
        `${pad} is ${pin.unusableReason === 'consumed' ? 'used inside the module' : 'not available'}`,
        pin.consumed?.by.evidence ?? [],
      );
      continue;
    }
    if (reservedPads.has(pad)) {
      ex(`reserved:${pad}`, `${pad} is reserved by the project`);
      continue;
    }
    if (ctx.usbPads.has(pad)) {
      ex(`consumed:${pad}`, `${pad} is wired to the USB-UART bridge`, ctx.usbEvidence);
      continue;
    }
    const other = lockedElsewhere.get(pad);
    if (other !== undefined && other !== net.id) {
      ex(null, `${pad} is locked to ${other}`);
      continue;
    }
    // function
    let routing: Routing | null = null;
    let carryMaxHz: number | null = null;
    let carryEvidence: string[] = [];
    if (net.kind === 'adc') {
      if (!pin.adc) {
        ex(null, `${pad} has no ADC`);
        continue;
      }
      if (wifi && pin.adc.radioConflict.value === true) {
        ex(
          `adc2-wifi:${pad}`,
          `${pad} is on ${pin.adc.unit}, which the radio uses while Wi-Fi is on`,
        );
        continue;
      }
      routing = 'fixed';
    } else if (net.busKind !== null && instance !== null && net.role !== null) {
      const c = carryFor(pin, instance, net.role);
      if (!c) {
        ex(null, `${pad} cannot carry ${instance}.${net.role}`);
        continue;
      }
      routing = c.routing;
      carryMaxHz = c.maxHz?.value ?? null;
      carryEvidence = c.maxHz?.evidence ?? [];
    } else if (!pin.functions.some((f) => f.fn === 'GPIO')) {
      ex(null, `${pad} has no GPIO function`);
      continue;
    }
    if (net.needsOutput && pin.inputOnly.value === true) {
      ex(`input-only:${pad}`, `${pad} is input-only but ${net.id} needs an output`);
      continue;
    }
    const a = assess(ctx.ac, net.members, pin, routing, net.busKind);
    if (a.blocked !== undefined) {
      ex(a.blocked, `${pad} would change boot mode or flash voltage (R6)`);
      continue;
    }
    cands.push({ pin, pad, routing, instance, carryMaxHz, carryEvidence, a });
  }
  cands.sort((x, y) => compareCost(x.a.cost, y.a.cost) || pinOrder(x.pin, y.pin));
  return { cands, excluded };
}

/**
 * Exact minimum scalar cost of completing the assignment of `rows` given the pads already `used`
 * (null: no completion exists). Cost of a pair is independent of the other nets, so this is the
 * assignment problem and a perfect lower bound for the depth-first search below.
 */
function completionBound(
  rows: readonly Net[],
  scalar: ReadonlyMap<string, ReadonlyMap<string, number>>,
  used: ReadonlySet<string>,
): number | null {
  const colIndex = new Map<string, number>();
  for (const n of rows) {
    for (const pad of scalar.get(n.id)?.keys() ?? []) {
      if (!used.has(pad) && !colIndex.has(pad)) colIndex.set(pad, colIndex.size);
    }
  }
  const padList = [...colIndex.keys()];
  return minAssignment(rows.length, padList.length, (r, c) => {
    const n = rows[r];
    const pad = padList[c];
    return n === undefined || pad === undefined ? null : (scalar.get(n.id)?.get(pad) ?? null);
  }).cost;
}

function searchOnce(
  budget: Budget,
  nets: readonly Net[],
  domains: ReadonlyMap<string, Cand[]>,
  best: { cost: Cost | null; pick: Map<string, Cand> | null },
): void {
  const scalar = new Map<string, Map<string, number>>();
  for (const n of nets) {
    const m = new Map<string, number>();
    for (const c of domains.get(n.id) ?? []) m.set(c.pad, scalarCost(c.a.cost));
    scalar.set(n.id, m);
  }
  const used = new Set<string>();
  // exact optimum of this leaf: the depth-first dive below then follows it without backtracking and
  // returns the first optimal assignment in candidate order (cost, connector, position)
  const target = completionBound(nets, scalar, used);
  if (target === null) return;
  if (best.cost !== null && target >= scalarCost(best.cost)) return; // strict improvement only
  const pick = new Map<string, Cand>();
  let spent = 0;
  const rec = (cur: Cost): boolean => {
    if (budget.exhausted) return false;
    let chosen: Net | null = null;
    let chosenLive: Cand[] = [];
    let remaining = 0;
    for (const n of nets) {
      if (pick.has(n.id)) continue;
      remaining++;
      const live = (domains.get(n.id) ?? []).filter((c) => !used.has(c.pad));
      if (live.length === 0) return false;
      if (
        chosen === null ||
        live.length < chosenLive.length ||
        (live.length === chosenLive.length && n.members.length > chosen.members.length)
      ) {
        chosen = n;
        chosenLive = live;
      }
    }
    if (remaining === 0) {
      best.cost = cur;
      best.pick = new Map(pick);
      return true;
    }
    if (chosen === null) return false;
    for (const c of chosenLive) {
      if (!budget.step()) return false;
      pick.set(chosen.id, c);
      used.add(c.pad);
      const next = addCost(cur, c.a.cost);
      const rest = nets.filter((n) => !pick.has(n.id));
      const lb = completionBound(rest, scalar, used);
      if (lb !== null && spent + scalarCost(c.a.cost) + lb <= target) {
        const before = spent;
        spent += scalarCost(c.a.cost);
        if (rec(next)) return true;
        spent = before;
      }
      used.delete(c.pad);
      pick.delete(chosen.id);
    }
    return false;
  };
  rec([0, 0, 0, 0]);
}

function solveBranch(ctx: Ctx, branch: InterfaceBranch): BranchResult {
  const exp = expandSignals(ctx.index, ctx.project, branch.choice);
  const empty = (reason: string, tokens: string[] = []): BranchResult => ({
    solution: null,
    nets: [],
    domains: new Map(),
    groups: [],
    signals: [],
    addresses: null,
    failure: { tokens, nets: [], reason },
  });
  if (exp.status !== 'ok') return empty('expansion failed');
  const signals = exp.signals;

  // A user lock is never dropped silently: a branch whose interface has no signal for a lock is infeasible.
  const unmatched = ctx.project.locked.filter(
    (l) => !signals.some((s) => s.id === `${l.instance}.${l.role}`),
  );
  if (unmatched.length > 0) {
    return empty(
      'a lock matches no signal of the chosen interface',
      unmatched.map((l) => `locked:${l.instance}.${l.role}=${l.pad}`).sort(cmp),
    );
  }

  // I2C address placement fixes the number of buses
  const i2cInst = [...new Set(signals.filter((s) => s.interface === 'i2c').map((s) => s.instance))];
  const members = i2cInst.flatMap((inst) => {
    const m = ctx.project.modules.find((x) => x.instance === inst);
    const b = m ? ctx.index.breakout(m.breakout) : undefined;
    const ic = b ? ctx.index.ic(b.ic) : undefined;
    return m && b && ic ? [resolveAddress(inst, b, ic, m.address_strap)] : [];
  });
  const i2cCount = ctx.chipPeripherals.filter(([, p]) => p.kind === 'i2c').length;
  const placed = assignI2c(members, ctx.i2cMux ? MUX_CHANNELS : i2cCount);
  if (!placed) {
    return empty(
      'I2C address collision cannot be resolved',
      i2cConflictTokens(
        ctx,
        i2cInst,
        (i) => members.find((m) => m.instance === i)?.options ?? [],
        i2cCount,
      ),
    );
  }
  const busOf = (inst: string): number =>
    ctx.i2cMux ? 0 : (placed.placements.find((p) => p.member.instance === inst)?.bus ?? 0);
  const { nets, groups: groupKinds } = buildNets(signals, busOf, ctx.project);

  const reserved = new Set(ctx.project.reserved);
  const lockedElsewhere = new Map<string, string>();
  for (const n of nets) if (n.lockedPad !== undefined) lockedElsewhere.set(n.lockedPad, n.id);

  const groups: Group[] = [...groupKinds.entries()]
    .map(([id, kind]) => ({ id, kind, options: groupOptions(ctx, kind) }))
    .sort((a, b) => cmp(a.id, b.id));

  const domainCache = new Map<string, NetDomain>();
  const dom = (n: Net, inst: string | null): NetDomain => {
    const k = `${n.id}|${inst ?? ''}`;
    let d = domainCache.get(k);
    if (!d) {
      d = domainFor(ctx, n, inst, reserved, lockedElsewhere);
      domainCache.set(k, d);
    }
    return d;
  };

  const best: { cost: Cost | null; pick: Map<string, Cand> | null } = { cost: null, pick: null };
  let bestInstances = new Map<string, string>();
  const chosenInst = new Map<string, string>();
  const enumerate = (gi: number): void => {
    if (ctx.budget.exhausted) return;
    const g = groups[gi];
    if (!g) {
      const doms = new Map<string, Cand[]>();
      for (const n of nets) {
        const inst = n.group !== null ? (chosenInst.get(n.group) ?? null) : null;
        doms.set(n.id, dom(n, inst).cands);
      }
      const before = best.cost;
      searchOnce(ctx.budget, nets, doms, best);
      if (best.cost !== before) bestInstances = new Map(chosenInst);
      return;
    }
    const taken = new Set(
      groups.slice(0, gi).flatMap((x) => (x.kind === g.kind ? [chosenInst.get(x.id) ?? ''] : [])),
    );
    const lastIdx = Math.max(
      -1,
      ...groups
        .slice(0, gi)
        .filter((x) => x.kind === g.kind)
        .flatMap((x) => {
          const c = chosenInst.get(x.id);
          return c !== undefined && g.options.some((o) => equivalent(ctx, o, c))
            ? [g.options.indexOf(c)]
            : [];
        }),
    );
    for (const opt of g.options) {
      if (taken.has(opt)) continue;
      // symmetry: interchangeable instances are used in name order only
      if (g.options.indexOf(opt) < lastIdx && equivalent(ctx, opt, g.options[lastIdx] ?? ''))
        continue;
      chosenInst.set(g.id, opt);
      enumerate(gi + 1);
      chosenInst.delete(g.id);
    }
  };
  enumerate(0);

  if (best.cost !== null && best.pick !== null) {
    return {
      solution: { cost: best.cost, pick: best.pick, groupInstance: bestInstances },
      nets,
      domains: domainCache,
      groups,
      signals,
      addresses: placed,
    };
  }
  const diag = diagnose(nets, groups, domainCache, ctx.hiddenAdc);
  return {
    solution: null,
    nets,
    domains: domainCache,
    groups,
    signals,
    addresses: placed,
    failure: diag,
  };
}

// ---------- unsat: first-cut conflict set ----------

/**
 * Raw cause tokens of a failed branch (the project-level minimal subset is computed by `unsat.ts`):
 * (1) nets whose domain is empty, explained by the exclusions that removed the pads (locked pad ->
 * `locked:` + cause token); (2) Hall-style pigeonhole check on nets with an identical domain (more ADC
 * nets than ADC pads -> `adc:` token, with the excluded ADC pads that explain the shortage); (3) otherwise
 * the nets of the smallest domains.
 */
function diagnose(
  nets: readonly Net[],
  groups: readonly Group[],
  cache: ReadonlyMap<string, NetDomain>,
  hiddenAdc: readonly string[],
): { tokens: string[]; nets: string[]; reason: string } {
  const tokens = new Set<string>();
  const involved = new Set<string>();
  const domainsOf = (n: Net): NetDomain[] => {
    const g = groups.find((x) => x.id === n.group);
    const insts = g ? g.options : [null];
    return insts.flatMap((i) => {
      const d = cache.get(`${n.id}|${i ?? ''}`);
      return d ? [d] : [];
    });
  };
  // (1) empty domains
  for (const n of nets) {
    const ds = domainsOf(n);
    const union = new Set(ds.flatMap((d) => d.cands.map((c) => c.pad)));
    if (union.size > 0 && !n.lockConflict) continue;
    involved.add(n.id);
    if (n.lockedPad !== undefined) {
      for (const m of n.members)
        if (m.lockedPad !== undefined) tokens.add(`locked:${m.id}=${m.lockedPad}`);
    }
    for (const d of ds) {
      for (const e of d.excluded) if (e.token !== null && e.rel) tokens.add(e.token);
    }
  }
  if (involved.size > 0) {
    return {
      tokens: [...tokens].sort(cmp),
      nets: [...involved].sort(cmp),
      reason: 'a signal has no usable pad',
    };
  }
  // (2) pigeonhole on identical domains
  const byDomain = new Map<string, Net[]>();
  for (const n of nets) {
    const ds = domainsOf(n);
    const key = JSON.stringify(
      [...new Set(ds.flatMap((d) => d.cands.map((c) => c.pad)))].sort(cmp),
    );
    byDomain.set(key, [...(byDomain.get(key) ?? []), n]);
  }
  for (const [key, group] of [...byDomain.entries()].sort(([a], [b]) => cmp(a, b))) {
    const pads = JSON.parse(key) as string[];
    if (group.length > pads.length) {
      const first = group[0];
      const adc = first?.kind === 'adc';
      tokens.add(
        adc
          ? `adc:${String(group.length)}-analog-signals-vs-${String(pads.length)}-adc-pads`
          : `pads:${String(group.length)}-signals-vs-${String(pads.length)}-pads`,
      );
      for (const n of group) involved.add(n.id);
      if (adc) for (const pad of hiddenAdc) tokens.add(`consumed:${pad}`);
      for (const n of group) {
        for (const d of domainsOf(n)) {
          for (const e of d.excluded) {
            if (
              e.token !== null &&
              e.rel &&
              (e.token.startsWith('consumed:') ||
                e.token.startsWith('reserved:') ||
                e.token.startsWith('adc2-wifi:'))
            ) {
              tokens.add(e.token);
            }
          }
        }
      }
    }
  }
  if (involved.size > 0) {
    return {
      tokens: [...tokens].sort(cmp),
      nets: [...involved].sort(cmp),
      reason: 'more signals than pads that can carry them',
    };
  }
  // (3) interaction between groups: report the most constrained nets
  const sorted = [...nets].sort((a, b) => {
    const sa = Math.min(...domainsOf(a).map((d) => d.cands.length));
    const sb = Math.min(...domainsOf(b).map((d) => d.cands.length));
    return sa - sb || cmp(a.id, b.id);
  });
  return {
    tokens: [],
    nets: sorted.slice(0, 4).map((n) => n.id),
    reason: 'no combination of pads satisfies every constraint at once',
  };
}

// ---------- explanation ----------

const TIER_NAMES = ['risk', 'performance', 'convenience', 'headroom'] as const;

function describeDiff(alt: Cand, chosen: Cand): { tier: 1 | 2 | 3 | 4; reason: string } {
  for (let t = 0; t < 4; t++) {
    const a = alt.a.cost[t] ?? 0;
    const c = chosen.a.cost[t] ?? 0;
    if (a !== c) {
      const why = alt.a.notes.length > 0 ? `: ${alt.a.notes.join('; ')}` : '';
      return {
        tier: (t + 1) as 1 | 2 | 3 | 4,
        reason:
          a > c
            ? `tier ${String(t + 1)} (${TIER_NAMES[t] ?? ''}) ${String(a)} vs ${String(c)}${why}`
            : `tier ${String(t + 1)} (${TIER_NAMES[t] ?? ''}) is better (${String(a)} vs ${String(c)}) but the pad is needed elsewhere in the optimal assignment`,
      };
    }
  }
  return {
    tier: 4,
    reason: 'equal on tiers 1-4; the chosen pad comes first in connector/position order',
  };
}

function toRecommendation(
  ctx: Ctx,
  branch: InterfaceBranch,
  r: BranchResult,
  opts: SolveOptions,
  stats: SolveStats,
): { recommendation: Recommendation; details: SolveDetails } {
  const sol = r.solution;
  if (!sol) throw new Error('toRecommendation needs a solution');
  const padOfNet = new Map<string, string>();
  const netOfSignal = new Map<string, Net>();
  for (const n of r.nets) {
    for (const m of n.members) netOfSignal.set(m.id, n);
    const c = sol.pick.get(n.id);
    if (c) padOfNet.set(n.id, c.pad);
  }
  const padOf = (sid: string): string | undefined => {
    const n = netOfSignal.get(sid);
    return n ? padOfNet.get(n.id) : undefined;
  };
  const addresses = (r.addresses?.placements ?? []).map((p) => ({
    instance: p.member.instance,
    address: p.address,
    status: p.member.status,
    options: p.member.options,
    bus: p.bus,
    evidence: p.member.evidence,
  }));
  const mc = moduleChecks(ctx.ac, r.signals, addresses, padOf);

  const ruleLines = (n: Net, c: Cand): { trace: string[]; evidence: string[] } => {
    const trace: string[] = [];
    const ev = new Set<string>([...c.pin.evidence, ...c.a.evidence, ...c.carryEvidence]);
    // facts that decided which pads were offered at all (consumed, USB bridge, PSRAM)
    const dom = r.domains.get(`${n.id}|${c.instance ?? ''}`);
    const filterEv = sortedUnique([
      ...ctx.view.moduleEvidence,
      ...(dom?.excluded ?? []).filter((e) => e.rel).flatMap((e) => e.evidence),
    ]);
    for (const e of filterEv) ev.add(e);
    // pads passed over because board circuitry (boot button, auto-reset, connectors) shares them
    const avoided = (dom?.cands ?? []).filter((x) => x.pin.onboard.length > 0 && x.pad !== c.pad);
    for (const x of avoided) for (const o of x.pin.onboard) for (const e of o.evidence) ev.add(e);
    const notOffered = [
      ...new Set(
        (dom?.excluded ?? []).filter((e) => e.rel && e.evidence.length > 0).map((e) => e.pad),
      ),
    ].sort(cmp);
    if (notOffered.length > 0)
      trace.push(`not offered (module, board or USB-bridge facts): ${notOffered.join(', ')}`);
    trace.push(
      `candidates: ${String(r.domains.get(`${n.id}|${c.instance ?? ''}`)?.cands.length ?? 0)} usable pads after filters`,
    );
    trace.push(
      `chosen ${c.pad} (${c.pin.connector}:${String(c.pin.position)} ${c.pin.label})${c.routing === null ? '' : `, ${c.instance === null ? '' : `${c.instance} `}${c.routing} routing`}`,
    );
    if (c.carryMaxHz !== null) trace.push(`routing limit ${String(c.carryMaxHz)} Hz`);
    for (const m of n.members) {
      for (const e of mc.facts.get(m.instance) ?? []) ev.add(e);
      if (m.maxHz !== null && c.carryMaxHz !== null) {
        trace.push(
          `${m.id}: device max ${String(m.maxHz)} Hz, bus clock capped at ${String(Math.min(m.maxHz, c.carryMaxHz))} Hz`,
        );
      }
      for (const e of m.evidence) ev.add(e);
    }
    for (const note of c.a.notes) trace.push(note);
    for (const re of c.a.rules) {
      if (n.members.some((m) => m.id === re.signal)) {
        trace.push(
          `${re.result.rule} [${re.result.level}] ${re.signal}: ${re.result.trace.join('; ')}`,
        );
      }
    }
    const modTraces = new Set<string>();
    for (const m of n.members) {
      for (const [scope, lines] of mc.traces) {
        if (
          scope === m.instance ||
          scope.startsWith(`${m.instance}:`) ||
          (n.group !== null && scope === n.group)
        ) {
          if (!modTraces.has(scope)) {
            modTraces.add(scope);
            for (const l of lines) trace.push(`${scope}: ${l}`);
          }
        }
      }
    }
    for (const me of mc.rules) {
      if (
        n.members.some(
          (m) =>
            me.scope === m.instance ||
            me.scope.startsWith(`${m.instance}:`) ||
            me.scope === n.group,
        )
      ) {
        for (const e of me.result.evidence) ev.add(e);
      }
    }
    trace.push(`score contribution [${c.a.cost.join(', ')}]`);
    return { trace, evidence: sortedUnique([...ev]) };
  };

  const assignments: Recommendation['assignments'] = [];
  for (const s of r.signals) {
    const n = netOfSignal.get(s.id);
    const c = n ? sol.pick.get(n.id) : undefined;
    if (!n || !c) continue;
    const { trace, evidence } = ruleLines(n, c);
    const usedByOthers = new Set(
      [...sol.pick.entries()].filter(([id]) => id !== n.id).map(([, v]) => v.pad),
    );
    const domain = r.domains.get(`${n.id}|${c.instance ?? ''}`)?.cands ?? [];
    const alternatives = domain
      .filter((x) => x.pad !== c.pad && !usedByOthers.has(x.pad))
      .slice(0, 3)
      .map((x) => ({ pad: x.pad, ...describeDiff(x, c) }))
      .map((d) => ({ pad: d.pad, lower_tier: d.tier, reason: d.reason }));
    assignments.push({
      instance: s.instance,
      role: s.id.slice(s.instance.length + 1),
      pad: c.pad,
      gpio: c.pin.gpio ?? -1,
      label: c.pin.label,
      connector: c.pin.connector,
      position: c.pin.position,
      ...(c.instance === null ? {} : { peripheral_instance: c.instance }),
      routing: c.routing ?? 'iomux',
      trace,
      evidence,
      alternatives,
    });
  }

  // warnings: pad-level from the chosen candidates, then module-level; merge duplicates
  const warn: WarnItem[] = [...mc.warnings];
  const parts: PartItem[] = [...mc.parts];
  for (const n of r.nets) {
    const c = sol.pick.get(n.id);
    if (!c) continue;
    warn.push(...c.a.warnings);
    parts.push(...c.a.parts);
  }
  if (stats.budgetExhausted) {
    warn.push({
      level: 'warning',
      code: 'BUDGET_EXHAUSTED',
      message: 'the search budget ran out; the assignment is the best found, not proven optimal',
      pads: [],
      evidence: [],
    });
  }
  const merged = new Map<string, WarnItem>();
  for (const w of warn) {
    const k = `${w.level}|${w.code}`;
    const cur = merged.get(k);
    if (!cur)
      merged.set(k, { ...w, pads: sortedUnique(w.pads), evidence: sortedUnique(w.evidence) });
    else {
      cur.pads = sortedUnique([...cur.pads, ...w.pads]);
      cur.evidence = sortedUnique([...cur.evidence, ...w.evidence]);
      if (!cur.message.includes(w.message)) cur.message = `${cur.message}; ${w.message}`;
    }
  }
  const order = ['critical', 'warning', 'caution', 'info'];
  const warnings = [...merged.values()].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level) || cmp(a.code, b.code),
  );

  const partMap = new Map<string, Recommendation['required_parts'][number]>();
  for (const p of parts) {
    const k = `${p.kind}|${p.role}|${p.value ?? ''}`;
    const cur = partMap.get(k);
    if (!cur) {
      partMap.set(k, {
        kind: p.kind,
        ...(p.value === undefined ? {} : { value: p.value }),
        role: p.role,
        count: 1,
        ...(p.pad === undefined ? {} : { pads: [p.pad] }),
      });
    } else {
      cur.count += 1;
      if (p.pad !== undefined) cur.pads = sortedUnique([...(cur.pads ?? []), p.pad]);
    }
  }

  const selMods = ctx.selection.modules;
  const interfaces: Recommendation['interfaces'] = {};
  for (const m of selMods) {
    const kind = branch.choice[m.instance];
    if (!kind) continue;
    interfaces[m.instance] = {
      kind,
      decided_by_rule: kind === m.chosen ? m.decidedByRule : 7,
      alternatives: m.candidates.filter((c) => c.feasible && c.kind !== kind).map((c) => c.kind),
    };
  }

  assignments.sort((a, b) => cmp(a.instance, b.instance) || cmp(a.role, b.role));
  const maxHz: Record<string, number> = {};
  let loadPin: number | null = null;
  for (const n of r.nets) {
    const c = sol.pick.get(n.id);
    if (!c) continue;
    for (const m of n.members) {
      if (n.busKind !== null) {
        const cap = Math.min(m.maxHz ?? Infinity, c.carryMaxHz ?? Infinity);
        if (Number.isFinite(cap)) maxHz[m.instance] = Math.min(maxHz[m.instance] ?? Infinity, cap);
      }
      if (m.actsOnLevel && loadPin === null) loadPin = c.pin.pinCurrentMaxMa.value;
    }
  }
  const el = ctx.ac.chip.electrical;
  const details: SolveDetails = {
    i2c: addresses.map((a) => ({
      instance: a.instance,
      address: a.address,
      bus: a.bus,
      status: a.status,
    })),
    moduleRules: mc.rules.map((e) => ({
      scope: e.scope,
      rule: e.result.rule,
      level: e.result.level,
      passed: e.result.passed,
      values: { ...e.result.values },
    })),
    maxHz,
    currents: {
      pinMa: loadPin,
      portMa: el.port_current_max ? prov(el.port_current_max).value : null,
      cumulativeMa: prov(el.cumulative_current_max).value,
    },
  };
  const recommendation: Recommendation = {
    catalog_version: opts.catalogVersion ?? 'unversioned',
    catalog_sha256: opts.catalogSha256 ?? 'unknown',
    ruleset_version: RULESET_VERSION,
    status: 'ok',
    interfaces,
    assignments,
    required_parts: [...partMap.values()].sort(
      (a, b) => cmp(a.kind, b.kind) || cmp(a.role, b.role) || cmp(a.value ?? '', b.value ?? ''),
    ),
    warnings: warnings.map((w) => ({
      level: w.level,
      code: w.code,
      message: w.message,
      pads: w.pads,
      evidence: w.evidence,
    })),
    budgets: mc.budgets,
    score: sol.cost,
  };
  return { recommendation, details };
}

function unsatRecommendation(
  opts: SolveOptions,
  interfaces: Recommendation['interfaces'],
  tokens: string[],
  relax: string[],
  extra: WarnItem[],
): Recommendation {
  return {
    catalog_version: opts.catalogVersion ?? 'unversioned',
    catalog_sha256: opts.catalogSha256 ?? 'unknown',
    ruleset_version: RULESET_VERSION,
    status: 'unsat',
    interfaces,
    assignments: [],
    required_parts: [],
    warnings: extra.map((w) => ({
      level: w.level,
      code: w.code,
      message: w.message,
      pads: w.pads,
      evidence: w.evidence,
    })),
    budgets: [],
    score: [0, 0, 0, 0],
    unsat: { minimal_conflict: tokens, relaxations: relax },
  };
}

// ---------- public API ----------

/** One solve without project-level diagnosis: an unsat result carries the raw cause tokens only. */
function solveOnce(index: CatalogIndex, project: Project, options: SolveOptions): SolveOutcome {
  const stats: SolveStats = { nodes: 0, branchesTried: 0, budgetExhausted: false };
  const base = (status: 'needs_variant', candidates: string[]): SolveOutcome => ({
    recommendation: {
      ...unsatRecommendation(options, {}, [], [], []),
      status,
      variant_candidates: candidates,
    },
    stats,
  });
  const sel = selectInterfaces(index, project, options.i2cMux === true ? MUX_CHANNELS : undefined);
  if (sel.status === 'needs_variant') return base('needs_variant', sel.candidates);
  if (sel.status === 'error') throw new Error(`${sel.code}: ${sel.message}`);
  const composed = composePinView(index, project.board, project.variant);
  if (composed.status === 'needs_variant') return base('needs_variant', composed.candidates);
  if (composed.status === 'error') throw new Error(`${composed.code}: ${composed.message}`);
  const view = composed.view;
  if (view.pins.length === 0) {
    // A board without a pin map (datasheet-required stub) can never yield a recommendation.
    return {
      recommendation: unsatRecommendation(
        options,
        {},
        ['board:no-pin-map'],
        [],
        [
          {
            level: 'critical',
            code: 'DATASHEET_REQUIRED',
            message: `${project.board} has no pin map in the catalog: a datasheet or schematic is required before pins can be chosen`,
            pads: [],
            evidence: [],
          },
        ],
      ),
      stats,
    };
  }
  const chip = index.chip(view.variant.chip);
  const board = index.board(project.board);
  if (!chip || !board) throw new Error(`unknown chip or board for ${project.board}`);

  const onboardPads = new Set(board.onboard.flatMap((o) => o.uses_pad));
  /** True when one onboard part (a USB bridge) uses both pads of a UART. */
  const bridged = (a: string, b: string): boolean =>
    board.onboard.some((o) => o.uses_pad.includes(a) && o.uses_pad.includes(b));
  const chipPeripherals = Object.entries(chip.peripherals).map(
    ([name, p]) =>
      [
        name,
        {
          kind: p.kind,
          matrix: p.matrix_routable,
          iomux: p.iomux_pins !== undefined && Object.keys(p.iomux_pins).length > 0,
        },
      ] as [string, { kind: string; matrix: boolean; iomux: boolean }],
  );
  const usbUarts = new Set(
    Object.entries(chip.peripherals)
      .filter(([, p]) => {
        const tx = p.iomux_pins?.tx;
        const rx = p.iomux_pins?.rx;
        return p.kind === 'uart' && tx !== undefined && rx !== undefined && bridged(tx, rx);
      })
      .map(([n]) => n),
  );
  const budget = new Budget(
    options.maxNodes ?? DEFAULT_MAX_NODES,
    options.now,
    options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
  );
  const ctx: Ctx = {
    index,
    project,
    view,
    ac: { index, project, chip, board, disabled: options.disabledRules ?? [] },
    pins: padPins(view),
    selection: sel,
    chipPeripherals,
    usbUarts,
    usbPads: new Set(
      [...usbUarts].flatMap((n) => {
        const m = chip.peripherals[n]?.iomux_pins;
        return [m?.tx, m?.rx].flatMap((x) => (x === undefined ? [] : [x]));
      }),
    ),
    usbEvidence: sortedUnique(
      board.onboard
        .filter((o) =>
          [...usbUarts].some((n) => {
            const m = chip.peripherals[n]?.iomux_pins;
            return (
              m?.tx !== undefined &&
              m.rx !== undefined &&
              o.uses_pad.includes(m.tx) &&
              o.uses_pad.includes(m.rx)
            );
          }),
        )
        .flatMap((o) => o.evidence),
    ),
    budget,
    i2cMux: options.i2cMux === true,
    hiddenAdc: Object.entries(chip.pads)
      .filter(([id, pad]) => pad.adc !== undefined && onboardPads.has(id))
      .map(([id]) => id)
      .filter((id) => !padPins(view).some((p) => p.pad === id))
      .sort(cmp),
  };

  const finish = (): void => {
    stats.nodes = budget.nodes;
    stats.budgetExhausted = budget.exhausted;
  };
  const branches = enumerateBranches(sel, options.branchLimit ?? DEFAULT_BRANCH_LIMIT);
  const chosenInterfaces = (
    choice?: Record<string, InterfaceKind>,
  ): Recommendation['interfaces'] => {
    const out: Recommendation['interfaces'] = {};
    for (const m of sel.modules) {
      const kind = choice?.[m.instance] ?? m.chosen ?? m.candidates[0]?.kind;
      if (kind)
        out[m.instance] = {
          kind,
          decided_by_rule: m.decidedByRule,
          alternatives: m.alternatives,
        };
    }
    return out;
  };

  if (project.modules.length === 0) {
    finish();
    return {
      ...toRecommendation(
        ctx,
        { choice: {}, ranks: [] },
        {
          solution: { cost: [0, 0, 0, 0], pick: new Map(), groupInstance: new Map() },
          nets: [],
          domains: new Map(),
          groups: [],
          signals: [],
          addresses: null,
        },
        options,
        stats,
      ),
      stats,
    };
  }

  if (branches.length === 0) {
    // interface level: some module has no feasible interface
    const tokens: string[] = [];
    const controllers = chipPeripherals.filter(([, p]) => p.kind === 'i2c').length;
    for (const c of sel.i2c.conflicts) {
      tokens.push(
        ...i2cConflictTokens(
          ctx,
          c,
          (i) => sel.i2c.addresses.find((a) => a.instance === i)?.options ?? [],
          controllers,
        ),
      );
    }
    for (const m of sel.modules) {
      if (m.chosen !== null) continue;
      for (const c of m.candidates) {
        const why = c.infeasibleReason ?? '';
        if (why.includes('radio')) tokens.push('adc2-wifi:all-adc-pads');
        else if (why.includes('no usable ADC')) tokens.push('adc:no-adc-pad');
        else if (!why.includes('I2C address')) tokens.push(`interface:${m.instance}:${c.kind}`);
      }
    }
    const tk = sortedUnique(tokens);
    finish();
    return {
      recommendation: unsatRecommendation(options, chosenInterfaces(), tk, [], []),
      stats,
    };
  }

  let firstFailure: { r: BranchResult; b: InterfaceBranch } | null = null;
  for (const b of branches) {
    stats.branchesTried++;
    const r = solveBranch(ctx, b);
    if (r.solution) {
      finish();
      return { ...toRecommendation(ctx, b, r, options, stats), stats };
    }
    firstFailure ??= { r, b };
    if (budget.exhausted) break;
  }
  finish();
  const ff = firstFailure;
  const failure = ff?.r.failure ?? { tokens: [], nets: [] as string[], reason: 'no solution' };
  const tokens = budget.exhausted ? [...failure.tokens, 'budget:exhausted'] : failure.tokens;
  const extra: WarnItem[] = budget.exhausted
    ? [
        {
          level: 'critical',
          code: 'BUDGET_EXHAUSTED',
          message:
            'the search budget ran out before a solution or a proof of unsatisfiability was found',
          pads: [],
          evidence: [],
        },
      ]
    : [];
  return {
    recommendation: unsatRecommendation(
      options,
      chosenInterfaces(ff?.b.choice),
      sortedUnique(tokens),
      [],
      extra,
    ),
    stats,
  };
}

/**
 * Solve a project. On unsat the result carries an irreducible conflicting subset (tokens) and ranked,
 * re-solve-verified relaxations (see `unsat.ts`); `stats` describe the first (full-project) solve only.
 */
export function solveDetailed(
  index: CatalogIndex,
  project: Project,
  options: SolveOptions = {},
): SolveOutcome {
  const first = solveOnce(index, project, options);
  const rec = first.recommendation;
  if (rec.status !== 'unsat' || first.stats.budgetExhausted) return first;
  const a = analyzeUnsat(index, project, (p, o) => solveOnce(index, p, o), options);
  const recommendation: Recommendation = {
    ...rec,
    unsat: {
      minimal_conflict: a.tokens,
      relaxations: a.relaxations,
    },
  };
  return { recommendation, stats: first.stats };
}

/** Solve a project: the recommendation only. See `solveDetailed` for the search statistics. */
export function solve(
  index: CatalogIndex,
  project: Project,
  options: SolveOptions = {},
): Recommendation {
  return solveDetailed(index, project, options).recommendation;
}
