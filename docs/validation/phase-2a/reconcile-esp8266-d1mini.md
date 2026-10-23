# ESP8266EX / LOLIN D1 mini V4.0.0 reconcile (task 2a.4)

Files edited: `catalog/chips/esp8266ex.yaml`, `catalog/modules/lolin-d1-mini-core.yaml`, `catalog/boards/lolin-d1-mini@V4.0.0.yaml`, `catalog/evidence/esp8266-hdg-v2.8.yaml` (claim `#vddpst-3v3` added), `catalog/evidence/esp8266-trm-v1.7.yaml` (claim `#quad-flash-6io` added). Evidence files `esp8266ex-ds-v7.1`, `lolin-d1-mini-v4-ug`, `lolin-d1-mini-v4-sch` unchanged (the auditor's locators equal existing claims). Inputs: researcher draft vs blind audit `docs/validation/phase-2a/audit-esp8266-d1mini.yaml` (94 facts: 81 found, 2 inferred, 11 could-not-verify). The comparison was mechanical (YAML parse of both sides, match by schema path, function names and units normalised): 127 comparison points (17 pad function sets, routing, input_only x 17, strap, electrical, peripherals, module, board, 16 connector pins), 7 differences, all listed below. The 17 per-pad function sets all matched. `pnpm catalog:validate`: 0 errors, 0 warnings (tail at the end).

## Counts (Facts per file)

| entity | verified | conflict | missing | single-source | total |
| --- | --- | --- | --- | --- | --- |
| esp8266ex (chip) before | 0 | 0 | 42 | 43 | 85 |
| esp8266ex (chip) after | 41 | 0 | 44 | 1 | 86 |
| lolin-d1-mini-core (module) before | 0 | 0 | 0 | 7 | 7 |
| lolin-d1-mini-core (module) after | 7 | 0 | 0 | 0 | 7 |
| lolin-d1-mini@V4.0.0 (board) before | 0 | 0 | 3 | 2 | 5 |
| lolin-d1-mini@V4.0.0 (board) after | 2 | 0 | 3 | 0 | 5 |

Chip total changed by +1: `electrical.internal_pull_ohm` was added as a `missing` fact (no value in any document, both keys searched). Board `status` stays `partially-verified` (the validator accepts it; three `missing` rail facts remain).

Chip after: 17 `input_only` (GPIO0-16) + 14 `strap: none` + vih/vil/voh/vol + pin_current_max + vdd_io + 4 peripheral limits (ADC range, HSPI 20 MHz, I2C 100 kHz, SPI 80 MHz) = 41 verified. 44 missing: reset_state x 18, power_up_glitch x 18, strap GPIO0/GPIO1/GPIO2/GPIO15, abs_max_vin, cumulative_current_max, internal_pull_ohm, TOUT radio_conflict. One `single-source` remains: `pads.TOUT.input_only` (see below).

## Mismatches and differences

| # | item | researcher | auditor | handling |
| --- | --- | --- | --- | --- |
| 1 | `pads.TOUT.input_only` (Fact) | true (Table 2-1 type I) | not recorded (read TOUT only for ADC facts) | not a value mismatch: only one key found it. Kept `single-source` with a note, NOT verified. Could be settled by a one-fact second read of Table 2-1 pin 6; if the owner prefers the strict gate it can be set `missing`. |
| 2 | `peripherals.HSPI.iomux_pins` | cs0/miso/mosi/sck only | adds HSPIHD = GPIO9, HSPIWP = GPIO10 | plain field. Auditor correct (DS Table 2-1 pins 18/19; the researcher's own per-pad functions list HSPI.HD/HSPI.WP). Added `hd: GPIO9`, `wp: GPIO10`. |
| 3 | module `bonded_pads` | 12 pads (GPIO6-11 excluded) | 18 pads (GPIO6-11 wired to the flash only) | plain field. Both are the same wiring; difference is modelling. Kept researcher's list (same as the ESP32 module records: flash-only pads live in `consumed`); header comment updated. |
| 4 | board `numbering.primary` | `label` | `gpio` | plain field. Header labels are 16, 14, 12, 13, 15, 5, 4, 0, 2 (equal to GPIO numbers) but also RST, A0, TX, RX, 3.3V, GND, VBUS; no D-labels exist in any document. Kept `label`; owner may switch to `gpio` (no engine effect expected, the numbers coincide). |
| 5 | J2 pin 1 (RST) | kind reset, no pad | pad EXT_RSTB | plain field; `reset` pins carry no `pad` in the schema (and EXT_RSTB is not a catalogue pad). Kept. |
| 6 | J2 pin 2 (A0) | kind gpio, pad TOUT | kind analog-ref, pad TOUT | plain field. `analog-ref` is meant for reference pins (AREF); A0 is an analog input and the validator requires a `gpio` pin to carry a pad that is bonded. Kept `gpio`/TOUT. |
| 7 | onboard SW1 reset button text | "RST net (EXT_RSTB and CHIP_EN, each with 12 kohm)" | RST = EXT_RSTB (pin 32) only; CHIP_EN (pin 7) only pulled up by R4, not routed to the button or a header | settled by re-reading the schematic figure: the auditor is right (CHIP_EN -> R4 -> +3V3 only; EXT_RSTB -> R7, RST net, SW1, C14). Researcher transcription error corrected in the board `onboard` effect text (plain field). |

No fact ended `conflict`: all differences were settled (items 2, 7), are plain modelling choices (3-6) or single-key (1).

Everything else matched: functions for GPIO0-16 (per pad, normalised names), routing class, input_only GPIO0-16 (false), electrical vih/vil/voh/vol (0.75/0.25/0.8/0.1 x VIO), IMAX 12 mA, vdd_io (3.3 V inside 1.8-3.6 V), ADC range 0-1.0 V, UART0/UART1/SPI/I2C/PWM role-to-pad maps, HSPI/I2C/SPI max clocks, consumed GPIO6-11 = flash, flash voltage 3.3 V, logic_voltage 3.3 V, 3V3 rail voltage 3.3 V (ME6211C33), J2/J3 pins 2-8 / 1-8 (position, label, kind, pad/rail; the auditor takes J2 = left, J3 = right by inference, the researcher the same), onboard parts LED1/R5 on GPIO2, CH340C on GPIO1/GPIO3, U5 UMH3N on GPIO0, R9/R10/R11, A0 divider R12 220k / R13 100k, JP1 + R14 on GPIO16, P1 I2C (GPIO4/GPIO5), flash U3.

## Verified facts

All 50 verified facts (41 chip, 7 module, 2 board) carry `reviewers: [hardware-researcher, hardware-fact-auditor]`, original evidence kept.
- Table 5-1 facts (vih_min, vil_max, voh_min, vol_max, pin_current_max, vdd_io) are marked `transcribed: true` (the auditor read the rendered table; the draft quotes are text-layer rows).
- `pin_current_max` 12 mA: verified as "the datasheet lists IMAX = 12 mA" (Table 5-1, I/O group, conditions '-'). Both keys found the same row; the note states the scope (per pin / per port, operating / absolute) is not stated in the document.
- `vdd_io` 3.3 V: verified as the typical operating point (Table 5-1 min 2.5 / typ 3.3 / max 3.6 V). Added claim `esp8266-hdg-v2.8#vddpst-3v3` (verbatim, quote re-checked against the PDF text) which documents the auditor's disagreement D-VDDPST. 3.3 V is inside the datasheet and the HDG range.
- `consumed.GPIO6-11 = flash` (module) and `flash_voltage` 3.3 V: both keys read the schematic figure (pad nets to U3, U3 VCC on +3V3 from ME6211C33): verified with `transcribed: true` (precedent). Added claim `esp8266-trm-v1.7#quad-flash-6io` (TRM §2.1, quote re-checked) to the six consumed facts as independent support. The flash part's own supply range is not stated (generic symbol 25Q-150MIL); the note says so.
- Peripheral limits: HSPI 20 MHz, I2C 100 kHz (software), ADC 0-1.0 V verified. SPI 80 MHz is the master value; both keys saw 20 MHz as slave (more restrictive when the chip is a slave); the note says so and the stored value stays 80 MHz (the SPI bus on this board is the flash bus, GPIO6-11, which are consumed).

## Negative findings and inferences (rule 4)

| fact | decision | basis |
| --- | --- | --- |
| `strap` = `none` for GPIO3-GPIO14, GPIO16 and TOUT (14 facts; GPIO0, GPIO1, GPIO2 and GPIO15 are the other four pads) | verified | both keys concluded no other pad is a strap from the same two statements (datasheet note after Table 2-1: "GPIO2, GPIO0, and MTDO are used to select booting mode"; HDG note: same three). Evidence list extended with `esp8266ex-ds-v7.1#boot-mode-note`. Note: "Negative finding: absence confirmed by two independent reads", and that the Pin List Strapping List sheet was not cross-checked. |
| `strap` GPIO1 | missing | both keys saw "U0TXD should not be pulled externally to a low logic level during the powering-up"; the schema cannot express "not low" and it is not called a strap; `none` would hide a boot-time restriction. Auditor recorded it as a pad limit only. |
| `power_up_glitch` (18 pads) | missing | both keys found no glitch statement, but no ESP8266 errata document exists (Espressif chip-errata site 404; the technical-documents search lists only the Pin List). Absence of a statement without an errata document is not a negative finding; the auditor explicitly says "do not record none". |
| auto-reset function of U5 UMH3N (auditor `inferred`) | plain field kept, text now says "function name inferred from the schematic figure" | both keys derived the same topology; no status exists on `onboard`. |
| JP1 normally-open (auditor `inferred`) | plain field kept, text now says "inferred from the symbol name JUMP_2_NO" | same. |
| `radio_conflict` TOUT | missing | documents say the two ADC uses are exclusive (both keys), but neither state nor deny a Wi-Fi conflict; auditor could-not-verify. |

## GPIO15 strap decision

Both keys found `required_at_reset: low` (HDG §1.4.7, `esp8266-hdg-v2.8#gpio15-low`, "needs to be at low-voltage level when the chip is powered on"): match. The schema's strap value is an object `{role, required_at_reset, default_pull}` and `default_pull` is a mandatory enum (`up|down|none`); no document states it (datasheet §4.1 only says pads can be *configured* with an internal pull-up; the auditor: could-not-verify). The draft stored `none` as a placeholder. Decision: **the whole fact is `missing`** (value null, evidence []). A placeholder would be a fabricated attribute on a field the engine reads, and no enum value is the provably restrictive one (`up` would be worse than `none` for a required-low pad but is equally undocumented). The finding is preserved in the note (required low, source claim ids, TRM caveat for the swapped-UART case, and the R11 12 kohm pull-down on the board schematic), so the engine shows a Caution for GPIO15 and a human sees the requirement. Schema gap to report: `default_pull` should be optional (or allow `unknown`), otherwise a datasheet-proven required level cannot be stored without an undocumented pull. When the Pin List (Strapping List) is downloaded, GPIO0/GPIO2/GPIO15 can be filled.

GPIO0 and GPIO2 stay `missing`: the researcher found no level; the auditor found only a board-level statement for the ESP-LAUNCHER dev board (HDG Table 2-1: GPIO0 switch low = UART download, high = flash boot), recorded in the GPIO0 note but not stored as a chip fact; GPIO2 level could-not-verify.

## Missing (both keys searched; Pin List not available)

reset_state x 18, power_up_glitch x 18, strap GPIO0/GPIO1/GPIO2/GPIO15, abs_max_vin (the datasheet has no absolute-maximum table; Table 5-1 VIH max 3.6 V and working voltage max 3.6 V are operating values), cumulative_current_max, internal_pull_ohm (new fact), TOUT radio_conflict; board: 3V3 max_current (ME6211 datasheet not a supplied source; the HDG 500 mA is the chip supply recommendation, not a board rating), VBUS voltage, VBUS max_current (5 V is a USB convention, not stated in the documents). Every note says the Espressif "ESP8266 Pin List" xls (sheets Strapping List, Register List, Buffer Sheet; linked from datasheet Appendix A) could not be downloaded automatically (the server returns the documentation-portal HTML shell) and is requested as a manual download (`sources/manual/README.md` is for the orchestrator to update).

## TOUT pad, gpio 17

`TOUT` is a catalogue-internal pad with `gpio: 17`; 17 is not a datasheet number (the chip has GPIO0-16 only, TOUT is pin 6). The schema needs a pad with a number to carry the ADC fact and to let the board header pin A0 resolve. Left as is; the chip header comment states it. Schema gap (report): pads that are not GPIOs (analog-only pins) need a pad id without a GPIO number, or `gpio` should be optional, and the A0 header pin should be `analog-ref`/`analog` kind instead of `gpio`.

## Connector comparison (J2 left, J3 right; position 1 at the antenna end)

All 16 pins compare equal in position, label, kind and pad/rail except J2-1 (auditor pad EXT_RSTB) and J2-2 (auditor kind `analog-ref`); see items 5 and 6. Labels kept as printed. Auditor alt labels (SCK on 14, MISO on 12, MOSI on 13, SCL on 5, SDA on 4, LED on 2) are in the board header comment (no schema field). D0-D8: no document maps D-labels (auditor: could-not-verify; the page mentions "D0" once, in "(except D0)"); none recorded.

## Auditor disagreements

- D-VDDPST (datasheet 1.8-3.6 V vs HDG 1.8-3.3 V): in the `vdd_io` note, claim added; no stored value affected.
- D-WORKING-V (Table 5-1 min 2.5 V vs section 4.9 "between 1.8 V and 3.6 V"): in the `vdd_io` note.
- D-SDIO-D2-SERIES-R (DS 20 ohm vs HDG 200 ohm on GPIO9): not a stored fact. The existing claim `esp8266ex-ds-v7.1#pin-gpio9` quotes the DS verbatim ("Series R: 20 Ω"); report only (probable datasheet typo, irrelevant to pin choice).
- D-PWM (DS four PWM outputs vs HDG three-channel application example): `peripherals.PWM` keeps the datasheet's four channels (plain field); report only.
- D-GPIO-COUNT (17 vs 16 GPIOs; GPIO16 is on the RTC block), D-SPI-COUNT, D-STRAP-WORDING, D-BOARD-VS-CHIP-A0 (3.2 V at A0 = 1.0 V at TOUT through R12/R13, consistent), D-D-LABELS: no stored fact affected.
- Auditor extras not stored (no field): ESD HBM 2 kV / CDM 0.5 kV, reset/CHIP_EN timing (below 0.6 V for 200 us), UART max 4.5 Mbaud, I2S/IR/SDIO-slave pin maps, crystal 26 MHz (74880 baud boot log), flash size 4 MB, GPIO16 pull-down-only / other pads pull-up-only (in `internal_pull_ohm` note), clock 80/160 MHz.

## Per-pad summary (chip pads)

All facts below verified unless stated. `strap` GPIO0/1/2/15 missing; reset_state and power_up_glitch missing on every pad.

| pad | functions | input_only | strap | reset_state | power_up_glitch | module / board |
| --- | --- | --- | --- | --- | --- | --- |
| GPIO0 | GPIO, SPI.CS2 | false | missing | missing | missing | J3-5 "0"; R9 12k pull-up; auto-reset |
| GPIO1 | GPIO, UART0.TXD, SPI.CS1 | false | missing | missing | missing | J3-1 "TX"; CH340C via R8 470 |
| GPIO2 | GPIO, UART1.TXD, I2C.SDA, I2S.O_WS | false | missing | missing | missing | J3-6 "2"; LED1 (low = on); R10 12k pull-up |
| GPIO3 | GPIO, UART0.RXD, I2S.O_DATA | false | none | missing | missing | J3-2 "RX"; CH340C |
| GPIO4 | GPIO, PWM3 | false | none | missing | missing | J3-4 "4" (SDA tag); P1 |
| GPIO5 | GPIO, IR.RX | false | none | missing | missing | J3-3 "5" (SCL tag); P1 |
| GPIO6-GPIO11 | GPIO + SDIO/SPI/HSPI flash functions | false | none | missing | missing | consumed = flash (verified), not led out |
| GPIO12 | GPIO, HSPI.MISO, I2S.I_DATA, PWM0 | false | none | missing | missing | J2-5 "12" |
| GPIO13 | GPIO, HSPI.MOSI, UART0.CTS, I2S.I_BCK | false | none | missing | missing | J2-6 "13" |
| GPIO14 | GPIO, HSPI.CLK, I2C.SCL, I2S.I_WS, PWM2, IR.TX | false | none | missing | missing | J2-4 "14" |
| GPIO15 | GPIO, HSPI.CS, UART0.RTS, I2S.O_BCK, PWM1 | false | missing (low at power-on found by both keys; default_pull undocumented) | missing | missing | J2-7 "15"; R11 12k pull-down |
| GPIO16 | GPIO, XPD_DCDC (deep-sleep wake) | false (RTC pad, no interrupt) | none | missing | missing | J2-3 "16"; JP1/R14 to RST |
| TOUT (internal gpio 17) | ADC (fixed) | true (single-source) | none | missing | missing | J2-2 "A0" via R12 220k / R13 100k; radio_conflict missing |
