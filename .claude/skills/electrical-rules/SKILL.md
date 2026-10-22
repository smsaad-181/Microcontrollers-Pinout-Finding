---
name: electrical-rules
description: The eight electrical validation rules R1–R8 (absolute max, logic thresholds, I2C pull-ups/rise time, pin and rail current, 5 V→3.3 V dividers, strap compatibility at reset, power budget, ADC fit) with exact formulas, decision boundaries, warning levels and verified test vectors. Use when implementing or testing packages/rules, writing fixtures, or checking electrical math.
---

# Electrical rules R1–R8

All limits come from catalog facts (with evidence). Never hard-code a datasheet constant in rule code;
constants below are **test vectors** taken from documents verified during planning (re-verify in 2a).

| Rule | Check | Fail level | Output when fixable |
| --- | --- | --- | --- |
| R1 Absolute max | max V a driver can apply ≤ receiver abs max (expressions like `VDDIO+0.3` allowed) | critical | level shifter / divider |
| R2 Logic thresholds | VOH,min(driver) ≥ VIH,min(receiver) AND VOL,max(driver) ≤ VIL,max(receiver) | critical | buffer (74AHCT/74LVC family) or shifter |
| R3 I2C pull-ups | Rp,eff (parallel of all pull-ups on the line) ∈ [Rp,min, Rp,max(speed, Cb)] | warning | corrected resistor or lower speed |
| R4 Current | load ≤ per-pin limit; Σ per port/VCC-pin/cumulative ≤ limits | critical | series R / driver transistor |
| R5 Divider | 5 V signal into 3.3 V input: Vout(+5 %) ≤ VDD(and ≤ abs max) AND Vout(−5 %) ≥ VIH,min | critical | divider values |
| R6 Strap at reset | resting level of the net during reset hold time = strap required level (or `any`) | warning / blocked if it changes boot mode or flash voltage | move pin / remove pull |
| R7 Power budget | Σ rail currents ≤ regulator rating and ≤ USB limit | warning | separate supply |
| R8 ADC fit | sensor range mapped inside ADC effective range on a radio-compatible unit | warning | divider values + dead-zone note |

Transistor drivers always use the driver's **worst-case VOH,min**, not the nominal rail.

Boundary convention: limits are inclusive (value == limit passes) unless the datasheet states strict.

## Formulas

- Rp,min = (VDD − VOL,max) / IOL  (VOL,max 0.4 V @ 3 mA for VDD > 2 V)  — NXP UM10204 / TI SLVA689
- Rp,max = tr,max / (0.8473 · Cb);  tr,max = 1000 ns (100 kHz), 300 ns (400 kHz), 120 ns (1 MHz); Cb ≤ 400 pF (550 pF Fm+ per TI)
- Cb estimate = Σ device pin capacitance (≤ 10 pF each per UM10204) + MCU pin + wiring term (user length); show and allow override
- Divider: Vout = Vin · R2/(R1+R2) at Vin ±5 %; compare with the receiver's VDD **min** for the upper
  limit and VIH at VDD **max** (ratio-based) for the lower limit when the board's rail tolerance is known;
  otherwise nominal VDD with the assumption stated in the trace
- LED: I = (Vsupply − Vf)/R ; NPN driver: Rb = (VOH − VBE)/(Ic/βforced), βforced = 10
- Logic levels as ratios of VDD when the datasheet gives ratios
- SPI fmax(device) = 1/tSCYC,min ; ESP32 routing limit: IO_MUX 80 MHz, GPIO matrix 40 MHz (≈26.6 MHz full-duplex with MISO) — ESP-IDF SPI master docs
- ADC: ratio ≤ Vmax,eff / Vsensor,max ; dead zone (sensor side) = Vmin,eff / ratio

## Test vectors (from planning; expected results)

| # | Case | Inputs | Expected |
| --- | --- | --- | --- |
| T1 | Rp,min @3.3 V | (3.3−0.4)/3 mA | 966.7 Ω |
| T2 | Rp,max 400 kHz, Cb 50 pF | 300 ns/(0.8473·50 pF) | 7.08 kΩ → 10 kΩ module pull-up FAILS |
| T3 | Rp,max 100 kHz, Cb 50 pF | 1000 ns/(0.8473·50 pF) | 23.6 kΩ → 10 kΩ PASSES |
| T4 | Rp,max 400 kHz, Cb 100 pF | | 3.54 kΩ → 4.7 kΩ FAILS |
| T5 | 5 × 4.7 kΩ in parallel | | 940 Ω < 966.7 Ω → FAILS Rp,min |
| T6 | 10 kΩ ∥ 4.7 kΩ | | 3.20 kΩ (fix for T2) |
| T7 | HC-SR04 echo, 1 k/2 k | 5.25 · 2/3 | 3.50 V > 3.3 V → REJECT |
| T8 | HC-SR04 echo, 2.2 k/3.3 k | 5.25·0.6 / 4.75·0.6 | 3.15 V / 2.85 V ≥ 0.75·3.3 = 2.475 V → ACCEPT |
| T9 | Uno R4 LED 220 Ω, Vf 2.0 | (5−2)/220 | 13.6 mA > 8 mA → CRITICAL; 470 Ω → 6.4 mA PASS |
| T10 | ESP32 → ATmega328P input | VOH ≥ 0.8·3.3 = 2.64 V vs VIH 0.6·5 = 3.0 V | FAIL R2 (buffer) — ATmega value interim until manual datasheet |
| T11 | Raspberry Pi 4 → 5 V AVR | VOH ≥ 3.3−0.4 = 2.9 V vs 3.0 V | FAIL R2 |
| T12 | SRD-05VDC unknown variant ×4 | 4 × 89.3 mA | 357 mA (0.36 W variant: 4 × 71.4 = 286 mA) |
| T13 | NPN for 89.3 mA coil, worst case | VOH,min 0.8·3.3 = 2.64 V: (2.64−0.7)/8.93 mA | Rb ≤ 217 Ω → 200 Ω; Ib 9.7 mA worst, ≈ 13 mA at 3.3 V (within ESP32 IOH typ 40 mA) |
| T14 | MFRC522 max 3V3 draw | TVDD 100 + IDDD 9 + IDDA 10 mA | 119 mA |
| T15 | ST7735 write clock | 1/66 ns | 15.15 MHz cap |
| T16 | 0–5 V sensor on ESP32 ADC1 @ max atten (150–2450 mV) | 10 k/9.1 k → 0.4764 | 5 V → 2.38 V; dead zone < 0.315 V |
| T17 | GPIO12 with 10 kΩ pull-up on ESP32 | strap requires low | BLOCKED (selects 1.8 V VDD_SDIO) |
| T18 | SPI CS on ESP32 GPIO5 | CS idles high, strap default high | PASS (risk tier +1) |

## Source facts used above (verify in Phase 2a)

ESP32-WROOM-32E datasheet v2.1 Table 15 (VIH 0.75·VDD, VIL 0.25·VDD, VOH 0.8·VDD, VOL 0.1·VDD,
IOH typ 40 mA, pulls 45 kΩ) · ESP32 datasheet v5.3 §3, §4.9.1, Table 5-1 · Uno R4 Minima manual rev 5
§9.3 · Raspberry Pi 4 datasheet rel 1.1 Table 3 · MFRC522 rev 3.9 Table 1 · ST7735 V2.1 serial timing ·
SRD relay sheet (secondary host) · UM10204 rev 7 · SLVA689.
