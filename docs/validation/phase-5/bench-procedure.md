# Bench check (needs you and a real board)

Goal: prove on real hardware that two warnings the app gives are true. Takes about 20 minutes. Record
what you see in `docs/validation/phase-5/bench.md` (template at the bottom). Do not skip a step you
cannot do: write "not done".

## What you need

- An ESP32-DevKitC V4 (WROOM-32E) or a DOIT ESP32 DevKit V1, USB cable, computer with a serial
  monitor (Arduino IDE serial monitor, or PuTTY at 115200 baud) and any simple "blink" or "hello"
  sketch already on the board.
- A 10 kΩ resistor, 2 jumper wires, a breadboard.

## Test 1: strapping pin (R6): GPIO12

1. In the app, choose the ESP32-DevKitC V4 (WROOM-32E version), add a **4-channel relay board
   (transistor type)**, go to **Constraints** and lock **relays COIL[1]** to **GPIO12**, then press
   **Find pins**. Write down the warnings. Expected: a *warning* ("relays.COIL[1] ... GPIO12 is pulled
   low during reset", code FLOATING_AT_RESET_LOAD) and a *caution* that the relay input's resting
   level is not documented. GPIO12 must be low at reset on this board.
2. Board powered from USB, sketch running, serial monitor open. Note "boots normally" (you see the
   sketch output).
3. Unplug USB. Connect the 10 kΩ resistor between **GPIO12 and 3V3**. Plug USB in again.
4. Watch the serial monitor. Expected on an ESP32 with the default eFuse: boot fails with a flash error
   (for example `flash read err`, `invalid header` or a reset loop). Write down exactly what you see.
5. Remove the resistor and confirm the board boots again. (The board is not damaged: the pull-up only
   sets the strap level at reset.)

If the board still boots with the resistor in place, note which board and module you used (some modules
have the flash voltage burned into an eFuse). That is a useful result, not a failure.

## Test 2: I2C pull-ups (R3)

1. In the app add one **BME280 module** (the 4-pin GY-BME280) on the DevKitC and press **Find pins**.
   Write down the pull-up message (value, bus speed, pass or warning).
2. Wire the BME280 (VCC 3V3, GND, SDA GPIO21, SCL GPIO22) and run any BME280 sketch. Note: reads fine
   or not.
3. If you have a second I2C module, add it in the app and see whether the pull-up message changes. Wire
   it too and note whether both still read.

## Test 3: DHT11 pin

1. In the app add a **DHT11** and note the data pin the app chose.
2. Wire DHT11 data to that pin (VCC 3V3, GND) and run a DHT11 sketch with that pin number. Note: reads
   temperature and humidity or not.

## Result template (`bench.md`)

| Test | Board | App said | Real board did | Match? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 strap GPIO12 | | | | | |
| 2 I2C BME280 | | | | | |
| 3 DHT11 | | | | | |

Date, your name, serial monitor output pasted below for test 1.
