// Unsat analysis (task 2b.6): an irreducible conflicting subset of the project and ranked relaxations.
//
// Members. The removable parts of a project are: each module instance (`module`), a forced interface
// (`interface`), each locked pin (`lock`), each reserved pad (`reserved`) and the Wi-Fi flag (`wifi`).
// Board and catalog facts (strap, consumed, input-only, ADC2/radio) are not removable members; they are
// reported as cause tokens taken from the solve of the minimal subset.
//
// Minimal subset. QuickXplain over the members, with the solver itself as the oracle (a subset is
// "sat" when `solve` returns `ok` on the sub-project). A final deletion pass re-solves the project
// without each member and drops any member whose removal leaves it unsat, so the result is irreducible
// (removing any member makes the project satisfiable, checked by re-solving).
//
// Relaxations. Each candidate edit is applied to the FULL project and kept only when re-solving gives
// `ok`. Ranking rule (lower rank first, ties by token): 1 relax a user constraint (unlock, unreserve,
// share-bus = release a forced address strap); 2 change-interface; 3 add a part (add-i2c-multiplexer,
// add-external-adc, add-io-expander); 4 different-variant; 5 wifi:false; 6 different-board;
// 7 remove-module. I.e. keep hardware and features first, add parts before giving up a feature, change
// the board or delete a function last. "Lower the clock to allow matrix routing" is not a relaxation
// here: a matrix route only lowers the achievable clock (a tier-2 cost), it never makes a project unsat.
// Pure and deterministic: no clock, no randomness; candidate order follows project and catalog order.
import type { Project } from '@pinout/schema';
import { boardRef, sortedUnique, type CatalogIndex } from './catalog.js';
import type { SolveOptions, SolveOutcome } from './solver.js';

export type MemberKind = 'module' | 'interface' | 'lock' | 'reserved' | 'wifi';
export interface ConflictMember {
  kind: MemberKind;
  /** module/interface: instance; lock: `<instance>.<role>=<pad>`; reserved: pad; wifi: `wifi`. */
  id: string;
}

export type SolveFn = (project: Project, options: SolveOptions) => SolveOutcome;

export interface UnsatAnalysis {
  members: ConflictMember[];
  tokens: string[];
  relaxations: string[];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const key = (m: ConflictMember): string => `${m.kind}|${m.id}`;
type ProjectModule = Project['modules'][number];
export const lockId = (l: Project['locked'][number]): string => `${l.instance}.${l.role}=${l.pad}`;

/** Every removable member of the project, in a fixed order. */
export function allMembers(project: Project): ConflictMember[] {
  const out: ConflictMember[] = [];
  for (const m of project.modules) out.push({ kind: 'module', id: m.instance });
  for (const m of project.modules)
    if (m.interface !== undefined) out.push({ kind: 'interface', id: m.instance });
  for (const l of project.locked) out.push({ kind: 'lock', id: lockId(l) });
  for (const p of sortedUnique(project.reserved)) out.push({ kind: 'reserved', id: p });
  if (project.wifi === true) out.push({ kind: 'wifi', id: 'wifi' });
  return out;
}

/** The project reduced to the given members (a lock needs its module; a dropped wifi member sets wifi false). */
export function subproject(project: Project, keep: readonly ConflictMember[]): Project {
  const has = new Set(keep.map(key));
  const modules = project.modules
    .filter((m) => has.has(`module|${m.instance}`))
    .map((m) => {
      const out: ProjectModule = { breakout: m.breakout, instance: m.instance };
      if (m.interface !== undefined && has.has(`interface|${m.instance}`))
        out.interface = m.interface;
      if (m.address_strap !== undefined) out.address_strap = m.address_strap;
      return out;
    });
  const live = new Set(modules.map((m) => m.instance));
  const next: Project = {
    ...project,
    modules,
    locked: project.locked.filter((l) => has.has(`lock|${lockId(l)}`) && live.has(l.instance)),
    reserved: project.reserved.filter((p) => has.has(`reserved|${p}`)),
  };
  if (project.wifi === true && !has.has('wifi|wifi')) next.wifi = false;
  return next;
}

/** Token a member contributes by itself (vocabulary of fixture-vocabulary.ts). */
function memberToken(m: ConflictMember): string | null {
  if (m.kind === 'lock') return `locked:${m.id}`;
  if (m.kind === 'reserved') return `reserved:${m.id}`;
  return null;
}

export function analyzeUnsat(
  index: CatalogIndex,
  project: Project,
  solveFn: SolveFn,
  options: SolveOptions,
): UnsatAnalysis {
  const sat = (p: Project, extra: Partial<SolveOptions> = {}): boolean => {
    try {
      return solveFn(p, { ...options, ...extra }).recommendation.status === 'ok';
    } catch {
      return false;
    }
  };
  const cache = new Map<string, boolean>();
  const unsatSubset = (keep: readonly ConflictMember[]): boolean => {
    const k = keep.map(key).sort(cmp).join(';');
    let r = cache.get(k);
    if (r === undefined) {
      r = !sat(subproject(project, keep));
      cache.set(k, r);
    }
    return r;
  };

  // QuickXplain: background `b`, members added last `delta`, candidates `c`.
  const qx = (
    b: ConflictMember[],
    delta: ConflictMember[],
    c: ConflictMember[],
  ): ConflictMember[] => {
    if (delta.length > 0 && unsatSubset(b)) return [];
    if (c.length <= 1) return c;
    const mid = Math.floor(c.length / 2);
    const c1 = c.slice(0, mid);
    const c2 = c.slice(mid);
    const d2 = qx([...b, ...c1], c1, c2);
    const d1 = qx([...b, ...d2], d2, c1);
    return [...d1, ...d2];
  };
  let members = qx([], [], allMembers(project));
  // Irreducibility pass: re-solve without each member; drop it when the rest is still unsat.
  for (let i = 0; i < members.length;) {
    const rest = members.filter((_, j) => j !== i);
    if (unsatSubset(rest)) members = rest;
    else i++;
  }

  const causes =
    solveFn(subproject(project, members), options).recommendation.unsat?.minimal_conflict ?? [];
  const tokens = new Set<string>(causes);
  for (const m of members) {
    const t = memberToken(m);
    if (t !== null) tokens.add(t);
    if (m.kind === 'interface') {
      const kind = project.modules.find((x) => x.instance === m.id)?.interface;
      if (kind !== undefined) tokens.add(`interface:${m.id}:${kind}`);
    }
  }
  if (tokens.size === 0) {
    const ids = members.filter((m) => m.kind === 'module').map((m) => m.id);
    tokens.add(`pads:${ids.join(',')}`);
  }
  return {
    members,
    tokens: [...tokens].sort(cmp),
    relaxations: relaxations(index, project, members, sat),
  };
}

// ---------- relaxations ----------

interface Candidate {
  rank: number;
  token: string;
  /** Edited projects, tried in order; the candidate holds when any of them is satisfiable. */
  projects: Project[];
  options?: Partial<SolveOptions>;
}

const dropModule = (p: Project, instance: string): Project => ({
  ...p,
  modules: p.modules.filter((m) => m.instance !== instance),
  locked: p.locked.filter((l) => l.instance !== instance),
});

function mapModule(p: Project, instance: string, f: (m: ProjectModule) => ProjectModule): Project {
  return { ...p, modules: p.modules.map((m) => (m.instance === instance ? f(m) : m)) };
}

const stripped = (m: ProjectModule, drop: 'interface' | 'address_strap'): ProjectModule => {
  const out: ProjectModule = { breakout: m.breakout, instance: m.instance };
  if (m.interface !== undefined && drop !== 'interface') out.interface = m.interface;
  if (m.address_strap !== undefined && drop !== 'address_strap')
    out.address_strap = m.address_strap;
  return out;
};

function freshName(p: Project, base: string): string {
  let n = base;
  for (let i = 2; p.modules.some((m) => m.instance === n); i++) n = `${base}${String(i)}`;
  return n;
}

function relaxations(
  index: CatalogIndex,
  project: Project,
  core: readonly ConflictMember[],
  sat: (p: Project, extra?: Partial<SolveOptions>) => boolean,
): string[] {
  const inCore = (kind: MemberKind, id: string): boolean =>
    core.some((m) => m.kind === kind && m.id === id);
  const coreModules = project.modules.filter((m) => inCore('module', m.instance));
  const cands: Candidate[] = [];

  // 1: relax a user constraint
  for (const l of project.locked) {
    if (!inCore('lock', lockId(l))) continue;
    cands.push({
      rank: 1,
      token: `unlock:${l.instance}.${l.role}`,
      projects: [{ ...project, locked: project.locked.filter((x) => x !== l) }],
    });
  }
  for (const pad of sortedUnique(project.reserved)) {
    if (!inCore('reserved', pad)) continue;
    cands.push({
      rank: 1,
      token: `unreserve:${pad}`,
      projects: [{ ...project, reserved: project.reserved.filter((x) => x !== pad) }],
    });
  }
  for (const m of coreModules) {
    if (m.address_strap === undefined) continue;
    cands.push({
      rank: 1,
      token: `share-bus:${m.instance}`,
      projects: [mapModule(project, m.instance, (x) => stripped(x, 'address_strap'))],
    });
  }
  // 2: change the forced interface
  for (const m of coreModules) {
    if (m.interface === undefined) continue;
    const kinds = index.breakout(m.breakout)?.interfaces_exposed ?? [];
    cands.push({
      rank: 2,
      token: `change-interface:${m.instance}=auto`,
      projects: [mapModule(project, m.instance, (x) => stripped(x, 'interface'))],
    });
    for (const k of kinds) {
      if (k === m.interface) continue;
      cands.push({
        rank: 2,
        token: `change-interface:${m.instance}=${k}`,
        projects: [
          mapModule(project, m.instance, (x) => ({ ...stripped(x, 'interface'), interface: k })),
        ],
      });
    }
  }
  // 3: add a part
  cands.push({
    rank: 3,
    token: 'add-i2c-multiplexer',
    projects: [project],
    options: { i2cMux: true },
  });
  const offload = (
    prefix: string,
    isPart: (id: string) => boolean,
    eligible: (id: string) => boolean,
    cap: number,
    name: string,
  ): void => {
    const movable = [
      ...coreModules.filter((m) => eligible(m.breakout)),
      ...project.modules.filter((m) => !inCore('module', m.instance) && eligible(m.breakout)),
    ];
    for (const b of [...index.catalog.breakouts].sort((x, y) => cmp(x.id, y.id))) {
      if (!isPart(b.id)) continue;
      const projects: Project[] = [];
      for (let n = 1; n <= Math.min(cap, movable.length); n++) {
        let p = project;
        for (const m of movable.slice(0, n)) p = dropModule(p, m.instance);
        projects.push({
          ...p,
          modules: [...p.modules, { breakout: b.id, instance: freshName(p, name) }],
        });
      }
      if (projects.length > 0) cands.push({ rank: 3, token: `${prefix}:${b.id}`, projects });
    }
  };
  const partIc = (id: string) => index.ic(index.breakout(id)?.ic ?? '');
  const hasI2c = (id: string) => !!partIc(id)?.interfaces.some((i) => i.kind === 'i2c');
  const exposesOnly = (id: string, kind: string): boolean => {
    const e = index.breakout(id)?.interfaces_exposed ?? [];
    return e.length > 0 && e.every((k) => k === kind);
  };
  offload(
    'add-external-adc',
    (id) => hasI2c(id) && /^ads\d|adc/.test(partIc(id)?.id ?? ''),
    (id) => exposesOnly(id, 'analog'),
    4,
    'ext-adc',
  );
  offload(
    'add-io-expander',
    (id) => hasI2c(id) && /^(mcp23|pcf857)/.test(partIc(id)?.id ?? ''),
    (id) => exposesOnly(id, 'digital'),
    8,
    'ext-io',
  );
  // 4: another variant of this board; 6: another board
  const board = index.board(project.board);
  for (const v of board?.variants ?? []) {
    if (v.id === project.variant) continue;
    cands.push({
      rank: 4,
      token: `different-variant:${v.id}`,
      projects: [{ ...project, variant: v.id }],
    });
  }
  const currentId = project.board.split('@')[0] ?? project.board;
  const seenBoards = new Set<string>();
  for (const b of [...index.catalog.boards].sort((x, y) => cmp(boardRef(x), boardRef(y)))) {
    if (b.id === currentId || seenBoards.has(b.id)) continue;
    seenBoards.add(b.id);
    cands.push({
      rank: 6,
      token: `different-board:${b.id}`,
      projects: b.variants.map((v) => ({ ...project, board: boardRef(b), variant: v.id })),
    });
  }
  // 5: drop Wi-Fi
  if (inCore('wifi', 'wifi')) {
    cands.push({ rank: 5, token: 'wifi:false', projects: [{ ...project, wifi: false }] });
  }
  // 7: remove a module (token: its breakout id; one instance of it is removed)
  const byBreakout = new Map<string, ProjectModule[]>();
  for (const m of coreModules)
    byBreakout.set(m.breakout, [...(byBreakout.get(m.breakout) ?? []), m]);
  for (const [b, ms] of [...byBreakout.entries()].sort(([x], [y]) => cmp(x, y))) {
    cands.push({
      rank: 7,
      token: `remove-module:${b}`,
      projects: ms.map((m) => dropModule(project, m.instance)),
    });
  }

  const ok = cands.filter((c) => c.projects.some((p) => sat(p, c.options ?? {})));
  return ok.sort((a, b) => a.rank - b.rank || cmp(a.token, b.token)).map((c) => c.token);
}
