// Interface selector (task 2b.3), rules 1-7 of skill `interface-selection`. For each module instance it
// produces ordered candidate interfaces with reasons; the solver (outer loop) enumerates branches from
// them. Rules: 1 module locks (breakout exposes), 2 feasibility, 3 incremental pin cost, 4 performance,
// 5 address conflicts (strap -> second bus -> SPI), 6 distance, 7 user override.
import type { Breakout, ClaimId, IC, Project } from '@pinout/schema';
import type { CatalogIndex, InterfaceKind } from './catalog.js';
import { composePinView, type ComposedView } from './compose.js';
import { normRole, signalPinCount, wiringFor, type Wiring } from './wiring.js';

export const LONG_WIRE_M = 0.5;
export const SPARE_PIN_MARGIN = 3;

const BUS_ROLES: Record<string, readonly string[]> = {
  i2c: ['SDA', 'SCL'],
  spi: ['SCK', 'MOSI', 'MISO'],
};
export const isBusRole = (kind: InterfaceKind, role: string): boolean =>
  (BUS_ROLES[kind] ?? []).includes(normRole(role));

export interface InterfaceCandidate {
  kind: InterfaceKind;
  /** 0 = best. */
  rank: number;
  feasible: boolean;
  infeasibleReason?: string;
  /** Extra MCU pins this interface needs, given the other modules' interfaces. */
  pinCost: number;
  /** True when this module would create the bus (I2C/SPI) or the first use of the kind. */
  newBus: boolean;
  /** True when the I2C address collision is solved by a second I2C controller. */
  secondBus: boolean;
  /** Spare usable GPIO pads left after allocating this candidate (estimate). */
  spareAfter: number;
  reasons: string[];
  /** Warning codes (e.g. LONG_WIRE_BUS, I2C_ADDRESS_UNKNOWN). */
  warnings: string[];
}

export interface ModuleInterfaces {
  instance: string;
  breakout: string;
  ic: string;
  candidates: InterfaceCandidate[];
  chosen: InterfaceKind | null;
  /** Interface-selection rule (1-7) that decided; 4 when the tie went to the performance rule. */
  decidedByRule: 1 | 2 | 3 | 4 | 5 | 7;
  alternatives: InterfaceKind[];
  warnings: string[];
  trace: string[];
}

export interface I2cAddress {
  instance: string;
  /** 7-bit address, null when it cannot be proven from the catalog and the breakout. */
  address: number | null;
  status: 'fixed' | 'strap' | 'selectable' | 'unknown';
  options: number[];
  strap?: string;
  bus: number;
  evidence: ClaimId[];
}

export interface InterfaceSelection {
  status: 'ok';
  modules: ModuleInterfaces[];
  /** Usable GPIO pads on the composed board view. */
  usableGpio: number;
  i2c: { buses: number; addresses: I2cAddress[]; conflicts: string[][] };
}

export type SelectionResult =
  | InterfaceSelection
  | { status: 'needs_variant'; candidates: string[] }
  | { status: 'error'; code: string; message: string };

// ---------- I2C address resolution ----------

interface AddrMember {
  instance: string;
  options: number[];
  status: I2cAddress['status'];
  strap?: string;
  evidence: ClaimId[];
}

const squash = (s: string): string => s.replace(/\s+/g, '').toUpperCase();

export function resolveAddress(
  instance: string,
  breakout: Breakout,
  ic: IC,
  strapChoice: string | undefined,
): AddrMember {
  const i2c = ic.interfaces.find((i) => i.kind === 'i2c');
  const all = i2c?.limits.addresses ?? [];
  const evidence = i2c?.limits.max_hz?.evidence ? [...i2c.limits.max_hz.evidence] : [];
  const unknown: AddrMember = {
    instance,
    options: all.map((a) => a.value).sort((a, b) => a - b),
    status: 'unknown',
    evidence,
  };
  if (all.length === 0) return unknown;
  if (strapChoice !== undefined) {
    const hit = all.find((a) => squash(a.strap) === squash(strapChoice));
    return hit
      ? { instance, options: [hit.value], status: 'strap', strap: hit.strap, evidence }
      : unknown;
  }
  for (const h of breakout.hardwired) {
    const hit = all.find((a) => squash(a.strap) === squash(`${h.strap}=${String(h.value)}`));
    if (hit) return { instance, options: [hit.value], status: 'fixed', strap: hit.strap, evidence };
  }
  if (all.length === 1)
    return { instance, options: [all[0]?.value ?? 0], status: 'fixed', evidence };
  // free-text hardwired level ("pulled up to 3.3 V by 10 kohm", "tied to GND"): the board's default address
  let preferred: number | undefined;
  for (const h of breakout.hardwired) {
    const text = String(h.value);
    const up = /pulled up|tied (high|to (3[.]3|vdd|vcc))/i.test(text);
    const down = /pulled down|tied (low|to gnd)/i.test(text);
    if (up === down) continue;
    const hit = all.filter((a) => {
      const [pin, level] = a.strap.split('=').map((t) => squash(t));
      return pin === squash(h.strap) && (up ? /^(VDD|VCC)/.test(level ?? '') : level === 'GND');
    });
    if (hit.length === 1) preferred = hit[0]?.value;
  }
  const ordered =
    preferred === undefined
      ? unknown.options
      : [preferred, ...unknown.options.filter((x) => x !== preferred)];
  const strapPins = new Set(all.map((a) => squash(a.strap.split('=')[0] ?? '')));
  const exposed = breakout.pins.some(
    (p) =>
      strapPins.has(squash(p.label)) || p.maps_to.split('/').some((t) => strapPins.has(squash(t))),
  );
  // The strap pin is on the breakout (e.g. ADS1115 ADDR, BME280 SDO): the user can choose.
  return exposed ? { ...unknown, status: 'selectable', options: ordered } : unknown;
}

function compatible(
  a: AddrMember,
  addrA: number | null,
  b: AddrMember,
  addrB: number | null,
): boolean {
  if (addrA === null || addrB === null) {
    // unknown address: provably distinct only when the possible address sets are disjoint
    return !a.options.some((x) => b.options.includes(x));
  }
  return addrA !== addrB;
}

interface Placement {
  member: AddrMember;
  bus: number;
  address: number | null;
}

function place(members: readonly AddrMember[], busCount: number): Placement[] | null {
  const placed: Placement[] = [];
  const go = (i: number, usedBuses: number): boolean => {
    const m = members[i];
    if (!m) return true;
    const choices: (number | null)[] = m.status === 'unknown' ? [null] : m.options;
    for (let bus = 0; bus < Math.min(busCount, usedBuses + 1); bus++) {
      for (const address of choices) {
        const ok = placed.every(
          (p) => p.bus !== bus || compatible(p.member, p.address, m, address),
        );
        if (!ok) continue;
        placed.push({ member: m, bus, address });
        if (go(i + 1, Math.max(usedBuses, bus + 1))) return true;
        placed.pop();
      }
    }
    return false;
  };
  return go(0, 0) ? placed : null;
}

/** Fewest buses (up to `maxBuses`) that hold all members; null when impossible. */
export function assignI2c(
  members: readonly AddrMember[],
  maxBuses: number,
): { buses: number; placements: Placement[] } | null {
  if (members.length === 0) return { buses: 0, placements: [] };
  for (let b = 1; b <= Math.max(1, maxBuses); b++) {
    const p = place(members, b);
    if (p) return { buses: new Set(p.map((x) => x.bus)).size, placements: p };
  }
  return null;
}

// ---------- selection ----------

function peripheralKind(kind: InterfaceKind): string | null {
  if (kind === 'i2c' || kind === 'spi' || kind === 'uart') return kind;
  if (kind === 'analog') return 'adc';
  return null;
}

interface Decided {
  instance: string;
  kind: InterfaceKind;
  cost: number;
}

function costOf(w: Wiring, kind: InterfaceKind, busPresent: boolean): number {
  let cost = 0;
  for (const s of w.wired) {
    const n = signalPinCount(s);
    if (isBusRole(kind, s.signal.role)) cost += busPresent ? 0 : n;
    else cost += n;
  }
  if (kind === 'onewire' && !busPresent) cost += 0;
  return cost;
}

const PERF_STREAM: readonly InterfaceKind[] = [
  'spi',
  'i2c',
  'uart',
  'onewire',
  'analog',
  'digital',
];
const PERF_SLOW: readonly InterfaceKind[] = ['i2c', 'onewire', 'spi', 'uart', 'analog', 'digital'];

/** A display-style device streams frames: it has a data/command line on its SPI interface. */
function isStreaming(ic: IC): boolean {
  return ic.interfaces.some(
    (i) => i.kind === 'spi' && i.signals.some((s) => normRole(s.role) === 'DC'),
  );
}

interface Ctx {
  index: CatalogIndex;
  project: Project;
  view: ComposedView;
  usableGpio: number;
  i2cPeripherals: number;
  uartFree: number;
  hasKind: (k: string) => boolean;
}

function feasibility(
  ctx: Ctx,
  kind: InterfaceKind,
  cost: number,
  spareAfter: number,
  decided: readonly Decided[],
): string | null {
  const pk = peripheralKind(kind);
  if (pk !== null && !ctx.hasKind(pk)) return `chip has no ${pk} peripheral`;
  if (spareAfter < 0)
    return `needs ${String(cost)} pins but only ${String(ctx.usableGpio)} usable GPIO pads exist`;
  if (kind === 'uart' && decided.filter((d) => d.kind === 'uart').length >= ctx.uartFree) {
    return 'no free UART instance';
  }
  if (kind === 'analog') {
    const adcPins = ctx.view.pins.filter((p) => p.usable && p.adc);
    if (adcPins.length === 0) return 'no usable ADC pad on this board';
    if (ctx.project.wifi === true && adcPins.every((p) => p.adc?.radioConflict.value === true)) {
      return 'every ADC pad conflicts with the radio while Wi-Fi is on';
    }
  }
  return null;
}

export function selectInterfaces(
  index: CatalogIndex,
  project: Project,
  /** Override of the I2C bus count (an I2C multiplexer gives several channels on one controller). */
  i2cBusLimit?: number,
): SelectionResult {
  const composed = composePinView(index, project.board, project.variant);
  if (composed.status === 'needs_variant') return composed;
  if (composed.status === 'error') return composed;
  const view = composed.view;
  const chip = index.chip(view.variant.chip);
  if (!chip) return { status: 'error', code: 'UNKNOWN_CHIP', message: view.variant.chip };
  const board = index.board(project.board);

  const usablePads = new Set(
    view.pins.filter((p) => p.usable && p.pad !== undefined).map((p) => p.pad),
  );
  const periphs = Object.values(chip.peripherals);
  const bridged = (a: string, b: string): boolean =>
    board?.onboard.some((o) => o.uses_pad.includes(a) && o.uses_pad.includes(b)) ?? false;
  const usbUarts = periphs.filter((p) => {
    const m = p.iomux_pins ?? {};
    const tx = m.tx;
    const rx = m.rx;
    return p.kind === 'uart' && tx !== undefined && rx !== undefined && bridged(tx, rx);
  }).length;
  const ctx: Ctx = {
    index,
    project,
    view,
    usableGpio: usablePads.size,
    i2cPeripherals: i2cBusLimit ?? periphs.filter((p) => p.kind === 'i2c').length,
    uartFree: periphs.filter((p) => p.kind === 'uart').length - usbUarts,
    hasKind: (k) => periphs.some((p) => p.kind === k),
  };

  interface Entry {
    instance: string;
    breakout: Breakout;
    ic: IC;
    exposed: InterfaceKind[];
    override?: InterfaceKind;
    strap: string | undefined;
  }
  const entries: Entry[] = [];
  for (const m of project.modules) {
    const breakout = index.breakout(m.breakout);
    const ic = breakout ? index.ic(breakout.ic) : undefined;
    if (!breakout || !ic) {
      return {
        status: 'error',
        code: 'UNKNOWN_BREAKOUT',
        message: `unknown breakout ${m.breakout}`,
      };
    }
    const icKinds = new Set(ic.interfaces.map((i) => i.kind));
    entries.push({
      instance: m.instance,
      breakout,
      ic,
      exposed: breakout.interfaces_exposed.filter((k) => icKinds.has(k)),
      ...(m.interface === undefined ? {} : { override: m.interface }),
      strap: m.address_strap,
    });
  }

  const decided: Decided[] = [];
  const results = new Map<string, ModuleInterfaces>();
  const addrMember = (e: Entry): AddrMember =>
    resolveAddress(e.instance, e.breakout, e.ic, e.strap);
  const i2cMembers = (extra?: Entry): AddrMember[] => {
    const ids = new Set(decided.filter((d) => d.kind === 'i2c').map((d) => d.instance));
    const ms = entries.filter((e) => ids.has(e.instance)).map(addrMember);
    return extra ? [...ms, addrMember(extra)] : ms;
  };
  const busPresent = (kind: InterfaceKind): boolean => decided.some((d) => d.kind === kind);

  // fixed decisions (override or single exposed interface) first, then free choices, each in project order
  const fixed = entries.filter((e) => e.override !== undefined || e.exposed.length <= 1);
  const free = entries.filter((e) => !(e.override !== undefined || e.exposed.length <= 1));

  const evaluate = (e: Entry, kind: InterfaceKind): InterfaceCandidate => {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const w = wiringFor(e.breakout, e.ic, kind);
    const exposed = e.exposed.includes(kind);
    const base: InterfaceCandidate = {
      kind,
      rank: 0,
      feasible: true,
      pinCost: 0,
      newBus: false,
      secondBus: false,
      spareAfter: ctx.usableGpio,
      reasons,
      warnings,
    };
    if (!exposed || !w) {
      return {
        ...base,
        feasible: false,
        infeasibleReason: `${kind} is not exposed by breakout ${e.breakout.id}`,
        reasons: [`rule 1: ${kind} is not exposed by breakout ${e.breakout.id}`],
      };
    }
    const hasBus = BUS_ROLES[kind] !== undefined;
    let present = hasBus ? busPresent(kind) : false;
    let secondBus = false;
    let infeasible: string | null = null;
    if (kind === 'i2c') {
      const before = assignI2c(i2cMembers(), ctx.i2cPeripherals);
      const after = assignI2c(i2cMembers(e), ctx.i2cPeripherals);
      if (!after) {
        infeasible =
          'I2C address collision cannot be resolved by a strap or a second I2C controller';
        reasons.push(`rule 5: ${infeasible}`);
      } else if (before && before.buses > 0 && after.buses > before.buses) {
        secondBus = true;
        present = false;
        reasons.push(
          'rule 5: address collision on the existing bus; needs a second I2C controller',
        );
      }
      const mine = addrMember(e);
      if (mine.status === 'unknown') {
        warnings.push('I2C_ADDRESS_UNKNOWN');
        reasons.push(
          'address cannot be proven from the catalog; kept separate from other I2C devices',
        );
      }
    }
    const cost = costOf(w, kind, present);
    const others = entries
      .filter((o) => o.instance !== e.instance)
      .reduce((sum, o) => {
        const d = decided.find((x) => x.instance === o.instance);
        if (d) return sum + d.cost;
        const costs = o.exposed
          .map((k) => wiringFor(o.breakout, o.ic, k))
          .filter((x): x is Wiring => x !== undefined)
          .map((x) => costOf(x, x.kind, busPresent(x.kind)));
        return sum + (costs.length > 0 ? Math.min(...costs) : 0);
      }, 0);
    const spareAfter = ctx.usableGpio - others - cost;
    infeasible ??= feasibility(ctx, kind, cost, spareAfter, decided);
    if (infeasible !== null) reasons.push(`rule 2: ${infeasible}`);
    if ((kind === 'i2c' || kind === 'spi') && (project.wiring_length_m ?? 0) > LONG_WIRE_M) {
      warnings.push('LONG_WIRE_BUS');
      reasons.push(
        `rule 6: wiring ${String(project.wiring_length_m)} m exceeds ${String(LONG_WIRE_M)} m; consider a bus buffer or differential link`,
      );
    }
    reasons.push(
      `rule 3: costs ${String(cost)} pin${cost === 1 ? '' : 's'}${hasBus ? (present ? ' (bus already exists)' : ' (new bus)') : ''}`,
    );
    return {
      ...base,
      feasible: infeasible === null,
      ...(infeasible === null ? {} : { infeasibleReason: infeasible }),
      pinCost: cost,
      newBus: hasBus && !present,
      secondBus,
      spareAfter,
    };
  };

  const decide = (e: Entry): ModuleInterfaces => {
    const trace: string[] = [];
    const kinds: InterfaceKind[] = e.override !== undefined ? [e.override] : [...e.exposed];
    const cands = kinds.map((k) => evaluate(e, k));
    const perf = isStreaming(e.ic) ? PERF_STREAM : PERF_SLOW;
    const perfRank = (k: InterfaceKind): number => perf.indexOf(k);

    /** Returns the deciding rule when `a` beats `b`, 0 when `a` does not beat `b`. */
    const beats = (a: InterfaceCandidate, b: InterfaceCandidate): 0 | 2 | 3 | 4 | 5 => {
      if (a.feasible !== b.feasible) return a.feasible ? 2 : 0;
      const diff = b.pinCost - a.pinCost;
      const spare = Math.min(a.spareAfter, b.spareAfter);
      const decisive = Math.abs(diff) >= 2 || (Math.abs(diff) === 1 && spare < SPARE_PIN_MARGIN);
      if (decisive) return diff > 0 ? 3 : 0;
      const pa = perfRank(a.kind);
      const pb = perfRank(b.kind);
      if (pa !== pb) return pa < pb ? 4 : 0;
      return 0;
    };

    const ordered: InterfaceCandidate[] = [];
    const pool = [...cands];
    while (pool.length > 0) {
      let best = pool[0];
      if (!best) break;
      for (const c of pool.slice(1)) if (beats(c, best) !== 0) best = c;
      pool.splice(pool.indexOf(best), 1);
      ordered.push(best);
    }
    let decidedBy: ModuleInterfaces['decidedByRule'] = e.override !== undefined ? 7 : 1;
    const [first, second] = ordered;
    if (e.override === undefined && first && second) {
      const rule = beats(first, second);
      decidedBy = rule === 0 ? 4 : rule;
      if (rule === 2 && second.reasons.some((r) => r.startsWith('rule 5'))) decidedBy = 5;
    }
    ordered.forEach((c, i) => {
      c.rank = i;
    });

    const top = ordered[0];
    const chosen = top?.feasible === true ? top.kind : null;
    if (e.override !== undefined) trace.push(`rule 7: user override ${e.override}`);
    else if (e.exposed.length <= 1) {
      trace.push(
        `rule 1: breakout ${e.breakout.id} exposes only ${e.exposed.join(', ') || 'nothing'}`,
      );
    } else {
      trace.push(`rule 1: breakout ${e.breakout.id} exposes ${e.exposed.join(', ')}`);
      for (const c of ordered) {
        trace.push(
          `${c.kind}: ${c.feasible ? 'feasible' : `infeasible (${c.infeasibleReason ?? ''})`}, cost ${String(c.pinCost)}, spare ${String(c.spareAfter)}`,
        );
      }
      trace.push(`decided by rule ${String(decidedBy)}`);
    }
    const out: ModuleInterfaces = {
      instance: e.instance,
      breakout: e.breakout.id,
      ic: e.ic.id,
      candidates: ordered,
      chosen,
      decidedByRule: decidedBy,
      alternatives: ordered.filter((c) => c.feasible && c.kind !== chosen).map((c) => c.kind),
      warnings: [
        ...new Set(ordered.filter((c) => c.kind === chosen).flatMap((c) => c.warnings)),
      ].sort(),
      trace,
    };
    if (chosen !== null && top)
      decided.push({ instance: e.instance, kind: chosen, cost: top.pinCost });
    return out;
  };

  const addrRejected: string[] = [];
  for (const e of [...fixed, ...free]) {
    const r = decide(e);
    results.set(e.instance, r);
    const top = r.candidates[0];
    if (
      r.chosen === null &&
      top?.kind === 'i2c' &&
      top.reasons.some((x) => x.startsWith('rule 5'))
    ) {
      addrRejected.push(e.instance);
    }
  }

  const modules = entries.flatMap((e) => {
    const r = results.get(e.instance);
    return r ? [r] : [];
  });

  // final I2C placement of everything that chose I2C
  const members = i2cMembers();
  const assigned = assignI2c(members, ctx.i2cPeripherals);
  const addresses: I2cAddress[] = (assigned?.placements ?? []).map((p) => ({
    instance: p.member.instance,
    address: p.address,
    status: p.member.status,
    options: p.member.options,
    ...(p.member.strap === undefined ? {} : { strap: p.member.strap }),
    bus: p.bus,
    evidence: p.member.evidence,
  }));
  addresses.sort(
    (a, b) =>
      members.findIndex((m) => m.instance === a.instance) -
      members.findIndex((m) => m.instance === b.instance),
  );
  // Rule 5: two modules whose addresses collide on one bus are told apart by an address strap. The strap
  // decides the placement even when the interface itself was fixed by the user (rule 7).
  for (const mod of modules) {
    if (mod.chosen !== 'i2c') continue;
    const me = addresses.find((a) => a.instance === mod.instance);
    if (me?.address == null || me.status !== 'selectable') continue;
    const peer = addresses.find(
      (o) =>
        o.instance !== me.instance &&
        o.bus === me.bus &&
        o.status === 'selectable' &&
        o.options.some((x) => me.options.includes(x)),
    );
    if (!peer) continue;
    mod.decidedByRule = 5;
    mod.trace.push(
      `rule 5: ${me.instance} and ${peer.instance} share address options on bus ${String(me.bus)}; the address strap separates them (${me.instance} at 0x${me.address.toString(16)})`,
    );
  }
  return {
    status: 'ok',
    modules,
    usableGpio: ctx.usableGpio,
    i2c: {
      buses: assigned?.buses ?? 0,
      addresses,
      conflicts:
        assigned && addrRejected.length === 0
          ? []
          : [[...members.map((m) => m.instance), ...addrRejected]],
    },
  };
}

export interface InterfaceBranch {
  choice: Record<string, InterfaceKind>;
  /** Candidate rank per module (project order); lexicographically smaller is better. */
  ranks: number[];
}

/** Feasible interface combinations, best first (lexicographic on per-module rank), at most `limit`. */
export function enumerateBranches(selection: InterfaceSelection, limit = 32): InterfaceBranch[] {
  const out: InterfaceBranch[] = [];
  const mods = selection.modules;
  const choice: Record<string, InterfaceKind> = {};
  const ranks: number[] = [];
  const go = (i: number): void => {
    if (out.length >= limit) return;
    const m = mods[i];
    if (!m) {
      out.push({ choice: { ...choice }, ranks: [...ranks] });
      return;
    }
    for (const c of m.candidates) {
      if (!c.feasible) continue;
      choice[m.instance] = c.kind;
      ranks.push(c.rank);
      go(i + 1);
      ranks.pop();
      Reflect.deleteProperty(choice, m.instance);
    }
  };
  go(0);
  return out;
}
