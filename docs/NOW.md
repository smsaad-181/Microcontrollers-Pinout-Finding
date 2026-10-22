Doing: Two things at once. 1) The code reviewer does the last check of the foundation. 2) Two helpers collect REAL pin data from official datasheets: one for the ESP32-DevKitC board, one for the Raspberry Pi Pico and Pico W.
Why: You asked to work on the next phase at the same time. The pin data is what the website will use to tell you which pin is safe.
Folder: Check: D:\Development\pinout-finder-kit\pinout-finder (main folder). Pin data: D:\Development\pinout-finder-kit\pinout-finder-2a (a separate copy, so the two jobs cannot disturb each other)
Who: 1 reviewer + 2 data helpers. Every pin fact gets its datasheet source and a short quote. Later a second checker re-finds each fact independently.
Next: When the check passes, Phase 1 is done (push commands for you). Then the other boards: ESP32-S3, D1 mini, Arduino Uno R4, and Uno R3 (needs a PDF from you).
Needs you: Not yet. Soon: 2 datasheet PDFs that block automatic download (listed in sources/manual/README.md).
Where: Phase 1 final check + Phase 2a (real pin data) started
