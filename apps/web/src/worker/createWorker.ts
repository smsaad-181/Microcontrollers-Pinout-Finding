// Browser-only: spawns the engine worker and wraps it with Comlink.
import { wrap } from 'comlink';
import type { EngineApi } from './api';
import type { WorkerHandle } from './solverClient';

export function createEngineWorker(): WorkerHandle {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), {
    type: 'module',
    name: 'pinout-engine',
  });
  const api = wrap<EngineApi>(worker);
  return {
    init: (catalog, sha256) => api.init(catalog, sha256),
    solve: (project) => api.solve(project),
    lockRoles: (id) => api.lockRoles(id),
    terminate: () => {
      worker.terminate();
    },
  };
}
