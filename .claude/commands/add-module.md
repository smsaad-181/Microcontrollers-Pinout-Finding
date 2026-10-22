---
description: Research and add a sensor/display/actuator IC and its breakout variants with the two-key process and fixtures.
argument-hint: <module name>
---

Add the module `$ARGUMENTS` following skill `catalog-onboarding` (IC record + one breakout record per
vendor/variant that differs in regulator, level shifting, pull-ups, pin order or hardwired interface).
Ask the user which breakout they have if several exist. Run researcher → blind auditor → catalog-author
→ fixture-author → validators (reports under `docs/validation/module-<id>/`) → PR on `data/module-<id>`.
