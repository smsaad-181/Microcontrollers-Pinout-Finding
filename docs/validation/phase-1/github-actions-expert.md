# Validation report — Phase 1 — github-actions-expert

- Date: 2026-10-22 · Commit: 129a3e2 · Catalog version: 35e8668ed210 (empty catalog, 0 facts) · Validator: github-actions-expert
- Scope: `.github/workflows/{ci,deploy,links}.yml`, `.github/dependabot.yml`, and how they call repo scripts (`package.json`, `pnpm catalog:*`). Static review plus a clean-clone simulation of every CI command. No GitHub remote and `gh` is not logged in, so no workflow was executed. The phase-validator report was read only at the end.

## Gate items

| # | Gate item (from PHASE-1.md) | Command / method | Exit / result | Evidence (key output lines) | PASS/FAIL |
| --- | --- | --- | --- | --- | --- |
| 1 | Every `uses:` pinned to a 40-char SHA | the ci.yml grep, run locally; `git ls-remote --tags` per action | 0 unpinned; 6/6 SHAs equal the claimed tag commit | checkout `3d3c42e`=v7.0.1, pnpm/action-setup `ea17c68` = peeled `v6.1.0^{}`, setup-node `949feb2`=v7.1.0, configure-pages `45bfe01`=v6.0.0, upload-pages-artifact `fc324d3`=v5.0.0, deploy-pages `368f825`=v5.0.1. All are the newest stable tag of their repo (`sort -V`) | PASS |
| 2 | actionlint clean | `actionlint.exe -color` (v1.7.12 Windows build, scratchpad) | exit 0, no output | shellcheck/pyflakes integration not available locally | PASS (shellcheck part not verified) |
| 3 | CI sequence works from a clean checkout (Node 22.17 and Node 24.22.1) | fresh `git clone` into the scratchpad `ci-sim\repo`: `pnpm install --frozen-lockfile`, `pnpm -r lint`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm catalog:validate`, `pnpm catalog:compile`, `pnpm -r build`, then the `grep -q '/pinout-finder/assets/' apps/web/dist/index.html` step | every command exit 0 on both Node versions; grep exit 0 | install "Done in 20.9s using pnpm v10.34.7"; cli tests "61 passed (61)"; compile "wrote apps/web/public/catalog/35e8668ed210.json … (date 2026-10-22 from git)"; `apps/web/public` does not exist in the clone before compile and the build still works | PASS |
| 4 | deploy.yml sequence from a shallow clone (`actions/checkout` default is depth 1) | `git clone --depth 1`, install, `catalog:compile`, `pnpm --filter web build` | exit 0; `git log | wc -l` = 1 | same version `35e8668ed210`, same sha256 as the full clone, so the manifest date from `git log -1 --format=%cs -- .` works at depth 1 | PASS |
| 5 | CI on the draft PR is green and reports a check named `ci` | not runnable (no remote) | n/a | static: job `ci` has `name: ci` (ci.yml:132) | NOT RUN |
| 6 | Branch protection requires `ci` | not done (task 1.8); commands written below | n/a | `.github/CODEOWNERS` does not exist | NOT DONE |

## Findings

No Critical and no Major findings. Overlaps with the phase-validator report are marked.

| Severity | Area | File:line / fact path | Finding | Evidence / source (URL, revision, section) | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| Minor | Deploy correctness (already reported as F7; I rate it lower) | `deploy.yml:38` (`configure-pages`), `deploy.yml:9-10` (`contents: read` only) | `configure-pages` only calls `GET /repos/{o}/{r}/pages` (`getPagesSite` in `src/api-client.js` at the pinned SHA; with `enablement: false` any failure is `core.error` plus throw). The REST doc for "Get a GitHub Pages site" says the fine-grained permission is "Pages: read" but also "This endpoint can be used without authentication or the aforementioned permissions if only public resources are requested". Pages on the free plan needs a public repo, so the call probably succeeds under `contents: read`. Cannot be proven without a run, so I do not call it Major. The step's outputs (`base_path`, `base_url`) are unused: Vite's `base` is hard-coded in `apps/web/vite.config.ts`, and `deploy-pages` needs nothing from it. The only effect is an extra failure mode (Pages not enabled yet). | https://docs.github.com/en/rest/pages/pages (Get a GitHub Pages site, "fine-grained token must have… Pages (read)… can be used without authentication… public resources"); https://raw.githubusercontent.com/actions/configure-pages/45bfe0192ca1faeb007ade9deae92b16b8254a0d/src/api-client.js; `action.yml` there (`enablement` default false) | Preferred: delete the step (smallest permission set, one less API dependency). If PLAN fidelity matters, keep it and add `permissions: { contents: read, pages: read }` on the `build` job (read is enough for GET; `pages: write` is not needed there). Do not grant `pages: write` workflow-wide. |
| Minor | Triggers (already reported as F11) | `ci.yml:3-6` | `pull_request` plus `push` on `branches-ignore: [main]` runs everything twice per PR commit. The concurrency groups differ (`ci-refs/pull/N/merge` vs `ci-refs/heads/x`), so they do not cancel each other. Tag pushes do not trigger the workflow: GitHub does not run it for unspecified ref types when only `branches-ignore` is set. | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax (on.push.branches / tags filter semantics) | Drop the `push` trigger (keep `pull_request` + `workflow_dispatch`). Only if CI before a PR is wanted, keep it. |
| Minor | Concurrency / dispatch (new) | `deploy.yml:4-6,12-15` | `workflow_dispatch` on deploy can be started from any branch. Two effects. (a) Whether it can publish depends only on the `github-pages` environment's deployment-branch policy, which is a repo setting and not in the file (see the setup list below). (b) Even if the environment rejects the run, the run joins concurrency group `pages` at start. A run from a feature branch that is queued behind an in-flight deploy replaces the single pending slot, so a pending `main` deploy can be cancelled and `main` is not deployed until the next push. `cancel-in-progress: false` is correct for the in-flight run, but only one pending run is kept. | https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site ("We recommend that you add a deployment protection rule so that only the default branch can deploy to this environment"); https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency | Configure the environment branch policy (commands below). Optional hardening: remove `workflow_dispatch` from deploy, or use `group: pages-${{ github.ref_name }}`, which loses cross-ref serialization (acceptable because only `main` may deploy). |
| Minor | Supply chain (new) | `ci.yml:21-22` | The actionlint version and sha256 live in `env:`, which Dependabot's `github-actions` ecosystem does not see, so it will go stale silently. The download itself is sound: `curl -fsSLo` (fail on HTTP error, TLS, redirects), checksum verified before `tar`, only `actionlint` extracted, no `\| sh`. I confirmed the sha256 `8aca8db9…a3d8` against the release's `actionlint_1.7.12_checksums.txt` (linux_amd64 line); 1.7.12 is the newest tag. | `curl https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt`; `git ls-remote --tags` | Add a comment with a bump reminder or a quarterly checklist item, or move to a pinned action (`rhysd/actionlint` docker/action by SHA, which Dependabot tracks). Optional: add `--proto '=https'` to curl. |
| Minor | Runtime (new) | `ci.yml` and `deploy.yml`, every `node-version: lts/*` | Today `lts/*` is v24.22.1 "Krypton" (the Node dist index.json shows 24.x as latest LTS; 26.x is still Current, `lts=false`). Node 26 is due to enter LTS in late Oct 2026, so CI and the deploy build will switch major version on their own, with no PR. The simulation passes on 22.17.0 and 24.22.1, but a floating major in the deploy path can break a deploy with no code change. `engines >=22.12.0` is satisfied by both. | https://nodejs.org/dist/index.json (fetched 2026-10-22); https://nodejs.org/en/about/previous-releases | Pin the major (`node-version: 24`), or use `node-version-file` with an `.nvmrc` kept by Dependabot. PLAN says `lts/*`, so a deliberate choice is fine if recorded. |
| Minor | Deploy gating (new) | `deploy.yml:23-34` | The deploy build re-runs `catalog:validate` and `pnpm -r test` but not lint, typecheck or `workflow-lint`. It does not wait for `ci`. Safety comes only from branch protection (task 1.8). With `enforce_admins:false` (as in the skill) an admin direct push to `main` deploys without `ci`. | n/a | Acceptable for solo mode. Once protection is set, consider `enforce_admins: true`, or add `pnpm -r typecheck && pnpm -r lint` to deploy `build`. |
| Info | Pin-check scope (new) | `ci.yml:30-37` | The grep guard covers only `.github/workflows/*.yml`. It would miss `*.yaml` or composite actions under `.github/actions/`, and it does not check that the version comment matches the SHA. I ran the guard locally: no hits on the real files; on a test file it flags `@v4` and a 39-char SHA. It treats a quoted `uses:` as a false positive (fails safe). | local run | Optional: widen to `.github/**/*.y?(a)ml`. |
| Info | Dependabot (new) | `dependabot.yml` | Valid. `cooldown.default-days` is documented ("Default cooldown period… If not specified… 3 days"); `groups.<name>.update-types` takes `minor`/`patch`/`major` (documented; the `version-update:semver-*` form is only for `allow`/`ignore`, and it is used correctly here). `npm` with `directory: /` covers a pnpm workspace; the docs list pnpm v7–v10 under npm, and the repo uses pnpm 10.34.7. Whether Dependabot bumps the `packageManager` field is not verified. Pinned action SHAs with `# vX.Y.Z` comments are what the `github-actions` ecosystem updates. Security updates ignore cooldown. | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference (cooldown, groups, update-types, supported package managers) | None. |
| Info | Pages artifact (new) | `deploy.yml:39-41` | `apps/web/dist` contains `assets/`, `catalog/`, `index.html` and no dot-files (`find -name '.*'` is empty). `upload-pages-artifact@v5` excludes dot-files by default (`include-hidden-files` default false) and always excludes `.git`/`.github`. `.nojekyll` is not needed: GitHub's docs tie it to branch-based publishing. Artifact retention default is 1 day, fine because deploy runs right after. `deploy-pages` with `needs: build`, `environment: github-pages` and `url: steps.deployment.outputs.page_url` (step id `deployment`) matches the docs; job-level `permissions: pages: write, id-token: write` replaces the workflow-level set (so `contents` is none in that job, which is fine because it has no checkout). | https://raw.githubusercontent.com/actions/upload-pages-artifact/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml (inputs, tar excludes); https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages | None. |

Items judged and found correct, with no finding:

- **Permissions.** Workflow-level `contents: read` in all three files; the only elevated job is `deploy` (`pages: write`, `id-token: write`). `id-token` is needed by `deploy-pages` for its OIDC check. Nothing else is over-granted. Every `actions/checkout` has `persist-credentials: false`. There is no `pull_request_target` and no `secrets.*` anywhere, so fork PRs get a read-only token and no secrets.
- **Script injection.** The only `${{ }}` inside a `run:` block is none. `toJSON(needs)` goes through `env: NEEDS_JSON` (ci.yml:138). The `concurrency.group` use of `github.ref` is not shell-interpolated. No branch name, PR title or `head_ref` is used.
- **Aggregate job `ci`.** I tried these bypasses and none works: (a) a needed job skipped: `needs.<j>.result` is `skipped` and the `all(.[]; .result=="success")` check fails; (b) cancelled or failed: same; (c) all jobs absent: `length > 0` guards it. A needed job that is cancelled or fails does not make `ci` skip, because `if: always()` forces it to run. Limits of my check: `jq` is not installed locally, so the jq program was verified by reading, not by running; jq is preinstalled on `ubuntu-latest` (not verified here). The six needed jobs are all listed (matches the gate). No path filters or matrices are used, so no legitimately skipped job exists.
- **Cache poisoning.** `setup-node cache: pnpm` runs in the deploy build too. PR and feature-branch caches are scoped to their own ref and cannot be restored by `main`, so only `main`-created caches reach deploy. No untrusted workflow writes them.
- **`links.yml`.** A no-op echo with `contents: read`; the weekly cron is harmless. Scheduled workflows are disabled after 60 days of repo inactivity (GitHub docs, events that trigger workflows); relevant only when Phase 5 starts.
- **`pnpm/action-setup@v6.1.0`** reads `packageManager` from `package.json` (`package_json_file` default; no `version:` input is given, which would conflict). Order is correct: pnpm is installed before `setup-node` with `cache: pnpm`.

## Setup needed before the first deploy (human or orchestrator, once the repo exists)

```bash
OWNER=<owner>; REPO=pinout-finder
# 1. Pages source = GitHub Actions (409 means it exists: use PUT)
gh api -X POST repos/$OWNER/$REPO/pages -f build_type=workflow || gh api -X PUT repos/$OWNER/$REPO/pages -f build_type=workflow
# 2. github-pages environment: only main may deploy
gh api -X PUT repos/$OWNER/$REPO/environments/github-pages --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST repos/$OWNER/$REPO/environments/github-pages/deployment-branch-policies -f name=main -f type=branch
```

Check: `gh api repos/$OWNER/$REPO/environments/github-pages --jq .deployment_branch_policy` and `.../deployment-branch-policies --jq '.branch_policies[].name'`. The Pages site must exist before the first deploy run, or `configure-pages` (if kept) and `deploy-pages` fail. Both the Pages repo setting and the environment policy are documented in the two docs.github.com pages cited above; the `gh api` field names follow the REST "Environments" and "Deployment branch policies" pages (fetched; request body keys `deployment_branch_policy.custom_branch_policies` appear there).

## Branch protection (task 1.8, not done): exact commands and pitfalls

```bash
gh api -X PUT repos/$OWNER/$REPO/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["ci"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
gh api repos/$OWNER/$REPO/branches/main/protection --jq '.required_status_checks.contexts, .required_linear_history.enabled, .allow_force_pushes.enabled'
```

CODEOWNERS (`.github/CODEOWNERS`, placeholder owner to be replaced):

```
# Placeholder owner: replace @OWNER before enabling require_code_owner_reviews.
*            @OWNER
catalog/**   @OWNER
.github/**   @OWNER
```

Pitfalls:

1. The `PUT` body must contain all four keys `required_status_checks`, `enforce_admins`, `required_pull_request_reviews`, `restrictions` (use `null` where unused), or the API returns 422.
2. The required context is the **job name** `ci` (ci.yml:132), not `ci / ci` and not the workflow name. A required check that has never run is still allowed to be set, but every PR stays "waiting" until some run reports `ci`, so open the draft PR first or accept that the first PR shows "Expected".
3. `strict: true` forces "branch up to date" before merge, so each PR may need a rebase after another merge. Fine for solo; drop it if it annoys.
4. `contexts` accepts a check from any app with that name. To pin it to GitHub Actions, use `"checks": [{"context":"ci","app_id":15368}]` instead of `contexts` (the id 15368 is from memory and was NOT verified against the docs).
5. `enforce_admins: false` lets an owner push straight to `main` (this also triggers a deploy without `ci`). Linear history needs repo "Allow squash merging" on and the squash button used (`gh pr merge --squash`).
6. Branch protection on private repos needs a paid plan; this repo must be public for Pages anyway.
7. The two-key rule (2 approvals on `catalog/**`) from PLAN is not met by this setup; the solo-mode decision is in `docs/STATE.md`. `require_code_owner_reviews` plus `required_approving_review_count` is a later change, and the approval count is repo-wide.
8. `required_status_checks` must be changed in the same PUT if more jobs are made required later (the PUT replaces the whole protection).

## External claims checked

| Claim | Source opened (URL · revision · section) | Result |
| --- | --- | --- |
| Each pinned SHA is the commit of the commented tag, and each is the latest release | `git ls-remote --tags` (and `--refs` sorted) for the six actions, 2026-10-22; pnpm/action-setup is annotated, matched via `^{}` | CONFIRMED |
| actionlint sha256 in ci.yml | https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_checksums.txt | CONFIRMED (`8aca8db9…a3d8  actionlint_1.7.12_linux_amd64.tar.gz`) |
| Latest LTS is 24.x; 26.x not yet LTS | https://nodejs.org/dist/index.json (2026-10-22): newest `lts` entry v24.22.1 Krypton 2026-10-20; newest overall v26.12.1 `lts:false` | CONFIRMED |
| `configure-pages` behaviour and inputs | raw `action.yml` and `src/api-client.js` at `45bfe01` | CONFIRMED (GET Pages; `enablement` false by default) |
| Pages GET works unauthenticated for public repos | https://docs.github.com/en/rest/pages/pages, "Get a GitHub Pages site" | CONFIRMED text; actual token behaviour not observed |
| `upload-pages-artifact` dot-file and retention behaviour | raw `action.yml` at `fc324d3` | CONFIRMED |
| `deploy-pages` inputs and `page_url` output | raw `action.yml` at `368f825` | CONFIRMED |
| Env protection recommendation for `github-pages` | https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site | CONFIRMED (recommended, not default-enforced) |
| Dependabot `cooldown`, `groups.update-types`, pnpm support | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference | CONFIRMED |
| GitHub's own Pages starter workflow permissions | https://raw.githubusercontent.com/actions/starter-workflows/main/pages/static.yml | `contents: read, pages: write, id-token: write` at workflow level, with configure-pages in the same job as deploy. The repo's split is stricter and still valid for deploy-pages. |
| Scheduled workflows disabled after 60 days inactivity | docs "Events that trigger workflows" (schedule) | CONFIRMED |

## Not verified (and why)

- Any real run of `ci`, `deploy` or `links`: no remote, `gh` not logged in.
- shellcheck diagnostics on the `run:` blocks: not installed locally (actionlint ran without it).
- Linux-specific behaviour of `packages/cli/test/e2e.test.ts` (spawns `pnpm` with `shell: true`, which works on both OSes in principle) and of the `ubuntu-latest` image (jq, tar `--exclude`): simulated only on Windows 11 / Git Bash, Node 22.17.0 and 24.22.1.
- Whether `configure-pages` succeeds under `contents: read` on a real runner (see the Minor finding).
- GitHub Actions app id 15368 for pinning the required check.
- Whether Dependabot updates the `packageManager` field.
- The Node 26 LTS promotion date (from the release schedule, not re-fetched).

## Summary

The workflows are well hardened: every action is pinned to the true commit of the newest release, permissions are least-privilege with job-level elevation only on `deploy`, there is no injection path, and the `ci` aggregate cannot pass when any needed job failed, was skipped or was cancelled. From a clean full and a shallow clone, every CI and deploy command sequence passes on Node 22.17 and 24.22.1, and actionlint is clean. There are no Critical or Major findings, only six Minor and a few Info items; the real exposure is the unset repo settings (Pages source, `github-pages` environment branch policy, branch protection, CODEOWNERS), which are listed with exact commands above and are not yet done.

VERDICT: PASS
