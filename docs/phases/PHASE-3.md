# Phase 3 — Web app

**Goal:** the full user workflow in the browser, deployed to GitHub Pages: board picker → modules
(with variant prompts) → constraints (locked pins, rails, framework) → results (allocation, wiring
table, SVG header view, warnings, alternatives, citations) → export/share.

Skills to load: `github-pages-deploy`, `pin-allocation-engine` (for the result model). Vendored agents
`accessibility-tester` and `typescript-pro` may be used for help.

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 3.1 | App shell, hash routes `#/`, `#/board`, `#/modules`, `#/constraints`, `#/results`, `#/p/<shared>`. Catalog fetch by version + hash cache. | ui-developer | shell |
| 3.2 | Engine in a Web Worker via Comlink; progress + cancel; 2 s timeout message. | ui-developer | worker |
| 3.3 | Board picker with filters (manufacturer, family, chip, module, revision) and **status badge** (Fully verified / Partially verified / Datasheet required). | ui-developer | screen 1 |
| 3.4 | Module search (MiniSearch over part numbers, nicknames, aliases) with **variant prompt** whenever more than one breakout matches. | ui-developer | screen 2 |
| 3.5 | Constraints: locked pins, reserved pins, voltage rails, framework, existing connections. | ui-developer | screen 3 |
| 3.6 | Results: allocation table (GPIO · board label · header position side by side), wiring instructions (direct vs needs-part), "why this pin" traces with citation links, alternatives, warnings with **text + icon** (never colour alone), "no safe assignment" view with fixes. | ui-developer | screen 4 |
| 3.7 | SVG header view generated from board connector data; states: free, assigned, restricted, power, ground, analog, bus. Keyboard focusable, labelled. | ui-developer | board view |
| 3.8 | Persistence: IndexedDB (idb-keyval) with try/catch + in-memory fallback; JSON import/export; CSV export; print stylesheet for PDF. | ui-developer | export |
| 3.9 | Share links: project JSON → lz-string → `#/p/...` with catalog version pinned; old catalog versions kept in `public/catalog/`; "re-check against latest" prompt. | ui-developer | sharing |
| 3.10 | Offline: vite-plugin-pwa; "update available" prompt when the manifest changes. | ui-developer | PWA |
| 3.11 | E2E (Playwright): the worked example end-to-end; a variant prompt; a share-link round trip; offline reload. | test-automator | e2e suite |
| 3.12 | Disclaimer + "how to verify" panel on every result. | ui-developer | copy |

## Gate checklist

- [ ] `pnpm -r test && pnpm --filter web e2e` exit 0 (Playwright against `vite preview` with the production `base`).
- [ ] Bundle: app JS ≤ 250 kB gzip; MVP catalog ≤ 300 kB gzip (CI size report).
- [ ] Accessibility: axe-core finds 0 serious/critical issues on all 5 screens; full keyboard path through the workflow.
- [ ] No third-party network requests at runtime (Playwright request log shows only the Pages origin).
- [ ] Every citation link in the worked-example result opens a URL listed in the evidence records.

*Post-merge* (live site after the deploy on `main`):

- [ ] Pages site loads, runs the worked example, and shows the same allocation as the engine fixture (`playwright` MCP or e2e against the live URL).
- [ ] Refreshing on any route works on Pages (hash routes).

## Validators (run in parallel)

- `phase-validator` — gate commands, live-site checks (use the `playwright` MCP).
- `accessibility-tester` — WCAG 2.1 AA audit of all screens.
- `hardware-fact-auditor` — spot-check 10 citations shown in the UI against their sources.
- `code-reviewer` — UI code, worker boundary, storage error handling.
