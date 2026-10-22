import { useEffect, useState } from 'react';
import { loadManifest, manifestUrl, type ManifestState } from './manifest';

/** Loads the catalog manifest once on mount; aborts the request on unmount. */
export function useCatalogManifest(): ManifestState {
  const [state, setState] = useState<ManifestState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    loadManifest(manifestUrl(import.meta.env.BASE_URL), fetch, controller.signal).then(
      setState,
      () => {
        // Only rejects when aborted on unmount; nothing to do.
      },
    );
    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
