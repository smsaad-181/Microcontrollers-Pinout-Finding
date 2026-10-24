// Single-file build: run the engine in a (blob) Web Worker when the browser allows it, otherwise on
// the main thread behind the same async API. A page opened from file:// may be refused a worker
// either synchronously (the constructor throws) or later (an `error` event before `init` answers).
import { wrap } from 'comlink';
import type { EngineApi } from '../worker/api';
import type { WorkerHandle } from '../worker/solverClient';

/** Runs `fn` after a macrotask, so the UI can paint its "solving" state before a blocking solve. */
function later<T>(fn: () => T): Promise<T> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(fn);
}

function mainThread(host: EngineApi): WorkerHandle {
  return {
    init: (catalog, sha256) =>
      later(() => {
        host.init(catalog, sha256);
      }),
    solve: (project) => later(() => host.solve(project)),
    lockRoles: (id) => later(() => host.lockRoles(id)),
    terminate: () => undefined,
  };
}

/**
 * A `WorkerHandle` over `spawn()`'s worker, falling back to `local()` on the main thread when the
 * worker cannot be created or fails before it has loaded the catalog.
 */
export function engineHandle(spawn: () => Worker, local: () => EngineApi): WorkerHandle {
  let worker: Worker;
  try {
    worker = spawn();
  } catch {
    return mainThread(local());
  }
  const remote = wrap<EngineApi>(worker);
  const failed = new Promise<'failed'>((resolve) => {
    worker.addEventListener(
      'error',
      () => {
        resolve('failed');
      },
      { once: true },
    );
  });
  let fallback: WorkerHandle | null = null;
  return {
    init: async (catalog, sha256) => {
      const r = await Promise.race([
        remote.init(catalog, sha256).then(() => 'ok' as const),
        failed,
      ]);
      if (r === 'failed') {
        worker.terminate();
        fallback = mainThread(local());
        await fallback.init(catalog, sha256);
      }
    },
    solve: (project) => (fallback ? fallback.solve(project) : remote.solve(project)),
    lockRoles: (id) => (fallback ? fallback.lockRoles(id) : remote.lockRoles(id)),
    terminate: () => {
      worker.terminate();
    },
  };
}
