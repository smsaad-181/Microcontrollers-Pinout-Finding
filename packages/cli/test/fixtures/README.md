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
     `conflict` without both `readings` and `active`.
   - `E_VERIFIED_REVIEWERS`: `verified` with fewer than 2 **distinct** reviewers. Reviewer identity is the
     key after trim + lower-case (`Hardware-Researcher` equals `hardware-researcher`). A reviewer key must
     not be blank: an empty or whitespace-only key is a shape error (`E_SCHEMA`, path `...reviewers.N`) on
     any fact, so the entity is then skipped (decision 8).
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
   gpio pad that the module of any variant does not list in `bonded_pads`. The reference defines no
   relation between a pad key and its `gpio` number, so that is not checked.
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

## Notes for contributors

- **Manifest `date` is not a pure function of the catalog.** The catalog file name and `version` are
  content-addressed and reproducible. The manifest `date` comes from `SOURCE_DATE_EPOCH`, else the last git
  commit touching the catalog root, so it depends on git history depth (and is the latest evidence
  `accessed` date when git is unavailable). An invalid `SOURCE_DATE_EPOCH` is a usage error (exit 2),
  never ignored.
- Exit codes: 0 ok, 1 validation errors, 2 usage error or unexpected internal error (one `error: ...` line).
