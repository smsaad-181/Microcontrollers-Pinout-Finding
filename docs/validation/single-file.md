# Single-file build: `pinout-finder.html`

The pin finder as **one HTML file** that runs by double-clicking it: no server, no install, no
network. The GitHub Pages build is unchanged; this is an extra build target.

## How to build

```sh
pnpm install
pnpm --filter web build:single
# -> apps/web/dist-single/pinout-finder.html
```

`build:single` first runs `pnpm catalog:compile`, so the file always contains the catalog as it
compiles at that moment (it fails if the catalog does not validate). To re-bundle an
already-compiled catalog without recompiling: `pnpm --filter web exec vite build --config vite.single.config.ts`.

## How to use

Copy `pinout-finder.html` anywhere (USB stick, e-mail, shared drive) and open it in a browser.
Everything works from `file://`, offline: board choice, module search, constraints, results,
board view, evidence links (these open the datasheet on the web, of course), project file save
and open, CSV export, print, hash routes (`pinout-finder.html#/board`, `#/results`, ...).

## Size (catalog 5803ea00f666, with DHT11)

| | raw | gzip |
| --- | --- | --- |
| `pinout-finder.html` | 1.68 MB | 361 kB |
| of which the catalog JSON | ~0.96 MB | — |

The engine is in the file twice (base64 blob-worker copy + main-thread fallback copy); this is the
price of the fallback and still opens instantly.

## How it works

`apps/web/vite.single.config.ts` + the build plugin `apps/web/src/singleFile.ts`:

- **Catalog**: `src/net.ts` (the app's only `fetch`) is swapped for `src/single/inlineFetch.ts`,
  which answers the manifest and catalog requests from text compiled into the page. The SHA-256
  check against the manifest still runs in the browser, as on the website.
- **Engine worker**: `src/worker/createWorker.ts` is swapped for `src/single/createWorker.ts`: the
  worker is bundled inline (`?worker&inline`) and started from a `blob:` URL. If the browser refuses
  the worker (constructor throws, or an `error` before it loads the catalog) the same engine runs on
  the main thread behind the same API (`src/single/engineHandle.ts`).
- **No service worker / PWA**: `virtual:pwa-register` is swapped for a no-op; the file contains no
  `serviceWorker` code and no web manifest.
- **Inlining**: JS, CSS and the icon are inlined; the build fails if any `src`/`href` to a local
  file would remain.
- **CSP** (meta tag): `default-src 'none'`, scripts and styles allowed only by SHA-256 hash of the
  inlined blocks, `worker-src blob:`, `img-src data:`, `connect-src 'none'`.

## Limits

- **Share links** made from the single file point at the file on *your* disk
  (`file:///.../pinout-finder.html#/p/...`): they only open on a machine with the file at the same
  path (or after pasting the `#/p/...` part after their own copy's address). To pass a project on,
  use **Save project file (JSON)** and **Open a saved project file**, or the website.
- **Older catalogs**: a shared project pinned to a different catalog version than the one inside
  the file shows "catalog not available" (the website keeps old catalogs; the file has one).
- **Saved draft**: kept in the browser's storage for `file://` pages; some browsers share that
  storage between all local files or drop it (an in-memory fallback is used then, and the status
  line says so).
- **No update prompt**: the file never updates itself. Rebuild it to get a newer catalog.
- **Main-thread fallback**: when a browser blocks workers on `file://`, a long solve briefly freezes
  the page and Cancel / the hard time limit cannot interrupt it.
- Requires a current browser (ES2022, WebCrypto on `file://`): tested with Microsoft Edge
  (Chromium). Chrome and Firefox are expected to behave the same.

## Validation

- `pnpm --filter web e2e:single` (`apps/web/e2e/singleFile.single.ts`, opened via `file://`,
  context offline): worked example solves with the fixture's SPI pins and four switches; engine ran
  in a `blob:` worker; the only request is the file itself; no console errors; the file contains
  no service-worker code. Same flow with `Worker` blocked: solves on the main thread. Direct
  hash-route load works.
- `apps/web/test/singleFile.test.ts`: worker fallback (sync throw and async `error`), HTML inliner
  and CSP hashes, refusal of leftover external references.
- Pages build unchanged: `PW_CHANNEL=msedge pnpm --filter web e2e` still 10/10.
