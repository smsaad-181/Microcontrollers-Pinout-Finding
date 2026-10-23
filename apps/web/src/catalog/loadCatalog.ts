// Loads the versioned catalog named by the manifest, checks its SHA-256 against the manifest, and
// keeps one parsed copy per hash. The file name is content-addressed (`<version>.json`), so the
// browser HTTP cache can keep it; only the manifest is fetched with `no-cache`.
import type { Catalog } from '@pinout/engine';
import type { Evidence } from '@pinout/schema';
import type { CatalogManifest, FetchLike } from '../manifest';

/** The compiled catalog as shipped in `public/catalog/<version>.json`. */
export interface WebCatalog extends Catalog {
  evidence: readonly Evidence[];
  version: string;
  format: number;
}

export type CatalogLoadResult =
  | { status: 'ready'; catalog: WebCatalog; sha256: string }
  | { status: 'error'; message: string };

/** Hex SHA-256 of a UTF-8 string (injected so tests do not need WebCrypto). */
export type Digest = (text: string) => Promise<string>;

/** WebCrypto SHA-256, available in secure contexts (https and localhost). */
export const webDigest: Digest = async (text) => {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const SAFE_FILE = /^[0-9a-z][0-9a-z._-]*\.json$/;
const ENTITY_KEYS = ['boards', 'breakouts', 'chips', 'evidence', 'ics', 'modules'] as const;

/** The catalog file name from the manifest; never a path (no slashes, no `..`). */
export function catalogFileName(manifest: CatalogManifest): string | null {
  const file = manifest.file ?? `${manifest.version}.json`;
  return SAFE_FILE.test(file) && !file.includes('..') ? file : null;
}

/** URL of the versioned catalog, relative to the Vite base. */
export function catalogUrl(baseUrl: string, file: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}catalog/${file}`;
}

function isWebCatalog(value: unknown): value is WebCatalog {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'string' && ENTITY_KEYS.every((k) => Array.isArray(v[k]));
}

const cache = new Map<string, Promise<CatalogLoadResult>>();

/** Clears the in-memory cache (tests). */
export function clearCatalogCache(): void {
  cache.clear();
}

async function fetchCatalog(
  baseUrl: string,
  manifest: CatalogManifest,
  fetchFn: FetchLike,
  digest: Digest,
): Promise<CatalogLoadResult> {
  const file = catalogFileName(manifest);
  if (file === null) return { status: 'error', message: 'The catalog manifest names an invalid file.' };
  let text: string;
  try {
    const response = await fetchFn(catalogUrl(baseUrl, file));
    if (!response.ok) {
      return { status: 'error', message: `Catalog request failed (HTTP ${response.status}).` };
    }
    text = await response.text();
  } catch {
    return { status: 'error', message: 'Network error while loading the catalog.' };
  }
  let actual: string;
  try {
    actual = await digest(text);
  } catch {
    return { status: 'error', message: 'This browser cannot check the catalog hash (WebCrypto).' };
  }
  if (actual !== manifest.sha256) {
    return {
      status: 'error',
      message: 'The catalog file does not match the hash in its manifest. Reload the page.',
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { status: 'error', message: 'The catalog file is not valid JSON.' };
  }
  if (!isWebCatalog(data) || data.version !== manifest.version) {
    return { status: 'error', message: 'The catalog file does not have the expected content.' };
  }
  return { status: 'ready', catalog: data, sha256: actual };
}

/**
 * Loads (once per manifest hash) and verifies the catalog. Never rejects. A failed load is not
 * cached, so a retry fetches again.
 */
export function loadCatalog(
  baseUrl: string,
  manifest: CatalogManifest,
  fetchFn: FetchLike,
  digest: Digest = webDigest,
): Promise<CatalogLoadResult> {
  const hit = cache.get(manifest.sha256);
  if (hit) return hit;
  const pending = fetchCatalog(baseUrl, manifest, fetchFn, digest).then((r) => {
    if (r.status !== 'ready') cache.delete(manifest.sha256);
    return r;
  });
  cache.set(manifest.sha256, pending);
  return pending;
}
