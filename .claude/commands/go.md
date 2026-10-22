---
description: Continue the build from the current phase, validate each phase, and keep going until a human gate, a 3-round failure, or completion.
---

Run the **Phase loop** from `CLAUDE.md`:

1. Read `CLAUDE.md`, `docs/STATE.md`, and the next not-DONE phase file in `docs/phases/`.
2. Check its human prerequisites yourself (commands/files) and tick them in STATE when satisfied or
   confirmed by the user in chat. If any stay open, list them with exact commands/instructions and stop.
3. Set the phase to IN PROGRESS in `docs/STATE.md`, create/checkout branch `phase-<id>` (Phase 0: work
   on `main`).
4. Execute the task table in order, delegating each task to its owner subagent (run independent tasks
   in parallel). After each task: run the relevant tests yourself, update STATE, commit.
5. Push the branch and open a draft PR (from Phase 1 on). Set VALIDATING. Launch every validator
   listed in the phase file **in parallel**, scope folder `docs/validation/phase-<id>/`. Each writes
   `<agent>.md` ending with `VERDICT: PASS|FAIL`.
6. Pre-merge gate: re-run the pre-merge gate commands yourself; check only the listed validators'
   `<agent>.md` verdicts; wait for CI if workflows exist. All pass → `gh pr ready` and
   `gh pr merge --squash --delete-branch`. Then the post-merge gate (items marked *post-merge*: deploy,
   live site, release) after the deploy run on `main`. All pass → tag `phase-<id>-done`, set DONE, log
   it, continue with the next phase.
7. Otherwise set FIXING (round n/3), route findings to the owning builders, fix, and go back to step 5.
   After 3 failed rounds: set BLOCKED, write "Decisions needed", stop.

At every stop, report to the user in under 15 lines: phase, what passed (with evidence), blockers, next action.
$ARGUMENTS
