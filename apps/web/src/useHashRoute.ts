import { useMemo, useSyncExternalStore } from 'react';
import { parseHashRoute, type Route } from './route';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const getHash = (): string => window.location.hash;
// Server/test render has no location: render the home route.
const getServerHash = (): string => '';

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return useMemo(() => parseHashRoute(hash), [hash]);
}
