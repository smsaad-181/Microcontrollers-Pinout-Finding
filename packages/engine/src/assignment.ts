// Exact lower bound for the pad search: every signal net needs its own pad and the cost of a (net, pad)
// pair does not depend on the other nets, so the cheapest completion is a minimum-cost assignment
// problem (Hungarian method). The 4-tier lexicographic cost is folded into one integer with a base
// larger than any tier total, which keeps the comparison exact (all values stay below 2^53).
import type { Cost } from './assess.js';

/** Tier weights of the scalar cost (tier 1 most significant). A tier total must stay below TIER_BASE. */
export const TIER_BASE = 1000;
const BIG = 1e12; // cost of a pair that cannot happen; any total >= BIG is infeasible

export const scalarCost = (c: Cost): number =>
  ((c[0] * TIER_BASE + c[1]) * TIER_BASE + c[2]) * TIER_BASE + c[3];

export interface AssignmentResult {
  /** Minimum scalar cost, or null when no perfect assignment of the rows exists. */
  cost: number | null;
}

/**
 * Minimum-cost assignment of every row to a distinct column. `cell(r, c)` is the scalar cost or null when
 * the pair is not allowed. Rows <= columns is required (otherwise infeasible).
 */
export function minAssignment(
  rows: number,
  cols: number,
  cell: (r: number, c: number) => number | null,
): AssignmentResult {
  if (rows === 0) return { cost: 0 };
  if (rows > cols) return { cost: null };
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(cols + 1).fill(0);
  const p = new Array<number>(cols + 1).fill(0);
  const way = new Array<number>(cols + 1).fill(0);
  for (let i = 1; i <= rows; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(cols + 1).fill(Infinity);
    const used = new Array<boolean>(cols + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0] ?? 0;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= cols; j++) {
        if (used[j]) continue;
        const raw = cell(i0 - 1, j - 1);
        const cur = (raw ?? BIG) - (u[i0] ?? 0) - (v[j] ?? 0);
        if (cur < (minv[j] ?? Infinity)) {
          minv[j] = cur;
          way[j] = j0;
        }
        if ((minv[j] ?? Infinity) < delta) {
          delta = minv[j] ?? Infinity;
          j1 = j;
        }
      }
      for (let j = 0; j <= cols; j++) {
        if (used[j]) {
          u[p[j] ?? 0] = (u[p[j] ?? 0] ?? 0) + delta;
          v[j] = (v[j] ?? 0) - delta;
        } else minv[j] = (minv[j] ?? 0) - delta;
      }
      j0 = j1;
    } while ((p[j0] ?? 0) !== 0);
    do {
      const j1 = way[j0] ?? 0;
      p[j0] = p[j1] ?? 0;
      j0 = j1;
    } while (j0 !== 0);
  }
  let total = 0;
  for (let j = 1; j <= cols; j++) {
    const r = (p[j] ?? 0) - 1;
    if (r < 0) continue;
    const c = cell(r, j - 1);
    if (c === null) return { cost: null };
    total += c;
  }
  return { cost: total };
}
