# RA4M1 chip reconcile (task 2a.4)

Files edited: `catalog/chips/renesas-ra4m1.yaml`, `catalog/evidence/ra4m1-ds-rev1.10.yaml` (9 claims added, 2 `supports` texts corrected), `catalog/evidence/ra4m1-um-rev1.10.yaml` (5 claims added). Inputs: researcher draft vs blind audit `docs/validation/phase-2a/audit-renesas-ra4m1.yaml` (148 facts). Comparison was mechanical (YAML parse of both sides, match by schema path, function names split on `/` and module prefixes stripped); the pin lists and key table pages were re-opened as text (PDF page = printed page) to settle the points below. The chip file was re-emitted by a script that reproduces the original file byte for byte when nothing is changed (sorted keys, flow-style facts, header comment kept and extended).

## Counts (Facts in the chip file, 236 total)

| status | before | after |
| --- | --- | --- |
| verified | 0 | 162 |
| conflict | 1 | 3 |
| missing | 52 | 53 |
| single-source | 183 | 18 |

`pnpm catalog:validate` (whole catalog): `0 errors, 0 warnings in 51 files`; arduino-uno-r4-minima@V1.2 stays `partially-verified` with no mismatch error at this time.

Verified (162): 52 `input_only`, 49 `reset_state` (all pads except P109, P914, P915), 52 `strap` (51 `none` + P201), and the electrical facts `vdd_io`, `abs_max_vin`, `cumulative_current_max`, `internal_pull_ohm`, `port_current_max`, `vih_min`, `vil_max`, `voh_min`, `vol_max`. Reviewers `[hardware-researcher, hardware-fact-auditor]`. Conflict (3): `electrical.pin_current_max`, `pads.P914.reset_state`, `pads.P915.reset_state`. Missing (53): `power_up_glitch` x 52 and `pads.P109.reset_state`. Single-source (18): `adc.radio_conflict` on the 18 ADC pads.

## Mismatches, conflicts and corrections

1. `electrical.pin_current_max` (existing conflict, kept and completed). Readings: 8 mA (Arduino UNO R4 Minima manual s9.3 and pinout, no drive setting named; datasheet middle-drive rows `ioh-iol-mid`, `ioh-iol-other-pins`) and 4 mA (datasheet Table 2.6 low drive and fixed rows, UM DSCR reset value 0 = low drive). Active 4 mA (most restrictive and the reset default). Table below.
2. `pads.P914.reset_state`, `pads.P915.reset_state`: draft `input` (PDR = 0), audit `disabled` (not general I/O at reset, dedicated USB function; UM p. 362-363). Both agree there is no pull-up. Conflict, active `disabled` (keeps the pad from being treated as a free GPIO). Claim added: `ra4m1-um-rev1.10#p914-p915-initial`.
3. `pads.P109.reset_state`: draft `input`; the audit (UM p. 367 note 3, "P109 is output from the initial value") says the pad is a TDO/SWO output with the level not stated. No enum value can be supported, so the fact is `missing` (value null, no evidence). Claim added `um#p109-output-initial` (cited in the note, not in the fact, since a missing fact carries no evidence).
4. `electrical.vih_min` / `vil_max` note correction: the draft said the Schmitt IIC pads are P100/P101. Datasheet Table 2.4 note 1 lists P205, P206, P400, P401, P407, P408 (6 pads) for the IIC Schmitt thresholds (0.7 x VCC / 0.3 x VCC); P100, P101, P204-P206, P400, P401, P407, P408 are the SMBus-mode pads (VIH 2.2 V, 2.0 V at 2.7-3.6 V, VIL 0.8 V; note 2). Notes and the claim `vih-vil-schmitt` `supports` text fixed; new claims `iic-schmitt-pads`, `vih-vil-smbus`, `table-2-4-conditions`. Values stay verified: `VDDIO*0.8` / `VDDIO*0.2` for ordinary pins. The SMBus VIL 0.8 V is stricter than 0.2 x VCC above 4 V but applies only to SMBus-mode pads and cannot be stored per pad.
5. `routing` of `ADTRG0` on P407: draft `fixed`, audit `iomux`. The UM pin function tables (p. 370, 375: PSEL 01010b "CAC/ADC14", ADTRG0 on P102 and P407) show it is PSEL-selected, so the draft was corrected to `iomux`.
6. Everything else in the function comparison agrees (see routing section).

## Input and output levels (rule 6)

DS Table 2.4 (p. 30) has one column, VCC 2.7-5.5 V; Table 2.5 covers 1.6-2.7 V. The stored `vih_min` condition `VCC: 2.7 to 5.5 V` is therefore right and matches the audit (VIH min VCC x 0.8, P000-P015 AVCC0 x 0.8, VIL max x 0.2). The draft's header comment mentioned "4.0-5.5 V / 2.7-5.5 V columns"; it is reworded (input levels: Table 2.4 only column 2.7-5.5 V; output levels: Table 2.7, VCC 4.0-5.5 V). `voh_min` (VCC - 0.8 V at -2.0 mA low drive / -4.0 mA middle drive) and `vol_max` (0.8 V at 2.0 / 4.0 mA) cite Table 2.7, which does have the 4.0-5.5 V condition (p. 34); both agree with the audit, so verified. No researcher statement cites a column the document lacks, after the header fix.

## Current limits (datasheet Table 2.6, pp. 32-33, per pin: average = max, must not be exceeded)

| pad group (bonded pads) | low drive IOH / IOL | middle drive IOH / IOL |
| --- | --- | --- |
| 41-pin group: P100-P115, P201-P204, P300-P307, P500-P503 | -4 / 4 mA | -4 / 8 mA |
| other output pads: P000-P008, P010-P015, P205, P206, P400-P402, P407, P410, P411 | -4 / 4 mA | -8 / 8 mA |
| P212, P213 (no drive switching) | -4 / 4 mA | - |
| P914, P915 (USB, fixed) | -4 / 4 mA | - |
| P408 | -4 / 4 mA | IIC fast-mode (VCC 2.7-5.5 V) -8 / 8; VCC 3.0-5.5 V -20 / 20 |
| P409 | -4 / 4 mA | 2.7-3.0 V -8 / 8; 3.0-5.5 V -20 / 20 |

Totals: P000-P008 + P010-P015 -30 / 30 mA (`port_current_max` = 30, verified); P914 + P915 -2 / 2 mA (row prints "SIOL (min)", apparent typo); all output pins -60 / 60 mA (`cumulative_current_max` = 60, verified). Drive default: PmnPFS.DSCR resets to 0 = low drive (UM p. 361-362), so a pad is at 4 mA until firmware selects middle drive. The Arduino statement ("GPIOs can handle up to 8 mA") names no drive setting; 8 mA is a datasheet value only at middle drive, as sink for the 41-pin group (source stays -4) or both ways for the "other" pads. The schema has no per-pad override (single chip-wide `pin_current_max`; see `docs/schema.md`), so nothing was invented; the table is in the fact's note. Also flagged for the engine: the 5 V-tolerant pads on the package are P205, P206, P400, P401, P402, P407, P408 (7).

## `abs_max_vin`

Auditor: -0.3 to +6.5 V on the 7 5 V-tolerant bonded pads (P205, P206, P400, P401, P402, P407, P408), -0.3 to AVCC0 + 0.3 V on P000-P008 and P010-P015, -0.3 to VCC + 0.3 V elsewhere. The documents agree with the draft's `VDDIO+0.3` (common-pad value, the most restrictive chip-wide reading); status verified, note lists the groups, per-pad variation cannot be stored (schema gap). The draft's statement "none of them is on a UNO R4 header" is a board fact the chip file cannot support; it was removed from the `abs-max-5v-tol` claim text (left to the board reconcile).

## Reset state (rule 8)

- Ordinary pads: `input` (Hi-Z, no pull-up, low drive; PmnPFS = 0). Agree; verified.
- P108, P110, P300, P201: `pullup` (PCR = 1 initial value, UM p. 362, 367). Agree; verified. UM internal inconsistency: p. 362 says the pull-up "is also disabled in the reset state" while the register initial value has PCR = 1; the specific register value (and p. 367 note 2) is used; the pull is also the more cautious reading. Noted in each fact.
- P109: missing (above). P914, P915: conflict (above).

## Strap (rule 7) and negative findings (rule 9)

- P201/MD strap: role, `required_at_reset: high` agree and are verified. `default_pull: up` rests on the PmnPFS initial value (PCR = 1); the audit notes no document calls the reset pull-up a strap pull. Decision: keep `up` (it is the documented register state, not a placeholder) and say so in the note; the UM inconsistency above applies. Verified.
- `strap` = `none` on the other 51 pads: verified; positive support UM Table 3.1 (MD is the only mode-setting pin), both keys concluded none; note says "negative finding: absence confirmed by two independent reads". Debug pads P108/P110/P300 are pulled up at reset but are not mode straps (audit).
- `adc.radio_conflict` = false (18 ADC pads): the audit did not state a radio conclusion (its ADC facts are channel numbers only; it transcribed the same function lists, which contain no radio). Not an independent finding, so it stays `single-source` with a note; the chip has no radio and the board file carries any real conflict. Owner may downgrade to missing or accept as verified-from-silence like the RP2040 precedent.
- `power_up_glitch` (52 pads): auditor `could-not-verify` (searched DS and UM text; Renesas technical updates not retrievable). Stays `missing`; notes say neither key may claim none.

## Routing class (rule 10)

Digital functions are `iomux` and analog/debug/USB/clock/MD/NMI/RES `fixed` in both keys. Function-name sets agree on all 52 pads except cell splitting (draft splits `CTS0_RTS0/SS0` into `CTS0_`, `RTS0`, `SS0`; audit keeps the printed cell; no content difference, pads P101, P103, P108, P110, P205, P301, P401, P407, P408). Routing differences: P407 ADTRG0 (fixed -> iomux, corrected, above) and P109 CLKOUT (draft `iomux`, audit `fixed`, because the audit grouped it in the TDO/SWO cell): the UM p. 371 table has CLKOUT at PSEL 01001b on P109, so the draft is kept (`iomux`). Pad set: 52 pads, `gpio` = port x 100 + pin, an invented number; the chip header comment states both, unchanged.

## Peripherals, touch, ADC (rule 11)

- Touch: draft has `touch.channel` for 26 pads; the audit has the same 26 TSnn channels. Audit also lists TSCAP on P112 and P205 (a CTSU capacitor pin, not a channel; present in the function lists, no `touch` field fits).
- ADC: 18 pads with channel numbers AN000-AN010, AN016-AN022 match the audit (audit adds P407 ADTRG0 as an "adc" entry: it is a trigger input, not a channel, so no `adc` block).
- Audit `dac_opamp` (DA0 on P014; AMP0+/-/O ... AMP2+/-/O on P000-P004, P010-P014) agrees with the function lists; the schema `dac` block holds channel numbers only and is not populated (unchanged).
- `peripherals` table (ADC14, GPT, IIC0/1, RSPI0/1, SCI0/1/2/9) unchanged; audit adds CAN (1 channel, CTX0/CRX0 on P401/P109/P103 and P402/P110/P102), USBFS, DAC12; the schema `kind` enum has no fitting entries and the role-to-pad maps cannot be stored (one pad per role).
- IIC channel count: DS Table 1.7 (p. 5) and UM overview say 3-channel; Table 1.14 (p. 11), pin list and block diagram show 2 (IIC0, IIC1). Kept 2 (matches pin list); informational.
- `errata`: plain list, empty on all pads. Neither key opened Renesas technical updates (TN-RA*); empty means unknown here, not none. `sources.newer_revision_check`: could-not-verify, not a catalog field.

## Extra audit facts not stored

- `vcc_pin_current_max`: could-not-verify (no per-supply-pin rating in Tables 2.1/2.6); no schema field anyway.
- `input_leakage` 1 uA max (Table 2.10), `input_capacitance` 30 pF (P914, P915, P100-P103, P111, P112, P200) / 15 pF others: no schema field.
- `voh_min` at 2.7-4.0 V (Table 2.8) and P408/P409, P914/P915 values: in the notes only.
- Clock limits (ICLK 48 MHz, PCLKA 48, PCLKB 32, PCLKC/D 64, FCLK 32 MHz, Table 2.17): no matching field. SPI master min cycle 2 tPcyc (about 24 MHz), SCI async 4/6 tPcyc: not stored.
- USB: VCC_USB_LDO 3.8-5.5 V; DAC12 load >= 30 kOhm / <= 50 pF; ADC channel classes (AN000-AN014 high-precision AVCC0 domain, AN016-AN025 VCC domain): not stored.

## Per-pad summary (52 pads)

Columns: function count, input_only status, reset_state (status), strap (status), power_up_glitch status, ADC. All `errata` lists are empty (unknown, not none). All per-pad `input_only` facts are verified.

| pad | functions | input_only | reset_state | strap | power_up_glitch | ADC |
| --- | --- | --- | --- | --- | --- | --- |
| P000 | 5 | verified | input (verified) | verified (verified) | missing | AN000 (radio_conflict False, single-source) |
| P001 | 5 | verified | input (verified) | verified (verified) | missing | AN001 (radio_conflict False, single-source) |
| P002 | 4 | verified | input (verified) | verified (verified) | missing | AN002 (radio_conflict False, single-source) |
| P003 | 3 | verified | input (verified) | verified (verified) | missing | AN003 (radio_conflict False, single-source) |
| P004 | 4 | verified | input (verified) | verified (verified) | missing | AN004 (radio_conflict False, single-source) |
| P010 | 5 | verified | input (verified) | verified (verified) | missing | AN005 (radio_conflict False, single-source) |
| P011 | 6 | verified | input (verified) | verified (verified) | missing | AN006 (radio_conflict False, single-source) |
| P012 | 4 | verified | input (verified) | verified (verified) | missing | AN007 (radio_conflict False, single-source) |
| P013 | 4 | verified | input (verified) | verified (verified) | missing | AN008 (radio_conflict False, single-source) |
| P014 | 3 | verified | input (verified) | verified (verified) | missing | AN009 (radio_conflict False, single-source) |
| P015 | 4 | verified | input (verified) | verified (verified) | missing | AN010 (radio_conflict False, single-source) |
| P100 | 15 | verified | input (verified) | verified (verified) | missing | AN022 (radio_conflict False, single-source) |
| P101 | 17 | verified | input (verified) | verified (verified) | missing | AN021 (radio_conflict False, single-source) |
| P102 | 15 | verified | input (verified) | verified (verified) | missing | AN020 (radio_conflict False, single-source) |
| P103 | 12 | verified | input (verified) | verified (verified) | missing | AN019 (radio_conflict False, single-source) |
| P104 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P105 | 8 | verified | input (verified) | verified (verified) | missing | - |
| P106 | 5 | verified | input (verified) | verified (verified) | missing | - |
| P107 | 4 | verified | input (verified) | verified (verified) | missing | - |
| P108 | 9 | verified | pullup (verified) | verified (verified) | missing | - |
| P109 | 14 | verified | None (missing) | verified (verified) | missing | - |
| P110 | 15 | verified | pullup (verified) | verified (verified) | missing | - |
| P111 | 8 | verified | input (verified) | verified (verified) | missing | - |
| P112 | 10 | verified | input (verified) | verified (verified) | missing | - |
| P113 | 7 | verified | input (verified) | verified (verified) | missing | - |
| P200 | 2 | verified | input (verified) | verified (verified) | missing | - |
| P201 | 2 | verified | pullup (verified) | MD strap (verified) | missing | - |
| P204 | 12 | verified | input (verified) | verified (verified) | missing | - |
| P205 | 17 | verified | input (verified) | verified (verified) | missing | - |
| P206 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P212 | 9 | verified | input (verified) | verified (verified) | missing | - |
| P213 | 8 | verified | input (verified) | verified (verified) | missing | - |
| P214 | 2 | verified | input (verified) | verified (verified) | missing | - |
| P215 | 2 | verified | input (verified) | verified (verified) | missing | - |
| P300 | 6 | verified | pullup (verified) | verified (verified) | missing | - |
| P301 | 15 | verified | input (verified) | verified (verified) | missing | - |
| P302 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P303 | 5 | verified | input (verified) | verified (verified) | missing | - |
| P304 | 5 | verified | input (verified) | verified (verified) | missing | - |
| P400 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P401 | 14 | verified | input (verified) | verified (verified) | missing | - |
| P402 | 12 | verified | input (verified) | verified (verified) | missing | - |
| P407 | 12 | verified | input (verified) | verified (verified) | missing | - |
| P408 | 14 | verified | input (verified) | verified (verified) | missing | - |
| P409 | 10 | verified | input (verified) | verified (verified) | missing | - |
| P410 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P411 | 11 | verified | input (verified) | verified (verified) | missing | - |
| P500 | 8 | verified | input (verified) | verified (verified) | missing | AN016 (radio_conflict False, single-source) |
| P501 | 12 | verified | input (verified) | verified (verified) | missing | AN017 (radio_conflict False, single-source) |
| P502 | 11 | verified | input (verified) | verified (verified) | missing | AN018 (radio_conflict False, single-source) |
| P914 | 2 | verified | disabled (conflict) | verified (verified) | missing | - |
| P915 | 2 | verified | disabled (conflict) | verified (verified) | missing | - |
