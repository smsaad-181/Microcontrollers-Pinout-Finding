// The app's only network access: fetching our own catalog files. The single-file build
// (vite.single.config.ts) replaces this module with src/single/inlineFetch.ts.
import type { FetchLike } from './manifest';

export const browserFetch: FetchLike = (input, init) => fetch(input, init);
