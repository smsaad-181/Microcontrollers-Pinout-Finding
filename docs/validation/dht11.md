# DHT11 onboarding (hardware-researcher + catalog-author, 2026-10-24)

Records: `catalog/ics/dht11.yaml`, `catalog/breakouts/dht11-4pin.yaml`, `catalog/breakouts/dht11-3pin-module.yaml`,
evidence `adafruit-product-386`, `adafruit-dht-learn`, fixture `dht11-on-esp32-devkitc-single-wire-ok`.

Key limitation: the official Aosong datasheet could not be read (aosong.com has no datasheet link on the product page and the
download center needs a login; mirrors were not used). All values come from Adafruit pages (secondary) and are `interim`.
One researcher key only; no blind audit yet.

| Fact | Record | Status | Value | Source |
| --- | --- | --- | --- | --- |
| Protocol: single data pin, not I2C | ic interface | modelled as `digital`, role DATA, dir io | n/a | adafruit-dht-learn#single-pin |
| vdd_range | ic | conflict | active 3.3-5 V (readings 3-5 and 3.3-5) | adafruit-product-386#supply-io, adafruit-dht-learn#vcc-range |
| vio_range | ic | interim | 3-5 V (data line at supply level) | adafruit-product-386#supply-io |
| supply_current | ic, both breakouts | interim | max 2.5 mA during conversion; standby not stated | adafruit-product-386#max-current |
| Pull-up 4.7-10 k, external, bare 4-pin | dht11-4pin notes (`pullups: []`) | interim, notes only | 4.7 k or 10 k to VCC | adafruit-product-386#pullup, adafruit-dht-learn#pullup-10k |
| Pull-up on 3-pin module | dht11-3pin-module | missing | unknown (no source for such a board) | none |
| Min sampling interval | breakout notes | interim, notes only | 1 s spec; vendor library 2 s | adafruit-product-386#sampling-rate, #library-2s |
| 4-pin order | dht11-4pin | interim | VCC, DATA, NC, GND | adafruit-dht-learn#pin-order |
| 3-pin order | dht11-3pin-module | missing | roles only, board order unsourced | none |
| VIH, VIL, VOH, VOL, abs max | ic | missing | none | Aosong datasheet unread |
| Start-pulse and bit timing | none | missing | not captured | Aosong datasheet unread |
| Regulator, level shifter | both breakouts | missing | none | none |
| `drive` of DATA | ic signal | placeholder (push-pull) | not a fact | none |

## Schema gaps (not worked around)

- No field for "needs external pull-up" (only `breakout.pullups`, which means onboard), for minimum sampling interval, or for
  single-wire timing. These are in notes only; the engine cannot warn about a missing pull-up.
- Kind `onewire` is Maxim 1-Wire (the engine maps it to the ONEWIRE peripheral); DHT11 is a different protocol, so `digital` was used.

Manual download requested: `sources/manual/README.md` row 10.
