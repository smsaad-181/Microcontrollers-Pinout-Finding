// Hash routes only: GitHub Pages has no rewrite rules, so path routes would 404 on refresh.

export type Route = { name: 'home' } | { name: 'not-found'; path: string };

/** Turns `location.hash` (e.g. "", "#", "#/", "#/board/x") into a route. */
export function parseHashRoute(hash: string): Route {
  let path = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = path.indexOf('?');
  if (queryAt !== -1) path = path.slice(0, queryAt);
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  return { name: 'not-found', path };
}

/** Builds an href for a hash route, e.g. `hrefFor('/')` returns "#/". */
export function hrefFor(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}
