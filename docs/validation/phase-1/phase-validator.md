# Validation report — Phase 1 (re-validation after fix round 2) — phase-validator

- Date: 2026-10-22 · Commit validated: `eeac3fa81332f495e05d14d40bf3907dbb696a92` (branch `phase-1-fix-1`; `git diff b50c8a9 HEAD` = only `docs/NOW.md`, so source equals `b50c8a9`; round-2 fixes under review: `b50c8a9` checker N1/N4/N5/N7/N8, `d461402` base path) · Catalog version: `35e8668ed210` (empty real catalog, unchanged) · Validator: phase-validator
- Scope: every locally checkable Phase 1 gate item re-run fresh; N1-N9 and F-series reproduced with the original probes (110 reused) plus 57 new gap probes; my own loop over all 75 invalid roots; regression against `de62e13` / `e564bbd`; 8 source mutations; external claims. `docs/STATE.md` not used as evidence. Per the user's decision (build locally, publish at the end), remote-only items are DEFERRED, not failed.
- Scratch evidence (outside the repo): `C:\Users\SAAD\AppData\Local\Temp\claude\d--Development-pinout-finder-kit\ddb4f849-ef4d-4359-a359-7f2a6e0f4722\scratchpad\validator-r3\` (`loop_invalid.py/.json`, `probe.py` (old probes, rerun) + `probe_all.log`, `newprobes.py`/`probe2.py` + `probe2.log`, `runs/`).

## Gate items — pre-merge (locally checkable)

| # | Gate item (PHASE-1.md) | Command / method | Exit / result | Evidence (key output lines) | PASS/FAIL |
| --- | --- | --- | --- | --- | --- |
| G1a | Frozen install | `pnpm install --frozen-lockfile` | exit 0 | `Lockfile is up to date` · `Done in 4s using pnpm v10.34.7` | PASS |
| G1b | Typecheck | `pnpm -r typecheck` | exit 0 | 6 of 7 projects `Done`, no TS errors | PASS |
| G1c | Lint | `pnpm -r lint` | exit 0 | 6 of 7 projects `Done`, no ESLint output | PASS |
| G1d | Tests | `pnpm -r test` | exit 0 | schema 115/115 (6 files), cli 247/247 (6 files), web 46/46 (4 files), engine 1, rules 1, codegen 1 | PASS |
| G1e | Formatting | `pnpm format:check` | exit 0 | `All matched files use Prettier code style!` | PASS |
| G2a | Valid fixture validates | `pnpm -s catalog:validate --root packages/cli/test/fixtures/valid` | exit 0 | `Coverage: 41 facts` = verified 39, interim 1, missing 1 · `demo-board-1@r1  partially-verified` · `0 errors, 0 warnings in 7 files` | PASS |
| G2b | EVERY invalid root: exit != 0 and exactly the expected code | own loop `loop_invalid.py` over `invalid/*/`, `pnpm -s catalog:validate --root <dir>` each | 75/75 exit 1 | `dirs=75 cases=75 dirs_without_case=[] cases_without_dir=[] dups=[] bad=[]`: for every case the printed error-code set equals `{cases.yaml code}` and a line with the expected file and a `path_contains` match exists; no stack trace. Codes in cases.yaml: E_DUPLICATE_ID 10, E_PIN_NUMBERING 10, E_REF_UNRESOLVED 12, E_SCHEMA 21, E_FACT_STATUS 6, E_VERIFIED_REVIEWERS 4, E_PAD_KEY 3, E_EVIDENCE_UNKNOWN 2, E_FILE_EXTENSION 2, E_YAML 2, E_BOARD_STATUS 1, E_EVIDENCE_MISSING 1, E_UNKNOWN_DIR 1 | PASS |
| G2c | Empty real catalog validates | `pnpm -s catalog:validate` | exit 0 | `Coverage: 0 facts` · `0 errors, 0 warnings in 0 files (root: catalog)` | PASS |
| G3 | Compile determinism | `rm -rf apps/web/public/catalog; pnpm catalog:compile` twice, sha256 of both files | exit 0 both; identical | `c790f31b…081ba5  35e8668ed210.json`, `792d4097…05784e  catalog-manifest.json` in both runs; version still `35e8668ed210`; compile output is git-ignored (status clean) | PASS |
| G4 | Web build + base path | `pnpm --filter web build`; inspect `dist/index.html` | exit 0 | `src="/Microcontrollers-Pinout-Finding/assets/index-CWSJHPhk.js"`, `href="/Microcontrollers-Pinout-Finding/assets/index-CeF4-KpQ.css"`; title/h1 `Pinout Finder — coming soon`; CSP `<meta>` present; 0 inline `<script>`, 0 `<style>`/`style=`. With `PAGES_BASE=/some-other-name/` the build exits 0 and emits `/some-other-name/assets/index-Cbq9EAT5.js` and `.css` (env is followed) | PASS |
| G5 | Every `uses:` pinned to a 40-char SHA | grep over `.github/workflows` | 21 `uses:` lines, 0 unpinned (grep exit 1) | actionlint 1.7.12 `-shellcheck= -pyflakes=`: exit 0, no output. `ci.yml:114` and `deploy.yml:23` set `PAGES_BASE: /${{ github.event.repository.name }}/` in `env:` (not interpolated into `run:`); `ci.yml:129` and `deploy.yml:39` assert `grep -qF "${PAGES_BASE}assets/"` | PASS |
| G8 | Zod schemas match the TS reference field-for-field | own diff | match | see "Schema vs reference" | PASS |

## Gate items — requiring the remote (DEFERRED TO FINAL RELEASE by user decision)

| # | Gate item | Status | Supporting evidence (unauthenticated, read-only) |
| --- | --- | --- | --- |
| R3 | CI green on a PR, check named `ci` | DEFERRED (re-run on the final PR) | Earlier run 39737205965 (`pull_request`, head `592a632`) `completed success`, 7 jobs green. It does not cover the round-1/round-2 code or the new `PAGES_BASE` env, so it is evidence only, not a PASS for this commit |
| R4 | Branch protection readable via `gh api` and requires `ci`; CODEOWNERS (task 1.8) | DEFERRED | public API: `main` `"protected": false` |
| P1 | Deploy run on `main` succeeded | DEFERRED | first deploy failed 404 because Pages is off (setting, not a code defect); its `build` job succeeded |
| P2 | Pages URL returns 200 with "Pinout Finder" | DEFERRED | `has_pages: false` |
| — | Pages `build_type` / `github-pages` environment branch policy | DEFERRED | needs auth |

Remaining for the final release: R3, R4/task 1.8, P1, P2, Pages `build_type`; plus `github.event.repository.name` behaviour on a real runner (first run of the new `PAGES_BASE` env).

## Schema vs reference

- `packages/schema/test/reference.ts` vs the ```ts block of `.claude/skills/catalog-schema/SKILL.md`: after removing `export ` and comments, 123 vs 123 non-empty lines, identical. The reference file and `reference-types.test.ts` were last changed in `1da01ad` (not touched by either fix round); the `expectTypeOf<S.X>().toEqualTypeOf<Ref.X>()` equality test is intact.
- Round-2 schema changes (`git diff e305f1c HEAD -- packages/schema/src`), all constraint-only, no field added, renamed or re-typed, so inferred types equal the reference:
  - `evidence.ts`: `url`/`url_original` are now plain-string checks (no whitespace, `^https?://` lower-case, no userinfo, `URL.canParse`); `title`/`publisher` non-blank; `superRefine` requires every claim id to start with `<evidence id>#`. Emitted JSON Schema: `url` = `allOf [{pattern ^\S+$},{pattern ^https?:\/\/}]`, `url_original` the same inside `anyOf` with null, `title`/`publisher` `pattern \S` (verified in `dist/evidence.schema.json`), so editors now flag `javascript:` (N8).
  - `fact-rules.ts`: `checkConflict`: >= 2 readings, each with evidence, `active` deep-equals one reading's value, `value` deep-equals `active`; `deepEqual` is key-order independent. Presence rule unchanged.
  - `primitives.ts`: `REVIEWER_KEY = /^[a-z0-9][a-z0-9._-]*$/` applied after trim + lower-case; identity (`normalizeReviewer`) unchanged.
- Verdict: PASS.

## Regression check on the contract

- 12 original invalid cases: the first lines of `cases.yaml` equal `git show de62e13:.../cases.yaml` (prefix diff empty); each still yields exactly its original code/file/path (G2b).
- `git diff e564bbd HEAD -- invalid/cases.yaml`: 0 removed or changed lines (additions only); `git diff --name-status e564bbd HEAD -- invalid` shows only `A` plus the one `M` on cases.yaml. All 36 round-1 cases pass in G2b.
- `git diff de62e13 HEAD -- packages/cli/test/fixtures/valid`: 0 bytes. Valid fixture unchanged.
- Codes: source (`packages/cli/src`, `packages/schema/src`) emits 14: E_BOARD_STATUS, E_DUPLICATE_ID, E_EVIDENCE_MISSING, E_EVIDENCE_UNKNOWN, E_FACT_STATUS, E_FILE_EXTENSION, E_PAD_KEY, E_PIN_NUMBERING, E_REF_UNRESOLVED, E_SCHEMA, E_UNKNOWN_DIR, E_VERIFIED_REVIEWERS, E_YAML, W_IGNORED_FILE. `fixtures/README.md` documents all 14; its only extra is `W_DUPLICATE_PAD`, mentioned prospectively in decision 19 ("downgrade ... in a later round"), not emitted (see F-N10).

## N1-N9 and F8/F9 re-check (original probes reproduced)

| ID | Orig. severity | Status now | Evidence (reproduced this session) |
| --- | --- | --- | --- |
| N1(a) pad key vs gpio | Major | **FIXED** | `GPIO2` with `gpio: 7`: `E_PAD_KEY chips/demo-mcu-1.yaml pads.GPIO2.gpio: pad "GPIO2" is named for GPIO 2 but has gpio: 7`; `GP2` with `gpio: 3`: E_PAD_KEY; duplicate gpio (`PA5` with `gpio: 0`): `gpio 0 is already used by pad "GPIO0"`. Legitimate names still pass (exit 0): `GPIO7`/7, `PA5`, `D13`, `P0.13`, `GPIO2_A`, `GP20`, `IO21`, `BCM22` |
| N1(b) conflict facts | Major | **FIXED** | one reading: `E_FACT_STATUS ...readings`; reading without evidence: `...readings.1.evidence`; `active` not a reading: `...active`; `value` != `active`: `...value`. Deep equality with reordered object keys passes (exit 0, `c_object_reordered_ok`); a different object as `active` fails; extra key in `active` is `E_SCHEMA`; unknown evidence inside a reading is `E_EVIDENCE_UNKNOWN` |
| N1(c) pad references | Major | **FIXED** | `onboard[].uses_pad` (`E_REF_UNRESOLVED ...onboard.0.uses_pad.1`), `os_overlays[].pads` (`...pads.led`), `module.bonded_pads` (`bonded_pads.4`), `module.consumed` key (`consumed.GPIO99`), `peripherals.*.iomux_pins` (`...I2C0.iomux_pins.sda`): each exactly one error, exit 1 |
| N1(d) same pad on two pins | Major | **FIXED** | `E_PIN_NUMBERING ...connectors.0.pins.3.pad` (same connector) and `connectors.1.pins.0.pad` (across connectors), message names the first pin |
| N4 uniqueness and references | Minor | **FIXED** for the listed items | duplicate variant / connector / rail ids: `E_DUPLICATE_ID ...variants.1.id`, `connectors.1.id`, `rails.1.name`; power pin with unknown rail: `E_REF_UNRESOLVED ...pins.0.rail`; empty or whitespace `title`/`publisher`: `E_SCHEMA must not be blank`; claim prefix mismatch: `E_SCHEMA claims.0.id` (citing it adds `E_EVIDENCE_UNKNOWN`, still exit 1). Still open (documented as deferred to Phase 2b): breakout `pullups[].line` / `pins[].maps_to` / `interfaces_exposed`, fixture duplicate `instance` / unknown `locked[].pad` (all exit 0, see F-N11) |
| N5 reviewer look-alikes | Minor | **FIXED** | zero-width-space and Cyrillic `а` reviewer: `E_SCHEMA ...reviewers.1: reviewer key must be plain ASCII ...`, exit 1 |
| N6 Dependabot npm failure | Minor | **NOT VERIFIED** (remote) | cause not readable without auth; check on the first run after publishing |
| N7 misspelled kind dir | Minor | **FIXED** | `chip/demo-mcu-1.yaml`: `E_UNKNOWN_DIR`, exit 1; nested `misc/a/b/c.yaml` and `misc/c.yml` also flagged; directories without YAML, `.github/`, `node_modules/` ignored |
| N8 URL hygiene + JSON Schema | Minor | **FIXED** | userinfo, `https://example.com\@evil.com/x` (backslash form), leading space, inner space, uppercase/mixed-case scheme, `javascript:`, `data:`, `file:`, `ftp:`: `E_SCHEMA`; the emitted `evidence.schema.json` carries `^https?:\/\/` and `^\S+$` |
| N9 Node 24 `.nvmrc` | Info | **UNCHANGED** (Info) | `.nvmrc` = `24`; supported to 2028-04-30; decide a move to 26 after it turns LTS (2026-10-28) |
| N2 base path | Major | **FIXED** (local); live check DEFERRED | `vite.config.ts:12` default `/Microcontrollers-Pinout-Finding/`, overridable by `PAGES_BASE`; workflows derive it from `github.event.repository.name` and assert the built html; `apps/web/test/manifest.test.ts:38,51`, `CONTRIBUTING.md:38-39`, `tools/progress` use the new name; built html verified under both the default and an override. Stale leftovers: see F-N12 |
| N3 Pages disabled | Major (setup) | **DEFERRED (user decision)** | `has_pages: false`; to be done at publish |
| F8 pin rules | Minor | **FIXED** except two Info items | duplicate position/label, blank labels, pad not bonded, duplicate pad: all caught. Still exit 0: blank `reset` pin label; gpio pin on a module-`consumed` pad (documented design, README decision 6) |
| F9 URL schemes | Minor | **FIXED** | see N8; plain `http://` still accepted (intended) |
| F2-F5, F7, F11, F12, CR1-CR9 | — | no regression | `probe.py` rerun: all F2/F3/F4/F5/CR1/CR3/CR4/CR7/S5 probes give the same result as in the previous report (changes are only the intended N-fixes); cannot-be-cited prefix probe now fails at schema level |
| F6, F10, F13, F14 | Minor | unchanged | F6 documented; F10 = R4 DEFERRED; F13 no DOM test for hash-router focus; F14 (kept previous catalog versions, bundle-size check, editor hook) deferred to later phases |

## New-code gap probes (step 4)

| Probe | Result | Verdict |
| --- | --- | --- |
| `GPIO007` with `gpio: 7` | exit 0 (`Number("007") === 7`) | acceptable |
| `gpio` float `8.5`, negative `-1`, string `"7"` | `E_SCHEMA` (only), board `(not computed)` | caught |
| lower-case key `gpio2` with `gpio: 9` / `gpio9` with 9 | E_PAD_KEY / exit 0 (rule is case-insensitive) | correct |
| keys `GPIO(1)`, `GPIO.*`, `GPIO[1]`, `GPIO+` | exit 0, no crash (regex is applied to the key, not built from it) | correct |
| key `GPIO` + full-width digit `２` with `gpio: 5` | exit 0 (not recognised as GPIO-style, so a free name) | Info (F-N13) |
| 20-digit key `GPIO99999999999999999999` with `gpio: 5` | E_PAD_KEY | caught |
| pad key mismatch plus a shape error in another pad | only `E_SCHEMA` (chip is not 'ok', no cascade) | caught |
| pad key mismatch only | only `E_PAD_KEY`, no `E_SCHEMA`/ref cascade | caught |
| board with two variants on different chips, `uses_pad: [GPIO3]` valid in chip 1, absent in chip 2 | `E_REF_UNRESOLVED ...uses_pad.1: pad "GPIO3" is not a pad of chip demo-mcu-2 (variant demo-variant-b)`, no computed status | caught (every variant checked) |
| same, gpio pin on `GPIO3` | `E_PIN_NUMBERING ... not a pad of chip demo-mcu-2 (variant demo-variant-b)` | caught |
| chip broken (`gpio: "x"`) while module and board cite it | one `E_SCHEMA` for the chip; board `(not computed)`; no duplicate reference error for the chip | caught |
| module `consumed` key on a pad that the module does not list in `bonded_pads` | exit 0 | Info (F-N11) |
| `docs/README.md` in root | exit 0; `docs/notes.yaml` | `E_UNKNOWN_DIR` (false positive if a catalog ever keeps YAML docs in the root; Info F-N13) |
| `.github/x.yml`, `node_modules/x/y.yaml`, empty unknown dir | exit 0 | correct |
| kind dir renamed `Chips/` (NTFS) | `E_UNKNOWN_DIR Chips/demo-mcu-1.yaml`, exit 1 (also loaded as `chips/` on Windows because the FS is case-insensitive; harmless since it already fails) | correct |
| symlinked kind directory | not tested (no privilege to create symlinks verified); by reading `load.ts` a symlinked unknown directory is not seen as a directory by `Dirent.isDirectory()` and is skipped silently | not verified (Info) |
| 15 real vendor / standard URLs (Arduino, Espressif x4, Raspberry Pi pip-assets, Bosch, circuitbasics, NXP x2, TI, Wemos, `st.com ...pdf#page=3`, `%20` + query string, `http://`, host with port) | all exit 0 | no regression for Phase 2a data |
| URL with a literal space in the path | `E_SCHEMA URL must not contain whitespace` | by design; paste must be %-encoded |
| reviewers `jane.doe`, `smsaad-181`, `J_Smith`, `0day`, `a`, `hardware-researcher`, Kelvin sign `K` (U+212A) | accepted as distinct valid keys (Kelvin sign lower-cases to `k`, so it is the same identity as `k`, no bypass) | OK |
| reviewers `mahmud@southerniot.net`, `-x`, `x y`, `Smith, J`, `jose\u0301` | `E_SCHEMA` | by design; e-mail style identities are rejected (Info F-N13) |
| conflict with two identical readings | exit 0 | Info (F-N11) |
| `A4`/`A5` vs `SDA`/`SCL` on one pad | documented as an error (README decision 19), see F-N9 | Minor |

Nothing in these probes lets an invalid catalog reach exit 0 in a way that could carry a wrong hardware fact to the engine: no new Major.

## Mutation spot-checks (real tree, every file restored with `git checkout -- <file>`; `git status --short` empty afterwards)

| Mutant | Test scope | Result |
| --- | --- | --- |
| M1 `integrity.ts`: mismatch condition `Number(named[1]) !== pad.gpio` -> `false` | cli `integrity.test.ts` | KILLED (8 failed) |
| M2 `fact-rules.ts`: `deepEqual` object branch disabled (key-order case) | schema `round2.test.ts` | KILLED (1 failed) |
| M3 `load.ts`: unknown-directory scan skipped | whole cli suite | KILLED (3 failed) |
| M4 `evidence.ts`: URL userinfo check removed | schema `round2.test.ts` | KILLED (3 failed) |
| M5 `primitives.ts`: reviewer charset loosened to `^\S+$` | schema `round2.test.ts` | KILLED (5 failed) |
| M6 `validate.ts`: same pad on two pins not flagged | cli `integrity.test.ts` | KILLED (1 failed) |
| M7 `fact-rules.ts`: `active` must be one of readings removed | whole schema suite | KILLED (2 failed) |
| M8 `validate.ts`: power-pin rail reference unchecked | whole cli suite | KILLED (2 failed) |

8 of 8 killed (4 asked for, from four areas, plus 4 more). Tests assert concrete codes/paths.

## Plan coverage

PLAN Phase 1 items still not covered: branch protection requiring `ci` + CODEOWNERS (1.8, DEFERRED by user); previous catalog versions kept in `dist/` and bundle-size check, Playwright smoke, editor JSON Schema hook (F14, later phases); two-approval rule on `catalog/**` (solo mode); the plan-gate sentence "Pages URL serves the build from `main`" (DEFERRED). No locally checkable Phase 1 requirement is left uncovered.

## Findings (open after this round)

| ID | Severity | Area | File:line | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| F-N9 | Minor (Info for Phase 1; plan before the Uno entry) | one pad on two pins | `packages/cli/src/validate.ts:~478`, README decision 19 | The Arduino Uno R3 (an MVP board) repeats A4/A5 as the SDA/SCL header pins; a gpio pin needs a `pad`, so a faithful pin map is rejected with `E_PIN_NUMBERING`. The schema reference does not require one pad on two pins, so this is not a Phase 1 failure; README already records the caveat | Before cataloguing the Uno: downgrade the check to the warning `W_DUPLICATE_PAD` (as README says), or allow it only when the pins' labels are declared aliases (e.g. a documented `alias_of` convention approved via the schema owner). Do not invent a second pad. Add one valid fixture for the chosen form |
| F-N10 | Info | docs | `packages/cli/test/fixtures/README.md:227` | `W_DUPLICATE_PAD` is named but never emitted | keep wording prospective, or add the code when F-N9 is handled |
| F-N11 | Minor | validator coverage (deferred, documented) | `validate.ts` | Still exit 0: breakout `pullups[].line`/`maps_to`/`interfaces_exposed` vs IC; fixture duplicate `instance` / unknown `locked[].pad`; blank `reset` label; module `consumed` key not in `bonded_pads`; conflict with two identical readings | engine inputs for Phase 2b; add before breakout/fixture data entry; for `consumed` not in `bonded_pads` emit `E_REF_UNRESOLVED` |
| F-N12 | Info | docs | `.claude/skills/github-pages-deploy/SKILL.md:104` | still says default base `/pinout-finder/` | update the sentence to `/<repo-name>/` and note `PAGES_BASE` is set from `github.event.repository.name` |
| F-N13 | Info | strictness edge cases | `integrity.ts:11`, `load.ts`, `primitives.ts:64` | full-width-digit pad names count as free names; YAML under a non-kind root directory such as `docs/` is an error; e-mail style reviewer ids are rejected; a symlinked unknown directory is skipped | accept; document in README decision 20 (reviewer ids are handles, not e-mails) |
| N6 | Minor | Dependabot | `.github/dependabot.yml` | npm run failed once; cause unknown | check at publish time |
| N9 | Info | runtime | `.nvmrc` | Node 24 now in maintenance (EOL 2028-04-30); Node 26 LTS 2026-10-28 | schedule a bump |

Counts: Critical 0, Major 0, Minor 3 (F-N9, F-N11, N6), Info 4 (F-N10, F-N12, F-N13, N9).

## External claims checked

| Claim | Source opened (URL · section) | Result |
| --- | --- | --- |
| (a) project sites are served at `https://<owner>.github.io/<repository>/` and Vite `base` is `'/<REPO>/'` | `https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/static-deploy.md` § GitHub Pages step 1: "If you are deploying to `https://<USERNAME>.github.io/<REPO>/` ... set `base` to `'/<REPO>/'`" (GitHub "About GitHub Pages" § project sites, checked in the previous round) | CONFIRMED; the new base matches the repo `Microcontrollers-Pinout-Finding` |
| (b) `github.event.repository.name` exists in `pull_request`, `push`, `workflow_dispatch` and is not attacker-controlled | `https://docs.github.com/en/actions/reference/workflows-and-actions/contexts` § `github` context: `github.event` is "The full event webhook payload ... identical to the webhook payload of the event that triggered the workflow run"; the page itself does not list `repository.name`, and webhook payloads of those events include the `repository` object. The page warns about untrusted contexts; repository names contain only letters, digits, `.`, `_`, `-` and are chosen by the repo owner, and the value is only placed in an `env:` entry (not interpolated into a script) | CONFIRMED in principle from documentation; the exact value on a real runner is not yet observed (DEFERRED to the first run after publishing) |
| (c) `actions/deploy-pages` needs Pages enabled with source = GitHub Actions | `https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`: "To start using custom workflows you must first enable them for your current repository" | CONFIRMED; DEFERRED by user decision, not a defect |

## Not verified (and why)

- DEFERRED (user decision, final release): CI green on a PR for this code (R3), branch protection and CODEOWNERS (R4, task 1.8), deploy run on `main` (P1), live Pages URL with "Pinout Finder" (P2), Pages `build_type` and environment branch policy, Dependabot npm cause (N6).
- Real-runner value of `github.event.repository.name` in the new `PAGES_BASE` env (only the documentation was checked).
- Symlink handling in `load.ts` (no symlink created; reasoning from code only).
- Browser behaviour (hash-router focus), as before.
- Working tree: `git status --short` shows only this report modified (the `docs/NOW.md` change seen at the start of the session was committed as `eeac3fa` while I worked).

## Summary

All locally checkable gate items pass with fresh evidence at `eeac3fa`: 436 tests, typecheck, lint, format, 75/75 invalid roots with exactly the expected code, valid (39/1/1) and empty catalogs exit 0, byte-identical compile (`35e8668ed210`), web build under `/Microcontrollers-Pinout-Finding/` and following `PAGES_BASE`, SHA pins, actionlint, schema/reference diff. N1(a-d), N2, N4, N5, N7, N8 are FIXED and reproduced with the original probes; no regression in the 12 original or 36 round-1 cases or the valid fixture; 8 of 8 mutations killed; no new Major, and all 15 real vendor URLs still validate. Open items are Minor/Info (Arduino Uno A4/A5 handling before the Uno is entered, the deferred Phase 2b reference checks). Remote items remain for the final release: CI on a PR, branch protection/CODEOWNERS, deploy on `main`, live Pages URL, Pages setting.

VERDICT: PASS
