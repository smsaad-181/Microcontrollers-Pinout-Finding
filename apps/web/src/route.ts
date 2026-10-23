// Hash routes only: GitHub Pages has no rewrite rules, so path routes would 404 on refresh.

/** The workflow screens, in order. */
export const STEPS = ['board', 'modules', 'constraints', 'results'] as const;
export type StepName = (typeof STEPS)[number];

/** A hash route: home, one workflow step, a shared project, or a path with no page. */
export type Route =
  | { name: 'home' }
  | { name: StepName }
  | { name: 'shared'; data: string }
  | { name: 'not-found'; path: string };

/** Hashes that are in-page anchors (ids in the document), not routes. */
const IN_PAGE_ANCHORS: readonly string[] = ['#main'];

const isStep = (s: string): s is StepName => (STEPS as readonly string[]).includes(s);

/**
 * Turns `location.hash` (e.g. "", "#", "#/", "#/board") into a route. In-page anchors such as
 * "#main" keep the home page; `#/p/<data>` is a shared project; any other unknown hash is not-found.
 */
export function parseHashRoute(hash: string): Route {
  if (IN_PAGE_ANCHORS.includes(hash)) return { name: 'home' };
  let path = hash.startsWith('#') ? hash.slice(1) : hash;
  const queryAt = path.indexOf('?');
  if (queryAt !== -1) path = path.slice(0, queryAt);
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  const shared = /^\/p\/(.+)$/.exec(path);
  if (shared?.[1] !== undefined) return { name: 'shared', data: shared[1] };
  const step = path.slice(1);
  if (isStep(step)) return { name: step };
  return { name: 'not-found', path };
}

/** Builds an href for a hash route, e.g. `hrefFor('/')` returns "#/". */
export function hrefFor(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

/** The workflow step a route shows, or null for other pages. */
export function stepOf(route: Route): StepName | null {
  return isStep(route.name) ? route.name : null;
}

/** A stable key per page, used to move focus when the page changes. */
export function routeKey(route: Route): string {
  if (route.name === 'not-found') return `not-found:${route.path}`;
  if (route.name === 'shared') return 'shared';
  return route.name;
}
