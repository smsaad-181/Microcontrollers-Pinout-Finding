Doing: A helper is adding the missing safety tests the code reviewer asked for, and fixing a few small checker weaknesses.
Why: The code reviewer broke the code on purpose in 107 ways. 21 of those breaks went unnoticed by the tests, 4 of them on hardware-critical rules. The code is correct today, but without tests a later change could silently break it.
Folder: D:\Development\pinout-finder-kit\pinout-finder\packages\schema, packages\cli and apps\web\test
Who: One helper agent, writing tests that must fail when the code is broken. I check them myself afterwards.
Next: Then I run all three reviewers once more. This is the last allowed fix round, so if a reviewer fails the phase again I stop and ask you what to do.
Needs you: Nothing right now.
Where: Phase 1 of 6 (foundation) - fix round 3 of 3 (the last)
