# Bench results

Status: **software half done, hardware half pending.** The hardware tests need a real ESP32-DevKitC V4
and were not run by the build assistant (no board available). Fill the "Real board did" column using
`bench-procedure.md`.

Software half (engine run on 2026-10-24, catalog cf1388dd036e, DevKitC V4 / WROOM-32E):

| Test | Board | App said | Real board did | Match? | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 strap GPIO12 (relay COIL[1] locked to GPIO12) | DevKitC V4 | warning FLOATING_AT_RESET_LOAD ("GPIO12 is pulled low during reset") plus caution FLOATING_AT_RESET_UNKNOWN | pending | pending | expected: boot failure with a 10 kOhm pull-up to 3V3 |
| 2 I2C GY-BME280 4-pin | DevKitC V4 | SCL=GPIO16, SDA=GPIO17; caution I2C_PULLUP_UNKNOWN (pull-up not documented, R3 not verifiable) | pending | pending | measure SDA-3V3 resistance if possible |
| 2b GY-BME280 + GY-521 | DevKitC V4 | same two pins shared; address unknown cautions | pending | pending | |
| 3 DHT11 3-pin | DevKitC V4 | DATA=GPIO17; cautions only (levels/regulator unknown) | pending | pending | |

Finding from the software half: for modules whose pull-up value is missing the app says "cannot be
verified" instead of passing; it never reports a false pass.
