# Phase 5 — v1.0 launch

**Goal:** production-ready public release with documentation, weekly source-link checking, a hardware
bench check of the engine's boot-risk predictions, and a tagged release.

## Human checkpoint (mid-phase, after task 5.3)

- [ ] The user performs the bench check from `docs/validation/phase-5/bench-procedure.md` on real
      boards and records results in `docs/validation/phase-5/bench.md`. Claude prepares the procedure
      and cannot do this step itself; the loop pauses here and resumes when the user says "continue".

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 5.1 | `links.yml`: weekly job requests every evidence URL, compares redirects and (for downloadable files) SHA-256; opens an issue listing affected facts on change. | ci-pages-engineer | workflow |
| 5.2 | Docs: README (product), `docs/schema.md`, `CONTRIBUTING.md` (two-key process, `/add-board`), `docs/provenance.md` (source policy, licences), disclaimer. | ci-pages-engineer | docs |
| 5.3 | Bench-check procedure for the user: (a) ESP32-DevKitC V4 (WROOM-32E, 3.3 V flash) with 10 kΩ pull-up from GPIO12 to 3V3 at power-on → expect boot failure (VDD_SDIO 1.8 V) unless the eFuse override is burned (check `espefuse.py summary` first); (b) 10 kΩ pull-down from GPIO0 to GND at reset → expect download mode ("waiting for download" on the serial console); (c) GPIO5 used as SPI CS with an idle-high device → expect normal boot; (d) Uno R4 Minima LED + 220 Ω on a GPIO → measure ≈ 13 mA (> 8 mA rating), confirming the engine's Critical (an over-rating measurement, not a failure to reproduce). | hardware-researcher | `docs/validation/phase-5/bench-procedure.md` |
| 5.4 | Enable required human reviews on `catalog/**` via CODEOWNERS when a second maintainer exists (document how in CONTRIBUTING). | ci-pages-engineer | protection |
| 5.5 | Release prep on the branch: changelog, release notes draft, catalog version frozen. The `v1.0.0` tag and GitHub release are created **post-merge** on `main`. | ci-pages-engineer | release prep |

## Gate checklist

- [ ] All previous phase gates still pass on `main` (re-run full test + e2e).
- [ ] `links.yml` dry run passes (`gh workflow run links.yml` then check conclusion).
- [ ] Bench results: every predicted failure reproduced; any mismatch opens a catalog issue and blocks release.

*Post-merge:*

- [ ] Live site Lighthouse accessibility ≥ 95 and no console errors.
- [ ] Tag `v1.0.0` on the merge commit and GitHub release with notes exist.

## Validators (run in parallel)

- `phase-validator`, `hardware-fact-auditor` (final 10 % random re-verification of the whole catalog),
  `github-actions-expert` (all workflows), `accessibility-tester` (live site).
