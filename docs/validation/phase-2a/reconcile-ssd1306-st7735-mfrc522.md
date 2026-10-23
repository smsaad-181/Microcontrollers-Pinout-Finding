# SSD1306 / ST7735S / MFRC522 and breakouts reconcile (task 2a.4)

Files edited: `catalog/ics/{ssd1306,st7735s,mfrc522}.yaml`, `catalog/breakouts/{ssd1306-128x64-i2c-4pin,st7735s-1.8-spi-tft,rfid-rc522-blue}.yaml` (missing-fact notes and header comments only), `catalog/evidence/{ssd1306-ds-v1.1,mfrc522-ds-v3.9,st7735-ds-v2.1}.yaml` (claims added), `catalog/evidence/st7735-ds-v1.9.yaml` (header comment only), NEW `catalog/evidence/st7735s-ds-v1.3-mirror.yaml`. Inputs: researcher draft vs blind audit `audit-ssd1306-st7735-mfrc522.yaml` (40 facts: 34 found, 1 inferred, 5 could-not-verify). The auditor's ST7735S V1.3 copy was located by SHA-256 in the scratchpad; every stored value was re-read in the PDF text (SSD1306 p14, p47-48; MFRC522 p74-79; ST7735S V1.3 p23-24, p28-30, p35-37, p46; ST7735 V2.1 p19, p25) and Table 7-1 was also checked on a rendered image. Files were re-emitted with PyYAML block style, sorted keys (not byte-identical to the hand-written flow-style originals: comments inside the body, flow lists and quoting changed; header comments kept and updated). `pnpm catalog:validate`: 0 errors, 0 warnings.

## ST7735S: unofficial mirror evidence (decision needed)

The ST7735S facts now cite `st7735s-ds-v1.3-mirror`: the real ST7735S datasheet Version 1.3 (2012/06, 201 pages) from a THIRD-PARTY MIRROR (https://www.makerguides.com/wp-content/uploads/2025/01/ST7735S-Datasheet.pdf), SHA-256 `332320d2...8c46ac`. It is not the Sitronix-hosted file; its provenance is unverified. The record is `secondary: true`, `manual: false`, publisher "Sitronix Technology Corp. (document hosted by makerguides.com, not the publisher)". No ST7735S fact is `verified`. The project owner can either accept this copy as the ST7735S source or download the official PDF (manual-download request 2); until then the facts stay `interim` / `conflict`. Two ST7735S values differ materially between the part-specific V1.3 and the ST7735 V2.1 (see conflicts), so the official file is worth fetching.

## Counts (Facts per file)

| entity | verified | conflict | interim | missing | single-source |
| --- | --- | --- | --- | --- | --- |
| ssd1306 before | 0 | 0 | 0 | 1 | 7 |
| ssd1306 after | 7 | 0 | 0 | 1 | 0 |
| st7735s before | 0 | 0 | 7 | 1 | 0 |
| st7735s after | 0 | 3 | 4 | 1 | 0 |
| mfrc522 before | 0 | 0 | 0 | 1 | 8 |
| mfrc522 after | 8 | 0 | 0 | 1 | 0 |
| ssd1306-128x64-i2c-4pin before / after | 0 | 0 | 0 | 5 | 0 |
| st7735s-1.8-spi-tft before / after | 0 | 0 | 0 | 3 | 0 |
| rfid-rc522-blue before / after | 0 | 0 | 0 | 3 | 0 |

No `single-source` fact is left in these six files.

## Mismatches and conflicts (ST7735S; all others matched)

| # | fact | reading A (ST7735 V2.1, related part, researcher) | reading B (ST7735S V1.3 mirror, auditor) | active |
| --- | --- | --- | --- | --- |
| 1 | `vdd_range` | 2.6-3.3 V (p19) | 2.5 / 2.75 / 4.8 V (p29, Table 2) | [2.6, 3.3] (narrower, inside both) |
| 2 | `vio_range` | 1.65-3.3 V (p19) | 1.65 / 1.8 / 3.7 V (p29) | [1.65, 3.3] |
| 3 | `supply_current` (IDD, normal mode) | typ 0.5 / max 0.7 mA (p21) | typ 0.9 / max 2 mA (p30, Table 3) | {typ 0.9, max 2} mA (higher current) |

Each conflict has both readings with evidence ids and a note explaining the choice; `value` equals `active`.

Differences that are NOT stored as separate facts (put in the notes of the nearest fact instead):
- VDD absolute maximum 4.8 V (V1.3) vs 4.6 V (V2.1); VDDI 4.6 V in both. The stored `input_abs_max` is VIN = -0.3 to VDDI + 0.3 V, identical in both, so it stays `interim` with the supply-pin difference in its note (claim `#abs-max-supply` added). Judgement call: the instruction listed VDD abs max as differing, but the catalog field holds the pin-input rating only.
- SCL write pulse width min 15 ns (V1.3, claim `#serial-write-pulse-4line`) vs 30 ns (V2.1, new claim `st7735-ds-v2.1#serial-write-pulse-4line`). The stored `tscyc_min_s` (TSCYCW 66 ns, both documents, both 3-line and 4-line) agrees and stays `interim`; the pulse widths are in its note.

ST7735S facts that agree and stay `interim` with the "second independent read agrees (...)" note: `input_abs_max`, `tscyc_min_s`, `logic_levels.vih_min` (0.7 VDDI), `logic_levels.vil_max` (0.3 VDDI). The auditor also found VOH min 0.8 VDDI, VOL max 0.2 VDDI (not stored by the researcher: no change, not added).

## Verified (reviewers hardware-researcher + hardware-fact-auditor)

- ssd1306 (7): `input_abs_max` VDD+0.3 (Table 11-1 p47), `vih_min` 0.8 VDD, `vil_max` 0.2 VDD, `vdd_range` and `vio_range` 1.65-3.3 V (Table 12-1 p48; claim `#dc-vdd-condition` added for vio), SPI `tscyc_min_s` 100 ns (Tables 13-4/13-5), `supply_current` ICC typ 0.43 / max 0.78 mA. The auditor rated its own IDD read (50/150 uA) medium reliability because of extra contrast cells in the row; only the ICC pair is stored, which both keys found with confidence.
- mfrc522 (8): `input_abs_max` VDD(PVDD)+0.5, `vih_min`, `vil_max`, `vdd_range` 2.5-3.6 V, `vio_range` 1.6-3.6 V, `supply_current` TVDD typ 60 / max 100 mA, SPI `max_hz` 10 000 000 Hz, I2C `max_hz` 400 000 Hz (Fast mode).
- MFRC522 SPI `max_hz`: derived value. The datasheet prints 10 Mbit/s (p2, and p10 "up to 10 Mbit/s", claim `#spi-speed-section` added); the auditor read the same 10 Mbit/s; stored as 10 000 000 Hz (one bit per SCK cycle; SCK pulse widths 50 ns/50 ns allow it). The note states the conversion. Judgement call: kept verified because the figure is the same and the conversion is stated.
- MFRC522 I2C `max_hz`: Table 155 fSCL 400 kHz (p79); section 8.1.3 p16 states 400 kBd (claim `#i2c-speed-section` added).

## Missing (stays missing)

- ssd1306 I2C `max_hz`: both keys found only tcycle min 2.5 us (Table 13-6 p54; tR/tF max 300 ns; tIDLE min 1.3 us); no frequency rating. Rule 4: stays `missing` (the auditor stored the cycle time, the researcher nothing, so no identical derived value).
- mfrc522 SPI `miso_tristate_when_deselected`: both searched; only the I2C SDA output stage and IRQ are stated 3-state. Note updated.
- st7735s SPI `miso_tristate_when_deselected`: V1.3 p46 says only that SDA must be tri-state after a read command by the last falling SCL edge; p24 note 2 says CSX=1 has no influence on the serial interface; TOH 15-50 ns is listed. The auditor's "tri-stated when deselected" is an inference (`inferred`), not stored.
- SSD1306 deselected data-out state: no catalog field exists (no `miso_tristate_when_deselected` in the SSD1306 draft; SPI mode is write-only, there is no MISO) and the auditor could-not-verify the SDAout state. No fact added; reported here.
- The three generic breakouts (regulator, level_shifter, supply_current for all three; SSD1306 SDA/SCL pull-ups): both keys searched, no vendor document names these modules; notes added to each missing fact. ST7735S module: seller copy claims a 3.3 V LDO and level shifter, unverified (a Waveshare "1.8inch LCD Module" is a differently named product, not opened). The breakout `notes` keep the statement that pin labels and exposed interfaces come from the project definition, not a cited document; the auditor could not confirm them either. The st7735s breakout notes now cite VDDI max 3.3 V (V2.1) and 3.7 V (V1.3 mirror).

## Not stored (derived or no field)

- mfrc522 I2C address 0x28-0x2F (auditor, `inferred`: datasheet p19 says only that with EA low the upper 4 address bits are 0101b and does not print hex addresses): not stored; mentioned in the I2C `max_hz` note and header.
- Reset timings (SSD1306 RES# low 3 us; ST7735S tRESW 10 us / 5 ms / 120 ms; MFRC522 NRSTPD edge, no min width) and pin descriptions: no schema fields.

## Plain-field comparison

- SSD1306 select_strap (BS0, BS1, BS2): the researcher's table matches the datasheet Table 7-1 (p14, confirmed on a rendered image): I2C 0/1/0, 4-wire SPI 0/0/0, 3-wire SPI BS0=1 BS1=0 BS2=0, 6800 = BS2 only, 8080 = BS1+BS2. The auditor's 3-wire value (BS2=0 BS1=0 BS0=1) is the same listed in the opposite bit order, so there is NO difference and no plain field was changed. The evidence claim `ssd1306-ds-v1.1#bus-select-table` already states the table in BS0/BS1/BS2 order.
- SSD1306 I2C addresses 0x3C (SA0 low) / 0x3D (SA0 high): equal. I2C signals (D1/D2 tied = SDA, D0 = SCL), SPI signals (SCLK, MOSI, CS, DC, RES): equal. Parallel 6800/8080 buses not modelled (no schema kind).
- ST7735S select_strap (IM2 = 0 serial, SPI4W = 0 -> 3-line, 1 -> 4-line): equal. V1.3 table 12 names the pin 4WSPI instead of SPI4W (naming inconsistency inside V1.3, same function). Signals SCLK/MOSI(SDA, D0)/CS/DC/RST: equal. Parallel buses not modelled.
- MFRC522 select_strap (I2C=0 EA=0 UART; I2C=0 EA=1 SPI; I2C=1 I2C): equal. Signal sets for SPI, I2C and UART: equal.
- Breakout pin labels and `interfaces_exposed`: unchanged, no document to compare.

## Auditor disagreements

- D1 (VDD abs max/operating range, VDDI max, ST7735S V1.3 vs ST7735 V2.1): conflicts 1 and 2 plus the abs-max note.
- D2 (SPI4W vs 4WSPI naming inside V1.3): no value difference; no action.
- D3 (SSD1306 VDD abs max 4 V vs operating 3.3 V): not a conflict; the abs max stays VDD+0.3 V for inputs.
- D4 (SCL pulse width 15 vs 30 ns, IDD 0.9/2 vs 0.5/0.7 mA): pulse width in the `tscyc_min_s` note; IDD is conflict 3.
- SSD1306 Rev 1.5 (Aug 2010, radiolocman.com) exists but neither key opened it; all SSD1306 facts are Rev 1.1 (Advance Information). Worth a re-check if a PDF becomes available.

## Housekeeping

A scripted quote check against the PDF text found the new claims verbatim (table-cell text order, glyph-normalised). A few pre-existing researcher quotes are table-row compositions that do not appear contiguously in the extracted text (SSD1306 none; ST7735 V2.1 `#pin-im2-spi4w`, `#power-consumption`; MFRC522 `#host-interfaces-speed`, `#spi-pins`, `#abs-max-*`, `#op-supply-*`, `#supply-current-*`); the numbers in each were re-read in the PDF and agree with the auditor, so the claims were left unchanged.
