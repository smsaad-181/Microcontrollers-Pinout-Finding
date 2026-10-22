---
description: Show build progress, current task, human prerequisites, and decisions needed.
---

Read `docs/STATE.md` and the latest reports in `docs/validation/`. Report in a short table: phase,
status, last validation verdicts. Then list open human prerequisites and "Decisions needed". Also show
`git status --short | head` and the latest deploy run (`gh run list --workflow deploy.yml --limit 1`)
if `gh` is available.
