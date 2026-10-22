# Phase 4 — Code generation

**Goal:** minimal, compilable example code that uses exactly the allocated pins, for Arduino (C++) and
MicroPython, with library versions pinned and identified from official/maintainer sources.

Skills to load: `codegen-templates`, `datasheet-evidence` (for library facts).

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 4.1 | Research the canonical library for each MVP module per framework (maintainer repo, version, init API, default address/pins). Record as evidence (`kind: library`). Use the `context7` MCP for current API docs; confirm against the library's own repo/README. | hardware-researcher | library evidence |
| 4.2 | Template engine in `packages/codegen`: input = Recommendation; output = files. No pin literal may come from anywhere but the allocation. | engine-developer | codegen |
| 4.3 | Templates: Arduino (ESP32 core, AVR, RA4M1, RP2040 core, ESP8266 core) and MicroPython (ESP32, ESP32-S3, RP2040, ESP8266). Unsupported combos return "not available" with reason. | engine-developer | templates |
| 4.4 | CI compile check: `arduino-cli compile` for each MVP board/FQBN with pinned cores and libraries; `mpy-cross` syntax check for MicroPython. | ci-pages-engineer | CI job |
| 4.5 | UI: code tab with copy/download, library install notes. | ui-developer | UI |

## Gate checklist

- [ ] Generated sketches compile in CI for every MVP board (`arduino-cli` logs).
- [ ] A test parses generated code and proves every pin number equals the allocation (no stray literals).
- [ ] Every library reference has an evidence record (repo URL, version/tag, init API source).
- [ ] Ambiguous module variants produce labelled alternatives, never an invented API.

## Validators (run in parallel)

- `phase-validator` — gate commands.
- `hardware-fact-auditor` — verify library names, versions and init calls against maintainer sources.
- `code-reviewer` — generated code quality.
