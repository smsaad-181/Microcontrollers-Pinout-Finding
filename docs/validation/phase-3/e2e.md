# Phase 3 end-to-end report (task 3.11)

Run: `PW_CHANNEL=msedge pnpm --filter web e2e` (production build, `vite preview` on :4173, base `/Microcontrollers-Pinout-Finding/`). Result: 10 of 10 passed. CI should install Chromium and omit `PW_CHANNEL`.

| Check | Test | Result |
| --- | --- | --- |
| Worked example matches engine golden (exact SPI3 pins, all_used, no_pad_in, input-only switches, warnings) | workflow: worked example | pass |
| Every citation link is in the evidence records | workflow: citation links | pass |
| Variant prompt (Escape, disabled confirm, direct add for single-board parts) | workflow: variant prompt | pass |
| Share-link round trip in a fresh browser context, same allocation | workflow: share link | pass |
| Unsatisfiable view shows conflict and fixes | workflow: unsat | pass |
| Real-browser axe (incl. colour contrast), 0 serious/critical on 5 screens and variant dialog | quality: axe | pass |
| Only the app origin contacted | quality: request log | pass |
| Offline reload from service-worker cache | quality: offline | pass |
| Refresh on every hash route, share route, unknown route | quality: refresh | pass |
| Keyboard-only board, module, results path | quality: keyboard | pass |

Size (`pnpm check:size`): app JS 169.2 kB gzip (limit 250), catalog 131.7 kB gzip (limit 300).

App fix made while building the suite: BoardView pin buttons no longer contain their visible text (the label now sits beside the button in an aria-hidden group), so the accessible name is the full pin description (label-in-name).

Also green: lint, typecheck, format:check, `pnpm test` (1402 passed, 1 skipped).
Note: axe runs with `bypassCSP` only to inject axe-core; the app's CSP is otherwise unchanged.
