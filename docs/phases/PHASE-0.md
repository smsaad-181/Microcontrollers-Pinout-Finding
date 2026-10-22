# Phase 0 — Bootstrap

**Goal:** a working local toolchain, a GitHub repository, and GitHub Pages enabled with "GitHub Actions"
as the source. No product code yet.

## Human prerequisites

- [ ] `gh auth status` shows a logged-in account with `repo` and `workflow` scopes.
- [ ] Repo name confirmed (default `pinout-finder`), and visibility **public** (free GitHub Pages
      requires a public repo; see `docs/PLAN.md` → Decisions).

Claude checks `gh auth status` itself and ticks the box in `docs/STATE.md` when it passes; the repo
name is ticked when the user confirms it in chat. If auth is missing, print
`gh auth login --scopes repo,workflow` and stop. (Task 0.3 creates the repo; the user does not.)

Phase 0 works directly on `main` (no branch, no PR — there is no CI yet).

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 0.1 | Check tool versions: node ≥ 20, pnpm, git, gh, python3; uv optional. Record versions in `docs/STATE.md`. | main | STATE entry |
| 0.2 | Confirm MCP servers respond: `context7` (resolve the "vite" library), `fetch` (fetch https://vite.dev/guide/static-deploy), `playwright` (open about:blank). Record which work; missing ones are not blockers but note fallbacks (WebFetch, curl). | main | STATE entry |
| 0.3 | Create the GitHub repo if absent and push `main`. | ci-pages-engineer | remote `origin` |
| 0.4 | Enable Pages with workflow builds: `gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow` (or PUT if it exists). Read back with `gh api repos/{owner}/{repo}/pages`. | ci-pages-engineer | Pages `build_type: workflow` |
| 0.5 | Add `LICENSE` (MIT for code) and `catalog/LICENSE` (CC-BY-4.0 for catalog facts), plus `.editorconfig`. | ci-pages-engineer | files |
| 0.6 | Fill `sources/manual/README.md` with the known manual downloads (ATmega328P DS40002061, Sitronix ST7735S) and ask the user to fetch them before Phase 2a. | hardware-researcher | request list |

## Deliverables

Remote repo on GitHub, Pages enabled (workflow mode), licences, tool report in STATE.

## Gate checklist (phase-validator runs each)

- [ ] `git remote get-url origin` succeeds and points to the confirmed repo.
- [ ] `gh api repos/{owner}/{repo}/pages --jq .build_type` prints `workflow`.
- [ ] `gh repo view --json visibility --jq .visibility` prints `PUBLIC`.
- [ ] `node -v` major ≥ 20; `pnpm -v` succeeds.
- [ ] `LICENSE` and `catalog/LICENSE` exist with the right licence names.
- [ ] `sources/manual/README.md` lists each manual document with title, publisher, and why it is needed.

## Validators

- `phase-validator` only (no hardware facts or calculations in this phase).
