# Contributing

Thanks for helping. This project is a pin-allocation tool whose answers are only as good as its data,
so the rules below are strict about **evidence**. This is a skeleton; Phase 5 completes it.

## Ground rules

1. **No guessed hardware facts.** Every value the engine reads (pin function, strap level, voltage,
   current, timing, address) needs an evidence record: document title, revision, URL, section or
   table, access date, SHA-256 of the file when downloadable, and a short verbatim quote.
   If you cannot open the source, the fact is `missing`.
2. **Two keys.** A fact becomes `verified` only when two different reviewers have each checked it
   against the source. Until a second human maintainer exists, the two keys are the
   `hardware-researcher` agent and a blind `hardware-fact-auditor` agent (see `docs/STATE.md`).
3. **Never commit datasheets or vendor images.** Store facts and citations only. Downloaded PDFs
   live in `sources/cache/` (git-ignored).
4. **Tests come from datasheets, not from the engine.** Do not update a golden fixture to make a
   failing hardware test pass; fix the engine, or prove the fixture contradicts its source.

## Setup

```bash
node -v        # >= 22.12
pnpm -v        # 10.x (the repo pins pnpm@10.34.7)
pnpm install --frozen-lockfile
```

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm -r typecheck` | Type-check every package |
| `pnpm -r lint` | ESLint (strict, type-aware) |
| `pnpm -r test` | Vitest in every package |
| `pnpm catalog:validate` | Validate `catalog/` (schemas, evidence links, pin numbering, statuses) |
| `pnpm catalog:validate --root <dir>` | Validate another catalog root (used by tests); a directory with none of the seven kind directories is rejected with exit 2, not "0 errors" |
| `pnpm catalog:compile` | Emit `apps/web/public/catalog/<version>.json` and the manifest |
| `pnpm --filter web build` | Build the site (base path `/Microcontrollers-Pinout-Finding/`, override with `PAGES_BASE`) |
| `pnpm --filter web exec vite` | Dev server at http://localhost:5173/Microcontrollers-Pinout-Finding/ |

## Adding or fixing catalog data

1. Open the official document itself (not a search snippet). Record it in `catalog/evidence/`
   using `docs/templates/evidence.yaml`.
2. Write the entity YAML (`chips/`, `modules/`, `boards/`, `ics/`, `breakouts/`) from the templates in
   `docs/templates/`. One entity per file, kebab-case ids, keys sorted.
3. A fact you could not confirm stays `missing` (`value: null`, `evidence: []`). A value taken from a
   related or secondary source is `interim` and must cite that source.
4. Run `pnpm catalog:validate` until it is clean, then open a pull request.
5. If a publisher blocks automated download, do not work around it. Add the document to
   `sources/manual/README.md` and mark the facts `missing`.

Every pin needs all three names: chip GPIO number, board silkscreen label, and connector position.

## Code conventions

- TypeScript `strict`, ESM only, no `any` without a comment explaining why.
- `packages/engine` and `packages/rules` stay pure: no DOM, React, network or file-system access, and
  the same input plus catalog version must give byte-identical output.
- Test first for engine and rules code.
- Conventional commits: `feat(engine): …`, `data(catalog): …`, `test(fixtures): …`, `docs: …`.
- GitHub Actions are pinned to full commit SHAs with a version comment.

## Licences

Code is MIT (`LICENSE`). Catalog facts are CC-BY-4.0 (`catalog/LICENSE`). By contributing you agree
your contribution is released under the matching licence.
