---
description: Run one specific phase (tasks + validation gate), e.g. /phase 2a
argument-hint: <phase-id>
---

Run phase `$ARGUMENTS` exactly as the Phase loop in `CLAUDE.md` describes (tasks → parallel validators
→ gate → merge or fix rounds), using `docs/phases/PHASE-$ARGUMENTS.md`. Do not continue to the next
phase afterwards. Refuse if an earlier phase is not DONE, unless the user confirms.
