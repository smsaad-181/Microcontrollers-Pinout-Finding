Doing: Everything is pushed to GitHub (main, c4e35ad). Pin finder has 25+ boards and DHT11; single HTML file built.
Why: Pin finder only, as HTML (Phase 4 skipped).
Folder: D:\Development\pinout-finder-kit\pinout-finder
Who: Nobody working right now.
Next: Phase 5: docs (README, CONTRIBUTING, provenance), weekly link checker, bench-test procedure for you, release prep.
Needs you: Nothing now. Later: bench test on a real ESP32, turn on GitHub Pages.
Where: Overall about 95%.

## Update (pickers redesigned)
Board page has a brand sidebar (ESP > Espressif/Waveshare/..., Arduino, Raspberry Pi), search and photo cards. Module page has categories and one card per board version. Photos for all boards and modules (credits in docs/image-credits.md; most are product images used with credit, the owner chose this). Single HTML rebuilt. Next: Phase 5 (pin finder only).

## Update (Phase 5 built)
Phase 5 work is done on branch phase-5 and merged to main: link checker (`pnpm check:links`, weekly links.yml), README, provenance, CONTRIBUTING, CODEOWNERS, CHANGELOG, docs/RELEASE.md, bench procedure. Reviewer: PASS (0 Critical/Major, 6 minor; 3 fixed). 12 of 12 sampled facts re-confirmed. Waiting for the owner: run docs/validation/phase-5/bench-procedure.md and fill bench.md, then follow docs/RELEASE.md (push, enable Pages, restore deploy trigger, tag v1.0.0). Overall about 98%.

## Update (UX overhaul)
Plain-language redesign: step tracker with done states, sticky Back/Next bar, help for jargon, "Your rules" screen, Home "Try an example", Results as a wiring guide with warnings grouped (Fix before you wire / Check this / Good to know). Plain wording lives in apps/web/src/results/plain.ts (not independently reviewed; fact-check before v1.0). Checks: 171 unit, 11 e2e (incl. axe light and dark) pass.

## Update (micropinouts-style redesign)
Light teal theme, top-bar wizard nav, Home hero with search + brand pills, spec chips on cards, and a colour-coded pinout diagram (src/components/pinout/*) on the Board step (BoardDetails) and the Results page. Pin functions come only from catalog pad data. 176 unit tests, 11 e2e (axe light+dark) pass.
