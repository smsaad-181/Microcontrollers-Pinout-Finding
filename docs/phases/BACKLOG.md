# Backlog after v1.0 (not run by `/go` unless the user asks)

## Phase 6 — Coverage expansion (ongoing)

Add, one board per PR with the full two-key process (`/add-board`):
ESP32-C3-DevKitM-1, ESP32-C6-DevKitC-1, NodeMCU (ESP8266), Arduino Mega 2560, Nano 33 IoT, Nano ESP32,
Raspberry Pi Pico 2 / 2 W (RP2350 — include erratum E9 handling), then Raspberry Pi 4 / 5 using the
"overlay" model (I2C/SPI/UART pins fixed by device-tree overlays; Pi 5 uses RP1).
Community boards (ESP32-C3 SuperMini, ESP32-S3-Zero) enter with `community` status only.

Gate per board: every exposed pin verified or explicitly marked; at least 3 new golden fixtures.

## Phase 7 — Datasheet assistant (later)

In-browser pdf.js: the user opens a PDF locally (never uploaded), selects a pin table, the tool drafts
YAML with page anchors, and a button opens a prefilled GitHub PR. It never publishes facts by itself;
the two-key process still applies.
