---
name: catalog-onboarding
description: Step-by-step procedure to add a new board, module variant, sensor IC or breakout to the catalog with the two-key process, including the checklist, file templates and acceptance criteria. Use for /add-board, /add-module, and Phase 2a/6 catalog work.
---

# Catalog onboarding

## Add a board

1. **Identify exactly**: vendor, product name, revision, module variants (flash/PSRAM), USB
   implementation (bridge vs native). If the board has no official documentation, it can only enter
   as `community` (photo/schematic evidence required) — say so to the user.
2. **Research** (`hardware-researcher`): board guide/pinout + schematic, module datasheet, chip
   datasheet + TRM chapter for IO MUX, errata. Evidence records first.
3. **Draft** board YAML from `docs/templates/board.yaml`; connectors with every position; onboard parts
   consuming pins; rails with current ratings (from schematic: regulator part + its datasheet).
4. **Blind audit** (`hardware-fact-auditor`) → audit file.
5. **Reconcile** (`catalog-author`) → statuses; run `pnpm catalog:validate`.
6. **Fixtures** (`fixture-author`): ≥ 3 for a new board — one happy path, one strap/reserved trap,
   one electrical limit case.
7. **Validate**: `phase-validator` + `hardware-fact-auditor` sampling report.

## Add a module (sensor/display/actuator)

1. IC record (if new): interfaces, signals, limits, address options, select straps, supply ranges.
2. Breakout record(s): one per vendor/variant that differs in regulator, level shifting, pull-ups,
   pin order or hardwired interface. Aliases for search (e.g. "RC522", "RFID-RC522", "MFRC522 module").
3. Where the vendor gives no schematic, measured or photographed evidence may be recorded with
   `community` status and a Caution in results.
4. Fixtures: at least one per supported interface plus one unsafe-connection negative case.

Templates: `docs/templates/board.yaml`, `docs/templates/ic-breakout.yaml`, `docs/templates/evidence.yaml`.

## Gate (board-<id> / module-<id> scopes)

Validators: `hardware-fact-auditor` + `phase-validator` (+ `electrical-calc-verifier` if fixtures add
numbers), reports in `docs/validation/board-<id>/` or `module-<id>/`.

- [ ] `pnpm catalog:validate` exits 0; coverage report shows no `single-source` on engine-read fields.
- [ ] Every required fact (lists in `catalog-schema`) present with status verified/conflict/interim/missing.
- [ ] Auditor sample: 100 % of straps, consumed pads, input-only flags, absolute maxima, current limits,
      I2C addresses and hardwired interfaces re-derived blind; all match or recorded as conflict.
- [ ] ≥ 3 new fixtures (board) or ≥ 1 per interface + 1 negative (module), each citing evidence ids.
- [ ] `pnpm -r test` exits 0 (fixtures pass in the engine, Phase 2b+).
- [ ] No PDFs or vendor images committed.
