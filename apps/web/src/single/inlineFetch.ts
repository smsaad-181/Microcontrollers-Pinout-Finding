// Single-file build only (replaces src/net.ts): answers the app's two catalog requests from the
// manifest and catalog compiled into the page at build time, so the page never touches the network.
// Any other URL (e.g. an older catalog pinned by a share link) gets a 404.
import { catalogFile, catalogText, manifestText } from 'virtual:inline-catalog';
import type { FetchLike } from '../manifest';

const json = (text: string): Response =>
  new Response(text, { status: 200, headers: { 'content-type': 'application/json' } });

export const browserFetch: FetchLike = (input, init) => {
  if (init?.signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  const path = input.split(/[?#]/)[0] ?? '';
  if (path.endsWith('/catalog/catalog-manifest.json')) return Promise.resolve(json(manifestText));
  if (path.endsWith(`/catalog/${catalogFile}`)) return Promise.resolve(json(catalogText));
  return Promise.resolve(new Response('Not found', { status: 404 }));
};
