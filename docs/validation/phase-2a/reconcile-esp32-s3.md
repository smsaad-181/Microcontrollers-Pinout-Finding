# Reconcile report - ESP32-S3 chip (task 2a.4)

Written by the orchestrator from the catalog-author agent's hand-off (the agent's Write tool refused to
create report files). Inputs: researcher draft `catalog/chips/esp32-s3.yaml`; blind audit
`docs/validation/phase-2a/audit-esp32-s3.yaml` (361 facts: 356 found, 1 inferred, 4 could-not-verify).
Edited: `catalog/chips/esp32-s3.yaml`; one claim added to `catalog/evidence/esp32-s3-trm-v1.8.yaml`
(`esp32-s3-trm-v1.8#gpio-all-in-out`, TRM p.472). The comparison was mechanical (both sides parsed,
matched by schema path, function names normalised). Both keys agree on the pad set: 45 pads
(GPIO0-21, GPIO26-48; GPIO22-25 do not exist) and on every function list and routing class.

## Counts (214 facts in the chip file)

| status | before | after |
| --- | --- | --- |
| verified | 0 | 186 |
| conflict | 1 | 22 |
| missing | 2 | 6 |
| single-source | 211 | 0 |

`pnpm catalog:validate` exits 0 for the whole catalog.

## Conflicts (22)

1. `reset_state` on GPIO9-14, 17, 18, 33-42 (18 new). Datasheet Table 2-1 "At Reset" is blank (disabled); "After
   Reset" is input enabled (GPIO39: pull-up when EFUSE_DIS_PAD_JTAG = 0). The researcher stored At Reset
   (`disabled`), the auditor stored After Reset (`input`/`pullup`); the TRM RST column matches After Reset. Active
   = `disabled` (floating, restrictive), following the ESP32 precedent (`reconcile-esp32.md`). Owner flag: if
   `reset_state` should mean the state after reset, revert these 18 to verified with the After Reset value.
2. `pads.GPIO43.reset_state` (kept). Datasheet: WPU + IE (pull-up input) at and after reset. TRM Table 6.12-1 RST
   code 4: OE = 1, WPU = 1 (no output level stated; `output-high` is the nearest enum value). Active
   `output-high`; the auditor recorded the same disagreement.
3. `power_up_glitch` on GPIO18, 19, 20 (3 new). Datasheet Table 2-2: GPIO18 low and high glitch (60 us each); GPIO19
   low plus high (footnote 2); GPIO20 pull-down plus high (footnote 2). Footnote 2: "The total duration for the
   glitches and the delay are 3.2 ms and 2 ms respectively for GPIO19 and GPIO20" (mapping ambiguous). The two
   keys stored different values, so each is a conflict; active = the output-high glitch with the longest window
   (GPIO18 high 60 us; GPIO19 and GPIO20 high 3.2 ms). The GPIO20 pull-down glitch cannot be stored (schema level
   is high or low).

## Missing (6)

`electrical.abs_max_vin` (Table 5-1 has supply-pin rows only; VIH max VDD + 0.3 V is an operating limit),
`electrical.pin_current_max` (only typical/default values: IOH 40 mA, IOL 28 mA typ at PAD_DRIVER = 3; default drive
strengths 10/20/40 mA), `pads.GPIO43.strap` and `pads.GPIO43.power_up_glitch` (the audit has no per-pad record for
GPIO43; the researcher's `none` is in the note; the audit's other 44 records imply `none` - owner may accept it),
`peripherals.SPI2.limits.matrix_max_hz` and `SPI3` (ESP-IDF only says matrix routing "behaves the same" up to
40 MHz, which is an equivalence point, not a stated maximum; the auditor recorded null).

## Negative findings and other decisions

| fact | count | decision |
| --- | --- | --- |
| `strap` = none | 40 | verified: both keys concluded none; positive support datasheet Table 3-1 and TRM 8.1 list exactly four straps (GPIO0, 3, 45, 46) |
| `strap` = none on GPIO1, GPIO2 | 2 | verified, caveat kept: TRM Table 8.2-1 footnote 2 says they are not straps but must be reserved for SPI Download Boot (GPIO0 = 0, GPIO46 = 1, GPIO1 = 1, GPIO2 = 0); no level stored |
| `power_up_glitch` = none | 24 | verified: both keys found nothing in Table 2-2 or the errata (all 8 read); the note says absence is not an explicit "no glitch" statement |
| `power_up_glitch` low 60 us | 17 | verified (GPIO1-17 incl. XTAL_32K_P/N) |
| ADC1 `radio_conflict` = false | 10 | verified, weak basis stated (absence; only ADC2 is named as shared with Wi-Fi) |
| ADC2 `radio_conflict` = true | 10 | verified (datasheet p.59, ESP-IDF "ADC2 is also used by Wi-Fi") |
| strap GPIO0 high/up, GPIO46 any/down, GPIO45 low/down, GPIO3 any/none | 4 | verified; no level invented (`any` and `low` are the schema enum values) |
| GPIO19 reset `disabled`, GPIO20 reset `pullup` (USB_PU) | 2 | verified; TRM RST code 0 omits the USB pull-up (not contradictory); owner flag: a stricter reading would make GPIO20 a conflict with active `disabled` |
| SPI `iomux_max_hz` 80 MHz | 2 | verified (datasheet 4.2.1.5; no separate IO MUX / matrix limit is given) |
| SPI2 `iomux_pins` | 1 | equals the auditor's first set and the ESP-IDF table; the datasheet's second FSPI set on GPIO33-38 is carried in the per-pad function lists only (one pad per role in the schema) |
| ADC effective ranges (ATTEN0..3: 0-850 / 0-1100 / 0-1600 / 0-2900 mV) | 1 | verified |

Electrical facts verified (identical on both sides): `vih_min` VDD x 0.75, `vil_max` VDD x 0.25, `voh_min` VDD x 0.8,
`vol_max` VDD x 0.1, `cumulative_current_max` 1500 mA, `internal_pull_ohm` typ 45 kohm, `vdd_io` 3.3 V.
`input_only` is false on all 45 pads (verified; claim `gpio-all-in-out` added).

## Open items for the owner

- Errata lists (plain lists, not facts): the researcher keeps ADC-183 on GPIO11-20 and USBOTG-4289 on GPIO19/20; the
  auditor has empty lists. By the same logic TOUCH-100 would apply to the touch pads GPIO1-14 - either drop the pad
  entries or add TOUCH-100 (one line per pad). Listed in the STATE "Later" section.
- The audit's extra facts with no schema field (supply absolute maximum, input leakage, CHIP_PU thresholds, VDD_SPI
  resistance, default drive strength, per-pad power domains, SPI slave 60 MHz, UART 5 Mbit/s, I2C speeds, USB and
  JTAG pad maps, flash/PSRAM pad lists, the ATTEN to dB mapping) are not stored.
- The audit's sources note: no newer revision found; the "ESP32-S3 Consolidated Pin Overview" and the Hardware Design
  Guidelines were not consulted.
