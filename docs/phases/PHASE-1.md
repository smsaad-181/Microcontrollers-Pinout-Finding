# Phase 1 — Foundation

**Goal:** the monorepo skeleton, the typed schema with the evidence model, a catalog CLI that rejects
unsupported facts, CI on every PR, and a placeholder page **live on GitHub Pages** from `main`.

Skills to load: `catalog-schema`, `datasheet-evidence`, `github-pages-deploy`, `test-driven-development`.

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 1.1 | pnpm workspace: `packages/{schema,rules,engine,codegen,cli}`, `apps/web`. Root `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. ESLint flat config, Prettier, Vitest workspace. Scripts: `build`, `test`, `lint`, `typecheck`, `catalog:validate`, `catalog:compile`. | ci-pages-engineer | workspace builds |
| 1.2 | Zod schemas for **Evidence, Fact<T>, Chip, Module, Board, Pin view, IC, Breakout, Fixture, Project, Recommendation** exactly as the TypeScript reference in skill `catalog-schema`. Export JSON Schema for editor autocomplete (`packages/schema/dist/*.schema.json`). TDD: tests first. | engine-developer | `packages/schema` |
| 1.3 | `catalog validate [--root <dir>]` (default `catalog/`): loads `<root>/**/*.yaml` (fixtures validated against the Fixture schema), validates schemas, resolves every `evidence:` id to `catalog/evidence/*.yaml`, fails on: missing evidence, unknown evidence id, a pin without all three numbering systems (GPIO, board label, connector position), a `verified` fact with fewer than 2 reviewer keys, a board status that disagrees with its facts' statuses. Prints a coverage report. An **empty** real catalog must validate and compile (deploy runs both from Phase 1). | engine-developer | `packages/cli` |
| 1.4 | `catalog compile`: emits `apps/web/public/catalog/<version>.json` + `catalog-manifest.json` (version, date, SHA-256, counts per status). Deterministic output (sorted keys). | engine-developer | compiled JSON |
| 1.5 | Seed fixtures for the CLI: one tiny **valid** catalog and a set of **invalid** ones (each violating one rule) under `packages/cli/test/fixtures/`. Use clearly fake part names (`DEMO-MCU-1`) so no real hardware fact is invented. | fixture-author | fixtures |
| 1.6 | `apps/web`: Vite + React + TS placeholder page ("Pinout Finder — coming soon", catalog manifest version shown), hash router, CSP meta tag, `base: '/<repo>/'`. | ui-developer | placeholder app |
| 1.7 | Workflows: `ci.yml` (PR: jobs lint, typecheck, test, catalog-validate, build, plus a final aggregate job named **`ci`** that `needs:` all of them — branch protection requires that check name), `deploy.yml` (push to main: build + upload-pages-artifact + deploy-pages), `links.yml` stub (weekly, no-op until Phase 5). All actions pinned to commit SHAs with a version comment. `dependabot.yml` for actions + npm. | ci-pages-engineer | workflows |
| 1.8 | Branch protection on `main`: require the `ci` check, linear history (so merges are squash). Solo mode: no required human approvals yet — see "Decisions recorded" in `docs/STATE.md`; the two-key rule is enforced by the researcher + blind auditor agents and CI. `CODEOWNERS` with `catalog/** @<owner>` (CODEOWNERS decides *who* must review; GitHub's approval count is repo-wide, not per path). | ci-pages-engineer | protection set |
| 1.9 | Docs: `docs/schema.md` (generated from Zod descriptions), `CONTRIBUTING.md` skeleton. | ci-pages-engineer | docs |

## Deliverables

Monorepo, schema package with tests, CLI validate/compile with tests, placeholder site deployed.

## Gate checklist

- [ ] `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r lint && pnpm -r test` exit 0.
- [ ] `pnpm catalog:validate --root packages/cli/test/fixtures/valid` exits 0 and **non-zero on every invalid fixture root**, each with the expected error message (test proves it); `pnpm catalog:validate` on the (empty) real catalog exits 0.
- [ ] `pnpm catalog:compile` run twice produces byte-identical output (determinism).
- [ ] `pnpm --filter web build` exits 0; `dist/index.html` references assets under `/<repo>/`.
- [ ] Every `uses:` in `.github/workflows/*.yml` is pinned to a 40-char SHA (grep check).
- [ ] CI on the draft PR is green and reports a check named `ci`.
- [ ] Branch protection readable via `gh api repos/{owner}/{repo}/branches/main/protection` and requires `ci`.
- [ ] Zod schemas match the TypeScript reference in skill `catalog-schema` field-for-field (validator diff check).

*Post-merge* (after the squash merge to `main`):

- [ ] Deploy run on `main` succeeded (`gh run list --workflow deploy.yml --branch main --limit 1 --json conclusion`).
- [ ] The Pages URL returns HTTP 200 with the placeholder text (`curl -s <url> | grep "Pinout Finder"`).

## Validators (run in parallel)

- `phase-validator` — all gate items.
- `code-reviewer` — schema + CLI code quality and test meaningfulness.
- `github-actions-expert` — workflow security (permissions, pinning, concurrency, injection).
