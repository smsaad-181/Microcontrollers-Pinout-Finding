// Hash routes only: GitHub Pages has no rewrite rules, so path routes would 404 on refresh.

/** A hash route: the home page, or a path with no page. */
export type Route = { name: 'home' } | { name: 'not-found'; path: string };

/** Hashes that are in-page anchors (ids in the document), not routes. */
const IN_PAGE_ANCHORS: readonly string[] = ['#main'];

/**
 * Turns `location.hash` (e.g. "", "#", "#/", "#/board/x") into a route. In-page anchors such as
 * "#main" keep the current page (home); any other unknown hash is a not-found route.
 */
export function parseHashRoute(hash: string): Route {
  if (IN_PAGE_ANCHORS.includes(hash)) return { name: 'home' };
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
