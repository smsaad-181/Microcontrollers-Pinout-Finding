// Test-only brute force for the unsat analysis: the size of the smallest unsatisfiable subset.
import type { ConflictMember } from '../src/unsat.js';

/** Every subset of `items` of exactly `size` elements, in index order. */
function* combinations<T>(items: readonly T[], size: number, from = 0): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = from; i <= items.length - size; i++) {
    const head = items[i] as T;
    for (const rest of combinations(items, size - 1, i + 1)) yield [head, ...rest];
  }
}

/** Smallest unsatisfiable subset by exhaustive search (ascending size), or null when none exists. */
export function bruteForceMinimum(
  members: readonly ConflictMember[],
  isUnsat: (subset: readonly ConflictMember[]) => boolean,
): { size: number; subset: ConflictMember[] } | null {
  for (let size = 0; size <= members.length; size++) {
    for (const subset of combinations(members, size)) {
      if (isUnsat(subset)) return { size, subset };
    }
  }
  return null;
}
