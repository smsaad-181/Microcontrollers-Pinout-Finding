# Manual downloads requested

Some publishers block automated downloads. Please download these files from the official site and put
them in this folder (they are git-ignored; only their SHA-256 hashes go into the catalog). Then tell
Claude "continue".

| # | Document | Publisher | Official location | Why it is needed | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | ATmega48A/PA/88A/PA/168A/PA/328/P datasheet (DS40002061, latest revision) | Microchip | microchip.com → ATmega328P product page → Documentation → Data Sheets | Arduino UNO R3: per-pin and VCC/GND current limits, VIH/VIL, pull-up range | requested |
| 2 | ST7735S datasheet (latest revision) | Sitronix | Sitronix or your display vendor's download page | Confirm serial write cycle (tSCYCW), VDDI range and input limits for the ST7735S (planning only found ST7735 V1.9/V2.1) | requested |

Name files as you like; Claude will hash and identify them. Add more rows here when an agent requests them.
