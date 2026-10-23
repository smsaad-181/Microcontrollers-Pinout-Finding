# ADS1115 / SRD-05VDC-SL-C / relay boards reconcile

Inputs: researcher drafts vs blind audit `audit-ads1115-relay.yaml`. Files edited: `catalog/ics/ads1115.yaml`, `catalog/ics/srd-05vdc-sl-c.yaml`, `catalog/breakouts/{ads1115-breakout,relay-board-4ch-opto-jdvcc,relay-board-4ch-transistor}.yaml`. No evidence files changed (auditor locators equal existing claims). `pnpm catalog:validate`: 0 errors, 0 warnings in 95 files.

## Counts (Facts per file, after)

| entity | verified | conflict | interim | single-source | missing |
| --- | --- | --- | --- | --- | --- |
| ads1115 | 8 | 0 | 0 | 1 | 0 |
| ads1115-breakout | 3 | 0 | 2 | 0 | 1 |
| srd-05vdc-sl-c | 2 | 1 | 0 | 0 | 1 |
| relay-board-4ch-opto-jdvcc | 0 | 0 | 2 | 0 | 1 |
| relay-board-4ch-transistor | 0 | 0 | 0 | 0 | 7 |

All previously single-source facts changed; no schema field exists for polarity, input current, relay temperature or contact ratings, so those live in notes.

## Verified (reviewers hardware-researcher + hardware-fact-auditor)
- ads1115: vdd_range 2.0-5.5 V; digital input abs max 5.5 V; VIH 0.7 VDD, VIL 0.3 VDD, VOL 0.4 V at 3 mA; I2C max 3.4 MHz (Hs); analog full-scale +/-6.144 V (note keeps the AINx <= VDD+0.3 V caveat); supply current typ 0.15 / max 0.3 mA.
- ads1115-breakout: SCL, SDA 10 kohm to VIN; ALRT 10 kohm to VDD (schematic only, the guide never mentions it; the auditor saw it in both schematics).
- srd-05vdc-sl-c: nominal coil 5 V; nominal current 71.4 mA (both keys found this stated figure in the older, secondary sheet; the V1 sheet has no current and the 72 mA derived value is not stored).

## Conflict
- srd-05vdc-sl-c `input_abs_max` (overdrive): V1 130 % vs older sheet 120 %; active 120 % (6.0 V).
- Contact ratings and ambient temperature between the two SRD sheets (V1: 277VAC/30VDC, 2770VA/300W, -40..+85 C; older: 250VAC/110VDC, FORM C 7 A 28 VDC, 800VA/240W, -25..+70 C): no schema field, recorded as a conflict in the `vdd_range` note, most restrictive (older sheet) active. Not a Fact.

## Interim (inferred, not verified)
- ads1115-breakout regulator (absent) and level_shifter (none): inferred from the absence of parts in the schematic by both keys.
- relay-board-4ch-opto-jdvcc regulator (absent) and level_shifter (none): same reason.

## Missing
- ads1115-breakout supply_current: no board current published (both keys).
- relay-board-4ch-opto-jdvcc supply_current: vendor "15-20 mA driver current" is ambiguous (input vs coil) and contradicts the 1 kohm drawn resistor (C3); kept in the note, not stored. Floating input = relay off is inferred, stated only in the note as inferred. TS0011 p1 active-low contradiction (C1) and 5/12 V supply text (C2) in the note. Relay model not documented, so the `ic` link is an assumption.
- relay-board-4ch-transistor (7): level_shifter, regulator, 4 input pull-ups, supply_current; transistor, flyback diode, base resistor, input current, resting level and jumper have no field and stay unrecorded because the KS0058 schematic (https://fs.keyestudio.com/KS0058) is unreachable. Active-high polarity is found by both keys on the wiki (claim `keyestudio-ks0058-wiki#active-high`) and noted. Audit C8 (jumper cap and DIP-4 footprints in photos, SRD-05 vs SRD-06 drawing; may not be a plain transistor board) added to the note.
- ads1115 vio_range stays single-source: derived (no VIO pin), not found by the auditor.

## Other
- Audit C6 (ADS1015 value label on the shared PCB) and C7 (legacy schematic has no supply input) noted in the ads1115-breakout notes.
- TS0011 and SainSmart document the opto/JD-VCC type; no reachable circuit for the transistor type.
