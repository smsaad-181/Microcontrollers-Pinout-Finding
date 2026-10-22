# Catalog CLI test fixtures (Phase 1, task 1.5)

Every part, document and number here is **fictional** (`DEMO-*`, publisher "Demo Corp",
`https://example.com/demo-datasheet-1.pdf`, fake sha256). Nothing here is a real hardware fact.
Never copy these values into `catalog/`.

## Layout

```
valid/                      one tiny, complete catalog: `catalog validate --root .../valid` must exit 0
  evidence/demo-datasheet-1.yaml        1 evidence record, 12 claims
  chips/demo-mcu-1.yaml                 4 pads (GPIO0..GPIO3), 2 peripherals
  modules/demo-module-1.yaml            bonds GPIO0..GPIO3, GPIO3 consumed by flash
  boards/demo-board-1@r1.yaml           header J1 (power, ground, 3 gpio, reset), status partially-verified
  ics/demo-sensor-1.yaml                I2C sensor
  breakouts/demo-breakout-1.yaml        breakout of demo-sensor-1
  fixtures/demo-board-1-demo-breakout-1.yaml   golden fixture (Fixture schema)
invalid/<case>/             a full copy of valid/ with exactly ONE violation (generated; a violation may need
                            two patches or an extra copied file, see make-invalid.py)
invalid/cases.yaml          contract for the tests: { case, code, file, path_contains } (generated)
make-invalid.py             regenerates invalid/ from valid/
```

**Do not edit `invalid/` by hand.** Edit `valid/` or the `CASES` table in `make-invalid.py`, then run
`py -3 packages/cli/test/fixtures/make-invalid.py` (or `python3 ...`). The script uses only the
standard library. It fails if a patch's anchor text does not occur exactly once.

## Invalid cases

The CLI must exit non-zero and print the `code`, the `file` (relative to the catalog root), and a
fact/field path that contains `path_contains`.

| case | code | file | path_contains | violation |
| --- | --- | --- | --- | --- |
| `schema-error` | `E_SCHEMA` | `chips/demo-mcu-1.yaml` | `pads.GPIO2.gpio` | `gpio: "four"` (string, not number) |
| `missing-evidence` | `E_EVIDENCE_MISSING` | `ics/demo-sensor-1.yaml` | `vdd_range` | `verified` fact with `evidence: []` |
| `unknown-evidence` | `E_EVIDENCE_UNKNOWN` | `modules/demo-module-1.yaml` | `flash_voltage` | cites `demo-datasheet-1#no-such-claim` |
| `unknown-evidence-doc` | `E_EVIDENCE_UNKNOWN` | `breakouts/demo-breakout-1.yaml` | `level_shifter` | cites `no-such-doc#claim` |
| `pin-numbering` | `E_PIN_NUMBERING` | `boards/demo-board-1@r1.yaml` | `connectors.0.pins.3` | gpio pin J1-4 has no `pad` (no GPIO number) |
| `pin-numbering-pad` | `E_PIN_NUMBERING` | `boards/demo-board-1@r1.yaml` | `connectors.0.pins.3.pad` | gpio pin J1-4 `pad: GPIO99` is not a pad of demo-mcu-1 |
| `verified-one-reviewer` | `E_VERIFIED_REVIEWERS` | `chips/demo-mcu-1.yaml` | `electrical.vih_min` | `verified` with one reviewer |
| `verified-duplicate-reviewer` | `E_VERIFIED_REVIEWERS` | `boards/demo-board-1@r1.yaml` | `logic_voltage` | `verified` with the same reviewer twice |
| `board-status-mismatch` | `E_BOARD_STATUS` | `boards/demo-board-1@r1.yaml` | `status` | `fully-verified`, but one fact is `missing` and one is `interim` |
| `missing-with-value` | `E_FACT_STATUS` | `boards/demo-board-1@r1.yaml` | `rails.0.max_current` | `status: missing` with `value: 500` |
| `conflict-without-readings` | `E_FACT_STATUS` | `chips/demo-mcu-1.yaml` | `pads.GPIO0.reset_state` | `status: conflict` with no `readings`/`active` |
| `bad-fixture` | `E_SCHEMA` | `fixtures/demo-board-1-demo-breakout-1.yaml` | `expect.status` | golden fixture without `expect.status` |

Each case is designed so that **only** its listed code is reported (decision 8). The first 12 cases are the
original contract and must never change. `diff -r valid invalid/<case>` shows one changed line in one
file for them, and one violation (one or two patches, or one added file) for the cases below.

### Added in fix round 1 (new codes `E_DUPLICATE_ID`, `E_REF_UNRESOLVED`, `E_FILE_EXTENSION`)

`file` is the file the CLI reports for the case; for duplicates every clashing file is reported.

| case | code | file | path_contains | violation |
| --- | --- | --- | --- | --- |
| `duplicate-evidence-id` / `-chip-id` / `-module-id` / `-board-id` / `-ic-id` / `-breakout-id` | `E_DUPLICATE_ID` | the `*-copy.yaml` file (the original is reported too) | `id` | a copy of the file under a new name, same `id` (boards: same `id@revision`) |
| `duplicate-claim-id` | `E_DUPLICATE_ID` | `evidence/demo-datasheet-1.yaml` | `claims.1.id` | the same claim id twice in one evidence record |
| `ref-variant-module` | `E_REF_UNRESOLVED` | `boards/demo-board-1@r1.yaml` | `variants.0.module` | `module: nope` |
| `ref-module-chip` | `E_REF_UNRESOLVED` | `modules/demo-module-1.yaml` | `chip` | `chip: nope` |
| `ref-breakout-ic` | `E_REF_UNRESOLVED` | `breakouts/demo-breakout-1.yaml` | `ic` | `ic: nope` |
| `ref-fixture-board` / `-variant` / `-breakout` | `E_REF_UNRESOLVED` | the fixture | `board` / `variant` / `project.modules.0.breakout` | unknown board `nope@r9`, variant, breakout |
| `board-no-variants` | `E_SCHEMA` | the board | `variants` | `variants: []` (needs at least one) |
| `verified-case-reviewer` | `E_VERIFIED_REVIEWERS` | the board | `logic_voltage` | `[hardware-researcher, Hardware-Researcher]` is one reviewer |
| `verified-trim-reviewer` | `E_VERIFIED_REVIEWERS` | the board | `logic_voltage` | `["a ", a]` is one reviewer |
| `verified-blank-reviewer` | `E_SCHEMA` | the board | `logic_voltage.reviewers.1` | a blank reviewer key |
| `claim-empty-quote` / `-empty-locator` / `-empty-supports` | `E_SCHEMA` | the evidence | `claims.0.quote` / `.locator` / `.supports` | blank text |
| `claim-quote-too-many-words` / `-too-long` | `E_SCHEMA` | the evidence | `claims.0.quote` | 26 words / 401 characters (limits: 25 words, 400 characters) |
| `url-javascript` / `url-original-file` | `E_SCHEMA` | the evidence | `url` / `url_original` | scheme other than http(s) |
| `pin-empty-label` / `-power` / `-ground` | `E_PIN_NUMBERING` | the board | `connectors.0.pins.N.label` | blank label on a gpio / power / ground pin |
| `pin-duplicate-position` | `E_PIN_NUMBERING` | the board | `connectors.0.pins.3.position` | two pins at position 3 |
| `pin-duplicate-label` | `E_PIN_NUMBERING` | the board | `connectors.0.pins.3.label` | two gpio pins labelled "0" |
| `pin-pad-not-bonded` | `E_PIN_NUMBERING` | the board | `connectors.0.pins.4.pad` | pad GPIO2 exists on the chip but the module does not bond it out |
| `yaml-proto-key` / `yaml-constructor-key` | `E_SCHEMA` | the chip | `peripherals.__proto__` / `.constructor` | reserved JavaScript object key |
| `yaml-anchor` / `yaml-alias` | `E_YAML` | the chip | (root) | YAML anchor `&x` / alias `*x` |
| `file-extension-yml` / `-upper` | `E_FILE_EXTENSION` | `chips/demo-mcu-2.yml` / `ics/demo-sensor-2.YAML` | (root) | wrong extension inside a kind directory |

### Added in fix round 2 (new codes `E_PAD_KEY`, `E_UNKNOWN_DIR`; extended `E_FACT_STATUS`, `E_REF_UNRESOLVED`, `E_PIN_NUMBERING`, `E_DUPLICATE_ID`, `E_SCHEMA`)

| case | code | file | path_contains | violation |
| --- | --- | --- | --- | --- |
| `pad-key-gpio-mismatch` | `E_PAD_KEY` | the chip | `pads.GPIO2.gpio` | key `GPIO2` with `gpio: 7` |
| `pad-gpio-duplicate` | `E_PAD_KEY` | the chip | `pads.GPIO3.gpio` | pad GPIO3 given `gpio: 2`, already used by GPIO2 (also a key mismatch; same code) |
| `pad-key-gp-mismatch` | `E_PAD_KEY` | the chip | `pads.GP2.gpio` | key `GP2` with `gpio: 3` (module patched to keep bonding the renamed pad) |
| `conflict-one-reading` | `E_FACT_STATUS` | the chip | `pads.GPIO0.reset_state.readings` | conflict with a single reading |
| `conflict-reading-no-evidence` | `E_FACT_STATUS` | the chip | `...reset_state.readings.1.evidence` | a reading with `evidence: []` |
| `conflict-active-not-reading` | `E_FACT_STATUS` | the chip | `...reset_state.active` | `active: pulldown`, not the value of any reading |
| `conflict-value-not-active` | `E_FACT_STATUS` | the chip | `...reset_state.value` | `value: input` while `active: pullup` |
| `ref-onboard-pad` | `E_REF_UNRESOLVED` | the board | `onboard.0.uses_pad.1` | `uses_pad: [GPIO1, GPIO99]` |
| `ref-bonded-pad` | `E_REF_UNRESOLVED` | the module | `bonded_pads.4` | `bonded_pads` lists `GPIO99` |
| `ref-consumed-pad` | `E_REF_UNRESOLVED` | the module | `consumed.GPIO99` | `consumed` key `GPIO99` |
| `ref-iomux-pad` | `E_REF_UNRESOLVED` | the chip | `peripherals.I2C0.iomux_pins.sda` | `iomux_pins: { sda: GPIO99 }` |
| `ref-overlay-pad` | `E_REF_UNRESOLVED` | the board | `os_overlays.0.pads.led` | overlay role `led` -> `GPIO99` |
| `ref-power-pin-rail` | `E_REF_UNRESOLVED` | the board | `connectors.0.pins.0.rail` | `power` pin with `rail: "5V"`, but the only rail is `3V3` |
| `pin-duplicate-pad` | `E_PIN_NUMBERING` | the board | `connectors.0.pins.3.pad` | pins J1-3 and J1-4 both on `GPIO0` |
| `pin-duplicate-pad-connectors` | `E_PIN_NUMBERING` | the board | `connectors.1.pins.0.pad` | a second connector J2 with a pin on `GPIO0` |
| `duplicate-variant-id` / `-connector-id` / `-rail-name` | `E_DUPLICATE_ID` | the board | `variants.1.id` / `connectors.1.id` / `rails.1.name` | repeated inside one board |
| `evidence-empty-title` / `-publisher` | `E_SCHEMA` | the evidence | `title` / `publisher` | blank text |
| `claim-id-prefix-mismatch` | `E_SCHEMA` | the evidence | `claims.0.id` | claim id `other-doc#pad-table` in record `demo-datasheet-1` |
| `reviewer-zero-width` / `-cyrillic` | `E_SCHEMA` | the board | `logic_voltage.reviewers.1` | `hardware-researcher` + U+200B / Cyrillic `a` |
| `unknown-dir` | `E_UNKNOWN_DIR` | `chip/demo-mcu-1.yaml` | (root) | a YAML file in the misspelled directory `chip/` |
| `url-userinfo` / `-leading-space` / `-inner-space` | `E_SCHEMA` | the evidence | `url` | `https://user:pass@...`, a leading space, a space inside the URL |

## Expected coverage of `valid/` (informative)

A *fact* is any mapping that has both a `status` key and an `evidence` key. There are 41 facts:
**39 verified, 1 interim, 1 missing**, and 0 of each other status.

| file | verified | interim | missing |
| --- | --- | --- | --- |
| `chips/demo-mcu-1.yaml` | 25 | 1 (`electrical.internal_pull_ohm`) | 0 |
| `modules/demo-module-1.yaml` | 2 | 0 | 0 |
| `boards/demo-board-1@r1.yaml` | 2 | 0 | 1 (`rails.0.max_current`) |
| `ics/demo-sensor-1.yaml` | 5 | 0 | 0 |
| `breakouts/demo-breakout-1.yaml` | 5 | 0 | 0 |

## Interpretation choices the CLI must follow

The schema reference (skill `catalog-schema`) leaves these points open. The fixtures depend on the
choices below.

1. **Error paths** are the Zod-style path joined with `.`. Array indices are plain numbers
   (`connectors.0.pins.3.pad`), and record keys are used as they are (`pads.GPIO2.gpio`). A path is
   relative to the entity's root object, not prefixed with the file or entity id. For a missing
   required key, the path ends with that key (`expect.status`).
2. **`E_SCHEMA` covers shape only**: types, required keys, enums, literal patterns. The cross-field
   fact rules have their own codes even if they are written as Zod refinements; the CLI must map them:
   - `E_EVIDENCE_MISSING`: status other than `missing` with `evidence: []`.
   - `E_FACT_STATUS`: `value` not null while `missing`, `value` null while not `missing`, and
     `conflict` without both `readings` and `active`, and (fix round 2, decision 16) inconsistent conflicts.
   - `E_VERIFIED_REVIEWERS`: `verified` with fewer than 2 **distinct** reviewers. Reviewer identity is the
     key after trim + lower-case (`Hardware-Researcher` equals `hardware-researcher`). A reviewer key must
     not be blank: an empty or whitespace-only key is a shape error (`E_SCHEMA`, path `...reviewers.N`) on
     any fact, so the entity is then skipped (decision 8). After trim + lower-case a key must match
     `^[a-z0-9][a-z0-9._-]*$` (fix round 2): zero-width characters and look-alike letters are a shape error
     (`E_SCHEMA`, path `...reviewers.N`) too, so `hardware-researcher` + U+200B is never a second reviewer.
3. **What counts as a fact**: any mapping with both `status` and `evidence`. `onboard[].evidence`
   and `Fixture.evidence` are plain `ClaimId[]`, not facts. Their ids must still resolve
   (`E_EVIDENCE_UNKNOWN`), but they are not counted in coverage and do not need to be non-empty.
4. **Evidence resolution**: split `<doc>#<slug>` at the first `#`. Find the evidence record whose `id`
   field equals `<doc>` (not its file name), then look for a `claims[].id` equal to the **full**
   claim id. An unknown doc and an unknown claim are both `E_EVIDENCE_UNKNOWN`.
5. **Board references**: a board's `id` is `demo-board-1`. Fixtures and projects refer to a board as
   `<board.id>@<board.revision>` (`demo-board-1@r1`), following the golden-fixtures skill. The file name
   `boards/<id>@<rev>.yaml` follows `docs/templates/board.yaml`. The CLI must identify an entity by its
   directory and `id` field, never by its file name.
6. **Pin numbering (`E_PIN_NUMBERING`)** applies to pins with `kind: gpio`. Each one needs a `pad`, a
   non-empty `label` and a `position`, and its `pad` must be a key of `chip.pads` for the chip of
   **every** variant (`variant.module` -> `module.chip`). `GPIO99` is also outside the module's
   `bonded_pads`, so the case fails whether or not the CLI checks `bonded_pads`. Pins of other kinds
   need no `pad`. A gpio pin on a pad that the module consumes (GPIO3 here) is **not** a Phase 1 error,
   and the valid board does not expose GPIO3. Also `E_PIN_NUMBERING` (fix round 1): a gpio, power or
   ground pin with a blank `label`; two pins of one connector with the same `position`; two **gpio** pins
   of one connector with the same `label` (power/ground labels such as `GND` legitimately repeat); and a
   gpio pad that the module of any variant does not list in `bonded_pads`. The relation between a pad key and its
   `gpio` number is checked on the chip (decision 16), not on the board.
7. **Board status**: the reference does not list which fields are "critical", so the CLI computes:
   - `datasheet-required` when no connector has a `gpio` pin;
   - `fully-verified` when every fact is `verified`;
   - `partially-verified` otherwise, including `single-source`.

   `unsupported` is accepted as hand-set and not recomputed. The scope can be just the board file, or
   the board plus its variants' modules and chips; the fixtures give the same result either way. I
   recommend the wider scope, because chip facts are "engine-read".
8. **No cascading errors.** An entity that fails `E_SCHEMA` is left out of cross-reference checks, and
   checks that depend on it are skipped. `E_BOARD_STATUS` is evaluated only for boards with no
   `E_SCHEMA` or `E_PIN_NUMBERING` error. Without this, `pin-numbering` would also report
   `E_BOARD_STATUS`, and `schema-error` would report `E_PIN_NUMBERING`. Tests should assert that the
   expected code is present. The CLI should report only that code.
9. **YAML**: dates (`accessed`) and versions (`revision: "1.0"`) are quoted so that every loader reads
   them as strings. `docs/templates/evidence.yaml` shows `accessed` unquoted, which js-yaml would turn
   into a `Date`. The schema should expect a string matching `YYYY-MM-DD`. I2C addresses are written
   in decimal (`64  # 0x40`) to avoid differences in how loaders read hex.
10. **Optional vs nullable**: optional fields are left out, never set to `null` (for example, no
    `select_strap: null`). `docs/templates/ic-breakout.yaml` writes `select_strap: null` and
    `value: [null, null]` for missing facts. Neither matches the TypeScript reference
    (`select_strap?`, and `value: null` when `missing`), so the templates should be fixed to match.
11. **Unresolved references are errors (`E_REF_UNRESOLVED`).** A `variants[].module` that is not a module,
    a `module.chip` that is not a chip, a `breakout.ic` that is not an IC, and a fixture's `board`
    (`<id>@<revision>`), `variant` or `project.modules[].breakout` that do not exist are errors, reported
    on the file holding the reference (path = the field). A board with an unresolved reference gets **no**
    computed status (`computed: null`, no `E_BOARD_STATUS`) and the run exits non-zero. A reference to a
    file that is itself broken (E_YAML, E_SCHEMA, duplicate id) is not reported again (decision 8).
    `Board.variants` must have at least one entry (`E_SCHEMA`).
12. **Duplicate ids (`E_DUPLICATE_ID`).** Two entities of one kind with the same `id` (boards: the same
    `id@revision`) are an error in **every** involved file, path `id`. The same claim id twice inside one
    evidence record is an error at `claims.N.id` (N = the later occurrence). Evidence claim sets are never
    merged; the clashing id is treated like a broken entity, so dependants add no second error.
13. **Wrong extension (`E_FILE_EXTENSION`).** Inside a kind directory only lower-case `.yaml` is loaded.
    `.yml`, `.YAML`, `.Yml` ... are errors (they would otherwise be skipped silently). A YAML file directly in
    the catalog root is still only a `W_IGNORED_FILE` warning.
14. **YAML is plain data.** Anchors, aliases and merge keys are `E_YAML` (no alias bombs, nothing hidden
    from review). The keys `__proto__`, `constructor` and `prototype` are `E_SCHEMA` anywhere in a file,
    and none of that file's facts are counted in coverage.
15. **Evidence text and links.** Each claim's `quote`, `locator` and `supports` must be non-blank;
    `quote` has at most 25 words and 400 characters. `url` / `url_original` must be `http:` or `https:`.

16. **Chip pad identity and conflict facts (`E_PAD_KEY`, `E_FACT_STATUS`).** Pad names are not `GPIO<n>` on every
    chip family (`GP2` on RP2040, `BCM2` on Raspberry Pi, `PA5` on AVR/STM32), so no naming scheme is
    required. Two universal rules, path `pads.<key>.gpio`, reported on the chip: (1) `gpio` is unique within
    one chip (the later pad is reported and the message names the first); (2) a key that matches
    `^(GPIO|GP|IO|BCM)(\d+)$` (case-insensitive; the digits are compared as a number, so `GPIO02` equals 2)
    must have `gpio` equal to that number. Keys like `PA5`, `D13`, `P0.13`, `GPIO2_A` are exempt from rule 2.
    This is the weakest rule that still stops a wrong GPIO number on a board pin map. A `conflict` fact
    (`E_FACT_STATUS`) needs at least 2 `readings` (path `readings`), every reading with at least one evidence id
    (`readings.N.evidence`), `active` equal to the value of one reading (`active`) and `value` equal to `active`
    (`value`). Values are compared with deep equality (numbers, booleans, strings, arrays, objects; object key order is
    irrelevant). The engine reads the active reading, so it must be a real, cited one.
17. **Duplicate ids inside one board (`E_DUPLICATE_ID`).** Repeated `variants[].id`, `connectors[].id` or
    `rails[].name` in one board: error at the later occurrence (`variants.N.id`, `connectors.N.id`,
    `rails.N.name`). A board with such an error gets no computed status (as for decision 11).
18. **Pad references resolve (`E_REF_UNRESOLVED`).** A pad name must be a key of `chip.pads` in: `Board.onboard[].uses_pad`
    (path `onboard.I.uses_pad.J`) and `Board.os_overlays[].pads` values (`os_overlays.I.pads.<role>`), both checked
    against the chip of **every** variant (variant -> module -> chip) and reported on the board; `Module.bonded_pads`
    (`bonded_pads.I`) and `Module.consumed` keys (`consumed.<pad>`), reported on the module; `Chip.peripherals.*.iomux_pins`
    values (`peripherals.<name>.iomux_pins.<role>`), reported on the chip. A `power`-kind connector pin whose `rail` is not
    a `rails[].name` of the board is also `E_REF_UNRESOLVED` (`connectors.I.pins.J.rail`). A reference whose module or
    chip is unresolved, duplicated or broken is not checked and not reported again (decisions 8, 11, 12). Board pad
    references need not be bonded out (only gpio header pins are held to `bonded_pads`, decision 6). A board with an
    unresolved reference gets no computed status.
19. **One pad on two connector pins (`E_PIN_NUMBERING`).** Across all connectors of one board, every pin that carries a
    `pad` (any kind) is compared; the second occurrence is reported at `connectors.I.pins.J.pad` and the message names
    the first (`J1-3`). Power, ground, `nc` and `reset` pins carry no `pad`, so they never clash. This is an error, not a
    warning: neither the schema reference, the catalog-schema skill nor the plan describes a board that routes one pad to
    two header positions. **Hardware-realism caveat:** some real boards do (the Arduino Uno R3 repeats A4/A5 as the SDA/SCL
    header pins). If such a board is catalogued, downgrade this check to a warning (`W_DUPLICATE_PAD`) in a later round
    rather than inventing a second pad.
20. **Unknown directories (`E_UNKNOWN_DIR`), evidence text and reviewer keys.** Any directory directly under the catalog
    root that is not one of the seven kind directories and contains a `.yaml` / `.yml` file (any case, any depth) is an
    error per such file (`chip/demo-mcu-1.yaml`, path empty); the file is not loaded. Directories without YAML, directories
    whose name starts with `.` and `node_modules` are ignored. Evidence `title` and `publisher` must be non-blank
    (`E_SCHEMA`). A claim id must start with `<evidence id>#`, otherwise `E_SCHEMA` at `claims.N.id` (the simplest consistent
    code: the record is then broken and its claims are not used, so citing facts add no second error). `url` /
    `url_original` must match `^https?://` (lower-case scheme), contain no whitespace anywhere and no credentials
    (`user:pass@`, `user@`), and parse as a URL (`E_SCHEMA`). The emitted JSON Schema carries the patterns, so editors flag
    `javascript:`.
21. **`--root` must be a catalog root (exit 2).** `catalog validate|compile --root <dir>` where `<dir>` exists but contains
    none of the seven kind directories (`evidence chips modules boards ics breakouts fixtures`, each a real directory)
    exits 2 with `catalog: root "<dir>" is not a catalog root: ...`, so a typo or a wrong working directory can never print
    `0 errors` and exit 0. One kind directory is enough: the real catalog (`catalog/`, seven `.gitkeep` directories) is valid
    and empty (exit 0, compiles).
22. **Links are never followed (`W_SYMLINK_SKIPPED`).** A symbolic link or junction (to a file or directory, even a dangling
    one) directly in the catalog root, as a kind directory, or anywhere under a kind directory is skipped with the warning
    `W_SYMLINK_SKIPPED` (file = its root-relative path, exit stays 0). It is not read, so a catalog cannot pull in files from
    outside its root, and the result does not depend on how the operating system resolves links.
23. **Kind directory names are case-sensitive.** `Chips/` is not `chips/`, on every file system (before, a case-insensitive
    file system loaded it as `chips/` while Linux CI did not). A YAML file in `Chips/` is `E_UNKNOWN_DIR`; the message tells
    the author to use the lower-case name because Linux CI will not load it. `E_EVIDENCE_UNKNOWN` for an unknown claim in an
    existing evidence document appends `(known claims: a, b, c, d, e, ...)`: the first five claim ids of that document by
    code unit, `...` when there are more. A reading inside a `conflict` fact (`readings.N.evidence.M`) is resolved like any
    other claim id, and must have the `<doc>#<slug>` shape (`E_SCHEMA`).

### Added in fix round 3 (new code `W_SYMLINK_SKIPPED`; no existing case changed)

| case | code | file | path_contains | violation |
| --- | --- | --- | --- | --- |
| `conflict-reading-unknown-claim` | `E_EVIDENCE_UNKNOWN` | the chip | `pads.GPIO0.reset_state.readings.1.evidence.0` | a valid conflict whose second reading cites `demo-datasheet-1#no-such-claim` |

Symlink, junction, `Chips/`, not-a-catalog-root and mutation-killing cases are built in temporary directories by
`packages/cli/test/round3.test.ts` (they cannot be stored as fixtures).

### Deferred (not implemented; engine inputs, Phase 2b)

Breakout `pullups[].line` / `pins[].maps_to` against the IC's signals, `interfaces_exposed` against the IC's interfaces, and
fixture duplicate `instance` / unknown `locked[].pad` checks. Reason: engine inputs, Phase 2b. Also not checked: a gpio pin
on a module-`consumed` pad (decision 6, deliberate) and blank `reset`-pin labels.

## Notes for contributors

- **Manifest `date` is not a pure function of the catalog.** The catalog file name and `version` are
  content-addressed and reproducible. The manifest `date` comes from `SOURCE_DATE_EPOCH`, else the last git
  commit touching the catalog root, so it depends on git history depth (and is the latest evidence
  `accessed` date when git is unavailable). An invalid `SOURCE_DATE_EPOCH` is a usage error (exit 2),
  never ignored.
- Exit codes: 0 ok, 1 validation errors, 2 usage error or unexpected internal error (one `error: ...` line).
