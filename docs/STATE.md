# Build state

> Claude updates this file after every task. Humans may edit it too; Claude re-reads it each session.

Catalog version: none yet · Rule-set version: none yet · Last updated: 2026-10-22

## Phases

| Phase | Name | Status | Branch | Validation | Notes |
| --- | --- | --- | --- | --- | --- |
| 0 | Bootstrap: tools, repo, Pages enabled | IN PROGRESS (remote deferred) | main | — | 0.1, 0.2, 0.5, 0.6 done; 0.3/0.4 deferred by user (GitHub later) |
| 1 | Foundation: monorepo, schema, evidence model, CI/CD, placeholder on Pages | DONE (local) — remote items deferred to final release | main (55df47b) | phase-validator FAIL · code-reviewer FAIL · github-actions-expert PASS | local-only; 1.8 + CI/deploy gate items wait for GitHub |
| 2a | Catalog: MVP boards and modules, two-key verified | DONE (local, merged to main; owner accepted deferrals) | phase-2a | — | ESP32-DevKitC + Pico first; Uno R3 / ST7735S need manual PDFs |
| 2b | Engine: interface selection, CSP solver, rules R1–R8, explanations | NOT STARTED | phase-2b | — | |
| 3 | Web app: UI, Web Worker, projects, sharing, export, offline | NOT STARTED | phase-3 | — | |
| 4 | Code generation: Arduino + MicroPython | NOT STARTED | phase-4 | — | |
| 5 | v1.0 launch: docs, link checker, bench check, release | NOT STARTED | phase-5 | — | needs human bench check |

Status values: NOT STARTED · IN PROGRESS · VALIDATING · FIXING (round n/3) · BLOCKED · DONE

## Current task

Phase 1 DONE (local). Phase 2a running in worktree `../pinout-finder-2a` (ESP32-DevKitC and Pico researchers). Next: user pushes Phase 1 to GitHub.

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
- [x] 2a.1 · For each chip/module/board · _hardware-researcher_
- [x] 2a.2 · Create catalog/.drafting (pauses the on-edit validation hook) · _hardware-researcher_
- [x] 2a.3 · Blind re-derivation · _hardware-fact-auditor_
- [x] 2a.4 · Reconcile · _catalog-author_
- [x] 2a.5 · Module records · _hardware-researcher → catalog-author_
- [x] 2a.6 · Known conflict to record explicitly · _catalog-author_
- [x] 2a.7 · Golden fixtures (hand-written from documents, before Phase 2b) · _fixture-author_
- [x] 2a.8 · Delete catalog/.drafting · _catalog-author_

**Phase 2b**
- [x] 2b.1 · packages/rules · _engine-developer_
- [x] 2b.2 · Pin view composer · _engine-developer_
- [x] 2b.3 · Interface selection per module (rules 1–7 in skill interface-selection), producing cand… · _engine-developer_
- [x] 2b.4 · Signal expansion · _engine-developer_
- [x] 2b.5 · CSP solver · _engine-developer_
- [x] 2b.6 · Unsat path · _engine-developer_
- [x] 2b.7 · Explanation traces · _engine-developer_
- [x] 2b.8 · Property tests (fast-check) · _test-automator_
- [x] 2b.9 · Run all golden fixtures from Phase 2a · _engine-developer_
- [x] 2b.10 · Mutation testing (Stryker) on packages/rules and solver constraints; target ≥ 85 % muta… · _test-automator_
- [x] 2b.11 · Performance · _engine-developer_

**Phase 3**
- [x] 3.1 · App shell, hash routes #/, #/board, #/modules, #/constraints, #/results, #/p/<shared> · _ui-developer_
- [x] 3.2 · Engine in a Web Worker via Comlink; progress + cancel; 2 s timeout message. · _ui-developer_
- [x] 3.3 · Board picker with filters (manufacturer, family, chip, module, revision) and status bad… · _ui-developer_
- [x] 3.4 · Module search (MiniSearch over part numbers, nicknames, aliases) with variant prompt wh… · _ui-developer_
- [x] 3.5 · Constraints: locked pins, reserved pins, voltage rails, framework, existing connections. · _ui-developer_
- [x] 3.6 · Results · _ui-developer_
- [x] 3.7 · SVG header view generated from board connector data; states · _ui-developer_
- [x] 3.8 · Persistence · _ui-developer_
- [x] 3.9 · Share links · _ui-developer_
- [x] 3.10 · Offline: vite-plugin-pwa; "update available" prompt when the manifest changes. · _ui-developer_
- [x] 3.11 · E2E (Playwright) · _test-automator_
- [x] 3.12 · Disclaimer + "how to verify" panel on every result. · _ui-developer_

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
- [ ] (waiting on owner) manual datasheet downloads listed in `sources/manual/README.md`
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

- 2026-10-22 · **User workflow:** complete the project locally and review it on localhost; push to GitHub once at the end of each phase (the user pushes, or confirms first); enable Pages / publish only at the final release. Until then remote-only gate items (CI on a PR, branch protection, deploy run, live Pages URL, `gh api` checks) are DEFERRED TO FINAL RELEASE, not failures; validators list them as not-verifiable-yet. Pages is intentionally off for now (the first deploy 404 is expected).

- 2026-10-22 · Fix round 2 (checker): new codes `E_PAD_KEY` (unique gpio per chip; key `GPIO|GP|IO|BCM<n>` must equal gpio), `E_UNKNOWN_DIR`; extended `E_FACT_STATUS` (conflict needs ≥2 readings with evidence, `active` ∈ readings, `value` = `active`), `E_REF_UNRESOLVED` (pad references, power-pin rail), `E_DUPLICATE_ID` (variants/connectors/rails), `E_PIN_NUMBERING` (same pad on two connector pins); reviewer keys `^[a-z0-9][a-z0-9._-]*$`; evidence URLs lower-case http(s), no whitespace/credentials. 75 invalid fixtures, 409 tests.
- 2026-10-22 · **Known item for Phase 2a:** the "same pad on two connector pins" rule is an error. The Arduino Uno R3 repeats A4/A5 as the SDA/SCL header pins (same pad), so when the Uno is catalogued either model the second position as an alias or downgrade the rule to a warning (`W_DUPLICATE_PAD`) — decide then (fixtures README decision 19). Deferred to Phase 2b: breakout pull-up/line vs IC signals, `interfaces_exposed` vs IC interfaces, fixture `instance`/`locked[].pad` checks.

- 2026-10-22 · **User chose "Faster" validation for the rest of the project:** per phase, all automatic gates plus ONE independent reviewer (normally `phase-validator`); only Critical/Major findings block; Minor findings go to the "Later" list below. Unchanged: evidence for every hardware fact, two independent keys (`hardware-researcher` + blind `hardware-fact-auditor`) for `verified` facts, stop and ask after 3 failed fix rounds. Phase 1 closes when the running code-reviewer final pass has no Critical/Major (phase-validator PASSED round 2; github-actions-expert PASSED).

## Later (minor findings, not blocking)

- Phase 1 minors from the validator reports (see `docs/validation/phase-1/*.md`): Uno A4/A5 duplicate-pad handling (decide in 2a), deferred breakout/fixture/IC cross-checks (2b), old catalog versions kept for share links (3/5), bundle-size check (3), Dependabot npm run failure (check in GitHub UI), Node 26 LTS bump (after 2026-10-28), DOM tests for the web router (3).

## Later (schema gaps found by the 2a researchers, for the Phase 2a reconcile / schema round)

- Per-variant pin maps: WROVER-E module must list GPIO16/17 as bonded (and `consumed: psram`) only because the board's shared connector requires every gpio pin to be bonded on every variant's module.
- Connector pins cannot carry status/evidence, so a document disagreement about a pin (DevKitC J2/J3 pins D2/D3/CMD/D1/D0/CLK: user guide says GPIO6-11, modules leave them unconnected) is only in the board file header; modelled as `kind: nc`.
- `iomux_pins` cannot list alternative pads per role (RP2040 SPI0.RX is on GPIO0/4/16/20); rail voltage cannot be a range (VSYS 1.8-5.5 V); no `enable` pin kind (3V3_EN recorded as `reset`); consumed-kind enum has no `radio` (CYW43439 pads recorded as `internal`); `VDD+0.3`-style expressions only as `VDDIO+0.3`.
- Image-only facts (Pico header map, schematics) are `transcribed: true`; many ESP32 table-row quotes are flattened by PDF text extraction (auditor must check in the source).

- **Schema gap to fix before the engine (2b):** a header pad must be in `bonded_pads` of every variant's module, so WROVER-E lists GPIO16/17 as bonded although its pins 27/28 are NC (datasheet: up to 24 GPIOs). The data is truthful only through `consumed: psram` (verified). Fix options: per-variant connector overrides or per-variant bonded pads, or relax the validator to accept consumed-but-unbonded pads. Until then the engine must read `consumed`, not `bonded_pads`.
- WROOM-32E module covers only the no-PSRAM parts (DevKitC-32E). R2 parts (GPIO16 used for PSRAM) would need their own module record. DevKitC variants -32UE and -VIE (antenna connector) are not modelled (same pinout).
- Some catalog files (ESP32 chip/module/board) are emitted by script in JSON-style braces instead of the hand-written YAML style of the fixtures; valid but harder to read — normalise formatting in a cleanup pass.
- Unmodelled auditor facts with no schema field: pad power domains, drive-strength steps, SPI slave limits, max baud/I2C speeds, PWM resolution, PSRAM voltage, CHIP_PU thresholds, RP2040 clk_peri limits, input leakage, operating temperature.

- 2026-10-23 · Decision rules applied in 2a (kept consistent across boards): missing > guessed; a value found by only one key is `missing` (not verified); a derived number is never stored as a rating; negative findings (`none`/`false`) are `verified` only when both keys independently concluded it; `reset_state` stores the state AT reset (restrictive) and conflicts with the after-reset reading; per-pin current uses the datasheet reset-default drive (R4: 4 mA, Arduino's 8 mA only after software sets middle drive).
- Later (from the 2a reconciles): TOUCH-100 errata on ESP32-S3 touch pads (plain list); ESP8266 TOUT pad uses invented `gpio: 17` and RA4M1 pads use invented `gpio = port*100+pin` (schema needs a pad without a GPIO number); strap `default_pull` should be optional; kind enum lacks `enable`/`boot`/`analog`; rail voltage cannot hold a range; per-variant bonded pads; Pico `consumed` for internal pads GPIO23/24/25/29 is empty (modelled in `onboard`).

## Decisions needed

- 2026-10-22 · RESOLVED (user chose "add 3 tests, then close"): **Phase 1 hit the 3-fix-round limit.** Code-reviewer final pass: FAIL, 0 Critical, 3 Major, 8 Minor. All 3 Majors are TEST GAPS on correct code (reviewer proved the code behaves correctly with probes): CR1-R3 board status with a second variant's chip not covered by a test; CR2-R3 "pad bonded by module" for a second variant not covered; CR3-R3 conflict-fact deep equality ignoring an extra object key not covered. 20/21 earlier survivors now killed (W9 partial); 139 new mutations, 117 killed. Smallest fix per reviewer: three short tests, no source change. Waiting for the user to choose how to proceed.

- 2026-10-22 · **GitHub facts observed (read-only API):** repo `smsaad-181/Microcontrollers-Pinout-Finding` is public. PR #1 "Phase 1" merged by the user (21 commits, 463 files, merge commit, not squash). `ci` on the PR: all 7 jobs success (first real CI run — confirms the clean-clone simulation). `deploy` on main: `build` job success (validate, tests, compile, web build, upload-pages-artifact all green); `deploy` job failed at `actions/deploy-pages` with HTTP 404 "Ensure GitHub Pages has been enabled" — Pages is not enabled yet. **User action:** Settings → Pages → Source = "GitHub Actions" (or `gh auth login` and I do it). Do not re-run deploy until the base-path rename is on main, otherwise the published page would 404 its assets. Dependabot opened its first update runs.
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
| 2026-10-22 | 1 | Code-reviewer final pass after fix round 3: **FAIL** (0 Critical, 3 Major test gaps on correct code, 8 Minor). 3-round limit reached -> BLOCKED, user decision requested. |
| 2026-10-22 | 2a | Drive D: failed 20:23-20:40 (disk errors), recovered by itself; full backup to E:\backup\pinout-finder-kit-20261022 (2,484 files, 0 failed); repo `git fsck` clean. ESP32-DevKitC drafted (commit b3a22a8 on phase-2a: chip esp32 34 pads, 2 modules, board esp32-devkitc-v4@V4, 9 evidence; 333 single-source / 2 conflicts / 9 missing across the whole draft catalog; validate exit 0, 9/9 PDF fingerprints match). Pico drafted (2dc8ed8). Blind audits of the Pico started. |
| 2026-10-22 | 2a | Two-key results committed: Pico + Pico W + RP2040 (145 verified, 1 conflict, 7 missing); ESP32 chip (155 verified, 11 conflicts, 2 missing) and ESP32 modules + DevKitC V4 (21 verified, 2 missing). Whole catalog: 321 verified, 12 conflicts, 11 missing, 0 single-source; validate exit 0. Next boards in research: ESP32-S3, UNO R4 Minima, D1 mini. |
| 2026-10-23 | 2a | Two-key results committed for 5 of 6 MVP board families: Pico + Pico W (RP2040), ESP32-DevKitC V4, LOLIN D1 mini (ESP8266EX), ESP32-S3-DevKitC-1, Arduino UNO R4 Minima (RA4M1). Schema change: optional `ConnectorPin.alias_of` for repeated header positions (Uno SDA/SCL = A4/A5, ICSP); 82 invalid fixtures, 364 cli / 597 schema tests. Whole catalog: 745 verified, 37 conflicts, 143 missing, 0 single-source; validate exit 0. Remaining in 2a: Arduino UNO R3 (needs the ATmega328P PDF), 12 sensor/module records, >= 20 golden fixtures, coverage report, gate. |
| 2026-10-22 | 1 | User chose "add 3 tests, then close". Orchestrator added the 3 tests (CR1-R3, CR2-R3, CR3-R3) and proved each reviewer mutation is now killed (3 / 1 / 1 failing tests; sources restored byte-identical). Full suite: schema 592, cli 337 (+1 skipped), web 59; typecheck/lint/format 0. **Phase 1 DONE (local)**; remote gate items (CI on PR, branch protection 1.8, deploy, live URL) deferred to the final release by user decision. |
| 2026-10-22 | 2a | Started in parallel (user request) in git worktree `../pinout-finder-2a`, branch `phase-2a` (from `48c518d`), `catalog/.drafting` set. Researchers: ESP32-DevKitC V4 family and Raspberry Pi Pico/Pico W family (tasks 2a.1–2a.2). |
| 2026-10-22 | 1 | Fix round 3 done (engine-developer): 21/21 surviving mutants now killed (+ extra), new `W_SYMLINK_SKIPPED`, wrong `--root` = exit 2, enum-walker test over every schema enum, focus/CSP web tests; 76 invalid fixtures, ~980 tests. Final re-validation next. |
| 2026-10-22 | 1 | Re-validation 2: phase-validator **PASS** (0 critical/major, 3 minor); code-reviewer **FAIL** (0 critical, 2 major = missing tests, 10 minor; 107 mutations, 86 killed, 21 survived). Fix round 3 (last) started. |
| 2026-10-22 | 1 | Fix round 2 done (engine-developer): N1(a–d), N4, N5, N7, N8 implemented; orchestrator re-run: typecheck/lint/format 0, tests schema 115 / cli 247 / web 46, 75/75 invalid roots exit 1 with their code, valid + empty catalog exit 0, compile twice identical. Re-validation next. |
| 2026-10-22 | 1 | Re-validation 1 (phase-validator): **FAIL** — 0 Critical, 3 Major (N1 checker still accepts pad-key/gpio mismatch, bad conflict facts, unresolved pad refs, same pad on two pins; N2 base path vs repo name; N3 Pages disabled), 5 Minor. All local gates pass (303 tests, 48/48 invalid fixtures, deterministic compile, 21/21 SHA pins); all round-1 fixes confirmed; 8/8 mutants killed; real CI on PR #1 = 7/7. Fix round 2 started: N2 done (`d461402`), N1 + minors with fix agent. |
| 2026-10-22 | 1 | GitHub: user pushed `main` + `phase-1`; PR #1 merged to main before validators passed. Real CI on the PR: 7/7 jobs green. Deploy: build green, publish step 404 because Pages is not enabled. |
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
| 2026-10-23 | 2a | Phase 2a done: 1052 facts (789 verified, 42 conflict, 8 interim, 1 single-source->0, 212 missing), 24 golden fixtures, phase-validator PASS after owner accepted deferrals (Uno R3/ATmega328P, DS18B20, DHT22, MPU-6050, KS0058 await manual PDFs; ESP8266 GPIO0/2/15 strap facts missing until schema makes default_pull optional - first task of 2b). Merged phase-2a into main. |

| 2026-10-23 | 2b | Phase 2b done: rules R1-R8, composer, selector, CSP solver, unsat explainer, traces; 24/24 golden fixtures; property tests (1000 runs), rules mutation 95.75%, perf p95 58 ms; gate found 2 lock bugs + missing MCU-pin capacitance in R3 (all fixed); phase-validator PASS after fixes. Later list in docs/validation/phase-2b/phase-validator.md. |
| 2026-10-24 | 3 | Phase 3 done: web app (board picker, module search + variant prompt, worker solve, results with citations/traces/unsat, SVG header, save/export/print, share links, offline PWA); e2e 10/10, axe 0 issues, app 169 kB gz; phase-validator PASS (0 Critical/Major, 9 minor in docs/validation/phase-3/phase-validator.md). Later: share-link decompress cap, GPIO-3.11 citation, rails override needs engine change. |
