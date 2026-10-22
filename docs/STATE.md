# Build state

> Claude updates this file after every task. Humans may edit it too; Claude re-reads it each session.

Catalog version: none yet · Rule-set version: none yet · Last updated: 2026-10-22

## Phases

| Phase | Name | Status | Branch | Validation | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | Bootstrap: tools, repo, Pages enabled | IN PROGRESS | main | — | 0.1, 0.2, 0.5, 0.6 done locally; 0.3/0.4 wait for `gh` |
| 1 | Foundation: monorepo, schema, evidence model, CI/CD, placeholder on Pages | NOT STARTED | phase-1 | — | |
| 2a | Catalog: MVP boards and modules, two-key verified | NOT STARTED | phase-2a | — | needs manual PDFs |
| 2b | Engine: interface selection, CSP solver, rules R1–R8, explanations | NOT STARTED | phase-2b | — | |
| 3 | Web app: UI, Web Worker, projects, sharing, export, offline | NOT STARTED | phase-3 | — | |
| 4 | Code generation: Arduino + MicroPython | NOT STARTED | phase-4 | — | |
| 5 | v1.0 launch: docs, link checker, bench check, release | NOT STARTED | phase-5 | — | needs human bench check |

Status values: NOT STARTED · IN PROGRESS · VALIDATING · FIXING (round n/3) · BLOCKED · DONE

## Current task

Phase 0 — blocked on human prerequisite: install + log in to GitHub CLI, confirm repo name. Next: 0.3 (create repo, push `main`), 0.4 (enable Pages, workflow mode), then `phase-validator`.

## Human prerequisites

- [ ] Phase 0: GitHub CLI logged in (`gh auth status`) and repo name confirmed (default: `pinout-finder`)
  - 2026-10-22: `gh` is **not installed** on this machine (not on PATH, not in `C:\Program Files\GitHub CLI`).
- [ ] Phase 2a: manual datasheet downloads listed in `sources/manual/README.md`
- [ ] Phase 5 (mid-phase checkpoint after task 5.3): bench check on real boards

Claude ticks a box after checking it (command/files) or after the user confirms in chat.

## Toolchain (task 0.1, checked 2026-10-22, Windows 11 / Git Bash)

| Tool | Version | Note |
| --- | --- | --- |
| node | v22.17.0 | ≥ 20 ✔ |
| npm / npx | 10.9.2 | |
| pnpm | 10.34.7 | Installed with `npm i -g pnpm@10.34.7` (user prefix). Corepack 0.33 cannot run pnpm 12 (native-binary layout) — pin `packageManager: pnpm@10.34.7` in Phase 1. |
| git | 2.53.0.windows.1 | identity `smsaad-181` |
| gh | **missing** | blocks 0.3 / 0.4 |
| python3 | 3.14.3 via `py` launcher | `python`/`python3` on PATH are Microsoft Store stubs; use `py -3`. Hook `validate-on-edit.sh` calls `python3` — fix in Phase 1 (it exits 0 harmlessly today). |
| uv / uvx | missing (optional) | needed only for the `fetch` MCP server |

## MCP servers (task 0.2, checked 2026-10-22)

| Server | Result | Fallback |
| --- | --- | --- |
| context7 | not connected in this session (session started outside the project dir, so `.mcp.json` was not loaded) | WebFetch / curl on official docs |
| fetch | not connected; also needs `uvx`, which is missing | `curl` + Read (verified: `curl https://vite.dev/guide/static-deploy` → HTTP 200) |
| playwright | not connected in this session | re-check from a session opened in `pinout-finder/`; Playwright via pnpm in Phase 3 |

None of these block Phase 0. Re-check all three when a session is started inside `pinout-finder/`.

## Decisions recorded

- 2026-10-11 · Two-key review in solo mode: until a second human maintainer exists, the two keys are
  `hardware-researcher` + blind `hardware-fact-auditor`, enforced by CI. Required human approvals
  (CODEOWNERS on `catalog/**` + repo-wide approval count) are switched on in Phase 5. This refines the
  PLAN's "2 approving reviews" decision, which needs two humans.
- 2026-10-11 · `interim` fact status added (cited related/secondary value, always Caution) for parts
  whose official datasheet must be downloaded by hand.
- 2026-10-22 · Licence holder line is "Pinout Finder contributors" (MIT `LICENSE`); `catalog/LICENSE` is the
  official CC-BY-4.0 legal code from creativecommons.org. Change the holder if you want a person/company name.

## Decisions needed

(none)

## Log

| Date | Phase | Event |
| --- | --- | --- |
| 2026-10-22 | 0 | Started. Local git repo on `main`. Tasks 0.1 (tools), 0.2 (MCP), 0.5 (LICENSE, catalog/LICENSE, .editorconfig, .gitattributes) done; 0.6 already satisfied by `sources/manual/README.md`. Waiting on `gh` install/login + repo name. |
