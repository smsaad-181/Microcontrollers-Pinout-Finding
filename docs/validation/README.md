# Validation reports

One folder per phase (`phase-0`, `phase-1`, `phase-2a`, …) or per catalog change (`board-<id>`,
`module-<id>`). Each validator writes `<agent>.md` from `docs/templates/validation-report.md`; the last
line is `VERDICT: PASS` or `VERDICT: FAIL`. Other files in a folder (audit YAML, coverage, perf, calc
scripts, bench results) are evidence, not verdicts. A phase is DONE only when the reports of every
validator listed in its phase file pass and the orchestrator's own re-run of the gate commands succeeds.
