# Changelog

## 1.0.0 (unreleased)

First public release of the Universal Pinout Finder (pin finder only; code generation is out of scope).

- Deterministic constraint solver with rules R1-R8, ranked fixes when no plan exists, four warning
  levels and traces with evidence ids.
- Evidence-backed catalog: 22 boards (ESP32 family, Arduino UNO R4 Minima, Raspberry Pi Pico/Pico W,
  WEMOS D1 mini), 15 module boards on 11 parts and 97 evidence records, with golden fixtures.
- Web app: board picker with brand sidebar and photos, module picker with categories and one card per
  board version, constraints, results with citations, share links, JSON/CSV export, print view.
- Works offline (PWA) and as a single HTML file that opens from disk.
- Safety: boards without a pin map return "datasheet required" instead of a plan; user locks are never
  dropped silently; I2C bus capacitance includes the MCU pin.
- Weekly evidence link checker (`links.yml`, `pnpm check:links`).

Known gaps are listed in `docs/RELEASE.md`.
