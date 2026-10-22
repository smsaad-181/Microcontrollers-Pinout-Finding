---
description: Re-run the validators for a phase and report the gate result without changing code.
argument-hint: <phase-id>
---

Read `docs/phases/PHASE-$ARGUMENTS.md`. Launch every validator it lists, in parallel, each writing its
report to `docs/validation/phase-$ARGUMENTS/`. Then re-run the gate commands yourself. Summarize:
per-validator verdict, failed gate items with evidence, and the recommended fixes. Do not edit code.
