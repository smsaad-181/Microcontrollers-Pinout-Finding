# Phase 3 — Stage A (ui-developer self-report, not a validator verdict)

Scope: tasks 3.1, 3.2, 3.3, 3.4, 3.5 (first version), 3.6 (core), 3.12. Branch `phase-3`.

## What works

- **3.1 Shell and routes:** `#/`, `#/board`, `#/modules`, `#/constraints`, `#/results`, `#/p/<data>`
  (placeholder page). Focus moves to the page `<h1>` on route change; skip link; step nav with
  `aria-current="step"`. The catalog is loaded from `catalog/<version>.json`, named in the manifest;
  its SHA-256 is checked with WebCrypto against the manifest; one copy is kept per hash.
- **3.2 Worker:** the engine (`solveDetailed`) runs only in `engine.worker.ts` (Comlink). The main thread
  imports engine/schema as types only. A notice appears at 2 s (the engine's own wall-clock cap);
  the worker is stopped at 10 s; Cancel stops the worker and a new one starts for the next solve.
- **3.3 Board picker:** filters for manufacturer, family, chip, module and revision; status badge
  shows an icon and text (Fully verified / Partially verified / Datasheet required / Unsupported).
- **3.4 Modules:** MiniSearch over names, part numbers, vendors and compact aliases (RC522, MFRC522
  and RFID-RC522 all match). Results are grouped by IC; a modal variant prompt opens when more than
  one breakout matches (BME280: 3, relay boards: 2).
- **3.5 (first version):** Wi-Fi, framework, locked pins (the worker lists the roles), reserved pins.
- **3.6 Results:** interfaces, allocation table (chip GPIO · board label · header position), wiring
  instructions (direct wire, or the part the engine requires), warnings sorted by level with icon
  and text, "why this pin" trace, alternatives, sources (document, revision, locator, quote, link),
  power budget, unsat view (smallest conflict set and ranked relaxations), needs-variant view,
  budget-exhausted notice. Catalog version, hash and rule-set version are shown on every result.
- **3.12:** a disclaimer and a "How to verify" panel on every result.

## Evidence (this session)

- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`: exit 0. `pnpm test`: 44 files, 1370 passed and
  1 skipped. The web app alone: 12 files, 132 tests.
- `pnpm catalog:compile && pnpm --filter web build`: main JS 88.5 kB gzip + worker 60.6 kB gzip, so
  about 149 kB of the 250 kB budget. The catalog is 133 kB gzip.
- Preview smoke with curl: index, manifest, catalog, JS, CSS and worker all return 200. The CSP meta
  tag is present. The served catalog's SHA-256 equals the manifest's.
- Headless Edge driven over CDP (a scratch script, not committed). It picked the board, ran
  BME280 → variant prompt (3 options) → added the module, then solved the worked example. Result:
  ok, 20 assignments, bus pins as in the fixture, 1 Warning + 8 Caution + 1 Info, 99 ms. The
  potentiometer locked to GPIO25 with Wi-Fi on gave the unsat view with 4 ranked fixes. 0
  third-party requests, 0 console errors.

## Missing / next (Stage B)

- 3.7 SVG header view; 3.8 IndexedDB, JSON/CSV export, print stylesheet (only a basic print rule
  exists now). The draft is kept in `sessionStorage` only.
- 3.9 share links (`#/p/` only shows a placeholder); 3.10 PWA/offline; 3.11 Playwright e2e and axe.
- Constraints: no voltage rails and no "existing connections" yet. Modules cannot be renamed in the
  UI (the reducer supports it).
- Wiring does not say which rail each module is powered from: the Recommendation has no
  per-module rail field, so the UI gives generic GND/VCC guidance plus the budget table.
- No accessibility audit has run yet (no axe run).
