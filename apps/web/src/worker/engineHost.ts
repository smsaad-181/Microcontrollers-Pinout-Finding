// The engine host that runs inside the Web Worker. Kept free of worker globals so it can be tested
// directly in Node. All pin decisions come from `solveDetailed`.
import {
  indexCatalog,
  solveDetailed,
  wiringFor,
  DEFAULT_TIME_LIMIT_MS,
  type CatalogIndex,
  type InterfaceKind,
} from '@pinout/engine';
import type { Project } from '@pinout/schema';
import type { WebCatalog } from '../catalog/loadCatalog';
import type { EngineApi, SolveResponse } from './api';

/** Breakout pin label per `instance.role`, using the same role naming as the engine (`COIL[2]`). */
export function pinLabelsFor(
  index: CatalogIndex,
  project: Project,
  kinds: Record<string, InterfaceKind>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of project.modules) {
    const breakout = index.breakout(m.breakout);
    const ic = breakout ? index.ic(breakout.ic) : undefined;
    const kind = kinds[m.instance];
    if (!breakout || !ic || kind === undefined) continue;
    const wiring = wiringFor(breakout, ic, kind);
    if (!wiring) continue;
    for (const w of wiring.wired) {
      const count = Math.max(1, w.labels.length);
      for (let i = 0; i < count; i++) {
        const label = w.labels[i];
        if (label === undefined) continue;
        const role = count > 1 ? `${w.signal.role}[${String(i + 1)}]` : w.signal.role;
        out[`${m.instance}.${role}`] = label;
      }
    }
  }
  return out;
}

export function createEngineHost(now: () => number): EngineApi {
  let index: CatalogIndex | null = null;
  let version = '';
  let sha = '';
  const need = (): CatalogIndex => {
    if (index === null) throw new Error('engine worker: catalog not loaded');
    return index;
  };
  return {
    init(catalog: WebCatalog, sha256: string) {
      index = indexCatalog(catalog);
      version = catalog.version;
      sha = sha256;
    },
    solve(project: Project): SolveResponse {
      const idx = need();
      const start = now();
      const outcome = solveDetailed(idx, project, {
        now,
        timeLimitMs: DEFAULT_TIME_LIMIT_MS,
        catalogVersion: version,
        catalogSha256: sha,
      });
      const elapsedMs = now() - start;
      const kinds = Object.fromEntries(
        Object.entries(outcome.recommendation.interfaces).map(([k, v]) => [k, v.kind]),
      );
      return { outcome, elapsedMs, pinLabels: pinLabelsFor(idx, project, kinds) };
    },
    lockRoles(breakoutId: string): string[] {
      const idx = need();
      const breakout = idx.breakout(breakoutId);
      const ic = breakout ? idx.ic(breakout.ic) : undefined;
      if (!breakout || !ic) return [];
      const roles = new Set<string>();
      for (const kind of breakout.interfaces_exposed) {
        const wiring = wiringFor(breakout, ic, kind);
        if (!wiring) continue;
        for (const w of wiring.wired) {
          const count = Math.max(1, w.labels.length);
          for (let i = 0; i < count; i++)
            roles.add(count > 1 ? `${w.signal.role}[${String(i + 1)}]` : w.signal.role);
        }
      }
      return [...roles].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    },
  };
}
