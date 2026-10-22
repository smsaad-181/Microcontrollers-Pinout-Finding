// Catalog manifest: the small JSON file `catalog:compile` writes next to the versioned catalog.
// Validated with a minimal type guard so the web app does not depend on the CLI package.

export interface CatalogManifest {
  version: string;
  date: string;
  sha256: string;
  /** Entity counts (boards, modules, ...). */
  counts?: Record<string, number>;
}

export type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: CatalogManifest }
  | { status: 'missing' }
  | { status: 'invalid'; reason: string }
  | { status: 'error'; message: string };

export type LoadedManifestState = Exclude<ManifestState, { status: 'loading' }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isCatalogManifest(value: unknown): value is CatalogManifest {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.version)) return false;
  if (!isNonEmptyString(value.date)) return false;
  if (!isNonEmptyString(value.sha256)) return false;
  if (value.counts !== undefined) {
    if (!isRecord(value.counts)) return false;
    for (const n of Object.values(value.counts)) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return false;
    }
  }
  return true;
}

/** URL of the manifest, always relative to the Vite base (never an absolute host). */
export function manifestUrl(baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}catalog/catalog-manifest.json`;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Fetches and validates the manifest. Never rejects, except when `signal` aborts the request. */
export async function loadManifest(
  url: string,
  fetchFn: FetchLike,
  signal?: AbortSignal,
): Promise<LoadedManifestState> {
  let response: Response;
  try {
    response = await fetchFn(url, signal ? { cache: 'no-cache', signal } : { cache: 'no-cache' });
  } catch (err) {
    if (signal?.aborted) throw err;
    return { status: 'error', message: 'Network error while loading the catalog manifest.' };
  }
  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) {
    return {
      status: 'error',
      message: `Catalog manifest request failed (HTTP ${response.status}).`,
    };
  }
  // The Vite dev server answers unknown paths with index.html (200); treat that as "not built".
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return { status: 'missing' };

  let data: unknown;
  try {
    data = JSON.parse(await response.text()) as unknown;
  } catch (err) {
    // An abort while the body streams is not a bad manifest: surface it like a fetch abort.
    if (signal?.aborted) throw err;
    return { status: 'invalid', reason: 'The catalog manifest is not valid JSON.' };
  }
  if (!isCatalogManifest(data)) {
    return { status: 'invalid', reason: 'The catalog manifest does not have the expected fields.' };
  }
  return { status: 'ready', manifest: data };
}
