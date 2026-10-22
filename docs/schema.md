# Catalog schema reference

> Generated from the Zod schemas in `packages/schema` (their `.describe()` text) by
> `pnpm docs:schema`. Do not edit by hand. The normative design is the TypeScript reference in
> `.claude/skills/catalog-schema/SKILL.md`; a test keeps the Zod schemas equal to it.

`Fact<T>` is the evidence-backed wrapper every engine-read value uses:
`{ value, unit?, conditions?, evidence[], status, reviewers?, readings?, active?, transcribed?, note? }`.
A fact with status `missing` has `value: null` and no evidence; a `verified` fact needs at least two
distinct reviewers.

## Contents

- [board](#board)
- [breakout](#breakout)
- [chip](#chip)
- [evidence](#evidence)
- [fixture](#fixture)
- [ic](#ic)
- [module](#module)
- [pin-view](#pin-view)
- [project](#project)
- [recommendation](#recommendation)
- [warning](#warning)

## board

A board revision: connectors, labels, rails, onboard parts (catalog/boards/<id>@<rev>.yaml).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Board id without revision; referenced as `<id>@<revision>`. |
| `vendor` | string | yes | Board vendor. |
| `name` | string | yes | Board name. |
| `revision` | string | yes | Board revision. |
| `variants` | object[] | yes | Module variants of this board revision (at least one). |
| `variants[].id` | string | yes | Variant id. |
| `variants[].module` | string | yes | Module id. |
| `logic_voltage` | Fact<number> | yes | Logic voltage of the headers. |
| `rails` | object[] | yes | Power rails. |
| `rails[].name` | string | yes | Rail name. |
| `rails[].voltage` | Fact<number> | yes | Rail voltage. |
| `rails[].max_current` | Fact<number> | yes | Rail current capacity. |
| `rails[].source` | string | yes | What supplies the rail. |
| `connectors` | object[] | yes | Headers and connectors. |
| `connectors[].id` | string | yes | Connector id, e.g. 'J1'. |
| `connectors[].side` | "left" \| "right" \| "top" \| "bottom" | no | Board side. |
| `connectors[].pins` | object[] | yes | Pins in position order. |
| `connectors[].pins[].position` | integer | yes | Physical position on the connector (numbering 3 of 3). |
| `connectors[].pins[].label` | string | yes | Silkscreen label (numbering 2 of 3). |
| `connectors[].pins[].kind` | "power" \| "ground" \| "gpio" \| "reset" \| "nc" \| "analog-ref" | yes | Pin kind. |
| `connectors[].pins[].pad` | string | no | Chip pad (gives the GPIO number); required for gpio pins. |
| `connectors[].pins[].rail` | string | no | Power rail name for power pins. |
| `onboard` | object[] | yes | Onboard hardware attached to pads (LEDs, USB bridge, buttons, dividers…). |
| `onboard[].part` | string | yes | Onboard part. |
| `onboard[].uses_pad` | string[] | yes | Pads the part is wired to. |
| `onboard[].effect` | string | yes | Effect on those pads. |
| `onboard[].evidence` | string (pattern)[] | yes | Claim ids (a plain list, not a fact). |
| `numbering` | object | yes | Which numbering system the board documentation uses first. |
| `numbering.primary` | "gpio" \| "label" \| "physical" | yes | Primary numbering shown. |
| `os_overlays` | object[] | no | OS device-tree overlays (Raspberry Pi). |
| `os_overlays[].name` | string | yes | Overlay name. |
| `os_overlays[].pads` | Record<string, string> | yes | Overlay role to pad. |
| `os_overlays[].evidence` | string (pattern)[] | yes | Claim ids. |
| `status` | "fully-verified" \| "partially-verified" \| "datasheet-required" \| "unsupported" | yes | Board status, computed by the CLI from fact statuses; validate rejects a mismatch. |

## breakout

A breakout module wrapping an IC (catalog/breakouts/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Entity id, lower-case kebab-case (dots allowed). |
| `ic` | string | yes | IC id on the breakout. |
| `vendor` | string | yes | Breakout vendor. |
| `variant_names` | string[] | yes | Names the breakout is sold under. |
| `pins` | object[] | yes | Breakout pins. |
| `pins[].label` | string | yes | Pin label. |
| `pins[].maps_to` | string | yes | Signal role, or 'VCC' \| 'GND' \| 'NC'. |
| `regulator` | Fact<object> | yes | Onboard regulator. |
| `level_shifter` | Fact<boolean> | yes | Onboard level shifter. |
| `pullups` | object[] | yes | Onboard pull-ups. |
| `pullups[].line` | string | yes | Line. |
| `pullups[].value_ohm` | Fact<number> | yes | A fact: one value with unit, conditions, evidence ids, status and reviewers. |
| `hardwired` | object[] | yes | Hardwired straps. |
| `hardwired[].strap` | string | yes | Strap. |
| `hardwired[].value` | string \| number | yes | Hardwired value. |
| `interfaces_exposed` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital"[] | yes | Interfaces reachable on the pins. |
| `supply_current` | Fact<object> | yes | Supply current (typ/max). |
| `notes` | string | no | Free-text notes. |

## chip

A chip (SoC/MCU): pads, straps, electrical limits and peripherals (catalog/chips/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Entity id, lower-case kebab-case (dots allowed). |
| `vendor` | string | yes | Chip vendor. |
| `family` | string | yes | Chip family. |
| `series` | string | yes | Chip series. |
| `revisions` | string[] | yes | Silicon revisions covered. |
| `vdd_io` | Fact<number> | yes | I/O supply voltage. |
| `electrical` | object | yes | Chip electrical limits. |
| `electrical.vih_min` | Fact<number \| string (pattern)> | yes | Minimum input-high voltage. |
| `electrical.vil_max` | Fact<number \| string (pattern)> | yes | Maximum input-low voltage. |
| `electrical.voh_min` | Fact<number \| string (pattern)> | yes | Minimum output-high voltage. |
| `electrical.vol_max` | Fact<number \| string (pattern)> | yes | Maximum output-low voltage. |
| `electrical.abs_max_vin` | Fact<number \| string (pattern)> | yes | Absolute maximum input voltage. |
| `electrical.pin_current_max` | Fact<number> | yes | Maximum current per pin (mA). |
| `electrical.port_current_max` | Fact<number> | no | Maximum current per port (mA). |
| `electrical.vcc_pin_current_max` | Fact<number> | no | Maximum current per VCC pin (mA). |
| `electrical.cumulative_current_max` | Fact<number> | yes | Maximum total current of all pins (mA). |
| `electrical.internal_pull_ohm` | Fact<object> | no | Internal pull resistance range. |
| `pads` | Record<string, object> | yes | Pads keyed by pad id. |
| `pads.*.gpio` | integer | yes | Chip GPIO number (numbering system 1 of 3). |
| `pads.*.functions` | object[] | yes | Functions with routing class. |
| `pads.*.functions[].fn` | string | yes | Function name, e.g. 'GPIO', 'SPI3.SCK', 'I2C.SDA', 'ADC1_CH4', 'UART0.TX'. |
| `pads.*.functions[].routing` | "iomux" \| "matrix" \| "fixed" | yes | How a function reaches a pad: dedicated IO_MUX, GPIO matrix, or fixed (analog/dedicated). |
| `pads.*.functions[].max_hz` | Fact<number> | no | Maximum frequency for this function on this pad. |
| `pads.*.input_only` | Fact<boolean> | yes | True when the pad cannot drive an output. |
| `pads.*.reset_state` | Fact<"input" \| "pullup" \| "pulldown" \| "disabled" \| "output-high" \| "output-low"> | yes | State at reset. |
| `pads.*.strap` | Fact<object \| "none"> | yes | Strap role and required level, or explicit 'none'. |
| `pads.*.adc` | object | no | ADC unit/channel on this pad. |
| `pads.*.adc.unit` | string | yes | ADC unit, e.g. 'ADC1'. |
| `pads.*.adc.channel` | integer | yes | ADC channel number. |
| `pads.*.adc.radio_conflict` | Fact<boolean> | yes | True when the channel is unusable while the radio is on. |
| `pads.*.dac` | object | no | DAC channel on this pad. |
| `pads.*.dac.channel` | integer | yes | DAC channel. |
| `pads.*.touch` | object | no | Touch channel on this pad. |
| `pads.*.touch.channel` | integer | yes | Touch channel. |
| `pads.*.jtag` | string | no | JTAG signal on this pad, e.g. 'MTMS'. |
| `pads.*.power_up_glitch` | Fact<object \| "none"> | yes | Power-up glitch, or explicit 'none'. |
| `pads.*.errata` | string[] | yes | Errata ids affecting this pad (empty when none found). |
| `peripherals` | Record<string, object> | yes | Peripherals keyed by instance name, e.g. 'SPI3', 'I2C0', 'ADC1'. |
| `peripherals.*.kind` | "spi" \| "i2c" \| "uart" \| "adc" \| "pwm" \| "onewire-capable" | yes | Peripheral class. |
| `peripherals.*.iomux_pins` | Record<string, string> | no | Dedicated IO_MUX pad per role. |
| `peripherals.*.matrix_routable` | boolean | yes | True when the peripheral can be routed via the GPIO matrix. |
| `peripherals.*.limits` | object | no | Clock limits per routing class. |
| `peripherals.*.limits.matrix_max_hz` | Fact<number> | no | Max clock via the matrix. |
| `peripherals.*.limits.iomux_max_hz` | Fact<number> | no | Max clock via IO_MUX. |
| `peripherals.*.adc_effective_range_mv` | Fact<Record<string, any[]>> | no | Usable ADC input range in mV per attenuation. |

## evidence

An evidence record: one source document and the claims quoted from it (catalog/evidence/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Document id, e.g. `esp32-ds-v5.3`; the `<doc-id>` part of claim ids. |
| `title` | string | yes | Document title as printed. |
| `publisher` | string | yes | Publisher (vendor or standards body). |
| `doc_number` | string \| null | yes | Publisher document number, or null. |
| `revision` | string \| null | yes | Document revision as printed (quoted in YAML), or null. |
| `revision_date` | string \| null | yes | Revision date only if printed in the document, or null. |
| `url` | string | yes | Final URL the document was read from. |
| `url_original` | string \| null | yes | Original URL before redirects, or null. |
| `accessed` | string (pattern) | yes | Access date, YYYY-MM-DD, as a (quoted) string. |
| `sha256` | string (pattern) \| null | yes | SHA-256 of the downloaded file; null for HTML pages. |
| `kind` | "board-guide" \| "datasheet" \| "trm" \| "errata" \| "schematic" \| "design-guide" \| "api-doc" \| "library" \| "app-note" \| "standard" | yes | Kind of source document. |
| `secondary` | boolean | yes | True for a reputable secondary source (flagged to users). |
| `manual` | boolean | yes | True when the human supplied the file in sources/manual/. |
| `claims` | object[] | yes | Quoted claims that catalog facts cite. |
| `claims[].id` | string (pattern) | yes | Full claim id `<doc-id>#<slug>`; facts cite this exact string. |
| `claims[].locator` | string (pattern) | yes | Section, table, figure or page where the claim is found. |
| `claims[].quote` | string (pattern) | yes | Verbatim quote from the source (25 words or fewer, at most 400 characters). |
| `claims[].supports` | string (pattern) | yes | Which catalog fact(s) the quote supports. |

## fixture

A golden test fixture written by hand from datasheets (catalog/fixtures/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Entity id, lower-case kebab-case (dots allowed). |
| `board` | string | yes | Board reference `<board.id>@<board.revision>`. |
| `variant` | string | yes | Board variant id. |
| `project` | object | yes | A user project: board, variant, modules, locked and reserved pins. |
| `project.board` | string | yes | Board reference `<board.id>@<board.revision>`. |
| `project.variant` | string | yes | Board variant id. |
| `project.wifi` | boolean | no | Project uses Wi-Fi (affects ADC2 on ESP32). |
| `project.modules` | object[] | yes | Modules to connect. |
| `project.modules[].breakout` | string | yes | Breakout id. |
| `project.modules[].instance` | string | yes | Instance name, unique in the project. |
| `project.modules[].interface` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital" | no | Interface kind. |
| `project.modules[].address_strap` | string | no | Chosen address strap. |
| `project.locked` | object[] | yes | User-fixed assignments; never moved silently. |
| `project.locked[].instance` | string | yes |  |
| `project.locked[].role` | string | yes |  |
| `project.locked[].pad` | string | yes | Chip pad name, e.g. 'GPIO21'. |
| `project.reserved` | string[] | yes | Pads the user keeps free. |
| `project.rails` | Record<string, number> | no | Rail voltage overrides. |
| `project.framework` | "arduino" \| "micropython" \| "esp-idf" \| "pico-sdk" \| "rpi-python" | no | Code generation target. |
| `project.wiring_length_m` | number | no | Typical wire length in metres. |
| `project.allow_reassign` | boolean | no | Allow moving locked pins. |
| `expect` | object | yes | Expected engine result, derived by hand from datasheets. |
| `expect.status` | "ok" \| "unsat" \| "needs_variant" | yes | Solver result status. |
| `expect.exact` | Record<string, string> | no | `instance.role` to pad. |
| `expect.properties` | any[] | no | Property assertions. |
| `expect.warnings_include` | object[] | no | Warnings that must be present. |
| `expect.warnings_include[].code` | string | yes |  |
| `expect.warnings_include[].level` | "critical" \| "warning" \| "caution" \| "info" | yes | Severity. |
| `expect.required_parts_include` | any[] | no | Parts that must be listed. |
| `expect.minimal_conflict_includes` | string[] | no | For unsat results. |
| `expect.relaxations_include` | string[] | no | For unsat results. |
| `evidence` | string (pattern)[] | yes | Claim ids the derivations rely on (a plain list). |
| `derivations` | string[] | yes | Hand derivations from the sources. |
| `changelog` | string[] | no | Fixture change history. |

## ic

A sensor/peripheral IC: interfaces, timing, addresses, voltage limits (catalog/ics/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Entity id, lower-case kebab-case (dots allowed). |
| `vendor` | string | yes | IC vendor. |
| `part` | string | yes | Part number. |
| `interfaces` | object[] | yes | Supported interfaces. |
| `interfaces[].kind` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital" | yes | Interface kind. |
| `interfaces[].signals` | object[] | yes | Signals of this interface. |
| `interfaces[].signals[].role` | string | yes | Signal role, e.g. 'SDA', 'SCK', 'CS'. |
| `interfaces[].signals[].dir` | "in" \| "out" \| "io" | yes | Direction seen from the IC. |
| `interfaces[].signals[].drive` | "push-pull" \| "open-drain" \| "open-collector" | yes | Output drive type. |
| `interfaces[].signals[].shareable` | boolean | yes | True for bus lines that can be shared. |
| `interfaces[].signals[].acts_on_level` | boolean | no | True for relay/LED/MOSFET-gate/buzzer inputs (a "load"). |
| `interfaces[].signals[].resting_level` | "high" \| "low" \| "float" | no | Level at rest/reset. |
| `interfaces[].limits` | object | yes | Interface limits. |
| `interfaces[].limits.max_hz` | Fact<number> | no | Maximum clock. |
| `interfaces[].limits.spi_modes` | number[] | no | Supported SPI modes. |
| `interfaces[].limits.i2c_modes` | "sm" \| "fm" \| "fmp" \| "hs"[] | no | Supported I2C modes. |
| `interfaces[].limits.addresses` | object[] | no | I2C address options. |
| `interfaces[].limits.addresses[].value` | number | yes | 7-bit I2C address (decimal in YAML). |
| `interfaces[].limits.addresses[].strap` | string | yes | Strap setting that selects it. |
| `interfaces[].limits.miso_tristate_when_deselected` | Fact<boolean> | no | MISO released when CS high. |
| `interfaces[].limits.tscyc_min_s` | Fact<number> | no | Minimum SPI clock period (s). |
| `interfaces[].limits.analog_range_v` | Fact<any[]> | no | Analog output range (V). |
| `select_strap` | object | no | Interface-select strap (omit when none; never null). |
| `select_strap.pins` | string[] | yes | Strap pins. |
| `select_strap.table` | object[] | yes | Strap levels to interface. |
| `select_strap.table[].value` | Record<string, 0 \| 1> | yes | Pin levels. |
| `select_strap.table[].selects` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital" | yes | Interface kind. |
| `select_strap.evidence` | string (pattern)[] | yes | Claim ids. |
| `vdd_range` | Fact<any[]> | yes | Supply range (V). |
| `vio_range` | Fact<any[]> | yes | I/O supply range (V). |
| `input_abs_max` | Fact<number \| string (pattern)> | yes | Absolute maximum input voltage. |
| `logic_levels` | object | no | Logic thresholds. |
| `logic_levels.vih_min` | Fact<number \| string (pattern)> | yes | A fact: one value with unit, conditions, evidence ids, status and reviewers. |
| `logic_levels.vil_max` | Fact<number \| string (pattern)> | yes | A fact: one value with unit, conditions, evidence ids, status and reviewers. |
| `logic_levels.voh_min` | Fact<number \| string (pattern)> | no | A fact: one value with unit, conditions, evidence ids, status and reviewers. |
| `logic_levels.vol_max` | Fact<number \| string (pattern)> | no | A fact: one value with unit, conditions, evidence ids, status and reviewers. |
| `supply_current` | Fact<object> | yes | Supply current (typ/max). |

## module

A module (e.g. ESP32-WROOM-32E): bonded and consumed pads (catalog/modules/).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string (pattern) | yes | Entity id, lower-case kebab-case (dots allowed). |
| `chip` | string | yes | Chip id this module carries. |
| `bonded_pads` | string[] | yes | Chip pads bonded out by the module. |
| `consumed` | Record<string, Fact<"flash" \| "psram" \| "usb" \| "crystal" \| "internal">> | yes | Pads used inside the module and what uses them. |
| `flash_voltage` | Fact<number> | yes | Flash supply voltage. |
| `psram` | Fact<string> | no | PSRAM fitted, if any. |

## pin-view

PROVISIONAL (addition, not in the reference): one board pin with its effective, computed capabilities.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `connector` | string | yes | Connector id (numbering 3 of 3, with position). |
| `position` | integer | yes | Physical position on the connector (numbering 3 of 3). |
| `label` | string | yes | Silkscreen label (numbering 2 of 3). |
| `kind` | "power" \| "ground" \| "gpio" \| "reset" \| "nc" \| "analog-ref" | yes | Pin kind. |
| `pad` | string | no | Chip pad, for gpio pins. |
| `gpio` | integer | no | Chip GPIO number (numbering 1 of 3). |
| `functions` | object[] | yes | Effective functions after stacking chip, module and board. |
| `functions[].fn` | string | yes | Function name, e.g. 'GPIO', 'SPI3.SCK', 'I2C.SDA', 'ADC1_CH4', 'UART0.TX'. |
| `functions[].routing` | "iomux" \| "matrix" \| "fixed" | yes | How a function reaches a pad: dedicated IO_MUX, GPIO matrix, or fixed (analog/dedicated). |
| `functions[].max_hz` | Fact<number> | no | Maximum frequency for this function on this pad. |
| `flags` | "input-only" \| "strap" \| "consumed" \| "onboard" \| "jtag" \| "power-up-glitch" \| "adc-radio-conflict" \| "unverified"[] | yes | Computed caution flags. |
| `evidence` | string (pattern)[] | yes | Claim ids behind the composed view. |

## project

A user project: board, variant, modules, locked and reserved pins.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `board` | string | yes | Board reference `<board.id>@<board.revision>`. |
| `variant` | string | yes | Board variant id. |
| `wifi` | boolean | no | Project uses Wi-Fi (affects ADC2 on ESP32). |
| `modules` | object[] | yes | Modules to connect. |
| `modules[].breakout` | string | yes | Breakout id. |
| `modules[].instance` | string | yes | Instance name, unique in the project. |
| `modules[].interface` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital" | no | Interface kind. |
| `modules[].address_strap` | string | no | Chosen address strap. |
| `locked` | object[] | yes | User-fixed assignments; never moved silently. |
| `locked[].instance` | string | yes |  |
| `locked[].role` | string | yes |  |
| `locked[].pad` | string | yes | Chip pad name, e.g. 'GPIO21'. |
| `reserved` | string[] | yes | Pads the user keeps free. |
| `rails` | Record<string, number> | no | Rail voltage overrides. |
| `framework` | "arduino" \| "micropython" \| "esp-idf" \| "pico-sdk" \| "rpi-python" | no | Code generation target. |
| `wiring_length_m` | number | no | Typical wire length in metres. |
| `allow_reassign` | boolean | no | Allow moving locked pins. |

## recommendation

The engine output: interfaces, assignments, parts, warnings, budgets, score.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `catalog_version` | string | yes | Catalog version used. |
| `catalog_sha256` | string | yes | SHA-256 of the catalog JSON used. |
| `ruleset_version` | string | yes | Rule-set version used. |
| `status` | "ok" \| "unsat" \| "needs_variant" | yes | Solver result status. |
| `interfaces` | Record<string, object> | yes | Chosen interface per instance. |
| `interfaces.*.kind` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital" | yes | Interface kind. |
| `interfaces.*.decided_by_rule` | number | yes | Interface-selection rule that decided. |
| `interfaces.*.alternatives` | "i2c" \| "spi" \| "uart" \| "onewire" \| "analog" \| "digital"[] | yes |  |
| `assignments` | object[] | yes | Pin assignments with all three numbering systems. |
| `assignments[].instance` | string | yes |  |
| `assignments[].role` | string | yes |  |
| `assignments[].pad` | string | yes | Chip pad name, e.g. 'GPIO21'. |
| `assignments[].gpio` | number | yes |  |
| `assignments[].label` | string | yes |  |
| `assignments[].connector` | string | yes |  |
| `assignments[].position` | number | yes |  |
| `assignments[].peripheral_instance` | string | no |  |
| `assignments[].routing` | "iomux" \| "matrix" \| "fixed" | yes | How a function reaches a pad: dedicated IO_MUX, GPIO matrix, or fixed (analog/dedicated). |
| `assignments[].trace` | string[] | yes | Rule trace. |
| `assignments[].evidence` | string (pattern)[] | yes |  |
| `assignments[].alternatives` | object[] | yes |  |
| `assignments[].alternatives[].pad` | string | yes | Chip pad name, e.g. 'GPIO21'. |
| `assignments[].alternatives[].lower_tier` | 1 \| 2 \| 3 \| 4 | yes |  |
| `assignments[].alternatives[].reason` | string | yes |  |
| `required_parts` | object[] | yes | Extra parts required. |
| `required_parts[].kind` | "resistor" \| "capacitor" \| "level-shifter" \| "buffer" \| "transistor" \| "diode" \| "regulator" \| "divider" | yes |  |
| `required_parts[].value` | string | no |  |
| `required_parts[].role` | string | yes |  |
| `required_parts[].count` | number | yes |  |
| `required_parts[].pads` | string[] | no |  |
| `warnings` | object[] | yes | Warnings. |
| `warnings[].level` | "critical" \| "warning" \| "caution" \| "info" | yes | Severity. |
| `warnings[].code` | string | yes | Stable warning code. |
| `warnings[].message` | string | yes | Human-readable message. |
| `warnings[].pads` | string[] | yes | Pads concerned. |
| `warnings[].evidence` | string (pattern)[] | yes | Claim ids. |
| `budgets` | object[] | yes | Rail current budgets. |
| `budgets[].rail` | string | yes |  |
| `budgets[].demand_ma` | number | yes |  |
| `budgets[].limit_ma` | number \| null | yes |  |
| `score` | any[] | yes | Lexicographic score, tiers 1-4. |
| `unsat` | object | no | Diagnosis when unsatisfiable. |
| `unsat.minimal_conflict` | string[] | yes |  |
| `unsat.relaxations` | string[] | yes |  |
| `variant_candidates` | string[] | no | Candidates when needs_variant. |

## warning

A warning attached to a recommendation.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `level` | "critical" \| "warning" \| "caution" \| "info" | yes | Severity. |
| `code` | string | yes | Stable warning code. |
| `message` | string | yes | Human-readable message. |
| `pads` | string[] | yes | Pads concerned. |
| `evidence` | string (pattern)[] | yes | Claim ids. |
