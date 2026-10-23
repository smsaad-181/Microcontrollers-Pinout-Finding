# Phase 3 — Stage B (ui-developer self-report, not a validator verdict)

Scope: tasks 3.5 (finished), 3.7, 3.8, 3.9 and 3.10, plus the stage A gaps (the worker stop and
saved drafts). Branch `phase-3`, not pushed. Playwright e2e (3.11) is stage C.

## What works

- **3.5 Constraints:**
  - **Voltage rails:** a read-only table per board: rail, voltage, current limit, what supplies it,
    the fact status as text, and source links. There is no override input, because the engine does
    not read `Project.rails` (see "Open points").
  - **Existing connections:** a pin plus an optional note. The pad goes to the engine as reserved,
    and the note is shown on the header view.
  - **Wire length:** feeds `wiring_length_m`. Bad input is flagged with `aria-invalid` and a
    message.
  - **Hard stop:** you choose when a long search is stopped (5, 10, 30 or 60 s).
- **3.2 gap fixed:** the notice still comes at 2 s and says when the search will stop. At that
  point the Cancel button becomes "Stop now". The hard stop uses your setting and is never earlier
  than 2 s. Stopping terminates the worker; a new one starts for the next solve.
- **3.7 Header view:** an SVG drawn from the catalog connector data (no vendor graphics). It shows
  7 states: free, assigned, bus, restricted, power, ground and analog. Each state has its own shape
  and a text legend, so colour is never the only signal.
  - "Bus" means a shared bus line (SDA, SCL, SCK, MOSI, MISO…) or a pad used by more than one
    signal. Chip selects and resets count as assigned.
  - "Restricted" means one of: you reserved it, it is already wired, the module uses it inside, or
    it is a reset/EN/NC pin.
  - The view is one tab stop. Arrow keys move between pins and headers; Home and End also work.
  - Each pin is a labelled button, e.g. "J3 pin 11, IO17, GPIO17, Bus, env.SDA". The selected pin
    is read out through `aria-live`.
  - It appears on Constraints (locks and reserves) and on Results (the engine's assignments).
- **3.8 Persistence and export:**
  - **Saving:** the draft and settings are saved in IndexedDB (idb-keyval) behind `SafeStore`.
    The first failed read or write switches to memory for the rest of the session and keeps the
    last value. The header says "Project saved in this browser", or "Not saved: browser storage
    is unavailable".
  - **Validation:** stored data, imported files and links are all checked field by field.
  - **Files:** you can save and open a project file (JSON) and export the pin table (CSV). The CSV
    is RFC 4180 with formula injection blocked, and records the catalog and rule-set versions.
  - **Print:** a print stylesheet hides navigation and controls, opens every `<details>`, prints
    citation URLs and draws the header view in black.
- **3.9 Share links:** `#/p/<lz-string>` holds the project and the catalog version and SHA-256.
  - The shared page shows what will be loaded and replaces nothing until you click "Open".
  - **Older catalog:** if the link's catalog differs from the latest, you can either "Open and
    re-check against the latest catalog" or "Open with catalog X (as shared)".
  - **Loading the pinned catalog:** it loads `catalog/<version>.json` and checks it against the
    SHA-256 in the link. If that file is missing, an error is shown with a re-check button.
  - **Banner:** while a pinned catalog is in use, Results shows a "Re-check against the latest
    catalog" banner.
- **3.10 Offline:** vite-plugin-pwa (generateSW, `registerType: 'prompt'`).
  - **What is cached up front:** the app, the catalog manifest and the current catalog. The catalog
    hash is their revision, so a new catalog or a new app version shows "A new version… is
    available" with Update now / Later.
  - **Older catalogs:** cached when first used (CacheFirst).
  - **Manifest and icon:** `manifest.webmanifest` plus our own `icon.svg`.

## Evidence (this session)

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `check:rules-disabled`, `check:boundaries`:
  exit 0.
- `pnpm test`: 47 files, 1402 passed and 1 skipped. The web app alone: 17 files.
  - New tests: draft and storage fallback (throwing store, write-only failure, no storage),
    configurable hard stop, share round trip through the hash route, 7 damaged-link cases, JSON
    file round trip, CSV escaping, header-view states on the real catalog plus a solved result.
  - **axe-core (jsdom, `test/a11y.test.tsx`):** home, board, modules, constraints, results, shared
    link and not-found pages, rendered with the real catalog and the real engine. 0 violations of
    any impact (WCAG 2.0/2.1 A and AA plus best practice). The test fails on any violation, not
    only serious or critical ones.
- **Build:** `pnpm --filter web build`, sizes gzip:

  | File | Size |
  | --- | --- |
  | Main JS | 99.4 kB |
  | Worker | 60.5 kB |
  | workbox-window | 2.2 kB |
  | sw.js plus workbox runtime | about 8.3 kB |
  | **Total** | **about 170 kB of the 250 kB budget** |
  | CSS | 2.5 kB |
  | Catalog | 132 kB |

  The precache has 9 entries, with no duplicates. The CSP meta tag is still injected. The only
  URL strings in the bundles are XML namespaces, React error links and JSON-Schema ids; none are
  fetched.
- **Headless Edge over CDP against `vite preview`** (a scratch script, not committed):
  - The service worker became ready.
  - The share link opened the worked example: "Pins assigned", 38 header pins, 10 bus pins.
  - Arrow-down moved focus to the next pin.
  - After a real reload the project came back from IndexedDB, and "Project saved in this browser"
    was shown.
  - Constraints showed the rails and existing connections.
  - Print media hid the header.
  - With the network offline, a real reload still produced "Pins assigned" (served by the service
    worker).
  - 0 third-party requests, 0 console errors.

## Open points (for the lead / later stages)

- **Rail overrides:** `Project.rails` is in the schema but the engine ignores it, so the UI shows
  rails read-only instead of offering an input that would do nothing. Adding overrides needs an
  engine change first (a decision for the lead).
- **Old catalogs on Pages:** `apps/web/public/catalog/` is git-ignored and rebuilt at deploy, so
  only the current catalog is served. For pinned share links to keep working, the deploy must keep
  earlier `<version>.json` files (ci-pages-engineer). Until then, an old link falls back to the
  "not available, re-check" message.
- **axe limits in jsdom:** colour contrast is not measured (no layout), and label-in-name is
  "needs review" for header pins (the spoken label contains the visible label plus position and
  state). The variant-prompt `<dialog>` was not scanned. All three are for the Playwright and axe
  run in a real browser (stage C).
- **Carried over from stage A:** there is still no per-module rail in the wiring text (the
  Recommendation has no such field), and modules cannot be renamed in the UI.
- **Commit trailer:** commits carry `Co-Authored-By: Claude Opus 5.5`, the model that actually ran
  this session, not the Sonnet trailer in the brief.
