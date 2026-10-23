import type { Project } from '@pinout/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebCatalog } from '../src/catalog/loadCatalog';
import type { SolveResponse } from '../src/worker/api';
import { SLOW_NOTICE_MS, SolverClient, type WorkerHandle } from '../src/worker/solverClient';

const project: Project = { board: 'b@1', variant: 'v', modules: [], locked: [], reserved: [] };
const catalog = { version: 'v1' } as unknown as WebCatalog;
const response = { elapsedMs: 1, pinLabels: {} } as unknown as SolveResponse;

/** A fake worker whose solve resolves only when the test says so. */
function fakeFactory() {
  const workers: {
    handle: WorkerHandle;
    resolve: (r: SolveResponse) => void;
    reject: (e: Error) => void;
    terminated: boolean;
  }[] = [];
  const factory = (): WorkerHandle => {
    let resolve: (r: SolveResponse) => void = () => undefined;
    let reject: (e: Error) => void = () => undefined;
    const entry = {
      terminated: false,
      resolve: (r: SolveResponse) => {
        resolve(r);
      },
      reject: (e: Error) => {
        reject(e);
      },
      handle: {
        init: vi.fn(() => Promise.resolve()),
        solve: vi.fn(
          () =>
            new Promise<SolveResponse>((res, rej) => {
              resolve = res;
              reject = rej;
            }),
        ),
        lockRoles: vi.fn(() => Promise.resolve(['SW'])),
        terminate: () => {
          entry.terminated = true;
        },
      } as WorkerHandle,
    };
    workers.push(entry);
    return entry.handle;
  };
  return { factory, workers };
}

describe('SolverClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the worker answer and keeps the worker for the next solve', async () => {
    const { factory, workers } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha');
    const t = client.solve(project);
    await vi.advanceTimersByTimeAsync(0);
    workers[0]?.resolve(response);
    await expect(t.result).resolves.toEqual({ status: 'done', response });
    expect(workers[0]?.handle.init).toHaveBeenCalledWith(catalog, 'sha');
    client.solve(project);
    expect(workers).toHaveLength(1);
  });

  it('fires the slow notice at 2 s and stops hard at the timeout, terminating the worker', async () => {
    const { factory, workers } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha', undefined, 5000);
    const onSlow = vi.fn();
    const t = client.solve(project, onSlow);
    await vi.advanceTimersByTimeAsync(SLOW_NOTICE_MS - 1);
    expect(onSlow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onSlow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(t.result).resolves.toEqual({ status: 'timeout', afterMs: 5000 });
    expect(workers[0]?.terminated).toBe(true);
    // a fresh worker is started (and given the catalog) for the next request
    client.solve(project);
    expect(workers).toHaveLength(2);
    expect(workers[1]?.handle.init).toHaveBeenCalledWith(catalog, 'sha');
  });

  it('cancel terminates the worker and a late answer is ignored', async () => {
    const { factory, workers } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha');
    const onSlow = vi.fn();
    const t = client.solve(project, onSlow);
    await vi.advanceTimersByTimeAsync(10);
    t.cancel();
    workers[0]?.resolve(response);
    await expect(t.result).resolves.toEqual({ status: 'cancelled' });
    expect(workers[0]?.terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(SLOW_NOTICE_MS);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('a new solve cancels the running one', async () => {
    const { factory } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha');
    const first = client.solve(project);
    client.solve(project);
    await expect(first.result).resolves.toEqual({ status: 'cancelled' });
  });

  it('reports a worker error', async () => {
    const { factory, workers } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha');
    const t = client.solve(project);
    await vi.advanceTimersByTimeAsync(0);
    workers[0]?.reject(new Error('boom'));
    await expect(t.result).resolves.toEqual({ status: 'error', message: 'boom' });
  });

  it('asks the worker for lockable roles', async () => {
    const { factory } = fakeFactory();
    const client = new SolverClient(factory, catalog, 'sha');
    await expect(client.lockRoles('push-button')).resolves.toEqual(['SW']);
  });
});
