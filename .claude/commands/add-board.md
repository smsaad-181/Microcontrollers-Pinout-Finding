---
description: Research and add a new board (exact product + revision) to the catalog with the two-key process and fixtures.
argument-hint: <board name and revision>
---

Add the board `$ARGUMENTS` following skill `catalog-onboarding`:
1. Confirm the exact product, vendor, revision and module variants with the user if ambiguous.
2. `hardware-researcher`: evidence + draft facts. 3. `hardware-fact-auditor`: blind re-derivation.
4. `catalog-author`: reconcile, `pnpm catalog:validate`. 5. `fixture-author`: ≥ 3 fixtures.
6. Validators: `hardware-fact-auditor` (sampling report) + `phase-validator`, reports under
   `docs/validation/board-<id>/`. 7. PR on branch `data/board-<id>`.
If the board has no official documentation, explain that it can only enter with `community` status.
