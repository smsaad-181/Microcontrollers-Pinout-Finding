# RP2040 chip reconcile (task 2a.4)

Files edited: `catalog/chips/rp2040.yaml`, `catalog/evidence/rp2040-ds-3184e62.yaml` (one claim added). Inputs: researcher draft vs blind audit `docs/validation/phase-2a/audit-rp2040.yaml` (235 facts). Comparison was mechanical (YAML parse of both sides, match by schema path, function names and units normalised); 259 comparison points, 36 differences, all listed below.

## Counts (Facts in the chip file, 133 total)

| status | before | after |
| --- | --- | --- |
| verified | 0 | 131 |
| conflict | 1 | 1 |
| missing | 0 | 1 |
| single-source | 132 | 0 |

`pnpm catalog:validate`: 0 errors, 0 warnings (see hand-off for the tail).

## Mismatches and conflicts

1. `electrical.abs_max_vin` (existing conflict, kept). Readings: `VDDIO+0.5` (RP2040 Table 622, p. 614, evidence `rp2040-ds-3184e62#abs-max-vpin`; the auditor independently read the same value and noted GPIO0-25 are fault tolerant and GPIO26-29 are not) and `VDDIO+0.3` (Pico / Pico W datasheets, ADC pins GPIO26-29, evidence `pico-ds-rel21#adc-diode`, `pico-w-ds-rel7#adc-diode`). Active = `VDDIO+0.3`, the most restrictive; the schema holds one chip-wide value so the restrictive one is applied to all pads (the chip datasheet itself gives no lower limit for the ADC pads, so the two readings are about different pad classes, not a transcription error). Both readings carry evidence; validator passes.
2. `electrical.pin_current_max` (auditor could-not-verify, researcher 12 mA): became `missing`. Rationale: 12 mA is the highest drive-strength setting; datasheet 5.5.3.5 (p. 617) says the 2/4/8/12 mA modes "are not hard limits" and no per-pin absolute maximum exists in Tables 622/625 or 2.19.4. No datasheet text makes 12 mA a limit. The 12 mA / drive-strength information (default 4 mA, DRIVE reset 0x1, VOH/VOL specified at the setting) is in the fact's `note`. The existing claims `drive-strength`, `voh-3v3`, `drive-not-hard-limit` remain in the evidence file. Note for the engine: current-limit checks will show Caution for RP2040 pins; the only hard current limits are the 50 mA source and 50 mA sink totals in `cumulative_current_max` (verified).
3. `pads.GPIO26..29.errata`: researcher lists `[RP2040-E6, RP2040-E11]`, auditor `[RP2040-E6]` (the auditor considered E11, ADC DNL peaks, to apply to the ADC as a whole and name no pad). `errata` is a plain string list, not a Fact, so no status applies. Kept E11 on the four ADC pads (conservative: the engine surfaces it as an ADC accuracy caution); if the owner prefers the auditor's reading, delete `RP2040-E11` from those four lists.
4. Per-pad `functions#routing`: PIO0/PIO1 `iomux` (researcher) vs `matrix` (auditor), on all 30 pads (60 differences). Not a Fact; see the routing decision below. All other routing classes (SPI/UART/I2C/PWM/GPIO/USB `iomux`, ADC channels on GPIO26-29 `fixed`) agree, and all 30 function-name sets agree exactly (SPI/UART/I2C/PWM/SIO/PIO/CLOCK/USB/ADC).

Everything else matched: 120 per-pad scalar facts (input_only, reset_state, strap, power_up_glitch x 30), ADC unit/channel x 4, vih_min 2 V, vil_max 0.8 V, voh_min 2.62 V, vol_max 0.5 V, internal pull 50-80 kOhm (no typ), cumulative current 50 mA source and 50 mA sink, errata for GPIO0-25 (E5 on GPIO15 only), and the peripheral pin lists (SPI0/1, I2C0/1, UART0/1 role to pad sets derived by the auditor from Table 279 equal the researcher's per-pad `functions`, 6 of 6).

## Verified facts

All 131 verified facts carry `reviewers: [hardware-researcher, hardware-fact-auditor]`, status verified, original evidence kept. `vdd_io` (3.3 V): the auditor found IOVDD nominal 1.8-3.3 V (operating 1.62-3.63 V, typ 1.8 or 3.3 V in Table 634). 3.3 V is a listed typical value and the condition of every electrical fact, so it is verified as the 3.3 V operating point (note says so; it is not the only permitted supply). One claim was added for the independent read, `rp2040-ds-3184e62#iovdd-supply-section` (2.9.1, p. 151, quote re-checked against the PDF text), and cited in `vdd_io`. The other matched facts already cite the same pages and rows the auditor used (auditor locators equal the existing claims), so no further claims were added.

## Negative-finding decisions (project policy, rule 4)

| fact | count | decision | basis |
| --- | --- | --- | --- |
| `pads.*.strap` = none | 30 | verified | both keys concluded none; positive support: boot mode is sampled on QSPI_SS (2.8.1.1, claim `boot-cs-button`, cited). Note says "negative finding: absence confirmed by two independent reads". |
| `pads.*.power_up_glitch` = none | 30 | verified | both keys fully read errata appendix B (E1-E16); auditor also text-searched "glitch" (hits only clock muxes and a SIO register note). Positive support cited: `errata-intro`, `funcsel-reset` (FUNCSEL NULL at reset), `pad-reset`. Note states the negative-finding wording; no glitch duration is given in the datasheet. |
| `pads.GPIO26..29.adc.radio_conflict` = false | 4 | verified, weak basis stated | both keys agree, but the datasheet never mentions a radio at all (auditor labelled it `radio_conflict_basis: inference`). Note states this plainly. Owner may want to downgrade to missing if "verified from silence" is not acceptable; board/module records (Pico W GPIO29 = CYW43439 clock) carry the real radio conflict. |

## Routing-class decision (rule 5)

Schema definitions: `iomux` = chosen from a fixed per-pad list; `matrix` = freely routable to any pad; `fixed` = dedicated.
- For `iomux`: PIO0/PIO1 are FUNCSEL values F6/F7 in Table 279 (p. 237-239), each pad selects exactly one function from its fixed list, and datasheet 2.19.2 says the PIO function "must be selected for PIO to drive a GPIO". The same holds for SIO.
- For `matrix` (auditor's view, inferred): every pad offers F6/F7, and chapter 3.1 (p. 312) says "state machines' inputs and outputs are mapped to up to 32 GPIOs ... all state machines have independent, simultaneous access to any GPIO", e.g. UART TX/RX/CTS/RTS on "any four arbitrary GPIOs".
- Against free routing: the same paragraph continues "the amount of freedom available depends on how exactly a given PIO program chooses to use PIO's pin mapping resources, but at the minimum, an interface can be freely shifted up or down by some number of GPIOs" (contiguous pin groups, side-set and out bases). So free any-pad routing of every PIO role is not guaranteed by the datasheet.
- Decision: **`iomux`** for PIO0/PIO1 (and all FUNCSEL functions), applied to all 30 pads. Reason: the pad-level selection mechanism is FUNCSEL, and the more restrictive class for the engine is `iomux` because it does not promise free routing. This is judged undecidable between the two readings, so the rule 5 fallback applies; **flagged for the owner**. The engine consequence is low (PIO is available on every pad either way); a `matrix` tier penalty (ESP32-style lower max_hz) would be wrong for PIO.

## Auditor could-not-verify

- `electrical.pin_current_max` (above): became missing.
- `sources.newer_or_more_authoritative`: not a catalog field. Auditor found no newer revision (original URL returns the identical sha256), and keyword-searched the hardware design guide without finding a pad limit. Nothing stored.

## Extra audit facts not stored (no schema field or not a Fact)

- `electrical.input_leakage_max` 1 uA (Table 625): no schema field.
- `electrical.pin_drive_strength_default` 4 mA (Table 614): in the `pin_current_max` note only.
- `electrical.vdd_io` operating range 1.62-3.63 V: in the `vdd_io` note only (schema holds one number).
- `peripherals.clk_peri_max` 133 MHz (200 MHz at 1.15 V is outside the guaranteed spec): no matching field (`limits` take matrix/iomux max Hz facts only).
- Peripheral limits: SPI master 62.5 Mbit/s (slave ~11.083), I2C 100/400/1000 kbit/s (no high-speed), UART max UARTCLK/16 (7.8 Mbaud); no schema field for these in the chip file (limits.iomux_max_hz exists, but the datasheet gives chip-wide values only, so none stored; could be added later as Fact entries).
- `peripherals.PIO0/PIO1` (kind `pio`) and `peripherals.PWM` pad mapping: `kind` enum has no `pio`; PWM is kept as already present. PIO is represented through the per-pad `PIO0`/`PIO1` functions.
- `peripherals.*.iomux_pins`: the auditor's role-to-pad lists could not be stored (schema Record<role, PadId> holds one pad per role); they are equivalent to the per-pad functions (checked mechanically).
- `peripherals.ADC`: 12-bit, 500 ksps, ENOB 8.7. Auditor found an in-datasheet disagreement: Table 627 gives ADC input range 0..ADC_AVDD while the 4.9 note says the maximum is set by IOVDD; the most restrictive reading is min(IOVDD, ADC_AVDD). No ADC range field in the chip file (`adc_effective_range_mv` is not present); this supports the restrictive `abs_max_vin` for ADC pads.
- `disagreements.voltage_select_reference`: VOLTAGE_SELECT enum text says DVDD where 2.19.4 and Table 634 say IOVDD (apparent datasheet typo); IOVDD absolute max (3.63 V) equals the operating max, no margin. Informational.

## Per-pad summary (30 pads)

Columns: function count, input_only status, reset_state (status), strap (status), power_up_glitch (status), errata ids, ADC. All per-pad facts are verified.

| pad | functions | input_only | reset_state | strap | power_up_glitch | errata | ADC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GPIO0 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO1 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO2 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO3 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO4 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO5 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO6 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO7 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO8 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO9 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO10 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO11 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO12 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO13 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO14 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO15 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | RP2040-E5 | - |
| GPIO16 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO17 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO18 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO19 | 8 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO20 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO21 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO22 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO23 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO24 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO25 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | - | - |
| GPIO26 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | RP2040-E6, RP2040-E11 | ADC0 (radio_conflict False, verified) |
| GPIO27 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | RP2040-E6, RP2040-E11 | ADC1 (radio_conflict False, verified) |
| GPIO28 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | RP2040-E6, RP2040-E11 | ADC2 (radio_conflict False, verified) |
| GPIO29 | 9 | verified | pulldown (verified) | none (verified) | none (verified) | RP2040-E6, RP2040-E11 | ADC3 (radio_conflict False, verified) |
