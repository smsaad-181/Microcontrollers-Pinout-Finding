// Performance (task 2b.11): wall time of `solveDetailed` over the 25 golden fixtures, warm.
// Target p95 <= 200 ms on a dev machine; the CI bound is generous (shared runners). Override with
// PERF_P95_MS / PERF_MAX_MS; PERF_RUNS sets the repetitions per fixture (default 7).
// `PERF_VERBOSE=1 pnpm --filter @pinout/engine test perf` prints the per-fixture table for perf.md.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateRoot } from '../../cli/src/index.js';
import { solveDetailed } from '../src/solver.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const RUNS = Number(process.env.PERF_RUNS ?? 7);
const P95_BOUND_MS = Number(process.env.PERF_P95_MS ?? 1000);
const MAX_BOUND_MS = Number(process.env.PERF_MAX_MS ?? 5000);

const pct = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? Number.NaN;

describe('solve performance over the golden fixtures', () => {
  it('p95 and max stay within the CI bounds', () => {
    const fixtures = validateRoot(`${ROOT}catalog`).catalog.fixtures;
    expect(fixtures.length).toBe(25);
    for (const fx of fixtures) solveDetailed(index, fx.project); // warm-up (JIT, caches)
    const all: number[] = [];
    const rows: { id: string; median: number; max: number; nodes: number }[] = [];
    for (const fx of fixtures) {
      const times: number[] = [];
      let nodes = 0;
      for (let i = 0; i < RUNS; i++) {
        const t0 = performance.now();
        const out = solveDetailed(index, fx.project);
        times.push(performance.now() - t0);
        nodes = out.stats.nodes;
      }
      all.push(...times);
      const s = [...times].sort((a, b) => a - b);
      rows.push({ id: fx.id, median: pct(s, 50), max: s[s.length - 1] ?? 0, nodes });
    }
    all.sort((a, b) => a - b);
    const stats = { p50: pct(all, 50), p95: pct(all, 95), max: all[all.length - 1] ?? 0 };
    const fmt = (n: number): string => n.toFixed(1);
    console.info(
      `[perf] ${String(all.length)} samples: p50 ${fmt(stats.p50)} ms, p95 ${fmt(stats.p95)} ms, max ${fmt(stats.max)} ms`,
    );
    if (process.env.PERF_VERBOSE !== undefined) {
      rows.sort((a, b) => b.max - a.max);
      for (const r of rows)
        console.info(
          `[perf] ${r.id}: median ${fmt(r.median)} ms, max ${fmt(r.max)} ms, nodes ${String(r.nodes)}`,
        );
    }
    expect(stats.p95).toBeLessThanOrEqual(P95_BOUND_MS);
    expect(stats.max).toBeLessThanOrEqual(MAX_BOUND_MS);
  }, 120_000);
});
