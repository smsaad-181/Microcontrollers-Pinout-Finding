#!/usr/bin/env python3
"""Regenerate packages/cli/test/fixtures/invalid/ from valid/.

Each invalid case is a full copy of valid/ with exactly ONE text patch applied to ONE file, so the
copies stay in sync with valid/. Re-run after every edit to valid/:

    py -3 packages/cli/test/fixtures/make-invalid.py      (Windows)
    python3 packages/cli/test/fixtures/make-invalid.py    (elsewhere)

It also writes invalid/cases.yaml (the contract the CLI tests read). Every `old` string must occur
exactly once in its file; otherwise the script fails instead of silently producing a valid copy.
Standard library only.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VALID = HERE / "valid"
INVALID = HERE / "invalid"

R2 = "reviewers: [hardware-researcher, hardware-fact-auditor]"

# (case, code, file relative to the catalog root, path_contains, old text, new text)
CASES: list[tuple[str, str, str, str, str, str]] = [
    (
        "schema-error", "E_SCHEMA", "chips/demo-mcu-1.yaml", "pads.GPIO2.gpio",
        "    gpio: 2\n",
        '    gpio: "four"\n',
    ),
    (
        "missing-evidence", "E_EVIDENCE_MISSING", "ics/demo-sensor-1.yaml", "vdd_range",
        "vdd_range: { evidence: [demo-datasheet-1#sensor-supply],",
        "vdd_range: { evidence: [],",
    ),
    (
        "unknown-evidence", "E_EVIDENCE_UNKNOWN", "modules/demo-module-1.yaml", "flash_voltage",
        "flash_voltage: { evidence: [demo-datasheet-1#module-pads],",
        "flash_voltage: { evidence: [demo-datasheet-1#no-such-claim],",
    ),
    (
        "unknown-evidence-doc", "E_EVIDENCE_UNKNOWN", "breakouts/demo-breakout-1.yaml", "level_shifter",
        "level_shifter: { evidence: [demo-datasheet-1#breakout-pins],",
        "level_shifter: { evidence: [no-such-doc#claim],",
    ),
    (
        "pin-numbering", "E_PIN_NUMBERING", "boards/demo-board-1@r1.yaml", "connectors.0.pins.3",
        '{ kind: gpio, label: "1", pad: GPIO1, position: 4 }',
        '{ kind: gpio, label: "1", position: 4 }',
    ),
    (
        "pin-numbering-pad", "E_PIN_NUMBERING", "boards/demo-board-1@r1.yaml", "connectors.0.pins.3.pad",
        '{ kind: gpio, label: "1", pad: GPIO1, position: 4 }',
        '{ kind: gpio, label: "1", pad: GPIO99, position: 4 }',
    ),
    (
        "verified-one-reviewer", "E_VERIFIED_REVIEWERS", "chips/demo-mcu-1.yaml", "electrical.vih_min",
        f"vih_min: {{ evidence: [demo-datasheet-1#electrical-levels], {R2},",
        "vih_min: { evidence: [demo-datasheet-1#electrical-levels], reviewers: [hardware-researcher],",
    ),
    (
        "verified-duplicate-reviewer", "E_VERIFIED_REVIEWERS", "boards/demo-board-1@r1.yaml", "logic_voltage",
        f"logic_voltage: {{ evidence: [demo-datasheet-1#board-pinout], {R2},",
        "logic_voltage: { evidence: [demo-datasheet-1#board-pinout], reviewers: [hardware-researcher, hardware-researcher],",
    ),
    (
        "board-status-mismatch", "E_BOARD_STATUS", "boards/demo-board-1@r1.yaml", "status",
        "\nstatus: partially-verified\n",
        "\nstatus: fully-verified\n",
    ),
    (
        "missing-with-value", "E_FACT_STATUS", "boards/demo-board-1@r1.yaml", "rails.0.max_current",
        "status: missing, unit: mA, value: null }",
        "status: missing, unit: mA, value: 500 }",
    ),
    (
        "conflict-without-readings", "E_FACT_STATUS", "chips/demo-mcu-1.yaml", "pads.GPIO0.reset_state",
        "status: verified, value: pullup }",
        "status: conflict, value: pullup }",
    ),
    (
        "bad-fixture", "E_SCHEMA", "fixtures/demo-board-1-demo-breakout-1.yaml", "expect.status",
        "  status: ok\n",
        "",
    ),
]

# Cases that need several patches or extra files. Each op is one of
#   ("patch", file, old, new)   exactly-once text replacement in a file of the copy
#   ("copy", src, dest)         copy a file of the copy to a new path (duplicates, wrong extensions)
# (case, code, file the CLI reports, path_contains, ops)
Op = tuple[str, ...]
BOARD = "boards/demo-board-1@r1.yaml"
EVID = "evidence/demo-datasheet-1.yaml"
FIXT = "fixtures/demo-board-1-demo-breakout-1.yaml"
CHIP = "chips/demo-mcu-1.yaml"
MODULE = "modules/demo-module-1.yaml"
LV_OLD = f"logic_voltage: {{ evidence: [demo-datasheet-1#board-pinout], {R2},"
PAD1 = '{ kind: gpio, label: "1", pad: GPIO1, position: 4 }'
PAD_TABLE_QUOTE = (
    'quote: "DEMO-MCU-1 has four pads, GPIO0 to GPIO3. GPIO2 is input-only. '
    'Reset: GPIO0 pull-up, GPIO1 and GPIO2 input, GPIO3 disabled."'
)


def reviewers(case: str, code: str, value: str, path: str = "logic_voltage") -> tuple[str, str, str, str, list[Op]]:
    new = f"logic_voltage: {{ evidence: [demo-datasheet-1#board-pinout], reviewers: {value},"
    return (case, code, BOARD, path, [("patch", BOARD, LV_OLD, new)])


EV = "demo-datasheet-1#pad-table"
RESET_OLD = "status: verified, value: pullup }"


def conflict(case: str, path: str, value: str, active: str, readings: list[tuple[str, str]]):
    """GPIO0.reset_state turned into a conflict fact; the arguments decide which sub-rule it breaks."""
    rs = ", ".join(f"{{ value: {v}, evidence: [{e}] }}" for v, e in readings)
    new = f"status: conflict, active: {active}, readings: [{rs}], value: {value} }}"
    return (case, "E_FACT_STATUS", CHIP, "pads.GPIO0.reset_state." + path, [("patch", CHIP, RESET_OLD, new)])


EXTRA_CASES: list[tuple[str, str, str, str, list[Op]]] = [
    # F2: duplicate ids (both files are reported; the case names the copy)
    ("duplicate-evidence-id", "E_DUPLICATE_ID", "evidence/demo-datasheet-1-copy.yaml", "id",
     [("copy", EVID, "evidence/demo-datasheet-1-copy.yaml")]),
    ("duplicate-chip-id", "E_DUPLICATE_ID", "chips/demo-mcu-1-copy.yaml", "id",
     [("copy", CHIP, "chips/demo-mcu-1-copy.yaml")]),
    ("duplicate-module-id", "E_DUPLICATE_ID", "modules/demo-module-1-copy.yaml", "id",
     [("copy", MODULE, "modules/demo-module-1-copy.yaml")]),
    ("duplicate-board-id", "E_DUPLICATE_ID", "boards/demo-board-1@r1-copy.yaml", "id",
     [("copy", BOARD, "boards/demo-board-1@r1-copy.yaml")]),
    ("duplicate-ic-id", "E_DUPLICATE_ID", "ics/demo-sensor-1-copy.yaml", "id",
     [("copy", "ics/demo-sensor-1.yaml", "ics/demo-sensor-1-copy.yaml")]),
    ("duplicate-breakout-id", "E_DUPLICATE_ID", "breakouts/demo-breakout-1-copy.yaml", "id",
     [("copy", "breakouts/demo-breakout-1.yaml", "breakouts/demo-breakout-1-copy.yaml")]),
    ("duplicate-claim-id", "E_DUPLICATE_ID", EVID, "claims.1.id",
     [("patch", EVID, "claims:\n",
       'claims:\n  - id: demo-datasheet-1#pad-table\n    locator: "dup"\n    quote: "dup"\n    supports: "dup"\n')]),
    # F3 / CR1: unresolved references are errors
    ("ref-variant-module", "E_REF_UNRESOLVED", BOARD, "variants.0.module",
     [("patch", BOARD, "module: demo-module-1 }", "module: nope }")]),
    ("ref-module-chip", "E_REF_UNRESOLVED", MODULE, "chip",
     [("patch", MODULE, "chip: demo-mcu-1\n", "chip: nope\n")]),
    ("ref-breakout-ic", "E_REF_UNRESOLVED", "breakouts/demo-breakout-1.yaml", "ic",
     [("patch", "breakouts/demo-breakout-1.yaml", "ic: demo-sensor-1\n", "ic: nope\n")]),
    ("ref-fixture-board", "E_REF_UNRESOLVED", FIXT, "board",
     [("patch", FIXT, "board: demo-board-1@r1\nderivations", "board: nope@r9\nderivations")]),
    ("ref-fixture-variant", "E_REF_UNRESOLVED", FIXT, "variant",
     [("patch", FIXT, "\nvariant: demo-variant-a\n", "\nvariant: nope\n")]),
    ("ref-fixture-breakout", "E_REF_UNRESOLVED", FIXT, "project.modules.0.breakout",
     [("patch", FIXT, "breakout: demo-breakout-1", "breakout: nope")]),
    ("board-no-variants", "E_SCHEMA", BOARD, "variants",
     [("patch", BOARD, "variants:\n  - { id: demo-variant-a, module: demo-module-1 }\n", "variants: []\n")]),
    # F4: reviewer identity
    reviewers("verified-case-reviewer", "E_VERIFIED_REVIEWERS", "[hardware-researcher, Hardware-Researcher]"),
    reviewers("verified-trim-reviewer", "E_VERIFIED_REVIEWERS", '["a ", a]'),
    reviewers("verified-blank-reviewer", "E_SCHEMA", '[hardware-researcher, ""]', "logic_voltage.reviewers.1"),
    # F5: evidence claim text
    ("claim-empty-quote", "E_SCHEMA", EVID, "claims.0.quote",
     [("patch", EVID, PAD_TABLE_QUOTE, 'quote: ""')]),
    ("claim-quote-too-many-words", "E_SCHEMA", EVID, "claims.0.quote",
     [("patch", EVID, PAD_TABLE_QUOTE, 'quote: "' + " ".join(f"w{i}" for i in range(26)) + '"')]),
    ("claim-quote-too-long", "E_SCHEMA", EVID, "claims.0.quote",
     [("patch", EVID, PAD_TABLE_QUOTE, 'quote: "' + "x" * 401 + '"')]),
    ("claim-empty-locator", "E_SCHEMA", EVID, "claims.0.locator",
     [("patch", EVID, 'locator: "§2, Table 2-1"', 'locator: " "')]),
    ("claim-empty-supports", "E_SCHEMA", EVID, "claims.0.supports",
     [("patch", EVID,
       'supports: "DEMO-MCU-1 pad list, pad functions, input-only flags and reset states"', 'supports: ""')]),
    # F9: evidence URL scheme
    ("url-javascript", "E_SCHEMA", EVID, "url",
     [("patch", EVID, "url: https://example.com/demo-datasheet-1.pdf\n", 'url: "javascript:alert(1)"\n')]),
    ("url-original-file", "E_SCHEMA", EVID, "url_original",
     [("patch", EVID, "url_original: null\n", 'url_original: "file:///etc/passwd"\n')]),
    # F8: pin numbering
    ("pin-empty-label", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.3.label",
     [("patch", BOARD, PAD1, '{ kind: gpio, label: " ", pad: GPIO1, position: 4 }')]),
    ("pin-empty-label-power", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.0.label",
     [("patch", BOARD, '{ kind: power, label: "3V3", position: 1, rail: "3V3" }',
       '{ kind: power, label: "", position: 1, rail: "3V3" }')]),
    ("pin-empty-label-ground", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.1.label",
     [("patch", BOARD, "{ kind: ground, label: GND, position: 2 }", '{ kind: ground, label: "", position: 2 }')]),
    ("pin-duplicate-position", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.3.position",
     [("patch", BOARD, PAD1, '{ kind: gpio, label: "1", pad: GPIO1, position: 3 }')]),
    ("pin-duplicate-label", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.3.label",
     [("patch", BOARD, PAD1, '{ kind: gpio, label: "0", pad: GPIO1, position: 4 }')]),
    ("pin-pad-not-bonded", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.4.pad",
     [("patch", MODULE, "bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]", "bonded_pads: [GPIO0, GPIO1, GPIO3]")]),
    # CR3 / CR4: hostile YAML
    ("yaml-proto-key", "E_SCHEMA", CHIP, "peripherals.__proto__",
     [("patch", CHIP, "peripherals:\n", "peripherals:\n  __proto__: { kind: adc, matrix_routable: false }\n")]),
    ("yaml-constructor-key", "E_SCHEMA", CHIP, "peripherals.constructor",
     [("patch", CHIP, "peripherals:\n", "peripherals:\n  constructor: { kind: adc, matrix_routable: false }\n")]),
    ("yaml-anchor", "E_YAML", CHIP, "",
     [("patch", CHIP, "family: DEMO-MCU\n", "family: &fam DEMO-MCU\n")]),
    ("yaml-alias", "E_YAML", CHIP, "",
     [("patch", CHIP, "family: DEMO-MCU\n", "family: &fam DEMO-MCU\n"),
      ("patch", CHIP, "series: DEMO-MCU-1\n", "series: *fam\n")]),
    # CR7: wrong extension inside a kind directory
    ("file-extension-yml", "E_FILE_EXTENSION", "chips/demo-mcu-2.yml", "",
     [("copy", CHIP, "chips/demo-mcu-2.yml")]),
    ("file-extension-upper", "E_FILE_EXTENSION", "ics/demo-sensor-2.YAML", "",
     [("copy", "ics/demo-sensor-1.yaml", "ics/demo-sensor-2.YAML")]),
    # Fix round 2 (N1a): chip pad identity
    ("pad-key-gpio-mismatch", "E_PAD_KEY", CHIP, "pads.GPIO2.gpio",
     [("patch", CHIP, "    gpio: 2\n", "    gpio: 7\n")]),
    ("pad-gpio-duplicate", "E_PAD_KEY", CHIP, "pads.GPIO3.gpio",
     [("patch", CHIP, "    gpio: 3\n", "    gpio: 2\n")]),
    ("pad-key-gp-mismatch", "E_PAD_KEY", CHIP, "pads.GP2.gpio",
     [("patch", CHIP, "\n  GPIO3:\n", "\n  GP2:\n"),
      ("patch", MODULE, "bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]", "bonded_pads: [GPIO0, GPIO1, GPIO2, GP2]"),
      ("patch", MODULE, "\n  GPIO3: {", "\n  GP2: {")]),
    # N1b: conflict facts (the patched fact is a VALID conflict until one sub-rule is broken)
    conflict("conflict-one-reading", "readings", "pullup", "pullup", [("pullup", EV)]),
    conflict("conflict-reading-no-evidence", "readings.1.evidence", "pullup", "pullup", [("pullup", EV), ("input", "")]),
    conflict("conflict-active-not-reading", "active", "pullup", "pulldown", [("pullup", EV), ("input", EV)]),
    conflict("conflict-value-not-active", "value", "input", "pullup", [("pullup", EV), ("input", EV)]),
    # N1c: pad references must resolve to a pad of the chip
    ("ref-onboard-pad", "E_REF_UNRESOLVED", BOARD, "onboard.0.uses_pad.1",
     [("patch", BOARD, "uses_pad: [GPIO1]", "uses_pad: [GPIO1, GPIO99]")]),
    ("ref-bonded-pad", "E_REF_UNRESOLVED", MODULE, "bonded_pads.4",
     [("patch", MODULE, "bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]", "bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3, GPIO99]")]),
    ("ref-consumed-pad", "E_REF_UNRESOLVED", MODULE, "consumed.GPIO99",
     [("patch", MODULE, "\n  GPIO3: {", "\n  GPIO99: {")]),
    ("ref-iomux-pad", "E_REF_UNRESOLVED", CHIP, "peripherals.I2C0.iomux_pins.sda",
     [("patch", CHIP, "I2C0: { kind: i2c, matrix_routable: true }",
       "I2C0: { kind: i2c, iomux_pins: { sda: GPIO99 }, matrix_routable: true }")]),
    ("ref-overlay-pad", "E_REF_UNRESOLVED", BOARD, "os_overlays.0.pads.led",
     [("patch", BOARD, "numbering: { primary: gpio }\n",
       "numbering: { primary: gpio }\nos_overlays:\n  - { evidence: [demo-datasheet-1#board-pinout], name: demo-overlay, pads: { led: GPIO99 } }\n")]),
    # N1d: one pad on two connector pins
    ("pin-duplicate-pad", "E_PIN_NUMBERING", BOARD, "connectors.0.pins.3.pad",
     [("patch", BOARD, PAD1, '{ kind: gpio, label: "1", pad: GPIO0, position: 4 }')]),
    ("pin-duplicate-pad-connectors", "E_PIN_NUMBERING", BOARD, "connectors.1.pins.0.pad",
     [("patch", BOARD, "    side: left\n",
       '    side: left\n  - id: J2\n    pins:\n      - { kind: gpio, label: "9", pad: GPIO0, position: 1 }\n')]),
    # N4: duplicates inside a board, dangling rail, blank evidence text, claim prefix
    ("duplicate-variant-id", "E_DUPLICATE_ID", BOARD, "variants.1.id",
     [("patch", BOARD, "  - { id: demo-variant-a, module: demo-module-1 }\n",
       "  - { id: demo-variant-a, module: demo-module-1 }\n  - { id: demo-variant-a, module: demo-module-1 }\n")]),
    ("duplicate-connector-id", "E_DUPLICATE_ID", BOARD, "connectors.1.id",
     [("patch", BOARD, "    side: left\n",
       '    side: left\n  - id: J1\n    pins:\n      - { kind: ground, label: GND, position: 1 }\n')]),
    ("duplicate-rail-name", "E_DUPLICATE_ID", BOARD, "rails.1.name",
     [("patch", BOARD, "revision: r1\n",
       '  - max_current: { evidence: [], status: missing, value: null }\n    name: "3V3"\n    source: DEMO-LDO-2\n'
       f"    voltage: {{ evidence: [demo-datasheet-1#board-pinout], {R2}, status: verified, unit: V, value: 3.3 }}\nrevision: r1\n")]),
    ("ref-power-pin-rail", "E_REF_UNRESOLVED", BOARD, "connectors.0.pins.0.rail",
     [("patch", BOARD, 'position: 1, rail: "3V3" }', 'position: 1, rail: "5V" }')]),
    ("evidence-empty-title", "E_SCHEMA", EVID, "title",
     [("patch", EVID, "title: DEMO-MCU-1 Family Demo Datasheet\n", 'title: " "\n')]),
    ("evidence-empty-publisher", "E_SCHEMA", EVID, "publisher",
     [("patch", EVID, "publisher: Demo Corp\n", 'publisher: ""\n')]),
    ("claim-id-prefix-mismatch", "E_SCHEMA", EVID, "claims.0.id",
     [("patch", EVID, "  - id: demo-datasheet-1#pad-table\n", "  - id: other-doc#pad-table\n")]),
    # N5: reviewer keys must be plain ASCII tokens (no zero-width or look-alike characters)
    reviewers("reviewer-zero-width", "E_SCHEMA", '[hardware-researcher, "hardware-researcher\\u200b"]', "logic_voltage.reviewers.1"),
    reviewers("reviewer-cyrillic", "E_SCHEMA", '[hardware-researcher, "h\\u0430rdware-researcher"]', "logic_voltage.reviewers.1"),
    # N7: misspelled kind directory containing YAML
    ("unknown-dir", "E_UNKNOWN_DIR", "chip/demo-mcu-1.yaml", "",
     [("copy", CHIP, "chip/demo-mcu-1.yaml")]),
    # N8: evidence URLs
    ("url-userinfo", "E_SCHEMA", EVID, "url",
     [("patch", EVID, "url: https://example.com/demo-datasheet-1.pdf\n", 'url: "https://user:pass@example.com/demo-datasheet-1.pdf"\n')]),
    ("url-leading-space", "E_SCHEMA", EVID, "url",
     [("patch", EVID, "url: https://example.com/demo-datasheet-1.pdf\n", 'url: " https://example.com/demo-datasheet-1.pdf"\n')]),
    ("url-inner-space", "E_SCHEMA", EVID, "url",
     [("patch", EVID, "url: https://example.com/demo-datasheet-1.pdf\n", 'url: "https://example.com/demo datasheet.pdf"\n')]),
]

CASES_HEADER = """\
# GENERATED by make-invalid.py -- do not edit by hand; edit CASES in the script and re-run it.
# One entry per invalid catalog root invalid/<case>/. `file` is relative to that root; `path_contains`
# is a substring of the dot-joined fact/field path the CLI error must mention (array indices are
# written as plain numbers, e.g. connectors.0.pins.3.pad). The CLI must exit non-zero and print
# `code`, `file` and a path containing `path_contains`.
"""


def patch(case: str, dest: Path, rel: str, old: str, new: str) -> bool:
    target = dest / rel
    text = target.read_bytes().decode("utf-8")
    n = text.count(old)
    if n != 1:
        print(f"{case}: expected exactly 1 occurrence of {old!r} in {rel}, found {n}", file=sys.stderr)
        return False
    target.write_bytes(text.replace(old, new).encode("utf-8"))
    return True


def main() -> int:
    if not VALID.is_dir():
        print(f"missing {VALID}", file=sys.stderr)
        return 1
    names = [c[0] for c in CASES] + [c[0] for c in EXTRA_CASES]
    if len(names) != len(set(names)):
        print("duplicate case names", file=sys.stderr)
        return 1

    if INVALID.exists():
        shutil.rmtree(INVALID)
    INVALID.mkdir()

    for case, _code, rel, _path, old, new in CASES:
        dest = INVALID / case
        shutil.copytree(VALID, dest)
        if not patch(case, dest, rel, old, new):
            return 1

    for case, _code, _rel, _path, ops in EXTRA_CASES:
        dest = INVALID / case
        shutil.copytree(VALID, dest)
        for op in ops:
            if op[0] == "copy":
                (dest / op[2]).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(dest / op[1], dest / op[2])
            elif not patch(case, dest, op[1], op[2], op[3]):
                return 1

    lines = [CASES_HEADER]
    rows = [c[:4] for c in CASES] + [c[:4] for c in EXTRA_CASES]
    for case, code, rel, path in rows:
        lines.append(f"- case: {case}\n  code: {code}\n  file: \"{rel}\"\n  path_contains: \"{path}\"\n")
    (INVALID / "cases.yaml").write_bytes("".join(lines).encode("utf-8"))

    print(f"generated {len(names)} invalid cases under {INVALID}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
