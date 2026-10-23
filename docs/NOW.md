Doing: Four jobs run at once on the sensor data: 1) the BME280 and MPU-6050 comparison (resumed after the usage limit), 2) the SSD1306, display and RFID comparison, 3) an independent check of the ADS1115 and the two relay boards, 4) an independent check of the HC-SR04, push button and potentiometer.
Why: Each sensor fact needs two independent reads of the documents before it counts as verified. An important find: an independent reader found a copy of the real ST7735S datasheet on a public mirror (not on Sitronix's own site). Its values differ from the related ST7735 datasheet, so those facts are marked as conflicts and the stricter value is used.
Folder: D:\Development\pinout-finder-kit\pinout-finder-2a (catalog = the data, docs\validation\phase-2a = the reports)
Who: Two compare agents and two checker agents running in parallel.
Next: Compare the last two groups. Then the Arduino Uno R3 (needs your ATmega328P PDF), the 20 test cases, and the Phase 2a review. Then I give you the push commands.
Needs you: Please download the PDFs listed in sources\manual\README.md (9 items; the important ones are the ATmega328P, MPU-6050, DS18B20 and DHT22). Optional: also tell me if you accept the unofficial mirror copy of the ST7735S datasheet.
Where: Phase 2a (real pin data) - 5 board families verified; sensor data in the second-check step
