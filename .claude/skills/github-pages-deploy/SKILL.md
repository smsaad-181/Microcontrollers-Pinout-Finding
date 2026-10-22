---
name: github-pages-deploy
description: How this project builds and deploys to GitHub Pages — pnpm monorepo layout, Vite base path, hash routing, CSP meta, catalog versioning in dist, ci.yml / deploy.yml / links.yml patterns with SHA-pinned actions, Pages enablement via gh, branch protection, Dependabot, and platform limits. Use for any repo, CI, deploy or web-hosting task.
---

# GitHub Pages deployment

## Platform facts (re-verify links in Phase 0 if they look stale)

- Free plans: Pages only for **public** repos. Site ≤ 1 GB; soft bandwidth 100 GB/month; deploys time
  out after 10 minutes; custom Actions workflows are not subject to the 10 builds/hour soft limit.
  Pages must not be used to run an online business / commercial SaaS. — docs.github.com "GitHub Pages limits"
- Custom workflow: `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`;
  deploy job needs `pages: write`, `id-token: write`, `environment: github-pages`, `needs: build`.
  — docs.github.com "Using custom workflows with GitHub Pages"
- Vite project site: `base: '/<REPO>/'` for `https://<user>.github.io/<REPO>/`. — vite.dev static deploy guide
- Pages has **no rewrite rules and no custom headers** → hash routes; CSP via `<meta http-equiv>`.

## Repo layout

```
apps/web/              Vite + React app (public/catalog/<version>.json copied by catalog:compile)
packages/{schema,rules,engine,codegen,cli}
catalog/               YAML source of truth
.github/workflows/{ci,deploy,links}.yml  .github/dependabot.yml  .github/CODEOWNERS
```

## Enable Pages (workflow mode)

```bash
gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow   # 409 if exists → use PUT
gh api -X PUT  repos/{owner}/{repo}/pages -f build_type=workflow
gh api repos/{owner}/{repo}/pages --jq '.build_type,.html_url'
```

## Pin actions to SHAs

```bash
tag=v4.0.5; repo=actions/deploy-pages   # use the full latest release tag, e.g. from: gh release view -R $repo --json tagName
ref=$(gh api repos/$repo/git/ref/tags/$tag)
# if .object.type == "tag" (annotated), dereference:
sha=$(echo "$ref" | jq -r .object.sha); type=$(echo "$ref" | jq -r .object.type)
[ "$type" = tag ] && sha=$(gh api repos/$repo/git/tags/$sha --jq .object.sha)
echo "uses: $repo@$sha # $tag"
```
Pick the **latest release tag** of each action at implementation time (GitHub's docs and Vite's guide
showed different majors in Oct 2026 — check each action's releases page). Dependabot (`package-ecosystem:
github-actions`) keeps SHAs current.

## deploy.yml (shape)

```yaml
name: deploy
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read }
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<sha> # vX
      - uses: pnpm/action-setup@<sha> # vX
      - uses: actions/setup-node@<sha> # vX
        with: { node-version: lts/*, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm catalog:validate && pnpm -r test && pnpm catalog:compile
      - run: pnpm --filter web build
      - uses: actions/configure-pages@<sha> # vX
      - uses: actions/upload-pages-artifact@<sha> # vX
        with: { path: apps/web/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps:
      - id: d
        uses: actions/deploy-pages@<sha> # vX
```

`ci.yml`: on `pull_request` + push to non-main branches; jobs lint, typecheck, test, catalog-validate,
build, e2e smoke, bundle-size report, and a final job **`ci`** with `needs: [all of the above]` and
`if: always()` that fails unless every needed job succeeded — branch protection requires the check
named `ci` (check names come from job names, not the workflow file); `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
`links.yml`: `schedule: cron weekly` + `workflow_dispatch`; runs `pnpm catalog check-links`; opens an
issue with `gh issue create` (needs `issues: write`) when URLs/hashes change.

## Branch protection (solo phase)

```bash
gh api -X PUT repos/{owner}/{repo}/branches/main/protection --input - <<'JSON'
{ "required_status_checks": { "strict": true, "contexts": ["ci"] },
  "enforce_admins": false, "required_pull_request_reviews": null,
  "restrictions": null, "required_linear_history": true }
JSON
```
Merges are `gh pr merge --squash` (linear history). Once a second maintainer exists (Phase 5), enable
`required_pull_request_reviews` with `require_code_owner_reviews: true`; CODEOWNERS (`catalog/** @…`)
decides who must review, while `required_approving_review_count` is repo-wide.

## Web app essentials

- `vite.config.ts`: `base: process.env.PAGES_BASE ?? '/pinout-finder/'`.
- Router: hash-based (`createHashRouter`).
- `index.html` CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`.
- Catalog: `public/catalog/<version>.json` + `catalog-manifest.json`; keep previous versions for share links.
- Service worker via vite-plugin-pwa with `registerType: 'prompt'` (shows "update available").

## Verify a deploy

```bash
gh run list --workflow deploy.yml --limit 1 --json conclusion,url
url=$(gh api repos/{owner}/{repo}/pages --jq .html_url)
curl -s -o /dev/null -w '%{http_code}\n' "$url"; curl -s "$url" | grep -q "Pinout Finder" && echo OK
```
