---
name: interface-selection
description: Rules for choosing the communication interface (I2C, SPI, UART, 1-Wire, analog, digital) when a module supports more than one — module locks first, then feasibility, incremental pin cost, performance need, address conflicts, wiring distance, and user override — with the pin-cost table and a worked example. Use when implementing or testing interface choice.
---

# Interface selection

Procedure: for each interface combination allowed by rule 1, solve the pin CSP (skill
`pin-allocation-engine`). Discard infeasible combinations (rule 2). Among the rest, apply rules 3–7
per module in order; record which rule decided (shown to the user). If rules still tie, prefer the
combination whose pin solution has the better lexicographic score, then the bus already in use.

1. **Module locks** — only interfaces the *breakout* exposes. Blue RC522 board: SPI hardwired.
   4-pin GY-BME280: I2C only; 6-pin version exposes CSB/SDO → I2C or SPI. BME280 note: once CSB is
   pulled low, I2C stays disabled until power-on reset (Bosch datasheet §6.1).
2. **Feasibility** — drop interfaces the solver cannot place (no CS left, no UART instance, etc.).
3. **Incremental pin cost** given the current project (table). If ≥ 3 spare pins remain after
   allocation, a 1-pin difference is ignored and rule 4 decides.
4. **Performance** — displays/fast streams (> ~400 kbit/s or frame updates) → SPI; slow sensors → I2C.
5. **Conflicts** — I2C address collision: try the address strap, then a second I2C bus, then SPI.
6. **Distance** — > ~0.5–1 m: warn for I2C/SPI; suggest a bus buffer or differential link.
7. **User override** — always wins; full re-check runs.

| Interface | Added pins (bus exists) | New bus | Speed | Engine checks |
| --- | --- | --- | --- | --- |
| I2C | 0 (+1 INT optional) | 2 | 100 k / 400 k / 1 MHz | address uniqueness, R3 pull-ups, Cb |
| SPI | 1 CS (+DC/RST/INT as needed) | 3 + CS | device/routing limited | CS count, per-device clock & mode, MISO tri-state |
| UART | not shareable | 2 + instance | 9.6 k–1 Mbaud | instance count, crossover, UART0/USB, 5 V TX |
| 1-Wire | 0 on existing line | 1 + 4.7 kΩ | ~16 kbit/s | parasite power strong pull-up, length |
| Analog | — | 1 ADC channel | — | ADC unit vs radio, R8 range |

MISO sharing: a device is allowed on a shared MISO line only if its catalog fact says MISO is
high-impedance when deselected; otherwise `caution` and prefer a dedicated bus. (MFRC522: fact pending.)

## Worked example (DevKitC V4 project)

BME280 (6-pin) — I2C costs 2 (no bus yet), SPI costs 1 CS on the existing display/RFID bus. Spare
pins after allocation ≥ 3, so rule 3 does not decide; rule 4 picks I2C (slow sensor, keeps SPI for the
display) and leaves a zero-cost bus for future sensors. SPI reported as valid alternative saving 1 pin.
