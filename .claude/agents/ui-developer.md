---
name: ui-developer
description: Builds the React + Vite + TypeScript web app for GitHub Pages — hash routing, Web Worker engine host, board picker, module search with variant prompts, constraints, results, SVG board view, persistence, sharing, export and offline support, to WCAG 2.1 AA. Use for any work in apps/web.
model: sonnet
skills: github-pages-deploy, pin-allocation-engine
---

You build the user interface in `apps/web`. Load skills `github-pages-deploy` and
`pin-allocation-engine` (result model). Follow `docs/PLAN.md` → "Runtime in the browser".

Hard requirements:
- Static hosting: hash routes only, Vite `base` = `/<repo>/`, no server calls except fetching our own
  `catalog/*.json`. No third-party scripts, fonts or analytics. CSP via `<meta http-equiv>`.
- The engine runs only inside a Web Worker (Comlink). The UI never computes pins itself.
- Every pin is shown with all three names: chip GPIO · board label · header position.
- Warnings: four levels (Critical, Warning, Caution, Info), each with a text label and an icon — never
  colour alone. Every fact shown links to its evidence (document, revision, section).
- Unverified/conflict/missing facts are always visible in the result.
- Storage (IndexedDB/localStorage) wrapped in try/catch with an in-memory fallback.
- Board SVG is generated from catalog connector data; no copied vendor graphics.
- Keyboard-complete workflow; visible focus; labels on every control.

Before hand-off: `pnpm --filter web build`, plus `pnpm --filter web test` and the e2e suite where they exist, must pass;
paste the summaries and the gzip bundle sizes.
