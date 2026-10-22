---
name: esp32-gpio-reference
description: Pre-extracted reference for the original ESP32 (not S2/S3/C3/C6/H2) IO MUX pin functions, RTC/ADC/DAC/touch mapping, reset pull states and strapping register, transcribed from the ESP32 TRM v5.8 Chapter 6 — a research lead for Phase 2a that must still be re-verified against the live TRM and datasheet before becoming a catalog fact. Use when researching or auditing ESP32 pin facts.
---

# ESP32 GPIO reference (research lead)

`references/gpio_pin_reference.md` contains Table 6.10-1 (IO_MUX pin summary), Table 6.11-1 (RTC_MUX
summary) and Register 6.13 (GPIO_STRAP_REG) from the ESP32 Technical Reference Manual v5.8.

How to use it:
- As a **map** of where to look and what to expect. It is not evidence by itself.
- Re-open the current TRM and ESP32 Series Datasheet from Espressif, confirm each value, and record
  evidence with the revision you actually read. If the live document differs, the live document wins
  and the difference is noted.
- Known conflict: GPIO4 appears in GPIO_STRAP_REG (6 strap bits) but not in the datasheet strap table
  (5 pins) → catalog `conflict`, treated as a strap.
- Board-level facts (which pads are exposed, GPIO16/17 on WROVER, UART0 to the USB bridge) come from
  the board user guide, not from this file.
- For other ESP32 families use their own datasheets/TRMs; this table does not apply.
