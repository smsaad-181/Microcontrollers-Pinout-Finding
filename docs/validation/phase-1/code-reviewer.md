# Validation report — Phase 1 (re-review after fix rounds 1 and 2) — code-reviewer

- Date: 2026-10-22 · Commit: `036c4b4` (branch `phase-1-fix-1`; source equals `b50c8a9`, later commits are docs only; working tree clean before and after) · Catalog version: `35e8668ed210` (empty real catalog) · Validator: code-reviewer
- Scope (every file read in full): `packages/schema/{src,scripts,test}`, `packages/cli/{src,test/*.ts}` including `integrity.ts`, `order.ts`, `test/fixtures/{README.md,make-invalid.py}`, `apps/web/{src,test,vite.config.ts,index.html}`, `.github/workflows/*.yml` (shell snippets only), root config, `tools/progress` (security skim). `docs/STATE.md` not used as evidence; `phase-validator.md` was read only at the very end to mark overlaps ("already F-N..").
- Scratch evidence (outside the repo): `C:\Users\SAAD\AppData\Local\Temp\claude\d--Development-pinout-finder-kit\ddb4f849-ef4d-4359-a359-7f2a6e0f4722\scratchpad\code-review-r2\` (`p1.ts`-`p3.ts` probes, `lib.ts`, `mut.mjs` + `m1..m6.json` mutation harness and `m*.out` results, `js.cjs` ajv check, generated catalog copies).
- Method: every mutation was applied to the real tree, only the targeted vitest project run, the file restored with `git checkout -- <file>` in a `finally` block. `git status --short` was empty after every run and is empty at the end except for this report.

## Gate items

Only items that overlap this role; the full gate belongs to `phase-validator`.

| # | Gate item | Command / method | Exit / result | Evidence (key output lines) | PASS/FAIL |
| --- | --- | --- | --- | --- | --- |
| 1 | Typecheck | `pnpm -r typecheck` | 0 | all projects `Done` | PASS |
| 2 | Lint | `pnpm -r lint` | 0 | all projects `Done` | PASS |
| 3 | Tests | `pnpm test` (root) | 0 | `Test Files 19 passed (19)`, `Tests 411 passed (411)` | PASS |
| 4 | Generator reproducible | `py -3 -I make-invalid.py` on a scratch copy of `fixtures/`, `diff -r` against the repo | 0 | `generated 75 invalid cases`; `diff -r` empty (committed `invalid/` equals generator output) | PASS |
| 5 | Dependency CVEs | `pnpm audit --prod`; `pnpm audit` | 0 / 0 | both `No known vulnerabilities found` | PASS |
| 6 | Secrets | `grep -rEn "(api[_-]?key\|secret\|password\|token)\s*[:=]\s*['\"][^'\"]{8,}"` over `packages/*/src,test`, `apps/web/src,test`, `.github`, `tools` | no match | empty | PASS |
| 7 | Web build: CSP present, nothing inline | `pnpm --filter web build`, read `dist/index.html` | 0 | `<meta http-equiv="Content-Security-Policy" ...>` directly after `<meta charset>`, one external module script and one stylesheet under `/Microcontrollers-Pinout-Finding/assets/`, no inline script or `style=`; the policy does not block the app | PASS |
| 8 | JSON Schema emission validates the valid fixtures | `pnpm --filter @pinout/schema build`; ajv 6.15.0 (already installed, transitive of ESLint; nothing added) with the draft 2020-12 tuple form (`prefixItems` + `items:false`) rewritten to draft-07 `items:[..]` + `additionalItems:false`, because ajv 6 does not know `prefixItems` | 0 | all 7 valid fixtures (evidence, chip, module, board, ic, breakout, fixture) validate. Without the rewrite the IC fails at `vdd_range` (ajv limitation, as in the previous round). Gaps for invalid input: finding CR14 | PASS (Minor gaps) |
| 9 | `docs/schema.md` up to date | `node scripts/emit-docs.mjs <scratch>` and `diff` | 0 | identical to `docs/schema.md` | PASS |

## Status of my previous findings CR1-CR9

| ID | Was | Now | Evidence (original failing input re-run) |
| --- | --- | --- | --- |
| CR1 board with `variants: []` / unresolved `variant.module` reaches `fully-verified`, exit 0 | Major | **FIXED** | `variants: []`: `error E_SCHEMA boards/demo-board-1@r1.yaml variants: Too small: expected array to have >=1 items`, exit 1. `module: nope`: `error E_REF_UNRESOLVED ... variants.0.module: module "nope" is not in the catalog`, exit 1. A blocked board gets `computed: null`. I then tried to build an invalid catalog that exits 0 through reference suppression (see "Suppression attempts"): none succeeded. Mutations S3, B4, B8, H5, H6 killed |
| CR2 `fully-verified` branch and compile `version` content-addressing untested | Major | **FIXED** (for chip facts; a new gap for module facts is CR1-R2 below) | `computeBoardStatus` never returning `fully-verified` is killed (R2: 2 failed); compile version ignoring content is killed (R3: 1 failed); `interim` counted as verified is killed (B5) |
| CR3 `__proto__` pad key silently dropped by Zod | Minor | **FIXED** | AST scan rejects `__proto__`, `constructor`, `prototype` as keys anywhere: `E_SCHEMA chips/demo-mcu-1.yaml pads.__proto__` exit 1. Prototype names as pad names/values (`toString`, `constructor` as a board pin pad) behave correctly (`toString` pad accepted when consistently used; `constructor` as an unknown pad value gives `E_PIN_NUMBERING`). All lookups are `Map`/`Set` or `Object.hasOwn`. One test gap remains (B6, CR12) |
| CR4 alias bomb gives a stack trace | Minor | **FIXED** | 12 levels x 9 aliases: `error E_YAML chips/demo-mcu-1.yaml (root): line 67: YAML anchors (&name) are not allowed in catalog files`, exit 1, no trace. 5,000-level `[`, `{a:` and block nesting: `E_YAML ... Maximum call stack size exceeded`, exit 1 |
| CR5 `SOURCE_DATE_EPOCH=99999999999999` RangeError | Minor | **FIXED** | `99999999999999`, `-1`, `1e3`, `253402300800`, `0x10`: usage text, exit 2, no trace; `253402300799` and empty string accepted. Mutations E3/E4 killed |
| CR6 surviving mutants M3, M6, M10, M16, M18, M22, M24; web W2, W4, W7 | Minor | **FIXED** except web focus (W4) | Killed now: M3 (R1), M6 (R4), M10 (F3), M16 (G1), M18 (R3), M22 (H8), M24 (B1, B2), web abort-while-reading (W8), CSP plugin transform and `apply:'build'` (W5, W6). Still surviving: focus on route change (W9, already F13) and registration of the plugin in `vite.config.ts` (W10) |
| CR7 misplaced / mis-named files give only warnings | Minor | **PARTIAL** | `.yml`, `.YAML`, `.Yml` in a kind directory are now `E_FILE_EXTENSION` errors; a YAML file in an unknown directory is `E_UNKNOWN_DIR` (tested: `Chips/`, nested, `chip/`). A root-level `boards.yaml` is still only `W_IGNORED_FILE`, exit 0; this is documented (README decision 13) and pinned by a test, so I treat it as accepted. New edge cases: CR13 |
| CR8 web abort / overflow / skip link | Minor | **FIXED** | abort during `response.text()` is rethrown (test + mutation W8 killed); `code { overflow-wrap }` tested; `#main` is treated as an in-page anchor, not a not-found route |
| CR9 duplicated helpers, unhelpful messages | Minor | **PARTIAL** | `byCodeUnit` and `compareDiagnostics` now live in `order.ts` (the only definition; grep confirms); `ErrorCode` derives from `FactRuleCode`; `ExprSchema` has a hint (`expected a number, or an expression of the form VDD*<k>, VDDIO+<v> or VDDIO*<k>`). Still open: `E_EVIDENCE_UNKNOWN` does not list the claim ids of the cited document; `CatalogManifest` is duplicated in web (acknowledged in a comment); web exports have no JSDoc (CR16) |

## Mutation check (real tree, restore verified)

Run: 107 mutations (95 on cli/schema, 12 on web). Killed 86, survived 21. Killed rows name the first failing test; the full lists are in `m*.out` in the scratch folder.

### Killed (86)

| Mutation (file) | Killed by |
| --- | --- |
| A1 unique `gpio` check off (`integrity.ts`) | `integrity.test.ts > a gpio number used twice is reported at the later pad` |
| A2 key vs `gpio` mismatch check off | `integrity.test.ts > GPIO<n> must equal gpio` (12 failed) |
| A3 `GP` dropped from the pad-key regex | `integrity.test.ts > GP<n> must equal gpio`, `validate.test.ts > pad-key-gp-mismatch` |
| A4 regex `/i` dropped | `integrity.test.ts > gpio<n> must equal gpio` |
| A5 conflict: `active` in readings check removed | `round2.test.ts > active must be one of the readings`, fixture `conflict-active-not-reading` |
| A6 `deepEqual` replaced by `===` | `round2.test.ts > compares with deep equality for objects, arrays and strings, regardless of key order` |
| A7 conflict: `value` equals `active` removed | `round2.test.ts > value must equal active` |
| A8 conflict `readings < 2` to `< 1` | `round2.test.ts > needs at least two readings` |
| B1 pin pad: "every variant" to "some variant" | `hardening.test.ts > M24: every variant must have the pad in its chip` |
| B2 onboard/overlay pad: "every variant" to "some variant" | `integrity.test.ts > resolves against every variant` |
| B3 power-pin rail check off | fixture `ref-power-pin-rail` |
| B4 reference suppression always on (`targetMayBeBroken`) | 13 failed, `ref-variant-module`, `ref-module-chip`, ... |
| B5 `interim` counted as verified in board status | `validate.test.ts > includes chip facts in the board status` |
| B7 duplicate pad on a board off | fixtures `pin-duplicate-pad`, `-connectors` |
| B8 module to chip reference check off | fixture `ref-module-chip`, `hardening.test.ts > a module with an unresolved chip blocks the board status` |
| B9 `bonded_pads` pad existence off | fixture `ref-bonded-pad` |
| B10 forbidden keys not rejected | fixtures `yaml-proto-key`, `yaml-constructor-key` |
| B11 evidence resolution off | fixtures `unknown-evidence`, `unknown-evidence-doc` |
| B12 fixture variant-of-board check off | fixture `ref-fixture-variant` |
| C1 `E_UNKNOWN_DIR`: every `.yaml` under any other directory ignored (ignore-list too broad) | fixture `unknown-dir`, `integrity.test.ts > unknown directories` |
| C2 `E_UNKNOWN_DIR`: nested files not scanned | `integrity.test.ts > reports every YAML file inside an unknown directory, including nested ones` |
| C3 `E_FILE_EXTENSION` off | fixtures `file-extension-yml`, `-upper` |
| C4 reviewer normalisation drops trim | fixture `verified-trim-reviewer` |
| C5 reviewer normalisation drops lower-case | fixture `verified-case-reviewer` |
| C6 reviewer charset regex loosened | fixtures `reviewer-zero-width`, `reviewer-cyrillic` |
| C7 URL userinfo check removed | fixture `url-userinfo`, `round2.test.ts > evidence URL hygiene` |
| C8 quote word limit 25 to 250 | fixture `claim-quote-too-many-words` |
| C9 claim-prefix check off | fixture `claim-id-prefix-mismatch` |
| C10 URL scheme check off | fixtures `url-javascript`, `url-original-file` |
| C11 quote character limit 400 to 4000 | fixture `claim-quote-too-long` |
| D1 manifest `facts` counts the wrong status set | `compile.test.ts > manifest carries counts per fact status, per board status and per entity kind` |
| D2 `compileCatalog` includes fixtures | `compile.test.ts` (2 failed) |
| D5 manifest `sha256` hashes different text | `compile.test.ts > manifest sha256 matches the catalog bytes` |
| E1 exit 1 also for warnings only | `hardening.test.ts > a root-level YAML file alone stays a warning (exit 0)` |
| E2 exit code 1 to 0 on validation errors | 79 failed |
| E3 unexpected-error exit 2 to 1 | `hardening.test.ts > an invalid SOURCE_DATE_EPOCH ... is a usage error (exit 2)` |
| E4 `SOURCE_DATE_EPOCH` upper bound removed | `hardening.test.ts` (99999999999999, 253402300800) |
| F1 stable-json key sort removed | `compile.test.ts > sorts keys lexicographically at every depth` |
| F3 entity sort removed | `hardening.test.ts > M10: compiled entities are ordered by id` |
| G1 evidence split at last `#` | `hardening.test.ts > M16` |
| G2 `missing` counted as `verified` in coverage | `validate.test.ts > counts facts per status exactly as the fixture README states` |
| G3 verified needs 1 reviewer | 13 failed |
| G4, G5, G6 `missing`-with-value / null-value / evidence-required rules off | `fact-rules.test.ts`, fixtures |
| G7 duplicate claim id check off | fixture `duplicate-claim-id` |
| G8 board uniqueness by `id` only (not `id@rev`) | 109 failed |
| H1 duplicate variant id off | fixture `duplicate-variant-id` |
| H3 `anyBoardBroken` always true | fixtures `ref-fixture-board` |
| H4 `consumed` key pad check off | fixture `ref-consumed-pad` |
| H5 / H6 blocked board still gets a status / board with pin errors gets a status | `hardening.test.ts` |
| H7 `iomux_pins` check off | fixture `ref-iomux-pad` |
| H8 empty silkscreen label rule off | fixtures `pin-empty-label*` |
| H9 YAML `uniqueKeys: false` | `validate.test.ts` duplicate-key test |
| H11 merge key (`<<`) rejection off | `validate.test.ts` |
| H12 loader ignore-list widened | `integrity.test.ts` |
| H13 gpio uniqueness compares the wrong value | `integrity.test.ts` |
| H14 `E_PAD_KEY` not wired into `validateCatalog` | 7 failed |
| H16 pin position duplicate off | fixture `pin-duplicate-position` |
| H17 "pad not bonded by module" off | fixture `pin-pad-not-bonded` |
| H18 `E_BOARD_STATUS` mismatch not reported | fixture `board-status-mismatch` |
| H19 `datasheet-required` rule off | `validate.test.ts` |
| H20 board status ignores chip facts | `validate.test.ts > includes chip facts in the board status` |
| H22 `unsupported` is recomputed | `validate.test.ts` |
| R1 evidence keyed by file name instead of `id` | 4 failed |
| R2 `computeBoardStatus` can never return `fully-verified` | 2 failed |
| R3 compile `version` ignores content | `compile.test.ts` |
| R4 loader `toPosix` removed | 3 failed |
| S1 `ClaimId` regex loosened | schema test |
| S3 `variants.min(1)` removed | fixture `board-no-variants` |
| S5 `accessed` date regex off; S6 `sha256` regex off | schema tests |
| S8 fact evidence ids unchecked; S10 `VDDIO+` template removed; S13 pin `kind` enum to string | schema tests |
| W1 web manifest guard without `sha256`; W2 counts validation weakened | `manifest.test.ts` |
| W3 route query string not stripped; W4 trailing slashes not stripped | `route.test.ts` (2 and 9 failed) |
| W5 CSP plugin without `apply: 'build'`; W6 `injectCsp` no longer throws; W7 `'unsafe-inline'` in `script-src` | `cspMeta.test.ts`, `route.test.ts > CONTENT_SECURITY_POLICY` |
| W8 abort while reading the body not rethrown | `manifest.test.ts > rethrows an abort that happens while the body is being read` |
| W11 HTML-with-200 fallback removed; W12 manifest URL ignores the Vite base | `manifest.test.ts` |

`CRLF normalisation removed` (asked for in the brief) does not exist as code: CRLF is handled by the YAML parser. I verified the behaviour instead: a CRLF copy of every fixture validates with exit 0 and `catalog:compile` output is byte-identical to the LF copy (`diff -r` empty).

### Survived (21)

| ID | Mutation | Why it matters | Grade |
| --- | --- | --- | --- |
| H21 | `computeBoardStatus` ignores module facts (`[board, ...chips]`) | board status is the user-facing trust label. Current code is correct (probe: all facts verified, module `flash_voltage` made `single-source`, board declared `fully-verified` gives `E_BOARD_STATUS ... declared fully-verified, computed partially-verified`); no test builds that case (finding CR1-R2) | **Major** |
| S2 | `ENTITY_ID_PATTERN` loosened to `/^.+$/` | entity ids are the resolution key of every reference and of the evidence-doc split at `#`. Current code rejects `"Demo MCU"` (`E_SCHEMA ... id`), no test pins the pattern (CR2-R2) | **Major** |
| S15 | strap `required_at_reset` enum to `z.string()` | boot-strap level is on the hardware-critical list; `required_at_reset: hgih` is rejected today (`E_SCHEMA ... strap.value`), nothing pins it (CR2-R2) | **Major** |
| S12 | module `consumed` kind enum to `z.string()` | flash/PSRAM/USB-consumed pads are on the 100 % audit list; `value: flsh` is rejected today, nothing pins it (CR2-R2) | **Major** |
| B6 | `Object.hasOwn(chip.pads, pad)` to `pad in chip.pads` (pin pad lookup) | with `in`, a board pin on `toString`/`constructor` would resolve; no test uses a prototype-named pad | Minor |
| S4 | pad `gpio` loses `.int().nonnegative()` | `gpio: 1.5` is rejected today (`E_SCHEMA`), untested | Minor |
| S7 | `URL.canParse` refine removed | `http://` with no host passes the regex checks | Minor |
| S9 | conflict reading evidence ids unchecked (`z.string()`) | still caught later as `E_EVIDENCE_UNKNOWN`, so fail-safe | Minor |
| S11 | `community` removed from `StatusSchema` | no test uses a `community` fact; a `community` fact is accepted today and the board stays partially verified | Minor |
| S14 | connector `position` loses `.positive()` | position 0 / negative untested | Minor |
| D3 | manifest `board_status` always counts `partially-verified` | the counts may be shown by the UI later | Minor |
| D4 | manifest `bytes` uses `string.length` instead of UTF-8 bytes | ASCII-only fixture | Minor |
| F2 | stable-json sorts arrays | array order is semantic (pin order, readings); only sorted arrays in fixtures | Minor |
| F4 | `validateCatalog` input sort removed | masked by the final diagnostic sort | Minor |
| F5 | diagnostic sort removed in `validateCatalog` (in-process API) | `validateRoot` re-sorts only when the loader added diagnostics | Minor |
| F6 | `byCodeUnit` replaced by `localeCompare('en')` | determinism relies on code-unit order; no test has ids whose order differs (for example `a-b` vs `ab`, upper/lower case) | Minor |
| H2 | `uniqueByKey` keeps duplicated ids | the duplicate error stays; only a second-order effect | Minor |
| H10 | YAML version option 1.2 to 1.1 | `schema: 'core'` is also set, so likely equivalent; `no`/`on` as labels stay strings (probe exit 0) | Minor |
| H15 | evidence-date fallback takes the earliest instead of the latest | only reached without epoch and without git | Minor |
| W9 | focus move on route change removed | already F13 (no DOM test) | Minor |
| W10 | `vite.config.ts` no longer registers `cspMeta()` | the plugin is unit-tested, its registration is not, and CI only greps the base path; the CSP could vanish unnoticed | Minor |

## Findings

| ID | Severity | Area | File:line / fact path | Finding | Evidence / source | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| CR1-R2 | **Major** | test meaningfulness (status computation) | `packages/cli/src/validate.ts:208-213`; tests in `validate.test.ts`, `hardening.test.ts` | Mutant H21 survives: `computeBoardStatus` can ignore module facts and all 247 cli tests pass. Only chip facts (H20) and board facts are pinned. The README (decision 7) says the status covers board + variant modules + chips. | mutation H21 (`247 passed`); correct behaviour shown by probe `p2.ts` (module `flash_voltage` `single-source`, board `fully-verified`: `E_BOARD_STATUS`) | Add to `hardening.test.ts`: valid fixture with `max_current` and `internal_pull_ohm` made verified and the board `fully-verified` expects 0 errors (the positive case), then the module's `flash_voltage` set to `single-source` expects `E_BOARD_STATUS` with `computed: partially-verified`. |
| CR2-R2 | **Major** | test meaningfulness (schema constraints on safety data not pinned) | `packages/schema/src/primitives.ts:44` (`ENTITY_ID_PATTERN`), `chip.ts` strap `required_at_reset`, `board.ts` `consumed` kind enum; tests `schemas.test.ts`, `round2.test.ts` | Mutants S2, S15, S12 survive all 362 schema + cli tests. Nothing asserts that an id such as `"Demo MCU"` or `a#b`, a strap level `hgih`, or a consumed kind `flsh` is rejected. Ids key every reference and the evidence split; straps and consumed pads are on the hardware-critical audit list. Current code rejects all three (probe `p3.ts`), so this is a missing test, not a code bug. | mutations S2, S15, S12; probe `p3.ts` | In `schemas.test.ts` add table tests: ids `Demo`, `a b`, `a#b`, `a@b`, `-a`, `a--b`, empty (each `E_SCHEMA`), strap `required_at_reset: hgih`, consumed `value: flsh`, and also `gpio: 1.5`, `gpio: -1`, `position: 0`, a fact with `status: community` (accepted). |
| CR3-R2 | Minor | determinism tests | `packages/cli/src/order.ts:5`, `stable-json.ts`, `validate.ts:639` | F6 (`localeCompare`), F5, F4, F2 survive. The code is deterministic today (code-unit sort everywhere, no locale or clock use; two compiles from a deleted output folder under `TZ=Asia/Tokyo LC_ALL=tr_TR.UTF-8` vs default are byte identical, `diff -r` empty), but a regression to a locale-aware sort would pass. | mutations F2, F4, F5, F6; `diff -r o1 o2` empty | Add ids whose code-unit order differs from locale order (`Zed`-style capitals cannot occur, so use `a-b`, `a.b`, `ab`, `a_b`) to a compile test and assert the exact output order; add an array-order test (pins out of position order) to `stableStringify`. |
| CR4-R2 | Minor | loader robustness | `packages/cli/src/load.ts:44-46` | Symbolic links and junctions in the catalog root are skipped silently: a directory junction `chipz` to a folder with YAML gives exit 0 and no diagnostic (`Dirent.isDirectory()` is false for links). Inside a kind directory a junction is followed and loaded (`chips/linked/bad.yaml` gives `E_YAML`), so the two cases differ. | `junc` and `jk` probes: exit 0 vs exit 1 | Use `entry.isDirectory() \|\| entry.isSymbolicLink()` in the unknown-directory scan (and stat the target), or document that links are ignored. |
| CR5-R2 | Minor | CLI usability | `packages/cli/src/cli.ts:109-119` | `--root` pointing at any existing directory with no kind subdirectories validates "0 files" with exit 0 (`pnpm catalog:validate --root packages/cli/test/fixtures/valid/chips` prints `0 errors, 1 warning in 0 files`, exit 0). A typo such as `--root catlog/..` or a wrong CWD in CI would pass silently. | reproduced, exit 0 | When the root has none of the seven kind directories, exit 2 with "root is not a catalog (no evidence/, chips/ ... directory)"; keep exit 0 for the real empty catalog (it has the `.gitkeep` directories). |
| CR6-R2 | Minor | loader message on case-insensitive file systems | `packages/cli/src/load.ts:57` | On Windows/macOS a directory named `Chips/` is reported as `E_UNKNOWN_DIR ... this file is not loaded`, but it is loaded as `chips/` (the run shows `chips 1` in the entity counts). The exit code (1) is right; the text is wrong there. Phase-validator saw the same behaviour and called it harmless. | `case` probe output | Change the wording to "is not a catalog directory (expected exactly one of ...)", without the claim about loading. |
| CR7-R2 | Minor | conflict facts | `packages/schema/src/fact-rules.ts:119-124` | The message says "a conflict needs at least 2 disagreeing readings" but two readings with the same value are accepted (`readings [3.3, 3.3]`, `active 3.3`: 0 errors). Already F-N11. | probe `p1.ts` ("conflict identical readings") | Report `E_FACT_STATUS` at `readings` when all reading values are deep-equal, or reword the message. |
| CR8-R2 | Minor | surviving low-risk mutants | see "Survived" table | B6 (`in` vs `Object.hasOwn`), S4, S7, S9, S11, S14, D3, D4, H2, H10, H15 survive; each has a correct current behaviour that no test asserts. B6 is the only one with a real regression risk (prototype-named pad resolves). | mutation table | One test per mutant: a board pin on pad `toString` gives `E_PIN_NUMBERING`; `http://` rejected; `position: 0` rejected; a compile test with a `fully-verified` and a `datasheet-required` board checks `board_status` counts; an evidence record with a non-ASCII title checks `bytes`. |
| CR9-R2 | Minor | web | `apps/web/vite.config.ts:3`, `apps/web/src/cspMeta.ts:3` | `pnpm test` prints a Vite warning: `import "./csp" without a file extension (apps/web/src/cspMeta.ts:3:41)` ("unsupported by configLoader: native"). The built page also keeps the template's "CSP meta tag: inserted here at build time" comment after the inserted tag. W10: nothing checks that `vite.config.ts` registers `cspMeta()`, and CI only greps the base path in `dist/index.html`. | `pnpm test` output; mutation W10 | `import ... from './csp.ts'` (the config already imports `./src/cspMeta.ts`); add `grep -q 'Content-Security-Policy' apps/web/dist/index.html` to the "dist/index.html" step in `ci.yml` and `deploy.yml`. |
| CR10-R2 | Minor | maintainability | `apps/web/src/*.ts(x)`, `validate.ts` messages | Web exports (`isCatalogManifest`, `useCatalogManifest`, `useHashRoute`, `CatalogStatus`, `App`) have no JSDoc; `E_EVIDENCE_UNKNOWN` still does not list the claim ids that exist in the cited document (open part of CR9); `CatalogManifest` is duplicated between cli and web (acknowledged in a comment). | reading | JSDoc one line each; append `known claims: a, b, c` (at most 5) to the "unknown claim" message. |
| CR11-R2 | Minor | JSON Schema export gaps | `packages/schema/dist/*.schema.json` | Checked with ajv on every `E_SCHEMA` invalid fixture: flagged by the emitted schema: wrong type, missing key, `variants` `minItems`, blank reviewer/quote/locator/supports/title/publisher, quote over 400 characters, non-http(s) URL, leading/inner space in URL. NOT flagged: quote over 25 words (`claim-quote-too-many-words`), claim-id prefix (`claim-id-prefix-mismatch`), reviewer charset (`reviewer-zero-width`, `reviewer-cyrillic`), URL userinfo (`url-userinfo`), reserved keys. These rules live in Zod `refine`/`superRefine`, which cannot be emitted. Editors therefore accept input the CLI rejects (the CLI stays the authority). | `js.cjs` output (`NOT FLAGGED by JSON schema`) | Add `.meta({ pattern })` or a `.regex()` where an equivalent regex exists: reviewer `^\s*[A-Za-z0-9][A-Za-z0-9._-]*\s*$`, URL userinfo `^https?://[^/?#@]*([/?#]\|$)`, and say in `docs/schema.md` which rules only the CLI checks. |
| CR12-R2 | Minor (Info) | local dashboard | `tools/progress/server.mjs:127-140` | Binds `127.0.0.1` only, serves two fixed routes (no path built from `req.url`, no traversal), `execFileSync` with fixed argv, the page escapes every interpolated field with `esc()`. It does not check the `Host` header, so a DNS-rebinding page could read `/api/state` (STATE.md text, git log subjects, changed file paths). Information only, local repo. | reading | Reject requests whose `Host` is not `localhost:<port>` or `127.0.0.1:<port>`. |

Already reported by phase-validator (re-confirmed, not counted): conflict with identical readings (F-N11, my CR7-R2), symlinked unknown directory skipped (F-N13, my CR4-R2 adds that the inside-kind case differs), `Chips/` on NTFS (called harmless; CR6-R2 is only the wording), full-width digits and e-mail reviewer ids (F-N13), `W_DUPLICATE_PAD` wording (F-N10), manifest `date` depends on clone depth (F6; `resolveCatalogDate` still uses `git log -1 -- .`, and CI does not set `SOURCE_DATE_EPOCH`; the catalog JSON and version are not affected, only the manifest label).

## Correctness of the new code (item 2, probes)

| Probe | Result |
| --- | --- |
| pad key `GPIO000` with `gpio: 0` | accepted as the name for GPIO 0 (`Number("000") === 0`); a board pin on `GPIO0` then fails `E_REF_UNRESOLVED`/`E_PIN_NUMBERING`, so a mismatched name is still caught elsewhere |
| `GPIO99999999999999999999` with `gpio: 3` | `E_PAD_KEY` (`Number()` gives 1e20, not equal) |
| `gpio: 9007199254740993` | `E_SCHEMA ... Too big: expected int to be <=9007199254740991` |
| `gpio3` (lower case) vs `gpio: 4` | `E_PAD_KEY`; `gpio3` with `gpio: 3` accepted but unreferenced `GPIO3` then fails `E_REF_UNRESOLVED` (lookups are case-sensitive) |
| `gpio: 1.5` | `E_SCHEMA` |
| pad `toString` used consistently in chip and module | 0 errors; `__proto__` pad: `E_SCHEMA`; board pin on `constructor` or `__proto__` as value: `E_PIN_NUMBERING` |
| deep equality: object key order, arrays vs objects, `-0` vs `0`, `null` | key order independent (killed A6); `-0.0` equals `0` (`===`); an array never equals an object; `NaN` cannot occur (Zod rejects `.nan`) |
| conflict: active not a reading / value not active / one reading / reading without evidence | each one `E_FACT_STATUS` at the exact path |
| every-variant chip resolution | killed (B1, B2); `mods`/`chips` de-duplicated by id before status |
| uniqueness maps keyed by user strings | all `Map`/`Set`; objects only through `Object.hasOwn` (one `in` mutation survives, B6) |
| `GPIO_STYLE_PAD` with `/i` | `gpio`, `Gp`, `bcm` handled (A3, A4 killed); `GPIO` + full-width digit is a free name (F-N13) |

### Suppression attempts (could a broken entity hide an error so the catalog exits 0?)

I built eight catalogs; each exits 1 because every "broken" entity carries its own error, and the suppression only removes derived noise:

| Catalog | errors | Result |
| --- | --- | --- |
| evidence file fails YAML parse and is the only doc everything cites | 1 (`E_YAML`) | exit 1; no extra `E_EVIDENCE_UNKNOWN`; board still computed |
| evidence doc duplicated (`copy.yaml`) | 2 (`E_DUPLICATE_ID` in both) | exit 1 |
| two boards share one module, second board broken (`vendor: 5`) | 1 (`E_SCHEMA` on board 2) | exit 1; board 1 keeps its status |
| two boards share one module, both valid | 0 | exit 0, both computed (correct) |
| chip YAML broken, module and board cite it | 1 (`E_YAML`) | exit 1; board `computed: null` |
| module with no `id` (schema broken), board cites `demo-module-1` | 4 (`E_SCHEMA`) | exit 1; `computed: null` |
| unknown `variant.module` plus an unrelated id-less broken module (`brokenModules.has(null)`) | 4 (`E_SCHEMA` of the broken file) | exit 1 (the unknown-module error is suppressed, but the broken file's errors remain, so exit 1 is guaranteed) |
| fixture cites an unknown board while another board file is broken | 12 | exit 1 |

Proof sketch (reading `validate.ts:294-310, 339, 367-387`): an entity is "broken" only if `entity === undefined` (an E_YAML or E_SCHEMA diagnostic was pushed for that file; `shapeCheck` always pushes at least one issue) or if its id is in `duplicated` (E_DUPLICATE_ID pushed). A suppressed reference error therefore always coexists with an error, so exit 0 cannot be produced by suppression. Mutation B4 (suppression always on) is killed. Loader side: `E_FILE_EXTENSION` and `E_UNKNOWN_DIR` are errors; only a root-level YAML file and (CR4-R2) a root-level link are silent.

### Loader and exit-code contract on odd input (item 2)

| Input | Exit | Output |
| --- | --- | --- |
| zero-byte `chips/demo-mcu-1.yaml` | 1 | `E_SCHEMA ... (root): Invalid input: expected object, received null` |
| UTF-8 BOM before an IC file | 0 | accepted |
| CRLF line endings on all files | 0 | accepted; compile output byte-identical to LF |
| 5 MB comment line / 5 MB string value | 0 / 1 | 1.8 s / 2.8 s; `E_SCHEMA Unrecognized key "zzz"` for the string case, no trace |
| 5,000-level flow sequence, flow map, 3,000-level block map | 1 | `E_YAML ... Maximum call stack size exceeded at line N`, no trace |
| 700-level nested value inside `fixtures/*.yaml expect.properties` (z.unknown) | 0 | accepted; 900 levels and above give `E_YAML` (the YAML parser's limit comes before any later recursion) |
| no command / unknown option / `--root` without value / root is a file | 2 | usage text or `catalog: root "..." is not a directory` |
| `--out` is an existing file | 2 | `error: EEXIST: file already exists, mkdir ...`, one line, no trace |
| `compile` with errors | 1 | `refusing to emit output because validation failed`, nothing written |

## Determinism (item 3)

`stableStringify` sorts keys by code unit at every depth (integer-like keys included) and keeps array order; numbers use `JSON.stringify` (the same text on every V8: `1e+21`, `-0` prints `0`); no `Date.now`, `Math.random`, `localeCompare` or `toLocale*` remains in `packages/*/src` (grep shows only the definition in `order.ts`). The compile `version` is content-addressed and the date lives only in the manifest. Two runs from a deleted output folder (`rm -rf o1; compile`) and a run under `TZ=Asia/Tokyo LC_ALL=tr_TR.UTF-8` are byte identical (`diff -r` empty; version `96bc08372c1d` for the valid fixture, `SOURCE_DATE_EPOCH=1700000000` gives `date 2023-11-14`). Pad uniqueness messages that name "the first pad" follow JS key order (integer-like names first), which is deterministic but not file order: cosmetic.

## Web app (item 6)

- XSS/injection: every manifest field (`version`, `date`, `counts` keys and values) and the route path are rendered as React text; there is no `dangerouslySetInnerHTML`, no `href` built from data (`hrefFor` takes constants), no `eval`. The guard accepts only non-empty strings and non-negative integer counts. Not exploitable.
- Fetch/abort: abort is rethrown both for `fetch()` and while reading the body (W8 killed); `useCatalogManifest` swallows the abort rejection on unmount; HTML-with-200 (Vite dev fallback) is `missing`; non-404 failures are `error`. Remaining: setting state after unmount is harmless in React 18.
- Hash routes: `#`, `#/`, `#//`, `#/?x`, trailing slashes, `#main` (anchor), unknown paths; no `decodeURIComponent`, so malformed `%` cannot throw. Long hashes wrap (`overflow-wrap`, tested).
- CSP string vs build output: identical to `csp.ts`; no inline script or style in the build; `img-src data:` covers the `data:,` favicon. Dev server has no CSP by design (React Refresh preamble); the plugin is `apply: 'build'` (W5 killed).
- Three required web mutations: manifest guard (W1, W2 killed), route parsing (W3, W4 killed), csp plugin (W5, W6, W7 killed; W10 registration survives, CR9-R2).

## Workflows (shell snippets only)

`ci.yml` "Every uses is pinned" grep (`grep -nE '^\s*-?\s*uses:' ... | grep -vE 'uses:\s*[^@[:space:]]+@[0-9a-f]{40}(\s|$)'`) is correct and fails closed; `grep -qF "${PAGES_BASE}assets/" apps/web/dist/index.html` uses an `env:` value, not an interpolated expression; the `ci` gate job uses `jq -e 'length > 0 and all(.[]; .result == "success")'` with `NEEDS_JSON` in `env:` (no injection). Remote runs are deferred by the user and not judged.

## External claims checked

| Claim | Source opened (URL · revision · section) | Result |
| --- | --- | --- |
| none: the review judged code behaviour against the repository's own contracts (`CLAUDE.md`, `PHASE-1.md`, fixtures README) and local reproduction; no hardware, standard or library claim was relied on | n/a | n/a |

## Not verified (and why)

- Emitted JSON Schema for tuple types against a native draft 2020-12 validator: only ajv 6 is installed. I rewrote `prefixItems` to draft-07 tuples for the check (all 7 valid fixtures pass); a native 2020-12 check is not done and no dependency was added.
- Real symlinks on Linux/macOS (junction behaviour on Windows was tested; semantics are the same for `Dirent`).
- Browser behaviour (hash-router focus, layout at phone width).
- Remote CI, deploy and branch protection: deferred by the user.

## Summary

All nine previous findings are fixed or accepted (CR7 and CR9 partial, both Minor); the checker's new code is sound: I could not construct an invalid catalog that exits 0 through reference suppression, prototype-named keys, pad-key edge cases, odd files or oversized input, and compile output is deterministic across locale and time zone. The tests are strong (86 of 107 mutants killed) but four safety-relevant mutants survive: board status ignoring module facts (CR1-R2), and unpinned entity-id format, strap-level enum and consumed-pad enum (CR2-R2). Both are missing tests for code that behaves correctly today, and each takes a few lines to fix. Per the phase-validation rule (a survived mutant on status computation or on hardware-critical schema constraints is Major), the gate fails until those tests exist.

Counts: Critical 0, Major 2, Minor 10.

VERDICT: FAIL
