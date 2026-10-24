// Single-file build only (replaces src/worker/createWorker.ts): the engine worker is bundled into the
// page and started from a blob: URL; see engineHandle.ts for the main-thread fallback.
import EngineWorker from '../worker/engine.worker.ts?worker&inline';
import { createEngineHost } from '../worker/engineHost';
import type { WorkerHandle } from '../worker/solverClient';
import { engineHandle } from './engineHandle';

export function createEngineWorker(): WorkerHandle {
  return engineHandle(
    () => new EngineWorker({ name: 'pinout-engine' }),
    () => createEngineHost(() => performance.now()),
  );
}
