Doing: Four data helpers are collecting the sensor and module data: the BME280 and MPU-6050 sensors, the SSD1306 OLED, the ST7735S display and the RFID reader, the DS18B20, DHT22 and HC-SR04, and the ADS1115, relay boards, push button and potentiometer.
Why: The website will tell you how to wire each sensor: its voltage, its addresses, the pull-up resistors, and whether it needs a level shifter. These facts come from the chip datasheets and, for the common breakout boards, from the board makers' own documents. Anything with no official document stays marked missing.
Folder: D:\Development\pinout-finder-kit\pinout-finder-2a (catalog = the data)
Who: Four data helpers in parallel. Afterwards each part gets the same independent second check as the boards.
Next: The independent checks of the sensor data. Then the Arduino Uno R3 when you provide the ATmega328P PDF. Then the 20 test cases that the pin-picking brain must pass.
Needs you: Soon: the ATmega328P PDF (Microchip) for the Arduino Uno R3, and the ST7735S PDF (Sitronix) for the display. Both are listed in sources\manual\README.md. Without the ST7735S PDF, the display uses clearly marked "interim" values from the related ST7735 datasheet.
Where: Phase 2a (real pin data) - 5 board families verified; sensor and module research started
