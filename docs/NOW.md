Doing: The ESP32 chip data is verified and saved. Now four jobs run at once: 1) comparing the ESP32 modules and board, 2) collecting ESP32-S3 pin data, 3) collecting Arduino Uno R4 Minima pin data, 4) collecting LOLIN D1 mini pin data.
Why: Phase 2a needs real, source-backed pin data for 6 boards. Done so far: Raspberry Pi Pico, Pico W and the ESP32 chip. A second, independent check follows for each new board.
Folder: D:\Development\pinout-finder-kit\pinout-finder-2a (catalog = the data, docs\validation\phase-2a = the reports)
Who: One compare agent and three data helpers, each working on its own files.
Next: Independent checks and comparisons for the three new boards. The Arduino Uno R3 and the TFT display need two PDFs from you (see below).
Needs you: Later: download 2 PDFs that block automatic download: the ATmega328P datasheet (Microchip) and the ST7735S datasheet (Sitronix). They are listed in sources\manual\README.md. Not needed yet.
Where: Phase 2a (real pin data) - 3 of 6 boards done, 3 in progress
