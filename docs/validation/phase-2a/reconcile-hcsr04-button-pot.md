# Reconcile: HC-SR04, push-button, potentiometer-10k (2026-10-23)

Audit: audit-hcsr04-button-pot.yaml. No commits made.

Files changed: catalog/ics/{hc-sr04,push-button,potentiometer-10k}.yaml, catalog/breakouts/{hc-sr04-4pin,potentiometer-10k}.yaml, catalog/evidence/{hc-sr04-elecfreaks-ds,bourns-3386-ds-rev-12-24}.yaml.

## Status counts (facts)
- hc-sr04 (IC): verified 2 (vdd_range, supply_current); missing 5 (input_abs_max, vio_range, vih_min, vil_max, voh_min)
- hc-sr04-4pin (breakout): verified 1 (supply_current); missing 2 (regulator, level_shifter)
- push-button (IC): missing 4 (vdd_range, input_abs_max, supply_current, vio_range)
- push-button (breakout): missing 4 (level_shifter, regulator, pullup, supply_current)
- potentiometer-10k (IC): missing 5 (input_abs_max, supply_current, vdd_range, vio_range, analog_range_v)
- potentiometer-10k (breakout): missing 3 (level_shifter, regulator, supply_current)
- No conflicts.

## Missing, one-line reasons
- hc-sr04 echo_voh (voh_min): datasheet only says "TTL lever signal", no voltage (garbled wording); not inferred from 5 V supply.
- hc-sr04 vih/vil, input_abs_max, vio_range, regulator, level_shifter: not stated in the 3-page datasheet.
- push-button vdd_range: placeholder 3-24 V was the Omron B3F contact rating, not a supply range; set missing, value null.
- push-button input_abs_max: none stated; defers to a separate Omron precautions document (not opened).
- potentiometer input_abs_max: placeholder 300 V was Bourns 3386 power-rating voltage, not an input limit; set missing, value null.
- Passive-part supply_current / vdd_range / vio_range: not applicable, no document states them.

## Notes recorded
- Plain HC-SR04 is DC 5 V only; HC-SR04-33 (3.3-5 V) is a different product, not merged.
- Datasheet "Working Frequency 40Hz" is a unit typo for 40 kHz (evidence claims #freq-table-typo and #burst-freq added).
- Bourns 3386 is a trimmer (rotational life 200 cycles, claim #trimmer-life added); representative part only. Taper not stated, so "linear" was removed from the part string.

## Judgement flag
supply_current 15 mA: both agree on the number, but the datasheet gives no typ/max qualifier. Kept verified with value {typ: 15}; the note says the typ slot is a schema convention. Reviewer may prefer to downgrade.

## Validate
catalog validate: 0 errors, 0 warnings in 94 files (root: catalog), exit 0
