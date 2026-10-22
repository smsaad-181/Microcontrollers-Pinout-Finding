# Build state

> Claude updates this file after every task. Humans may edit it too; Claude re-reads it each session.

Catalog version: none yet · Rule-set version: none yet · Last updated: 2026-10-22

## Phases

| Phase | Name | Status | Branch | Validation | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | Bootstrap: tools, repo, Pages enabled | IN PROGRESS (remote deferred) | main | — | 0.1, 0.2, 0.5, 0.6 done; 0.3/0.4 deferred by user (GitHub later) |
| 1 | Foundation: monorepo, schema, evidence model, CI/CD, placeholder on Pages | FIXING (round 1/3) | phase-1 | phase-validator FAIL · code-reviewer FAIL · github-actions-expert PASS | local-only; 1.8 + CI/deploy gate items wait for GitHub |
| 2a | Catalog: MVP boards and modules, two-key verified | NOT STARTED | phase-2a | — | needs manual PDFs |
| 2b | Engine: interface selection, CSP solver, rules R1–R8, explanations | NOT STARTED | phase-2b | — | |
| 3 | Web app: UI, Web Worker, projects, sharing, export, offline | NOT STARTED | phase-3 | — | |
| 4 | Code generation: Arduino + MicroPython | NOT STARTED | phase-4 | — | |
| 5 | v1.0 launch: docs, link checker, bench check, release | NOT STARTED | phase-5 | — | needs human bench check |

Status values: NOT STARTED · IN PROGRESS · VALIDATING · FIXING (round n/3) · BLOCKED · DONE

## Current task

Phase 1 RE-VALIDATING after fix round 1 (of max 3), local only. One validator at a time:
- **phase-validator** — running now: re-runs every gate item, reproduces every earlier finding (F1–F15, CR1–CR9) and probes the new code; overwrites `docs/validation/phase-1/phase-validator.md`.
- code-reviewer — next (after user's go).
- github-actions-expert — last.

## Task checklist

Legend: `[x]` done · `[~]` in progress · `[-]` deferred (needs GitHub) · `[ ]` not started. The local progress dashboard (`node tools/progress/server.mjs` → http://localhost:4300) reads this list.

**Phase 0**
- [x] 0.1 · Check tool versions · _main_
- [x] 0.2 · Confirm MCP servers respond · _main_
- [-] 0.3 · Create the GitHub repo if absent and push main. · _ci-pages-engineer_
- [-] 0.4 · Enable Pages with workflow builds · _ci-pages-engineer_
- [x] 0.5 · Add LICENSE (MIT for code) and catalog/LICENSE (CC-BY-4.0 for catalog facts), plus .edi… · _ci-pages-engineer_
- [x] 0.6 · Fill sources/manual/README.md with the known manual downloads (ATmega328P DS40002061, S… · _hardware-researcher_

**Phase 1**
- [x] 1.1 · pnpm workspace · _ci-pages-engineer_
- [x] 1.2 · Zod schemas for Evidence, Fact<T>, Chip, Module, Board, Pin view, IC, Breakout, Fixture… · _engine-developer_
- [x] 1.3 · catalog validate [--root <dir>] (default catalog/) · _engine-developer_
- [x] 1.4 · catalog compile · _engine-developer_
- [x] 1.5 · Seed fixtures for the CLI · _fixture-author_
- [x] 1.6 · apps/web · _ui-developer_
- [x] 1.7 · Workflows · _ci-pages-engineer_
- [-] 1.8 · Branch protection on main · _ci-pages-engineer_
- [x] 1.9 · Docs: docs/schema.md (generated from Zod descriptions), CONTRIBUTING.md skeleton. · _ci-pages-engineer_

**Phase 2a**
- [ ] 2a.1 · For each chip/module/board · _hardware-researcher_
- [ ] 2a.2 · Create catalog/.drafting (pauses the on-edit validation hook) · _hardware-researcher_
- [ ] 2a.3 · Blind re-derivation · _hardware-fact-auditor_
- [ ] 2a.4 · Reconcile · _catalog-author_
- [ ] 2a.5 · Module records · _hardware-researcher → catalog-author_
- [ ] 2a.6 · Known conflict to record explicitly · _catalog-author_
- [ ] 2a.7 · Golden fixtures (hand-written from documents, before Phase 2b) · _fixture-author_
- [ ] 2a.8 · Delete catalog/.drafting · _catalog-author_

**Phase 2b**
- [ ] 2b.1 · packages/rules · _engine-developer_
- [ ] 2b.2 · Pin view composer · _engine-developer_
- [ ] 2b.3 · Interface selection per module (rules 1–7 in skill interface-selection), producing cand… · _engine-developer_
- [ ] 2b.4 · Signal expansion · _engine-developer_
- [ ] 2b.5 · CSP solver · _engine-developer_
- [ ] 2b.6 · Unsat path · _engine-developer_
- [ ] 2b.7 · Explanation traces · _engine-developer_
- [ ] 2b.8 · Property tests (fast-check) · _test-automator_
- [ ] 2b.9 · Run all golden fixtures from Phase 2a · _engine-developer_
- [ ] 2b.10 · Mutation testing (Stryker) on packages/rules and solver constraints; target ≥ 85 % muta… · _test-automator_
- [ ] 2b.11 · Performance · _engine-developer_

**Phase 3**
- [ ] 3.1 · App shell, hash routes #/, #/board, #/modules, #/constraints, #/results, #/p/<shared> · _ui-developer_
- [ ] 3.2 · Engine in a Web Worker via Comlink; progress + cancel; 2 s timeout message. · _ui-developer_
- [ ] 3.3 · Board picker with filters (manufacturer, family, chip, module, revision) and status bad… · _ui-developer_
- [ ] 3.4 · Module search (MiniSearch over part numbers, nicknames, aliases) with variant prompt wh… · _ui-developer_
- [ ] 3.5 · Constraints: locked pins, reserved pins, voltage rails, framework, existing connections. · _ui-developer_
- [ ] 3.6 · Results · _ui-developer_
- [ ] 3.7 · SVG header view generated from board connector data; states · _ui-developer_
- [ ] 3.8 · Persistence · _ui-developer_
- [ ] 3.9 · Share links · _ui-developer_
- [ ] 3.10 · Offline: vite-plugin-pwa; "update available" prompt when the manifest changes. · _ui-developer_
- [ ] 3.11 · E2E (Playwright) · _test-automator_
- [ ] 3.12 · Disclaimer + "how to verify" panel on every result. · _ui-developer_

**Phase 4**
- [ ] 4.1 · Research the canonical library for each MVP module per framework (maintainer repo, vers… · _hardware-researcher_
- [ ] 4.2 · Template engine in packages/codegen · _engine-developer_
- [ ] 4.3 · Templates · _engine-developer_
- [ ] 4.4 · CI compile check · _ci-pages-engineer_
- [ ] 4.5 · UI: code tab with copy/download, library install notes. · _ui-developer_

**Phase 5**
- [ ] 5.1 · links.yml · _ci-pages-engineer_
- [ ] 5.2 · Docs · _ci-pages-engineer_
- [ ] 5.3 · Bench-check procedure for the user · _hardware-researcher_
- [ ] 5.4 · Enable required human reviews on catalog/ via CODEOWNERS when a second maintainer exist… · _ci-pages-engineer_
- [ ] 5.5 · Release prep on the branch · _ci-pages-engineer_

## Human prerequisites

- [ ] Phase 0: GitHub CLI logged in (`gh auth status`) and repo name confirmed — repo name confirmed by user 2026-10-22: `smsaad-181/Microcontrollers-Pinout-Finding` (public, empty); `gh` login still open
  - 2026-10-22: `gh` 2.103.0 installed (winget). Login not completed; user will finish GitHub setup later.
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
| gh | 2.103.0 (`C:\Program Files\GitHub CLI`; open a new shell for PATH) | not logged in yet |
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
- 2026-10-22 · Node floor `>=22.12.0` (not 20): Vitest 5 requires it and Node 20 is EOL (Apr 2026); still "Node LTS" per CLAUDE.md, CI uses `lts/*`. TypeScript pinned to 6.0.3 (typescript-eslint 8.72 supports `<6.1`; TS 7 native port not yet supported).
- 2026-10-22 · Workspace packages resolve each other from source via the `@pinout/source` export condition (no prebuild needed for typecheck/test/CLI); catalog scripts run from the repo root, so `--root` and the default `catalog/` are relative to the root.

- 2026-10-22 · Catalog compiler: `version` = first 12 hex chars of the SHA-256 of the canonical catalog JSON (content-addressed, so old share links keep resolving); manifest `date` = SOURCE_DATE_EPOCH → last git commit touching the catalog → latest evidence date. New codes beyond the fixture contract: `E_YAML` (syntax/duplicate keys), warnings `W_DANGLING_REF`, `W_IGNORED_FILE`. `PinView` schema is a provisional addition (revisit in 2b.2).
- 2026-10-22 · `apps/web/public/catalog/` is generated at deploy time and git-ignored. Phase 3/5 must decide how old `<version>.json` files stay available for share links (PLAN: previous versions remain in `dist/`).
- 2026-10-22 · Open for later: duplicate entity ids have no error code yet; CI uses a shallow checkout so the manifest `date` may differ from a local build (content/version are unaffected).

- 2026-10-22 · Fix round 1 changed the error-code contract (fixtures README decisions 2, 6, 11–15): new `E_DUPLICATE_ID`, `E_REF_UNRESOLVED` (replaces the `W_DANGLING_REF` warning), `E_FILE_EXTENSION`; reviewer identity = trim + lower-case; evidence claims need non-blank quote/locator/supports, quote ≤ 25 words and 400 chars; evidence URLs http(s) only; `Board.variants` needs at least one; YAML anchors/aliases/merge keys and `__proto__`-style keys are rejected. CI: Node pinned via `.nvmrc` (24), `configure-pages` removed, CI runs once per PR, deploy only from `main`.

## Decisions needed

- 2026-10-22 · **Repo name differs from the plan default** (`pinout-finder` → `Microcontrollers-Pinout-Finding`). `origin` is added locally (nothing pushed; user chose "connect only"). Pages URL will be `https://smsaad-181.github.io/Microcontrollers-Pinout-Finding/`. TODO after the running re-validation finishes (do not edit during validation): change the Vite `base` default, the CI/deploy `grep '/pinout-finder/assets/'` check, `apps/web/test/manifest.test.ts`, `package.json`, dashboard probe URL, and docs to the new base path `/Microcontrollers-Pinout-Finding/`; ask the user before the first push. Needs `gh auth login` for Pages/branch protection (or the user enables Pages source = GitHub Actions in repo settings).

- 2026-10-22 · **GitHub deferred by user ("I will update later in github… continue").** Work continues locally
  (phase branches merged locally). When ready, the human runs `gh auth login --scopes repo,workflow`; then Claude:
  0.3 `gh repo create pinout-finder --public --source . --push`; 0.4 enable Pages (`build_type=workflow`);
  pushes all branches/tags; 1.8 branch protection (require `ci`, linear history) + CODEOWNERS owner;
  and runs the remote-only gate items (CI green on a PR, deploy run, live Pages URL) for every phase done locally.
  Phases are marked `DONE (local)` until those remote items pass.

## Log

| Date | Phase | Event |
| --- | --- | --- |
| 2026-10-22 | 1 | Fix round 1 (engine-developer + orchestrator): all 5 Majors addressed; tests schema 83 / cli 171 / web 46 (was 62/61/35); 48 invalid fixtures (was 12) each exit 1 with exactly its code; mutants M3 M5 M6 M10 M16 M18 M24 now killed; workflows: Node 24 pinned, configure-pages removed, single CI run per PR, deploy guarded to main. Re-validation pending. |
| 2026-10-22 | 1 | Validator 3/3 github-actions-expert: **PASS** — 0 Critical/Major, 6 Minor; clean-clone CI simulation (install, lint, typecheck, test, validate, compile, build) exit 0 on Node 22 and 24; branch-protection commands for 1.8 recorded in its report. |
| 2026-10-22 | 1 | Validator 2/3 code-reviewer: **FAIL** — 2 Major: CR1 board with `variants: []`/unknown module passes as fully-verified (exit 0); CR2 surviving mutants (no positive `fully-verified` test, no content→version test). 7 Minor (e.g. `__proto__` pad silently dropped, alias-bomb stack trace). pnpm audit clean. |
| 2026-10-22 | 1 | Validator 1/3 phase-validator: **FAIL** — all local gate commands pass (161 tests, 12/12 invalid fixtures rejected, compile deterministic, SHA pins OK); 5 Major findings in checker strictness + deploy.yml. Remote-only gate items not verifiable (no GitHub). |
| 2026-10-22 | 1 | 1.9 done: CONTRIBUTING.md; `docs/schema.md` generated from the Zod descriptions (`pnpm docs:schema`, 11 schemas). |
| 2026-10-22 | 1 | 1.2–1.4 done (TDD): Zod schemas match the skill reference (type-level equality tests, 24 types), `catalog validate` (every invalid fixture → its contracted code, valid + empty real catalog → 0), `catalog compile` (twice → byte-identical; version = first 12 hex of content sha256). Orchestrator re-run: typecheck/lint 0; schema 62, cli 61, web 35 tests pass. |
| 2026-10-22 | 1 | 1.6 done: placeholder page (hash router, build-time CSP meta, manifest version card); web typecheck/lint 0, 35 tests pass, build OK, no inline script/style in dist, "Pinout Finder" in static HTML. Open for Phase 3: `worker-src` CSP for the Web Worker. |
| 2026-10-22 | 1 | 1.1 done: pnpm workspace (schema, rules, engine, codegen, cli, web); frozen install, typecheck, lint, 6/6 test projects, web build (assets under `/pinout-finder/`) all exit 0 in orchestrator re-run. |
| 2026-10-22 | 1 | 1.7 done: ci.yml (aggregate `ci` job), deploy.yml, links.yml stub, dependabot.yml; 22 `uses:` pinned to 40-char SHAs (grep check OK), actionlint 1.7.12 → 0 errors. Not yet run on GitHub. |
| 2026-10-22 | 1 | 1.5 done: CLI fixtures (valid + 12 invalid cases, error-code contract in `packages/cli/test/fixtures/README.md`); each invalid case differs from valid in exactly one line (diff -r checked). |
| 2026-10-22 | 0 | Started. Local git repo on `main`. Tasks 0.1 (tools), 0.2 (MCP), 0.5 (LICENSE, catalog/LICENSE, .editorconfig, .gitattributes) done; 0.6 already satisfied by `sources/manual/README.md`. Waiting on `gh` install/login + repo name. |
