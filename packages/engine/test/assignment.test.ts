import { describe, expect, it } from 'vitest';
import { minAssignment, scalarCost } from '../src/assignment.js';

type Cell = (r: number, c: number) => number | null;

/** Exhaustive minimum for tiny matrices (rows <= cols). */
function brute(rows: number, cols: number, cell: Cell): number | null {
  let best: number | null = null;
  const used = new Array<boolean>(cols).fill(false);
  const go = (r: number, sum: number): void => {
    if (r === rows) {
      if (best === null || sum < best) best = sum;
      return;
    }
    for (let c = 0; c < cols; c++) {
      const v = cell(r, c);
      if (used[c] || v === null) continue;
      used[c] = true;
      go(r + 1, sum + v);
      used[c] = false;
    }
  };
  go(0, 0);
  return best;
}

describe('minAssignment', () => {
  it('matches exhaustive search on random matrices, including forbidden cells', () => {
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let t = 0; t < 300; t++) {
      const rows = 1 + Math.floor(rnd() * 5);
      const cols = rows + Math.floor(rnd() * 3);
      const m: (number | null)[][] = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (rnd() < 0.3 ? null : Math.floor(rnd() * 9))),
      );
      const cell: Cell = (r, c) => m[r]?.[c] ?? null;
      expect(minAssignment(rows, cols, cell).cost).toBe(brute(rows, cols, cell));
    }
  });
  it('is infeasible with more rows than columns', () => {
    expect(minAssignment(3, 2, () => 1).cost).toBeNull();
  });
  it('folds the four tiers lexicographically', () => {
    expect(scalarCost([1, 0, 0, 0])).toBeGreaterThan(scalarCost([0, 999, 999, 999]));
    expect(scalarCost([0, 1, 0, 0])).toBeGreaterThan(scalarCost([0, 0, 999, 999]));
  });
});
