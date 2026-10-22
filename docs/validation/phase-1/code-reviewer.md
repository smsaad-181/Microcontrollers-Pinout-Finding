# Validation report — Phase 1 — code-reviewer

- Date: 2026-10-22 · Commit: 8e121a7bd7261260ba30169542f36cf149c3243c (branch `phase-1`, working tree clean before and after) · Catalog version: `35e8668ed210` (empty real catalog) · Validator: code-reviewer
- Scope: `packages/schema/{src,scripts,test}`, `packages/cli/{src,test/*.ts}` (+ fixture README/cases), `apps/web/{src,test,vite.config.ts,index.html}`, root config, `tools/progress` (security skim only). Every in-scope file read in full. Not used as evidence: `docs/STATE.md`; `phase-validator.md` was read only at the very end to mark overlaps ("already F<n>").
- Scratch evidence (outside the repo): `C:\Users\SAAD\AppData\Local\Temp\claude\d--Development-pinout-finder-kit\ddb4f849-ef4d-4359-a359-7f2a6e0f4722\scratchpad\` (`e1.ts`–`e5.ts` probes, `mut.mjs`/`mut2.mjs`/`mut3.mjs` mutation harnesses, `js.mjs` JSON-Schema check).
- Method: all mutations were applied in the real working tree, one at a time, a targeted vitest run executed, and the file restored in a `finally` block. `git status --short` was empty after every harness run.

## Gate items

Only the items that overlap this role (code quality, tests, security pre-checks) were re-run; the full gate belongs to `phase-validator`.

| # | Gate item | Command / method | Exit / result | Evidence (key output lines) | PASS/FAIL |
| --- | --- | --- | --- | --- | --- |
| 1 | `pnpm -r typecheck` | run fresh | 0 | 6 projects, all `Done` | PASS |
| 2 | `pnpm -r lint` | run fresh | 0 | 6 projects, all `Done` | PASS |
| 3 | `pnpm test` (root, all projects) | run fresh | 0 | `Test Files 14 passed (14)`, `Tests 161 passed (161)` | PASS |
| 4 | Dependency CVEs | `pnpm audit --prod`, `pnpm audit` | 0 / 0 | both: `No known vulnerabilities found` | PASS |
| 5 | Hard-coded secrets | `grep -rEn "(api_key\|secret\|password\|token)\s*=\s*['\"][^'\"]{8,}"` over `packages apps tools .github` (`*.ts *.tsx *.js *.mjs *.py`, node_modules excluded) | no match | empty output | PASS |
| 6 | Web build emits CSP meta + `/pinout-finder/` base | `pnpm --filter web build`, read `dist/index.html` | 0 | `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; ...">` directly after `<meta charset>`; script and css under `/pinout-finder/assets/`; no inline script or `style=`, so the policy does not block the app | PASS |
| 7 | JSON Schema emission validates valid fixtures | ajv 6.15.0 (only validator installed; it is a transitive dependency of ESLint, nothing added) on `packages/schema/dist/*.schema.json` vs `fixtures/valid/**` | 6 of 7 validate | evidence, chip, module, board, breakout, fixture: valid. IC: ajv reports `false schema` at `vdd_range.value[0]`. Cause: Zod emits tuples as draft 2020-12 `prefixItems` + `items:false`, which ajv 6 (draft-07 only) does not understand. This is a limitation of the checker, not proof of an emitter bug. A draft-2020-12 validator is not installed, so tuple handling is **not verified** (see "Not verified") | PASS (with caveat) |

## Mutation check (real tree, restore verified)

| # | Mutation | Test scope | Result |
| --- | --- | --- | --- |
| M1 | `distinct.size < 2` to `< 1` (two-key rule), `fact-rules.ts` | schema + cli validate/cli tests | killed (5 failed) |
| M2 | evidence resolution ignores the claim part (`!claims?.has(ref.claim)` to `!claims`) | validate.test | killed |
| M3 | evidence indexed by file name instead of `id` (decision 4/5) | validate + cli tests | **SURVIVED** (fixture file name equals its id; no test renames a file) |
| M4 | `stable-json` key sort removed | cli tests | killed (3 failed) |
| M5 | `computeBoardStatus` can never return `fully-verified` | validate + cli tests | **SURVIVED** (49 passed) |
| M6 | loader `toPosix` (backslash to slash) removed | validate.test | **SURVIVED** (no nested fixture dir; matters on Windows `readdir recursive`) |
| M7 | CLI exits 0 on validation errors | cli.test | killed (13 failed) |
| M8 | `E_YAML` diagnostics dropped | validate.test | killed |
| M10 | `sortedEntities` sort removed (compile order) | cli tests | **SURVIVED** (one entity per kind) |
| M16 | evidence split at `lastIndexOf('#')` instead of first `#` (decision 4) | validate + cli tests | **SURVIVED** (no claim id with a second `#`) |
| M18 | compile `version` hashes no content (`{format}` only) | cli tests | **SURVIVED** (61 passed) |
| M22 | empty gpio `label` check disabled | validate + cli tests | **SURVIVED** (already F8: "no test or fixture") |
| M24 | pad must exist in EVERY variant's chip changed to "in some variant" (decision 6) | cli tests | **SURVIVED** (fixture has one variant) |
| M25 | `unsupported` board status also recomputed | validate.test | killed |
| M26 | conflict needs `readings` AND `active` changed to either | schema tests | killed |
| M27 | `missing` with a value no longer rejected | schema + validate tests | killed |
| M28 | broken-evidence suppression always on (decision 8) | validate.test | killed |
| M29 | compile ignores `errorCount > 0` | compile.test | killed |
| M30 | `Expr` also accepts any string | schema tests | killed |
| M31 | `fact()` not strict | schema tests | killed |
| W1 | web: HTML-with-200 check removed | web tests | killed |
| W2 | web: `if (signal?.aborted) throw err` removed | web tests | **SURVIVED** |
| W3 | web: `counts` integer validation removed | web tests | killed |
| W4 | web: focus move on route change removed | web tests | **SURVIVED** |
| W5 | web: manifest URL ignores Vite base | web tests | killed |
| W6 | web: `'unsafe-inline'` added to CSP | web tests | killed (constant only) |
| W7 | web: CSP meta injection removed from `vite.config.ts` | none | not run (anchor lost to shell escaping); by reading, **no test covers the plugin** (only the build gate does) |

26 mutants executed (20 validator/schema, 6 web): 16 killed, 10 survived (M3, M5, M6, M10, M16, M18, M22, M24, W2, W4); W7 could not be run. Survivors are graded in CR2 and CR6.

## Findings

Overlaps with `phase-validator.md` are marked "already F<n>"; those are independently re-reproduced here but not re-counted.

| ID | Severity | Area | File:line / fact path | Finding | Evidence / source | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| CR1 | **Major** | validator soundness (extends F3) | `packages/cli/src/validate.ts:235-250, 252-293, 296-299`; `packages/schema/src/board.ts:46` (`variants: z.array(...)` has no `.min(1)`) | F3 covers a dangling `variant.module`. Worse case, which needs no dangling reference: a board with `variants: []` is accepted. `resolved` is then empty, so the "pad must be a pad of the chip of every variant" check (line 280) is vacuously true, and `computeBoardStatus` sees only the board's own facts. Reproduction (valid fixtures minus modules/chips; board edited: `variants: []`, one pin `pad: GPIO77`, `max_current` made verified, `status: fully-verified`): `errors 0 warnings 1 [{"ref":"demo-board-1@r1","declared":"fully-verified","computed":"fully-verified"}] W_DANGLING_REF variant` (the only warning comes from the fixture that cites the variant). A board with pin pads that exist in no chip, no module and no chip facts is therefore `fully-verified` and exits 0. Same exit-0 outcome with `module: nope` (confirmed, `[S2b]`: `errors=0 warnings=1 ... computed:"fully-verified"`). The status is the user-facing trust label, and decision 8's "skip dependent checks" is only safe when the dependency's error is itself reported; for unresolved references nothing is reported as an error. I confirmed decision 8 does not hide errors in the E_SCHEMA/E_YAML case: every entity with `entity === undefined` has at least one error diagnostic, so a broken file can never yield exit 0. | `scratchpad/e4.ts`, `scratchpad/e2.ts` S2a/S2b output above | (1) `variants: z.array(...).min(1)` in the schema. (2) In `validateCatalog`, when a variant's module or a module's chip is unresolved and not "broken", push an error (new code `E_REF_UNKNOWN`, agree it in the fixtures README as F3 proposes) instead of a warning, and do not compute a board status for that board. (3) Add invalid fixtures: `variants: []`, and unknown `variant.module` with `status: fully-verified`. |
| CR2 | **Major** | test meaningfulness (trust-bearing behaviour untested) | `packages/cli/test/validate.test.ts`, `compile.test.ts`; code under test `validate.ts:140-145`, `compile.ts:42` | Two mutants that break documented, safety-relevant behaviour survive. **M5:** no test ever asserts `computed === 'fully-verified'` or that a board declared `fully-verified` is accepted. The only `fully-verified` tests are negative (`E_BOARD_STATUS` expected), so a `computeBoardStatus` that can never return `fully-verified` passes all 49 tests; the "all facts verified" branch is unproven. **M18:** the version is documented (`compile.ts:3-7`) as "any content change gives a new file name"; no test changes the catalog and compares versions, so a version that ignores content (stale-cache risk: new catalog served under an old file name) passes 61/61. Tests check only that the version matches `/^[0-9a-f]{12}$/` and does not depend on `date`. | M5, M18 rows above | Add (a) a positive test: valid fixture with the `missing` and `interim` facts made verified and `status: fully-verified` yields 0 errors and `computed: 'fully-verified'`; (b) a compile test: change one fact value and assert a different `version`, different `fileName`, and that `manifest.sha256` matches the new bytes. |
| CR3 | Minor | schema/validator interaction | `packages/cli/src/validate.ts:173`, `packages/schema/src/chip.ts:96` (`z.record(PadIdSchema, PadSchema)`) | Fact rules and claim resolution run on the Zod OUTPUT (`p.entity`), while coverage counts run on the raw YAML. A pad keyed `"__proto__"` (YAML keeps it as an own property) is silently dropped by Zod's record parser, so its facts skip every rule. Probe: a `"__proto__"` pad with `reviewers: [x]` and `evidence: [nodoc#zzz]` gives `errors 0`; coverage reports 43 verified facts (39 + 4 from the dropped pad) while the compiled JSON contains no `__proto__` (`own keys of pads [GPIO0..GPIO3]`, `compiled has __proto__: false`). No bad fact reaches the compiled output, but validation passes data it did not check and the coverage report counts facts that are not compiled. | `scratchpad/e3.ts` | Reject the key: `PadIdSchema` refine `!['__proto__','constructor','prototype'].includes(v)` (also for `consumed`, `peripherals`, `conditions`, `rails` records), or run `checkFactRules`/`collectClaimRefs` on `p.raw` as well and report a mismatch. |
| CR4 | Minor | error handling | `packages/cli/src/validate.ts:101` | An alias bomb (12 nested levels x 9 aliases, `maxAliasCount: 100`) makes `doc.toJS` throw `ReferenceError: Excessive alias count...`, which is not caught: `pnpm catalog:validate` prints a Node stack trace and exits 1 (fail-safe, but no `E_YAML` diagnostic and the in-process API throws). Deep nesting is handled (`E_YAML ... Maximum call stack size exceeded`), so only the alias path is inconsistent. | `pnpm catalog:validate --root <bomb>`: stack trace from `Alias.js:67` via `validate.ts:101`; `exit=1` | Wrap `doc.toJS(...)` in try/catch and emit `E_YAML` with the message. |
| CR5 | Minor | error handling | `packages/cli/src/cli.ts:65-70` | `SOURCE_DATE_EPOCH=99999999999999 pnpm catalog:compile` throws `RangeError: Invalid time value` (stack trace, exit 1) because `/^\d+$/` admits values beyond the Date range. | reproduced, `exit=1` | Check `Number.isSafeInteger` and `!Number.isNaN(new Date(...).getTime())`, else fall through to the git date. |
| CR6 | Minor | test meaningfulness (surviving mutants, lower risk) | `packages/cli/test/validate.test.ts`, `compile.test.ts`, `cli.test.ts` | Survivors: **M3** evidence matched by file name (decision 4/5 says "never by file name"): rename an evidence file in a test and assert it still resolves (probe `[S4]` shows the code is correct today, only the test is missing). **M16** first-`#` split: add a claim id `doc#a#b` (allowed by `CLAIM_ID_PATTERN`). **M6** Windows backslash normalisation in the loader: add a nested `chips/sub/x.yaml` fixture. **M10** entity sort: all fixtures have one entity per kind, so compile ordering is untested; add two chips fed in reverse order and assert identical `catalogText`. **M24** per-variant pad rule: add a board with two variants on different chips. **M22** is already F8. W2/W4: the abort and focus logic in `apps/web` are not exercised (only `renderToString` and pure functions), and no test covers the CSP-injecting Vite plugin (W7). | mutation table | Add the tests named above; for the web, one jsdom test for the hook (abort on unmount) and one for focus on `hashchange`, as F13 already suggests. |
| CR7 | Minor | validator coverage | `packages/cli/src/load.ts:24-34, 43-53` | Misplaced or mis-named catalog files produce only warnings, so CI is green while nothing is validated or compiled: a root-level `chips.yaml` and a `chips/x.yml` give `W_IGNORED_FILE` exit 0. A `chips/x.YAML` is skipped with no diagnostic at all (the root check uses `/i`, the kind-directory checks at lines 43 and 53 are case-sensitive; by code reading, not run). | load.ts | Make `W_IGNORED_FILE` an error (or add `--strict` used by CI) and match extensions case-insensitively. |
| CR8 | Minor | web | `apps/web/src/manifest.ts:75-80`, `apps/web/src/styles.css:117`, `apps/web/src/App.tsx` | (a) If the request is aborted while the body is being read, `response.text()` rejects inside the `JSON.parse` try block and is reported as `{status:'invalid'}` instead of rethrowing the abort (only the `fetch()` call checks `signal.aborted`). Under StrictMode's double effect the first (aborted) call can set `invalid` before the second result replaces it. Not reproduced in a browser; by code reading. (b) `NotFoundPage` prints the raw hash in `<code>`; a very long unbroken hash has no `overflow-wrap`, so it can cause horizontal scrolling at phone width (not reproduced). Rendering is XSS-safe: no `dangerouslySetInnerHTML`, no hrefs built from data, all manifest fields are React-escaped text. Route parsing is total (`#//`, `#/?x`, `#nope`, trailing slashes tested; no `decodeURIComponent`, so no throw on malformed `%`). (c) there is no skip link although `<main id="main">` exists, and navigating to `#main` is parsed as a not-found route. | code reading | (a) `if (signal?.aborted) throw` after the `text()` await too. (b) `code { overflow-wrap: anywhere; }`. (c) add a skip link or drop the id. |
| CR9 | Minor | maintainability / contributor UX | `validate.ts:57`, `load.ts:12`, `stable-json.ts:17`, `validate.ts:386-389` vs `406-409`; `types.ts:47-56` vs `fact-rules.ts:4`; `apps/web/src/manifest.ts:4-10` | `byCodeUnit` is defined twice and re-inlined in `stable-json`; the diagnostic comparator is copy-pasted; `ErrorCode` repeats the schema's `FactRuleCode` members (they can drift); `CatalogManifest` is duplicated between cli and web (acknowledged in a comment). Exported functions `validateCatalog`, `compileCatalog`, `runCli`, `formatCoverage`, `formatSummary`, `checkFactRules` lack JSDoc. Contributor messages: an `Expr` typo (`value: "VDDIO*abc"`) yields only `E_SCHEMA electrical.vih_min.value: Invalid input`; the fix hint (allowed forms `VDD*<k>`, `VDDIO+<v>`, `VDDIO*<k>`) exists in the description but is not surfaced. `E_EVIDENCE_UNKNOWN` does not list the claim ids that do exist in the cited document. `W_IGNORED_FILE` for a root file reads well. | probe `[Expr]` output | Export one `byCodeUnit` and a `compareDiagnostics` from a shared module; derive `ErrorCode` from `FactRuleCode`; add custom error text on `ExprSchema` (`z.union(..., { error: ... })`); append "did you mean" / the doc's claim ids to `E_EVIDENCE_UNKNOWN`. |

### Already reported by phase-validator and independently re-confirmed (not re-counted)

| Mine | Matches | Reproduction in this session |
| --- | --- | --- |
| duplicate entity ids | F2 | `[S3]` second chip with same id, `[S3b]` second board `demo-board-1@r1`: both `errors=0`, both boards listed in coverage |
| dangling variant module accepted | F3 | `[S2b]`, see CR1 for the stronger variant |
| reviewer identity | F4 | `reviewers: ["", " "]` on a verified fact gives `errors=0` (`[S10]`) |
| claim/quote hygiene, mis-prefixed claim ids | F5 | `[S5]`: the citing side is caught; the stray claim itself is not |
| `javascript:` / `file:` evidence URL | F9 | `z.url()` accepts `javascript:alert(1)`, `file:///etc/passwd` |
| no uniqueness of connector position or pad, pad not in `bonded_pads` | F8 | `[S6]` position 4 changed to 3, `[S6b]` pad GPIO1 changed to GPIO0, `[S9]` bonded_pads reduced: all `errors=0` |
| manifest `date` depends on clone depth | F6 | not re-reproduced; in this repo both full and shallow clone give 2026-10-22 because HEAD touched `catalog/` |

### Checked and found sound (no finding)

- Decision 8 cannot produce a false exit 0 through suppression (see CR1): `entity === undefined` only after an error was pushed; `brokenDocs.has(null)` and `brokenDocs.has(doc)` only suppress derived errors.
- Evidence resolution: first-`#` split, matched by evidence `id` (not file name, `[S4]`), full claim id compared, unknown doc and unknown claim distinguished. `indexOf('#')` cannot be -1 for schema-valid ids (`CLAIM_ID_PATTERN`), and refs are only collected from schema-valid entities.
- YAML: core schema 1.2 (no `<<` merge: `<<` stays a literal key and is rejected by `.strict()`; `yes` stays a string; dates stay strings), `uniqueKeys`, multi-document input rejected, BOM and CRLF accepted (CRLF block scalars normalise to `\n`, so `\r\n` checkouts give identical compiled bytes: `[S11]` 0 errors), `.nan`/`.inf` rejected by `z.number()` (`expected number, received Infinity`).
- Determinism: all ordering uses code-unit comparison (no `localeCompare`, no `Date.now`, no `Math.random`); integer-like keys sorted lexicographically; `-0` serialises as `0`, `NaN` cannot reach it, `1e21` serialises as `1e+21` (valid JSON, same on any V8); version is content-addressed, date only in the manifest. Same entity id/ordering caveat as F2.
- Schema: `exactOptional` used consistently; `Expr` Zod template literal and the emitted JSON-Schema `pattern` agree on 12 probe strings (`VDD*1e3`, `VDD*.5`, `VDD*-0`, ...); no refinement can throw; type-level equality test against the reference is real (F-validator proved by mutation); `.strict()` means a newer catalog field is an `E_SCHEMA` error on an older CLI, which is acceptable because catalog and CLI ship from one repo.
- Web: CSP string matches what the built page needs (no inline script/style, same-origin fetch); focus management on route change is correct for screen readers; the HTML-with-200 trick is handled and tested.
- `tools/progress/server.mjs`: binds `127.0.0.1`, fixed routes (no path built from `req.url`), `execFileSync` with fixed arguments, client-side `esc()` on every interpolated field. Low risk (no Host-header check; local repo docs only).

## External claims checked

| Claim | Source opened (URL · revision · section) | Result |
| --- | --- | --- |
| none: this review judged code behaviour against the repository's own contracts (`CLAUDE.md`, `PHASE-1.md`, fixtures README) and local reproduction; no hardware, standard or third-party library claim was relied on | n/a | n/a |

## Not verified (and why)

- Emitted JSON Schema for tuple-typed facts (`ic.vdd_range`, `ic.vio_range`, `breakout.regulator.vin_range`, `peripheral.adc_effective_range_mv`) against a draft 2020-12 validator: only ajv 6 (draft-07) is installed and it ignores `prefixItems`; I did not add a dependency.
- Browser behaviour for CR8 (a), (b): no browser run (the phase-validator's playwright check is not in this role's tools).
- Case-insensitive `.YAML` skip in CR7 and the missing skip link in CR8 (c): by code reading only.
- Workflow security (`.github/workflows/*`) is out of scope for this role (`github-actions-expert`).

## Summary

No Critical findings. Two Major: a board with no resolvable variants (including `variants: []`) bypasses pad-numbering checks and can be `fully-verified` with exit 0 (CR1, the strongest form of F3), and the board-status "all verified" branch and the compile version's content-addressing are not pinned by any test (CR2, mutants M5 and M18 survive). The two-key rule, evidence resolution by id, E_YAML/E_SCHEMA handling, determinism of `stable-json`/`compile`, and the web app's XSS/CSP posture are otherwise sound; `pnpm audit` and the secret grep are clean. Seven Minors are listed (CR3-CR9) plus the overlaps with phase-validator F2-F5, F8, F9. Phase 1 should not pass until CR1, CR2 and the phase-validator Majors are fixed.

VERDICT: FAIL
