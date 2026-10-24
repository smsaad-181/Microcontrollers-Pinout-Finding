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
import type { CatalogManifest, FetchLike, ManifestState } from '../manifest';
import { browserFetch } from '../net';
import {
  draftReducer,
  EMPTY_DRAFT,
  projectKey,
  toProject,
  type CatalogPin,
  type DraftAction,
  type ProjectDraft,
} from '../project/draft';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../project/settings';
import {
  indexedDbStore,
  loadDraft,
  saveDraft,
  SafeStore,
  SETTINGS_KEY,
  type StorageBackend,
} from '../project/storage';
import { useCatalogManifest } from '../useCatalogManifest';
import type { SolveResponse } from '../worker/api';
import { createEngineWorker } from '../worker/createWorker';
import { SolverClient, type WorkerHandle } from '../worker/solverClient';

/** Everything derived from one loaded catalog. */
export interface LoadedCatalog {
  catalog: WebCatalog;
  sha256: string;
  boards: BoardOption[];
  search: ModuleSearch;
  cite: CitationLookup;
  client: SolverClient;
  /** True when this is an older catalog a shared link or file was pinned to. */
  pinned: boolean;
}

export type CatalogState =
  | { status: 'waiting' }
  | { status: 'loading' }
  | { status: 'ready'; data: LoadedCatalog }
  | { status: 'error'; message: string; pinned: boolean };

export type SolveState =
  | { status: 'idle' }
  | { status: 'running'; key: string; slow: boolean; stopAfterMs: number }
  | { status: 'done'; key: string; response: SolveResponse }
  | { status: 'cancelled'; key: string }
  | { status: 'timeout'; key: string; afterMs: number }
  | { status: 'error'; key: string; message: string };

/** Where the draft is kept: still loading, IndexedDB, or memory only (storage unavailable). */
export type StorageState = 'loading' | StorageBackend;

/** Replaceable browser services (tests pass fakes; the app uses the real ones). */
export interface AppServices {
  fetchFn: FetchLike;
  workerFactory: () => WorkerHandle;
  store: SafeStore;
}

export interface AppStateValue {
  manifest: ManifestState;
  /** The latest catalog, from the manifest. */
  latest: CatalogPin | null;
  catalog: CatalogState;
  draft: ProjectDraft;
  dispatch: (action: DraftAction) => void;
  storage: StorageState;
  settings: Settings;
  setSettings: (s: Settings) => void;
  solve: SolveState;
  /** Identity of the current engine input against the loaded catalog, or null. */
  solveKey: string | null;
  runSolve: () => void;
  cancelSolve: () => void;
}

const AppState = createContext<AppStateValue | null>(null);

export function useAppState(): AppStateValue {
  const v = useContext(AppState);
  if (v === null) throw new Error('useAppState outside <AppStateProvider>');
  return v;
}

function defaultServices(): AppServices {
  return {
    fetchFn: browserFetch,
    workerFactory: createEngineWorker,
    store: new SafeStore(indexedDbStore()),
  };
}

/** The catalog to load: the draft's pin when it differs from the latest, else the latest. */
function catalogTarget(
  manifest: ManifestState,
  pin: CatalogPin | null,
): { manifest: CatalogManifest; pinned: boolean } | null {
  if (manifest.status !== 'ready') return null;
  const latest = manifest.manifest;
  if (pin === null || (pin.version === latest.version && pin.sha256 === latest.sha256)) {
    return { manifest: latest, pinned: false };
  }
  return {
    manifest: { version: pin.version, sha256: pin.sha256, date: '', file: `${pin.version}.json` },
    pinned: true,
  };
}

function useLoadedCatalog(
  target: { manifest: CatalogManifest; pinned: boolean } | null,
  services: AppServices,
): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'waiting' });
  const sha = target?.manifest.sha256 ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const t = targetRef.current;
    if (sha === null || t === null) return;
    let live = true;
    let client: SolverClient | null = null;
    setState({ status: 'loading' });
    void loadCatalog(import.meta.env.BASE_URL, t.manifest, services.fetchFn).then((r) => {
      if (!live) return;
      if (r.status !== 'ready') {
        const message = t.pinned
          ? `The catalog this project was made with (${t.manifest.version}) is not available here. ${r.message}`
          : r.message;
        setState({ status: 'error', message, pinned: t.pinned });
        return;
      }
      client = new SolverClient(services.workerFactory, r.catalog, r.sha256);
      setState({
        status: 'ready',
        data: {
          catalog: r.catalog,
          sha256: r.sha256,
          boards: boardOptions(r.catalog),
          search: createModuleSearch(r.catalog),
          cite: citationIndex(r.catalog.evidence),
          client,
          pinned: t.pinned,
        },
      });
    });
    return () => {
      live = false;
      client?.dispose();
    };
  }, [sha, services]);
  return state;
}

/** Loads the saved draft and settings once, then saves every change. */
function usePersistentDraft(store: SafeStore) {
  const [draft, rawDispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [storage, setStorage] = useState<StorageState>('loading');
  const touched = useRef(false);

  const dispatch = useCallback((action: DraftAction) => {
    touched.current = true;
    rawDispatch(action);
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all([loadDraft(store), store.get(SETTINGS_KEY)]).then(([d, s]) => {
      if (!live) return;
      // A change made while storage was loading (e.g. opening a shared link) wins.
      if (!touched.current) rawDispatch({ type: 'load', draft: d });
      setSettingsState(parseSettings(s));
      setStorage(store.backend);
    });
    return () => {
      live = false;
    };
  }, [store]);

  useEffect(() => {
    if (storage === 'loading') return;
    void saveDraft(store, draft).then(() => {
      setStorage(store.backend);
    });
  }, [store, draft, storage]);

  const setSettings = useCallback(
    (s: Settings) => {
      setSettingsState(s);
      void store.set(SETTINGS_KEY, s).then(() => {
        setStorage(store.backend);
      });
    },
    [store],
  );

  return { draft, dispatch, settings, setSettings, storage };
}

export function AppStateProvider({
  children,
  services: given,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const [services] = useState<AppServices>(() => given ?? defaultServices());
  const manifest = useCatalogManifest(services.fetchFn);
  const { draft, dispatch, settings, setSettings, storage } = usePersistentDraft(services.store);
  const target = catalogTarget(manifest, draft.catalogPin);
  const catalog = useLoadedCatalog(target, services);
  const [solve, setSolve] = useState<SolveState>({ status: 'idle' });
  const cancelRef = useRef<(() => void) | null>(null);

  const latest = useMemo<CatalogPin | null>(
    () =>
      manifest.status === 'ready'
        ? { version: manifest.manifest.version, sha256: manifest.manifest.sha256 }
        : null,
    [manifest],
  );

  const ready = catalog.status === 'ready' ? catalog.data : null;
  const project = useMemo(() => toProject(draft), [draft]);
  const solveKey =
    ready !== null && project !== null ? `${ready.sha256}|${projectKey(project)}` : null;
  const stopAfterMs = settings.stopAfterS * 1000;

  const runSolve = useCallback(() => {
    if (ready === null || project === null || solveKey === null) return;
    const key = solveKey;
    setSolve({ status: 'running', key, slow: false, stopAfterMs });
    const ticket = ready.client.solve(
      project,
      () => {
        setSolve((s) => (s.status === 'running' && s.key === key ? { ...s, slow: true } : s));
      },
      stopAfterMs,
    );
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
  }, [ready, project, solveKey, stopAfterMs]);

  const cancelSolve = useCallback(() => {
    cancelRef.current?.();
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      manifest,
      latest,
      catalog,
      draft,
      dispatch,
      storage,
      settings,
      setSettings,
      solve,
      solveKey,
      runSolve,
      cancelSolve,
    }),
    [
      manifest,
      latest,
      catalog,
      draft,
      dispatch,
      storage,
      settings,
      setSettings,
      solve,
      solveKey,
      runSolve,
      cancelSolve,
    ],
  );
  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}
