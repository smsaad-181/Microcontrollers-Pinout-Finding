---
name: phase-validation
description: Protocol every validator agent follows at a phase gate — independence rules, fresh evidence, sampling method for hardware facts, research standards with authentic sources and MCP tools, severity levels, report format and PASS/FAIL verdict rules. Use whenever validating a phase, a fix round, or a catalog change.
---

# Phase validation protocol

## Independence

- Validators did not build the work and do not take builders' summaries as evidence.
- Re-run everything yourself in this session. Paste the command, exit code and key output lines.
- Write only inside your scope folder `docs/validation/<scope>/` (`phase-<id>`, `board-<id>`, `module-<id>`):
  `<agent>.md` plus audit/calc evidence files.

## What "validated" means

1. **Gate items** in `docs/phases/PHASE-<id>.md` (or the Gate section of `catalog-onboarding` for
   board/module scopes): each PASS with evidence. Report pre-merge and post-merge items separately.
2. **Plan coverage**: requirements in `docs/PLAN.md` for this phase that no task covered → finding.
3. **External truth**: any claim about hardware, standards, platform limits, library behaviour is
   checked against an authentic source (priority list in skill `datasheet-evidence`), cited with
   URL + revision + section. Tools, in order of preference:
   - `fetch` MCP (verbatim page text) · `curl -L` + `Read` with `pages` for PDFs
   - `context7` MCP for library/framework API docs (confirm against the maintainer repo for versions)
   - WebSearch to *locate* an official source (never as the source itself) · WebFetch (summarizing)
   - `playwright` MCP to check the live GitHub Pages site and UI behaviour
4. **Blocked sources**: do not circumvent; mark `could-not-verify` and request a manual download.

## Sampling hardware facts (auditor)

- Population: all engine-read facts with status `verified`.
- Sample ≥ 10 % (min 30) stratified by board/module/fact type, plus 100 % of: conflicts, straps,
  flash/PSRAM/USB-consumed pads, input-only flags, absolute maxima, current limits, I2C addresses,
  interface hardwiring on breakouts.
- Seed the random selection with the commit SHA so the sample is reproducible; list the seed.

## Severity

- **Critical** — could damage hardware, brick boot, or give a wrong pin/voltage/current decision;
  fabricated or unverifiable source on an engine-read fact; gate command fails.
- **Major** — requirement missing, test meaningless (asserts mocks/snapshots of engine output),
  non-determinism, security weakness in workflows.
- **Minor** — style, docs, small UX issues.

Verdict: any Critical or any failed gate item ⇒ `VERDICT: FAIL`. Majors ⇒ FAIL unless the phase file
marks the item optional. Minors never block.

## Report format

Use `docs/templates/validation-report.md`. The last line of `<agent>.md` must be exactly
`VERDICT: PASS` or `VERDICT: FAIL` (the orchestrator greps only the listed agents' reports).
