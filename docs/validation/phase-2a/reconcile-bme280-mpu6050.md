# BME280 / MPU-6050 and breakouts reconcile (task 2a.4)

Files edited: `catalog/ics/bme280.yaml`, `catalog/ics/mpu-6050.yaml`, `catalog/breakouts/{adafruit-bme280,gy-bme280-4pin,gy-bme280-6pin,gy-521}.yaml`, `catalog/evidence/bme280-ds-1.24.yaml` (claims `#output-low-spi`, `#current-humidity-meas`, `#current-temperature-meas` added). Evidence files `adafruit-bme280-learn-pinouts`, `adafruit-bme280-qt-sch-revc`, `adafruit-product-2652` unchanged (the auditor's locators equal existing claims). Inputs: researcher draft vs blind audit `audit-bme280-mpu6050.yaml` (84 facts: 49 found, 1 inferred, 34 could-not-verify). Comparison done by hand against the YAML (entity/path matched, units normalised: uA/mA, kohm/ohm, 0x76/118) and the PDF pages 2, 8, 13, 34-36 re-read. The files were re-emitted with PyYAML block style, sorted keys (not byte-identical to the hand-written originals: flow lists, quoting and indentation changed; header comments kept and updated; semantic round trip asserted). `pnpm catalog:validate`: 0 errors, 0 warnings.

## Counts (Facts per file)

| entity | verified | conflict | missing | single-source | total |
| --- | --- | --- | --- | --- | --- |
| bme280 before | 0 | 0 | 0 | 10 | 10 |
| bme280 after | 10 | 0 | 1 | 0 | 11 |
| mpu-6050 before | 0 | 0 | 5 | 0 | 5 |
| mpu-6050 after | 0 | 0 | 5 | 0 | 5 |
| adafruit-bme280 before | 0 | 0 | 1 | 4 | 5 |
| adafruit-bme280 after | 3 | 1 | 1 | 0 | 5 |
| gy-bme280-4pin / gy-bme280-6pin / gy-521 before and after | 0 | 0 | 5 each | 0 | 5 each |

bme280 total +1: `spi.limits.miso_tristate_when_deselected` added as `missing`.

## Mismatches and conflicts

| # | item | researcher | auditor | handling |
| --- | --- | --- | --- | --- |
| 1 | `adafruit-bme280.level_shifter` | true (BSS138 on SDA/SCL, CS via diode; learn guide "all pins") | true, but the Eagle schematic shows SDO/ADR unshifted at 3.3 V (disagreement "Adafruit level-shifting claim") | `conflict`: reading true (learn guide, product page, schematic SDA/SCL) vs reading false (schematic: SDO straight to sensor, R4 pull-up to 3.3 V, claim `qt-sch-revc#csb-sdo`). Active = false (restrictive); the note says SDA/SCL/SCK/SDI/CS are shifted, SDO (MISO output 0-3.3 V, I2C address strap) is not, and a 5 V host must not drive SDO above VDDIO + 0.3 V. `transcribed: true`. |

No other value mismatch. Every other stored value was found identically by the auditor.

## Verified facts (reviewers hardware-researcher + hardware-fact-auditor)

- bme280: `vdd_range` 1.71-3.6 V, `vio_range` 1.2-3.6 V (Table 1 p8); `input_abs_max` VDDIO+0.3 (Table 5 p13; the supply-pin maximum 4.25 V is in the note and cited via `#abs-max-supply`; the schema has one slot); `vih_min` 0.8 VDDIO, `vil_max` 0.2 VDDIO, `voh_min` 0.8 VDDIO (1.62 V; 60 % at 1.2 V in the note), `vol_max` 0.2 VDDIO (SDA, 3 mA, 1.62 V; 23 % at 1.2 V; SPI SDO 20 % at 1 mA, claim `#output-low-spi` added); SPI `max_hz` 10 MHz (Table 34 p37).
- bme280 I2C `max_hz` 3.4 MHz: verified; both keys found it only in the Key features list (p2). Table 33 has no fSCL row (re-checked: 3.4 MHz appears on page 2 only). The note says so.
- bme280 `supply_current` {typ 0.0036 mA, max 0.714 mA}: both numbers found by both keys. Note states: typ = 3.6 uA is the AVERAGE at 1 Hz H+P+T (p2, duty-cycled); max = 714 uA is the PEAK during a pressure-measurement phase (Table 1 IDDP, p8), not a continuous rating and not an average. Table 1 prints 340/714/350 uA (IDDH/IDDP/IDDT) in the Typ column with the Condition column "Max value at 85 C / -40 C"; the datasheet is itself ambiguous whether typical or worst case. The auditor records the same numbers (714 in the Typ column). Judgement call: verified (numbers agree), 714 uA kept in the `max` slot as the conservative worst case so a power budget cannot under-count; claims for IDDH/IDDT added. Sleep 0.1/0.3 uA and standby 0.2/0.5 uA are in the note. No continuous maximum exists in the datasheet.
- adafruit-bme280: `pullups` SDA and SCL 10 kohm (host side to Vin; a second 10 kohm to 3.3 V on the sensor side is in the note), `regulator` {present, vin_range 3-5 V}: verified, `transcribed: true`. Source difference recorded in each note: researcher read the rev C PNG (low resolution, hand transcribed), the auditor parsed the Eagle file `Adafruit BMP280 STEMMA QT.sch` (same PCB as the QT BME280 per the Downloads page) and cross-checked the PNG; same topology (AP2112K-3.3, BSS138, 4 x 10K, R4 SDO pull-up, SJ1, R5/D2 on CS). The 3-5 V range is Adafruit's statement, not an AP2112K rating.
- The Eagle file is not a catalog evidence record (outside my file list); the verified facts cite the PNG claims. Suggest the orchestrator add an evidence record for the Eagle file if a second independent citation is wanted.

## Missing

- mpu-6050 (5): `vdd_range`, `vio_range`, `input_abs_max`, `supply_current`, I2C `max_hz`. TDK PS-MPU-6000A-00 / RM-MPU-6000A-00 not fetchable (redirect to JS search page; HTTP 403); both keys: nothing recorded; manual download row 4 in `sources/manual/README.md`. Addresses/AD0 strap, INT, XDA/XCL, interface modes not recorded (no document).
- gy-bme280-4pin, gy-bme280-6pin, gy-521 (5 each: regulator, level_shifter, pull-up SDA, pull-up SCL, supply_current): no vendor document exists (auditor: could-not-verify; retailer listings are not evidence). Pin labels and exposed interfaces came from the project definition, not a cited document (kept in the board notes; the auditor could not confirm them).
- adafruit-bme280 `supply_current`: neither key found a board current; note updated.
- bme280 `miso_tristate_when_deselected`: Figure 11 (p34) labels SDO "tri-state" but no sentence states it; both keys: no statement. Missing. Note: the MISO signal in the IC record keeps `shareable: true` from the draft (plain field, no cited support either way); the engine should treat MISO sharing with a Caution.

## Inferences and negative findings

- BME280 has no interrupt/alert pin (auditor `inferred` from the 8-pin Table 35): the researcher did not record it; the schema has no such field, so nothing stored. Report only; not a verified negative finding (single key).
- CSB internal pull-up 70/120/190 kohm and the 4.7 kohm I2C pull-up recommendation: found by one or both keys but no schema field; not stored (claims exist in the evidence file).

## Plain-field comparison

All equal: I2C/SPI kinds, i2c_modes [sm, fm, hs], spi_modes [0, 3], addresses 0x76 (SDO=GND) / 0x77 (SDO=VDDIO), signals (SDA io open-drain, SCL in; SCK/MOSI in, MISO out, CS in), select_strap (CSB=1 i2c, CSB=0 spi), Adafruit pin order, hardwired SDO/CSB, interfaces_exposed [i2c, spi]. Differences: Adafruit pin `3Vo` stored as NC (auditor: 3.3 V regulator output; the schema has no output role) and `SDO` as MISO (auditor adds "I2C address bit"); noted in the board `notes`. Not modelled: SPI 3-wire signal set, STEMMA QT connector (in the notes), board host logic 3-5 V.

## Auditor disagreements

- Datasheet revision (cover 1.24 vs footers 1.23): no technical value differs; no action.
- IDDH/IDDP/IDDT typ vs max: handled in the supply_current note (above).
- Vil_si condition typo "3. 6V": in the `vil_max` note.
- Adafruit level-shifting guide vs schematic: conflict (#1).
- Guide text typo "BMP183": irrelevant.
