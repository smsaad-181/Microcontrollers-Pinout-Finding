# ESP32 chip reconcile (task 2a.4)

Files edited: `catalog/chips/esp32.yaml` (re-emitted by script, same formatting; round-trip of the untouched file was byte-identical) and `catalog/evidence/esp32-ds-v5.3.yaml` (one claim added, `gpio2-download-boot-low`). The other chip-level evidence files (TRM, errata, the two ESP-IDF pages) needed no change: every auditor locator equals an existing claim. Inputs: researcher draft vs blind audit `docs/validation/phase-2a/audit-esp32.yaml` (458 facts). The comparison was mechanical (YAML parse of both sides, match by schema path, HSPI*/VSPI*/U0-2*/MT* names mapped to SPI2/SPI3/UARTn/JTAG, role/enum spellings normalised): all 34 pads x {functions, input_only, reset_state, strap, power_up_glitch, adc, dac, touch, jtag, errata}, all electrical facts, vdd_io, and the peripheral pin/limit/range figures. Differences found: 16 errata lists, 9 reset_state (during vs after reset), 6 strap (4 are wording only), 6 function names, 1 electrical (`abs_max_vin`); everything else matched exactly.

## Counts (168 Facts in the chip file)

| status | before | after |
| --- | --- | --- |
| verified | 0 | 155 |
| conflict | 1 | 11 |
| missing | 1 | 2 |
| single-source | 166 | 0 |

Conflicts after: GPIO4 strap (kept), GPIO2 strap (new), reset_state on 9 pads (new). Missing: `pin_current_max`, `abs_max_vin`.

`pnpm catalog:validate`: 0 errors, 0 warnings in 21 files (whole catalog; the three board files show `partially-verified`, no board-status error).

## Pad set (rule 9)

Auditor 34 pads = researcher 34 pads: GPIO0-19, 21, 22, 23, 25, 26, 27, 32-39. No difference. GPIO20/24/28-31 do not exist (TRM 6.1; GPIO20 exists only on ESP32-PICO-V3/V3-02, not in the source set, not modelled).

## Mismatches and conflicts

1. **GPIO4 `strap` (task 2a.6, known conflict, kept).** Readings: `none` (datasheet Table 3-1 lists five straps GPIO0, GPIO2, MTDI, MTDO, GPIO5; claims `strap-default-config`, `five-strapping-gpios`) and a strap bit (TRM Register 6.13 GPIO_STRAP_REG: "Bit5-bit0 of boot_sel_chip[5:0] correspond to MTDI, GPIO0, GPIO2, GPIO4, MTDO, GPIO5"; claim `esp32-trm-v5.8#gpio-strap-reg`; default pull down from TRM Table 6.10-1 reset code 2). Active = the TRM reading (treat as strap, restrictive). The TRM states no required level and no boot function for GPIO4, so `required_at_reset: any` is only the schema's non-committal enum value (the enum has low/high/any only) and the role text says "effect not documented"; nothing was invented. The auditor independently found the same disagreement and recorded `none` per the datasheet (confidence inferred) with the conservative note "strap-sampled, no documented function"; both readings carry evidence claims.
2. **GPIO2 `strap` (new conflict).** Researcher `required_at_reset: any`, auditor `low`; same default pull (down), same table. Datasheet Table 3-3: SPI Boot needs GPIO0 = 1 and GPIO2 = any value; Joint Download Boot needs GPIO0 = 0 and GPIO2 = 0. The researcher gave the normal-boot level (consistent with GPIO0 = `high`), the auditor the download level. Both are faithful readings and the schema holds one level, so conflict. Active = `low` (restrictive: holding GPIO2 high at reset blocks download boot). Claim added for the auditor's reading: `esp32-ds-v5.3#gpio2-download-boot-low` (Table 3-3, p. 23, quote "Joint Download Boot Mode"; the table's cell values are in the supports text because the PDF text layer scrambles the table cells).
3. **`reset_state` on GPIO13, 14, 16, 17, 18, 19, 21, 22, 23 (new conflicts)** - see the reset-state decision below.
4. **`electrical.abs_max_vin`**: researcher `VDDIO+0.3` (derived from VIH max), auditor could-not-verify: became `missing` (see below).
5. Strap role-text-only differences on GPIO0, GPIO5, GPIO12, GPIO15: same default pull and same required level; wording differs ("Joint Download Boot" capitalisation, "SDIO-slave timing (with MTDO)", the explicit LDO levels). Treated as a match; researcher wording kept. All four verified.
6. Function-name differences (not Facts): GPIO17 `EMAC_CLK_180` (researcher, from TRM Table 6.10-1) vs `EMAC_CLK_OUT_180` (auditor, datasheet IO_MUX table): the two manuals print different names for the same IO_MUX function 5; researcher's TRM spelling kept (file header says "other names kept as printed"). GPIO36-39 `ADC_H` (researcher, TRM Table 6.11-1 analog function 0 of the four high-input ADC1 pads, kept as printed, routing `fixed`) is not listed by the auditor: kept. The auditor's "RTC I2C SDA/SCL" and `RTC_GPIOn` entries match the researcher's `RTC_I2C_*` / `RTC_GPIOn`.
7. **Errata lists (plain lists, not Facts), 16 differences, none applied.**
   - Auditor adds `ULP-3.19` ("ULP coprocessor and touch sensors cannot be used in deep-sleep if RTC_PERIPH is powered up") on the touch pads GPIO0, 2, 4, 12, 13, 14, 15, 27, 32, 33 (10 pads; auditor confidence inferred; the erratum names touch sensors, not pads). Not added: it concerns the touch function in deep-sleep only, and the erratum names no pad. Owner may add it to those 10 pads if wanted.
   - Researcher has `GPIO-3.6` on GPIO34-39 (6 pads) which the auditor omitted because input-only pads have no pull circuitry. Kept (the erratum text says "pads with both GPIO and RTC_GPIO functionality", which these pads literally are; the effect is moot because they have no pulls). Owner may drop it from those 6 pads.
   - `GPIO-3.14` (all pads) and `GPIO-3.11` (GPIO36, GPIO39) agree on every pad.

## Negative-finding decisions (rule 4)

| fact | count | decision | basis |
| --- | --- | --- | --- |
| `pads.*.strap` = none | 28 (GPIO4 excluded, conflict above) | verified | both keys concluded none; positive support: datasheet Table 3-1 lists exactly five strapping pins (cited via `strap-default-config`). TRM Register 6.13 lists six bits but only GPIO4 is outside Table 3-1, handled as the conflict. Note: "negative finding: absence confirmed by two independent reads". |
| `pads.*.power_up_glitch` = none | 34 | verified | researcher: errata GPIO category (GPIO-3.6, 3.14, 3.11) and datasheet; auditor: errata Table 2.1 (all sections 3.1-3.33), datasheet text search for glitch/spurious. Bases do not differ materially. The note states that the auditor did not independently search the TRM for glitches (its note mentions the TRM but records no search); at reconcile time a pdftotext search of the TRM found "glitch" only in UART/I2C/PCNT input filters. No positive statement exists: it rests on absence. RES-3.1/RES-3.8 (spurious watchdog reset at power-up) and GPIO-3.11 (80 ns pull-down on GPIO36/39 when ADC powers on) are not pad power-up glitches and are not recorded as such. |
| `pads.GPIO32-39.adc.radio_conflict` = false | 8 | verified, weak basis stated | both keys read it from absence: TRM 31.3.1 and the ESP-IDF ADC oneshot page name only ADC2 as shared with Wi-Fi (auditor confidence inferred). Note says plainly that no document states ADC1 is conflict-free. Owner may downgrade to missing. |
| `pads.*.adc.radio_conflict` = true (ADC2 pads GPIO0, 2, 4, 12-15, 25-27) | 10 | verified | positive statement: TRM p. 741 "If Wi-Fi module is using the SAR ADC2, users can not measure the analog signal from the pins using SAR ADC2." and ESP-IDF "ADC2 is also used by Wi-Fi.". |

TRM ADC2 note disagreement (auditor): the TRM p. 742 note lists strapping pins among ADC2 pads as "GPIO0, GPIO2, and GPIO15" and omits GPIO12/MTDI (also a datasheet Table 3-1 strap and an ADC2 pad). No fact changes: GPIO12 is recorded as a strap (low, default down, verified) and `radio_conflict` true regardless. Report note only.

## Reset-state decision (rule 6)

Schema: `reset_state` = "State at reset". The datasheet IO_MUX table (Appendix A.3, p. 69) has two columns, "At Reset" and "After Reset"; the TRM Table 6.10-1 "Reset" column is "each pin's default configurations after reset" and matches the datasheet After Reset column (auditor and researcher both confirmed). They are identical for 25 pads. For GPIO13, 14, 16, 17, 18, 19, 21, 22, 23, At Reset is `oe=0, ie=0` (input disabled, no pull) while After Reset is wpd (GPIO13), wpu (GPIO14) or `ie=1` no pull (GPIO16-19, 21-23).

Both keys read the same table; the primary values agree (both gave the After Reset state), but the auditor recorded the At Reset state as a separate fact (`reset_state_during_reset`) and the researcher only in a note. The literal schema meaning ("at reset") is the At Reset column, so for those 9 pads the fact is a `conflict`: readings `[disabled (datasheet At Reset), pulldown/pullup/input (TRM Reset column and datasheet After Reset)]`, active = `disabled`: while reset is asserted the pad is a floating input with no pull, the least defined state and the restrictive one for loads that need a defined level. For the 25 other pads At Reset equals After Reset and the fact is verified. Evidence reuses the researcher's per-pad claims `esp32-ds-v5.3#iomux-reset-gpioNN` (their quotes already contain both columns) and the TRM claims; no new claims needed.

**Flagged for owner:** this makes common pins GPIO16-19, 21-23 (SPI3, I2C defaults, PSRAM lines) carry a conflict/Caution. If the owner prefers `reset_state` to mean "state after reset (firmware start)", revert these 9 facts to verified with the After Reset value (one-line change each; the notes already carry both states).

## Routing-class decision (rule 7)

Researcher and auditor agree on the class of every function on all 34 pads (0 differences after name normalisation, apart from the 3 name differences listed above): `GPIO` = `matrix`; IO_MUX functions 0-5 other than GPIO (CLK_OUT*, EMAC_*, HS1_*/HS2_*/SD_*, SPI*/HSPI*/VSPI*, U0-2*, MT*) = `iomux`; analog/RTC/touch/DAC/ADC/XTAL_32K functions from TRM Table 6.11-1 = `fixed`. The auditor also lists a catch-all "all matrix-routable peripheral input and output signals" `matrix` item per pad; the researcher models that once at peripheral level (`peripherals.*.matrix_routable: true` for I2C0/I2C1/SPI2/SPI3/UART0-2, false for ADC1/ADC2) instead of repeating it per pad. Dual routing is modelled by `iomux_pins` (dedicated IO_MUX pad per role, equal to the auditor's lists for SPI2, SPI3 and UART0-2: 6/6) plus `limits.iomux_max_hz` (80 MHz) and `limits.matrix_max_hz` (40 MHz) on SPI2/SPI3; there are no per-function `max_hz` facts. This promises no more than the sources do (UART/I2C have no stored limits because the datasheet gives none per routing class). Kept as is.

## Auditor could-not-verify (rule 3)

- `electrical.abs_max_vin`: now `missing` (`value: null`, `evidence: []`). Datasheet Table 5-1 has only supply-pin rows (VDDA, VDD3P3, VDD3P3_RTC, VDD3P3_CPU, VDD_SDIO allowed input voltage -0.3 to 3.6 V), cumulative IO output current and storage temperature; no per-GPIO row (reconciler re-read Table 5-1 in the PDF text). The researcher's `VDDIO+0.3` is VIH max from Table 5-3, an operating limit; kept only as context in the note.
- `electrical.pin_current_max`: stays `missing` (the researcher already had it missing, the auditor agrees). Note extended with the auditor's typical/test values: IOH 40 mA (VDD3P3_CPU/RTC, falling to about 29 mA with many pins sourcing) and 20 mA (VDD_SDIO), IOL 28 mA at maximum drive strength, drive-strength steps 0..3 about 5/10/20/40 mA (default 2), and that revision history V1.4 mentions an older "maximum driving capability 80 mA" row that is gone in v5.3. Engine consequence: current-limit checks show Caution for ESP32 pads; the only hard limit is `cumulative_current_max` 1200 mA (verified).

## Verified (match) decisions worth noting

- `vdd_io` 3.3 V: verified as the recommended single-supply voltage and the operating point of the electrical facts; the auditor also read per-domain ranges (VDD3P3_CPU 1.8-3.6 V; VDDA/VDD3P3/VDD3P3_RTC/VDD_SDIO 2.3, or 3.0 with in-package 3.3 V flash/PSRAM, to 3.6 V): note only, the schema holds one number.
- `vih_min`/`vil_max`/`voh_min`/`vol_max` (VDD*0.75 / 0.25 / 0.8 / 0.1), `cumulative_current_max` 1200 mA, `internal_pull_ohm` typ 45 kohm: identical values, auditor `found`.
- `peripherals.ADC1.adc_effective_range_mv` (atten 0..3: 100-950, 100-1250, 150-1750, 150-2450 mV): identical.
- `peripherals.SPI2/SPI3.limits.iomux_max_hz` 80 MHz and `matrix_max_hz` 40 MHz: both keys read the ESP-IDF SPI master page. The auditor flagged that TRM 20.4 states the master maximum as fapb/2 (40 MHz) yet also allows fapb (80 MHz) with SPI_CLK_EQU_SYSCLK = 1 and the datasheet gives no figure. Same value on both sides, so verified, with the TRM wording noted in each fact.
- Per-pad `input_only` (GPIO34-39 true, others false), `adc` unit/channel (ADC1 CH0-7 on GPIO36, 37, 38, 39, 32, 33, 34, 35; ADC2 CH0-9 on GPIO4, 0, 2, 15, 13, 12, 14, 27, 25, 26), `dac` (GPIO25/26), `touch` (T0-T9), `jtag` (MTDI/MTCK/MTMS/MTDO on GPIO12-15), `gpio` numbers: all match.

## Extra audit facts not stored (no schema field or not a Fact)

- `pads.*.power_domain` (VDD3P3_CPU / VDD3P3_RTC / VDD_SDIO per pad, datasheet A.4): no schema field.
- Typical IOH/IOL, drive-strength steps (`electrical.pin_source_current_typ`, `pin_sink_current_typ`, `drive_strength_steps`): `pin_current_max` note only.
- `electrical.vdd_io_reset_chip_pu` (VIL_nRST max 0.6 V, VIH_nRST min 0.75 VDD): no field.
- `peripherals.SPI.slave_max_hz` (10 MHz IO_MUX, about 6.7 MHz matrix), `SPI.controllers` (SPI0/1 flash, SPI2 HSPI, SPI3 VSPI), `UART.max_baud` 5 Mbaud, `I2C` speeds (100/400 kbit/s, up to 5 MHz limited by pull-up), `PWM` (LEDC 16 channels, MCPWM 2 units; auditor `disagreements.pwm_resolution`: datasheet 4.8.8 says 20-bit while Table 4-6 says 16-bit duty accuracy), `APB_CLK` 80 MHz, `ADC.pad_input_limit` (RTC-domain pads must follow Table 5-3 DC levels), `DAC` 8 bit, TOUCH list: no matching fields (`kind` enum has no pwm limit fields).
- `pads.VDD_SDIO.voltage` (6 ohm from VDD3P3_RTC at 3.3 V, or internal 1.8 V LDO max 40 mA, 1.65-2.0 V; selected by MTDI): no field; strap role text covers the selection.
- `pads.GPIO16/17.psram_*`, `pads.GPIO6-11.flash_note`, `chip.gpio20`, `chip.pad_power_domain_note` (TRM Figure 6.1-2 says "all 31 GPIO pins" vs 34 elsewhere; TRM typo), `disagreements.uart_pins` (matrix vs IO_MUX both true), `sources.newer` (none; re-downloaded hashes identical, errata v3.1 is the newest): informational, not catalog fields. Module-level PSRAM/flash pad use belongs to the module/board reconcile.

## Per-pad summary (34 pads)

Columns: function count, input_only, reset_state, strap (required level / default pull), power_up_glitch, errata, ADC (rc = radio_conflict). Status in parentheses.

| pad | functions | input_only | reset_state | strap | power_up_glitch | errata | ADC |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GPIO0 | 7 | false (verified) | pullup (verified) | high/up (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH1 rc=true (verified) |
| GPIO1 | 4 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO2 | 8 | false (verified) | pulldown (verified) | low/down (conflict: any vs low) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH2 rc=true (verified) |
| GPIO3 | 3 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO4 | 9 | false (verified) | pulldown (verified) | any/down (conflict: none vs TRM strap) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH0 rc=true (verified) |
| GPIO5 | 4 | false (verified) | pullup (verified) | any/up (verified) | none (verified) | GPIO-3.14 | - |
| GPIO6 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO7 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO8 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO9 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO10 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO11 | 5 | false (verified) | pullup (verified) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO12 | 9 | false (verified) | pulldown (verified) | low/down (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH5 rc=true (verified) |
| GPIO13 | 9 | false (verified) | disabled (conflict: disabled vs pulldown) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH4 rc=true (verified) |
| GPIO14 | 9 | false (verified) | disabled (conflict: disabled vs pullup) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH6 rc=true (verified) |
| GPIO15 | 10 | false (verified) | pullup (verified) | any/up (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH3 rc=true (verified) |
| GPIO16 | 4 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO17 | 4 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO18 | 3 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO19 | 4 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO21 | 3 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO22 | 4 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO23 | 3 | false (verified) | disabled (conflict: disabled vs input) | none (verified) | none (verified) | GPIO-3.14 | - |
| GPIO25 | 5 | false (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH8 rc=true (verified) |
| GPIO26 | 5 | false (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH9 rc=true (verified) |
| GPIO27 | 5 | false (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC2_CH7 rc=true (verified) |
| GPIO32 | 5 | false (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH4 rc=false (verified, from absence) |
| GPIO33 | 5 | false (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH5 rc=false (verified, from absence) |
| GPIO34 | 3 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH6 rc=false (verified, from absence) |
| GPIO35 | 3 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH7 rc=false (verified, from absence) |
| GPIO36 | 4 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14, GPIO-3.11 | ADC1_CH0 rc=false (verified, from absence) |
| GPIO37 | 4 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH1 rc=false (verified, from absence) |
| GPIO38 | 4 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14 | ADC1_CH2 rc=false (verified, from absence) |
| GPIO39 | 4 | true (verified) | disabled (verified) | none (verified) | none (verified) | GPIO-3.6, GPIO-3.14, GPIO-3.11 | ADC1_CH3 rc=false (verified, from absence) |
