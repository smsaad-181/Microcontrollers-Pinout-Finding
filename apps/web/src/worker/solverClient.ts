// Main-thread side of the engine worker: one solve at a time, with a "slow" notice at 2 s, a hard
// stop, and cancel. Cancel and the hard stop terminate the worker (a synchronous solve cannot be
// interrupted otherwise) and start a fresh one for the next request.
import type { Project } from '@pinout/schema';
import type { WebCatalog } from '../catalog/loadCatalog';
import type { SolveResponse } from './api';

/** The engine's own wall-clock cap; the UI says so when a solve passes it. */
export const SLOW_NOTICE_MS = 2000;
/** Hard stop: the worker is terminated if no answer arrives by then. */
export const HARD_TIMEOUT_MS = 10000;

/** What the client needs from a worker: async engine calls and a way to kill it. */
export interface WorkerHandle {
  init: (catalog: WebCatalog, sha256: string) => Promise<void>;
  solve: (project: Project) => Promise<SolveResponse>;
  lockRoles: (breakoutId: string) => Promise<string[]>;
  terminate: () => void;
}

export type SolveRun =
  | { status: 'done'; response: SolveResponse }
  | { status: 'cancelled' }
  | { status: 'timeout'; afterMs: number }
  | { status: 'error'; message: string };

export interface SolveTicket {
  result: Promise<SolveRun>;
  cancel: () => void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => {
    globalThis.clearTimeout(id as ReturnType<typeof setTimeout>);
  },
};

export class SolverClient {
  private worker: WorkerHandle | null = null;
  private ready: Promise<void> | null = null;
  private active: (() => void) | null = null;

  constructor(
    private readonly factory: () => WorkerHandle,
    private readonly catalog: WebCatalog,
    private readonly sha256: string,
    private readonly timers: Timers = realTimers,
    private readonly hardTimeoutMs = HARD_TIMEOUT_MS,
  ) {}

  private ensure(): { worker: WorkerHandle; ready: Promise<void> } {
    if (this.worker === null || this.ready === null) {
      this.worker = this.factory();
      this.ready = this.worker.init(this.catalog, this.sha256);
    }
    return { worker: this.worker, ready: this.ready };
  }

  private kill(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  /** Starts a solve; a solve still running is cancelled first. `onSlow` fires at 2 s. */
  solve(project: Project, onSlow?: () => void): SolveTicket {
    this.active?.();
    const { worker, ready } = this.ensure();
    let settle: (r: SolveRun) => void = () => undefined;
    const result = new Promise<SolveRun>((resolve) => {
      settle = resolve;
    });
    let done = false;
    const slowId = this.timers.setTimeout(() => {
      if (!done) onSlow?.();
    }, SLOW_NOTICE_MS);
    const hardId = this.timers.setTimeout(() => {
      finish({ status: 'timeout', afterMs: this.hardTimeoutMs }, true);
    }, this.hardTimeoutMs);
    const finish = (r: SolveRun, killWorker: boolean) => {
      if (done) return;
      done = true;
      this.timers.clearTimeout(slowId);
      this.timers.clearTimeout(hardId);
      if (this.active === cancel) this.active = null;
      if (killWorker) this.kill();
      settle(r);
    };
    const cancel = () => {
      finish({ status: 'cancelled' }, true);
    };
    this.active = cancel;
    ready
      .then(() => worker.solve(project))
      .then(
        (response) => {
          finish({ status: 'done', response }, false);
        },
        (err: unknown) => {
          finish(
            { status: 'error', message: err instanceof Error ? err.message : String(err) },
            true,
          );
        },
      );
    return { result, cancel };
  }

  /** Lockable roles of a breakout (asks the engine; never computed on the main thread). */
  async lockRoles(breakoutId: string): Promise<string[]> {
    const { worker, ready } = this.ensure();
    await ready;
    return worker.lockRoles(breakoutId);
  }

  dispose(): void {
    this.active?.();
    this.kill();
  }
}
