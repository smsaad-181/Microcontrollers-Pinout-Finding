# Engine interpretations accepted by the owner (disputes 10 and 12-18)

One line each; the engine and the fixtures already follow them.

- **10. Errata and tier-1 risk:** ESP32 GPIO-3.6 / 3.11 / 3.14 are reported only (3.11 as Caution `ERRATUM_GPIO_3_11`); any other erratum that is not chip-wide (e.g. RP2040-E11 on the ADC pads) costs 1 risk per pad.
- **12. CS lines onto strap pads:** a load on a strap pad costs +1, a boot-mode or flash-voltage strap pad with an unproven level costs +1, and a CS line on an IO_MUX `cs*` pad of an SPI instance does not pay the tier-4 "SPI pin used" cost, which puts the CS lines on GPIO5.
- **13. Undocumented strap = strap:** a strap fact with status `missing` counts as a strap pad (+1 risk) and warns `STRAP_FACT_MISSING` (ESP8266 GPIO0/2/15).
- **14. Rule 5 under a user override:** two selectable-address modules sharing a bus get `interface_decided_by_rule: 5` even when rule 7 (a user override) fixed the interface.
- **15. Level-shifter Cautions:** when a module's logic levels cannot be verified (R2 Caution) and the breakout's shifter fact is `conflict` or not verified (missing/interim), the engine reports `LEVEL_SHIFTER_CONFLICT_RELIED` / `LEVEL_SHIFTER_UNKNOWN` although no R1/R2 failure occurs.
- **16. GPIO16 pull table:** "internal pull-down only" for ESP8266 GPIO16 is a one-entry table in `assess.ts` (claim `esp8266ex-ds-v7.1#pull-config`) until the chip record has a structured pad field.
- **17. Optional IRQ:** a module output named IRQ/INT/ALERT gets no pad unless the user locks one.
- **18. I2C VOL:** R3 sizes Rp,min with VOL = 0.4 V (I2C spec, same status as the 3 mA IOL constant), or the MCU's VOL when larger.
