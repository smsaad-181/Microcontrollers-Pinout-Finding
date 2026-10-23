// Types shared by the engine worker and the main thread. Type-only: the main thread never loads
// engine code; it only receives the engine's answers.
import type { SolveOutcome } from '@pinout/engine';
import type { Project } from '@pinout/schema';
import type { WebCatalog } from '../catalog/loadCatalog';

export interface SolveResponse {
  outcome: SolveOutcome;
  /** Wall-clock time inside the worker, in ms. */
  elapsedMs: number;
  /** Breakout pin label per `instance.role` of the chosen interface (from catalog wiring). */
  pinLabels: Record<string, string>;
}

/** The functions the worker exposes through Comlink. */
export interface EngineApi {
  /** Loads the catalog; `sha256` is the verified hash recorded in every result. */
  init(catalog: WebCatalog, sha256: string): void;
  solve(project: Project): SolveResponse;
  /** Signal roles of a breakout that can be locked (`SDA`, `COIL[2]`, ...), over all interfaces. */
  lockRoles(breakoutId: string): string[];
}
