import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { boardOptions, type BoardOption } from '../catalog/boards';
import { citationIndex, type CitationLookup } from '../catalog/evidence';
import { loadCatalog, type WebCatalog } from '../catalog/loadCatalog';
import { createModuleSearch, type ModuleSearch } from '../catalog/search';
import type { ManifestState } from '../manifest';
import {
  draftReducer,
  projectKey,
  toProject,
  type DraftAction,
  type ProjectDraft,
} from '../project/draft';
import { readDraft, sessionStore, writeDraft } from '../project/storage';
import { useCatalogManifest } from '../useCatalogManifest';
import type { SolveResponse } from '../worker/api';
import { createEngineWorker } from '../worker/createWorker';
import { SolverClient } from '../worker/solverClient';

/** Everything derived from one loaded catalog. */
export interface LoadedCatalog {
  catalog: WebCatalog;
  sha256: string;
  boards: BoardOption[];
  search: ModuleSearch;
  cite: CitationLookup;
  client: SolverClient;
}

export type CatalogState =
  | { status: 'waiting' }
  | { status: 'loading' }
  | { status: 'ready'; data: LoadedCatalog }
  | { status: 'error'; message: string };

export type SolveState =
  | { status: 'idle' }
  | { status: 'running'; key: string; slow: boolean }
  | { status: 'done'; key: string; response: SolveResponse }
  | { status: 'cancelled'; key: string }
  | { status: 'timeout'; key: string; afterMs: number }
  | { status: 'error'; key: string; message: string };

export interface AppStateValue {
  manifest: ManifestState;
  catalog: CatalogState;
  draft: ProjectDraft;
  dispatch: (action: DraftAction) => void;
  solve: SolveState;
  runSolve: () => void;
  cancelSolve: () => void;
}

const AppState = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const v = useContext(AppState);
  if (v === null) throw new Error('useAppState outside <AppStateProvider>');
  return v;
}

function useLoadedCatalog(manifest: ManifestState): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'waiting' });
  useEffect(() => {
    if (manifest.status !== 'ready') return;
    let live = true;
    let client: SolverClient | null = null;
    setState({ status: 'loading' });
    void loadCatalog(import.meta.env.BASE_URL, manifest.manifest, fetch).then((r) => {
      if (!live) return;
      if (r.status !== 'ready') {
        setState({ status: 'error', message: r.message });
        return;
      }
      client = new SolverClient(createEngineWorker, r.catalog, r.sha256);
      setState({
        status: 'ready',
        data: {
          catalog: r.catalog,
          sha256: r.sha256,
          boards: boardOptions(r.catalog),
          search: createModuleSearch(r.catalog),
          cite: citationIndex(r.catalog.evidence),
          client,
        },
      });
    });
    return () => {
      live = false;
      client?.dispose();
    };
  }, [manifest]);
  return state;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const manifest = useCatalogManifest();
  const catalog = useLoadedCatalog(manifest);
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => readDraft(sessionStore()));
  const [solve, setSolve] = useState<SolveState>({ status: 'idle' });
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    writeDraft(sessionStore(), draft);
  }, [draft]);

  const client = catalog.status === 'ready' ? catalog.data.client : null;

  const runSolve = useCallback(() => {
    const project = toProject(draft);
    if (client === null || project === null) return;
    const key = projectKey(project);
    setSolve({ status: 'running', key, slow: false });
    const ticket = client.solve(project, () => {
      setSolve((s) => (s.status === 'running' && s.key === key ? { ...s, slow: true } : s));
    });
    cancelRef.current = ticket.cancel;
    void ticket.result.then((r) => {
      if (cancelRef.current === ticket.cancel) cancelRef.current = null;
      switch (r.status) {
        case 'done':
          setSolve({ status: 'done', key, response: r.response });
          break;
        case 'cancelled':
          setSolve((s) =>
            s.status === 'running' && s.key === key ? { status: 'cancelled', key } : s,
          );
          break;
        case 'timeout':
          setSolve({ status: 'timeout', key, afterMs: r.afterMs });
          break;
        case 'error':
          setSolve({ status: 'error', key, message: r.message });
          break;
      }
    });
  }, [client, draft]);

  const cancelSolve = useCallback(() => {
    cancelRef.current?.();
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({ manifest, catalog, draft, dispatch, solve, runSolve, cancelSolve }),
    [manifest, catalog, draft, solve, runSolve, cancelSolve],
  );
  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}
