import { useEffect, useState } from 'react';
import { loadManifest, manifestUrl, type FetchLike, type ManifestState } from './manifest';

/** Loads the catalog manifest once on mount; aborts the request on unmount. */
export function useCatalogManifest(fetchFn: FetchLike): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    loadManifest(manifestUrl(import.meta.env.BASE_URL), fetchFn, controller.signal).then(
      setState,
      () => {
        // Only rejects when aborted on unmount; nothing to do.
      },
    );
    return () => {
      controller.abort();
    };
  }, [fetchFn]);

  return state;
}
