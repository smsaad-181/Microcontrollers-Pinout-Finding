# ESP32 GPIO Pin Reference (source: TRM v5.8, Chapter 6 — IO MUX and GPIO Matrix)

This file is the primary source for the "GPIO Selection" and "GPIO Safety" phases
of the design workflow. Every fact below is transcribed from Table 6.10-1
(IO_MUX Pin Summary), Table 6.11-1 (RTC_MUX Pin Summary), and Register 6.13
(GPIO_STRAP_REG) in the TRM — nothing here is invented. Cross-check the raw text
in `chapters/06_io_mux_gpio_matrix.txt` if you need the surrounding explanation.

**Chip scope:** original ESP32 (dual-core Xtensa) only. Do not apply this table to
S2/S3/C3/C6/H2 — their GPIO matrices differ.

## Table 6.10-1 — IO_MUX Pin Summary (all functions per pin)

Columns: **GPIO** = pin number · **Pin Name** = silkscreen/pad name if different from
GPIOn · **Function 0–5** = the six alternate functions selectable via IO_MUX
`MCU_SEL` · **Reset** = default state per the legend below · **Notes**.

| GPIO | Pin Name | Func 0 | Func 1 | Func 2 | Func 3 | Func 4 | Func 5 | Reset | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0 | GPIO0 | GPIO0 | CLK_OUT1 | GPIO0 | – | – | EMAC_TX_CLK | 3 | R (strapping) |
| 1 | U0TXD | U0TXD | CLK_OUT3 | GPIO1 | – | – | EMAC_RXD2 | 3 | default console TX |
| 2 | GPIO2 | GPIO2 | HSPIWP | GPIO2 | HS2_DATA0 | SD_DATA0 | – | 2 | R (strapping) |
| 3 | U0RXD | U0RXD | CLK_OUT2 | GPIO3 | – | – | – | 3 | default console RX |
| 4 | GPIO4 | GPIO4 | HSPIHD | GPIO4 | HS2_DATA1 | SD_DATA1 | EMAC_TX_ER | 2 | R (strapping) |
| 5 | GPIO5 | GPIO5 | VSPICS0 | GPIO5 | HS1_DATA6 | – | EMAC_RX_CLK | 3 | strapping |
| 6 | SD_CLK | SD_CLK | SPICLK | GPIO6 | HS1_CLK | U1CTS | – | 3 | on-chip SPI flash clock — do not use if flash is on these pins (default on WROOM/WROVER modules) |
| 7 | SD_DATA_0 | SD_DATA0 | SPIQ | GPIO7 | HS1_DATA0 | U2RTS | – | 3 | SPI flash D0 — same caveat as GPIO6 |
| 8 | SD_DATA_1 | SD_DATA1 | SPID | GPIO8 | HS1_DATA1 | U2CTS | – | 3 | SPI flash D1 — same caveat |
| 9 | SD_DATA_2 | SD_DATA2 | SPIHD | GPIO9 | HS1_DATA2 | U1RXD | – | 3 | SPI flash D2 (HD) — same caveat |
| 10 | SD_DATA_3 | SD_DATA3 | SPIWP | GPIO10 | HS1_DATA3 | U1TXD | – | 3 | SPI flash D3 (WP) — same caveat |
| 11 | SD_CMD | SD_CMD | SPICS0 | GPIO11 | HS1_CMD | U1RTS | – | 3 | SPI flash CS — same caveat |
| 12 | MTDI | MTDI | HSPIQ | GPIO12 | HS2_DATA2 | SD_DATA2 | EMAC_TXD3 | 2 | R, **strapping (MTDI)** — sets flash voltage at boot, avoid external pull-up |
| 13 | MTCK | MTCK | HSPID | GPIO13 | HS2_DATA3 | SD_DATA3 | EMAC_RX_ER | 2 | R (JTAG) |
| 14 | MTMS | MTMS | HSPICLK | GPIO14 | HS2_CLK | SD_CLK | EMAC_TXD2 | 3 | R (JTAG) |
| 15 | MTDO | MTDO | HSPICS0 | GPIO15 | HS2_CMD | SD_CMD | EMAC_RXD3 | 3 | R, **strapping (MTDO)** — controls boot log output; avoid external pull-down |
| 16 | GPIO16 | GPIO16 | – | GPIO16 | HS1_DATA4 | U2RXD | EMAC_CLK_OUT | 1 | often PSRAM CS on WROVER modules — verify against your specific module datasheet |
| 17 | GPIO17 | GPIO17 | – | GPIO17 | HS1_DATA5 | U2TXD | EMAC_CLK_180 | 1 | often PSRAM CLK on WROVER modules — verify |
| 18 | GPIO18 | GPIO18 | VSPICLK | GPIO18 | HS1_DATA7 | – | – | 1 | free general-purpose |
| 19 | GPIO19 | GPIO19 | VSPIQ | GPIO19 | U0CTS | – | EMAC_TXD0 | 1 | free general-purpose |
| 21 | GPIO21 | GPIO21 | VSPIHD | GPIO21 | – | – | EMAC_TX_EN | 1 | free general-purpose |
| 22 | GPIO22 | GPIO22 | VSPIWP | GPIO22 | U0RTS | – | EMAC_TXD1 | 1 | free general-purpose |
| 23 | GPIO23 | GPIO23 | VSPID | GPIO23 | HS1_STROBE | – | – | 1 | free general-purpose |
| 25 | GPIO25 | GPIO25 | – | GPIO25 | – | – | EMAC_RXD0 | 0 | R — also **DAC_1** (see RTC table) |
| 26 | GPIO26 | GPIO26 | – | GPIO26 | – | – | EMAC_RXD1 | 0 | R — also **DAC_2** |
| 27 | GPIO27 | GPIO27 | – | GPIO27 | – | – | EMAC_RX_DV | 0 | R |
| 32 | 32K_XP | GPIO32 | – | GPIO32 | – | – | – | 0 | R — shared with external 32kHz XTAL if used |
| 33 | 32K_XN | GPIO33 | – | GPIO33 | – | – | – | 0 | R — shared with external 32kHz XTAL if used |
| 34 | VDET_1 | GPIO34 | – | GPIO34 | – | – | – | 0 | R, **I = input-only, no pull-up/down, no output driver** |
| 35 | VDET_2 | GPIO35 | – | GPIO35 | – | – | – | 0 | R, **I = input-only** |
| 36 | SENSOR_VP | GPIO36 | – | GPIO36 | – | – | – | 0 | R, **I = input-only** |
| 37 | SENSOR_CAPP | GPIO37 | – | GPIO37 | – | – | – | 0 | R, **I = input-only** |
| 38 | SENSOR_CAPN | GPIO38 | – | GPIO38 | – | – | – | 0 | R, **I = input-only** |
| 39 | SENSOR_VN | GPIO39 | – | GPIO39 | – | – | – | 0 | R, **I = input-only** |

**Notes not present as a pin:** GPIO20, 24, 28, 29, 30, 31 do not exist on the
ESP32 package — do not select them.

### Reset column legend (per TRM)
- `0` — input disabled (IE=0)
- `1` — input enabled (IE=1)
- `2` — input enabled, internal pull-**down** active by default (IE=1, WPD=1)
- `3` — input enabled, internal pull-**up** active by default (IE=1, WPU=1)

### Pin notes legend (per TRM)
- **R** — pin has RTC/analog functions via RTC_MUX (see table below: ADC, DAC, touch, RTC_GPIO).
- **I** — input-only GPIO: no output driver, no internal pull-up/pull-down. Only
  usable for digital input or analog input (ADC), never as an output or with
  internal pull resistors — any pull-up/down for these pins must be external.

## Table 6.11-1 — RTC_MUX Pin Summary (analog + RTC functions)

Only the 18 GPIOs listed below have RTC/analog capability (ADC, DAC, touch, or
RTC_GPIO for deep-sleep wake). Any GPIO not in this table has **no** ADC/DAC/touch
capability and cannot be used for EXT0/EXT1 deep-sleep wake as an RTC GPIO.

| RTC GPIO # | GPIO # | Pin Name | ADC | DAC | Touch | RTC_GPIO |
|---|---|---|---|---|---|---|
| 0 | 36 | SENSOR_VP | ADC1_CH0 | – | – | RTC_GPIO0 |
| 1 | 37 | SENSOR_CAPP | ADC1_CH1 | – | – | RTC_GPIO1 |
| 2 | 38 | SENSOR_CAPN | ADC1_CH2 | – | – | RTC_GPIO2 |
| 3 | 39 | SENSOR_VN | ADC1_CH3 | – | – | RTC_GPIO3 |
| 4 | 34 | VDET_1 | ADC1_CH6 | – | – | RTC_GPIO4 |
| 5 | 35 | VDET_2 | ADC1_CH7 | – | – | RTC_GPIO5 |
| 6 | 25 | GPIO25 | ADC2_CH8 | DAC_1 | – | RTC_GPIO6 |
| 7 | 26 | GPIO26 | ADC2_CH9 | DAC_2 | – | RTC_GPIO7 |
| 8 | 33 | 32K_XN | ADC1_CH5 | – | TOUCH8 | RTC_GPIO8 |
| 9 | 32 | 32K_XP | ADC1_CH4 | – | TOUCH9 | RTC_GPIO9 |
| 10 | 4 | GPIO4 | ADC2_CH0 | – | TOUCH0 | RTC_GPIO10 (also I2C_SCL* ULP) |
| 11 | 0 | GPIO0 | ADC2_CH1 | – | TOUCH1 | RTC_GPIO11 (also I2C_SDA* ULP) |
| 12 | 2 | GPIO2 | ADC2_CH2 | – | TOUCH2 | RTC_GPIO12 (also I2C_SCL* ULP) |
| 13 | 15 | MTDO | ADC2_CH3 | – | TOUCH3 | RTC_GPIO13 (also I2C_SDA* ULP) |
| 14 | 13 | MTCK | ADC2_CH4 | – | TOUCH4 | RTC_GPIO14 |
| 15 | 12 | MTDI | ADC2_CH5 | – | TOUCH5 | RTC_GPIO15 |
| 16 | 14 | MTMS | ADC2_CH6 | – | TOUCH6 | RTC_GPIO16 |
| 17 | 27 | GPIO27 | ADC2_CH7 | – | TOUCH7 | RTC_GPIO17 |

`*` I2C_SCL/SDA on RTC_GPIO10–13 are the **ULP coprocessor's RTC_I2C** peripheral
(Chapter 1), not the main digital I2C controller — don't confuse the two when
picking I2C pins.

### ADC usage rule (critical, from Chapter 31 + common Wi-Fi conflict)
- **ADC1** (GPIO32–39): usable simultaneously with Wi-Fi.
- **ADC2** (GPIO0, 2, 4, 12–15, 25–27): shares hardware with the Wi-Fi radio.
  Reading ADC2 while Wi-Fi is active is unreliable/blocked. If the project uses
  Wi-Fi, prefer ADC1-capable pins (32–39) for any analog sensor.
- Only 8 of the 18 RTC-capable pins are ADC1 (32–39, i.e. RTC_GPIO 0,1,2,3,4,5,8,9);
  the other 10 are ADC2.

### DAC
Only two GPIOs have a hardware DAC: **GPIO25 (DAC_1)** and **GPIO26 (DAC_2)**. No
other pin can produce a true analog output — everything else needing an "analog"
output must use PWM (LEDC) with an RC filter instead.

### Capacitive touch
Only the 10 GPIOs with a `TOUCHn` entry above support the touch peripheral:
GPIO0, 2, 4, 12, 13, 14, 15, 27, 32, 33.

## Strapping pins (Register 6.13, GPIO_STRAP_REG)

> "Bit5-bit0 of boot_sel_chip[5:0] correspond to MTDI, GPIO0, GPIO2, GPIO4, MTDO,
> GPIO5, respectively." — TRM Register 6.13

So the strapping pins are: **GPIO0, GPIO2, GPIO4, GPIO5, GPIO12 (MTDI), GPIO15 (MTDO)**.
Their state at the rising edge of reset selects the boot mode and other chip
options. Practical design consequences:
- **GPIO0**: LOW = download/flash mode, HIGH (or floating with internal pull-up) =
  normal boot. Never let an external circuit hold this LOW at boot unless you
  intend to enter flashing mode (this is exactly what auto-program circuits on
  dev boards do, driven by DTR/RTS).
- **GPIO2**: must not be pulled HIGH at boot in some flash-download modes; commonly
  left floating or with a light pull-down for reliable boot.
- **GPIO5**: affects SDIO timing at boot; avoid strong external pulls.
- **GPIO12 (MTDI)**: sets flash voltage (3.3 V vs 1.8 V) at boot. Do **not** add an
  external pull-up — pulling this high at boot can select the wrong flash voltage
  and prevent boot. This is a very common footgun on custom ESP32 boards.
- **GPIO15 (MTDO)**: controls whether boot log is printed; avoid external pull-down
  if you want normal console output.
- **GPIO4**: also a strapping input per the register description; avoid strong
  external pulls at boot the same as the others.

Any external circuit (LED, button, sensor, relay driver) attached to these six pins
must be checked against its resting/idle state at power-up before you finalize
GPIO assignment. When in doubt, prefer a pin **not** in this list for anything
that presents a strong pull during boot (e.g., a relay driver's base resistor).

## SPI-flash-connected pins (GPIO6–11)

Function 1 on GPIO6–11 is the chip's SPI flash interface (SPICLK/SPIQ/SPID/
SPIHD/SPIWP/SPICS0 — see Table 6.10-1). On WROOM/WROVER modules the flash die is
already wired to these pins internally, so **GPIO6–11 are not available** for
external use on those modules. On a bare ESP32 chip with flash wired elsewhere
this restriction may not apply — confirm against the specific module's datasheet
before assuming these pins are free.

## Quick classification for the GPIO selection table

Use this file to fill in the workflow's GPIO table columns:
- **Input/Output**: all listed pins support both except the six explicitly marked `I` (34–39).
- **RTC/ADC/DAC/Touch**: read off the RTC_MUX table above; anything not listed there has none of these.
- **Strapping Risk**: yes only for GPIO0, 2, 4, 5, 12, 15.
- **Flash/PSRAM Risk**: yes for GPIO6–11 (flash, module-dependent) and commonly GPIO16/17 (PSRAM on WROVER — verify per module).
- **Pull-up/down**: internal pull resistors exist on every pin except the input-only 34–39 (per Chapter 6 §6.2/6.3 pad description); default reset pull-state comes from the Reset column above.
