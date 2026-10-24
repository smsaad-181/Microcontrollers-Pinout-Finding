// Plain-language wording for the Results screen. Pure presentation: it only rewords what the engine
// decided. It never changes a warning's level, hides one, or drops the engine's own message
// (the screen always keeps that under "Technical detail"). Unknown codes fall back to the engine text.
import type { Warning } from '@pinout/schema';
import type { WarningLevel } from './explain';

export interface PlainWarning {
  /** What the problem is, in one sentence. */
  what: string;
  /** What to do about it. */
  todo: string;
}

export const PLAIN_WARNINGS: Readonly<Record<string, PlainWarning>> = {
  FLOATING_AT_RESET_LOAD: {
    what: 'While the board starts up, this pin is not driven. Whatever is wired to it (a relay, LED or motor) can switch on by itself for a moment.',
    todo: 'Add the pull resistor listed under "You also need" so the pin sits at a safe level at start-up.',
  },
  FLOATING_AT_RESET_UNKNOWN: {
    what: 'We could not confirm what level this pin has while the board starts up.',
    todo: 'Add a pull resistor to the safe level, or check the chip datasheet before connecting anything that must not switch on at power-up.',
  },
  STRAP_LEVEL_MISMATCH: {
    what: 'This is a boot pin. What is wired to it can pull it to the wrong level at power-up and stop the board from starting.',
    todo: 'Unplug the module while uploading code or resetting, or choose another pin for it.',
  },
  STRAP_FACT_MISSING: {
    what: 'We do not know for sure if this is a boot pin.',
    todo: 'Check the chip datasheet for this pin before you rely on it.',
  },
  ONBOARD_LOAD_ON_PAD: {
    what: 'Something on the board itself (such as an LED or a button) is already connected to this pin.',
    todo: 'Expect it to light up or react, or pick another pin if that is a problem.',
  },
  FACT_CONFLICT_RELIED: {
    what: 'Two sources disagree about a fact this pin choice depends on.',
    todo: 'Open "Why these pins? (sources)", compare the sources, and check against your own board.',
  },
  PIN_CURRENT_UNVERIFIED: {
    what: 'We could not confirm how much current this pin can safely give.',
    todo: 'Do not power a load (motor, relay coil, LED strip) straight from the pin. Use a transistor or driver board.',
  },
  NO_INTERNAL_PULL_UP_ON_GPIO16: {
    what: 'This pin has no built-in pull-up.',
    todo: 'If the module needs a pull-up, add an external resistor (about 10 kOhm to 3V3).',
  },
  ERRATUM_GPIO_3_11: {
    what: 'Chip bug: this input can show a very short false pulse when the analog part of the chip wakes up.',
    todo: 'Debounce the signal in your code (ignore very short pulses).',
  },
  ADC_RANGE_UNKNOWN: {
    what: 'We could not confirm the voltage range this analog pin can read.',
    todo: 'Keep the signal between 0 V and 3.3 V, or check the datasheet.',
  },
  ADC_OVER_RANGE: {
    what: 'The sensor can output more voltage than this analog pin can safely read.',
    todo: 'Add a voltage divider (two resistors) so the signal never goes above 3.3 V.',
  },
  ADC_RADIO_UNKNOWN: {
    what: 'We could not confirm if this analog pin still works while Wi-Fi is on.',
    todo: 'Test the readings with Wi-Fi running, or use a pin that is known to work.',
  },
  I2C_PULLUP_UNKNOWN: {
    what: 'The I2C (2-wire bus) needs pull-up resistors on its two wires, and we do not know if your modules already have them.',
    todo: 'Most breakout boards include them. If the sensor is not found, add 4.7 kOhm from SDA to 3V3 and from SCL to 3V3.',
  },
  I2C_PULLUP_OUT_OF_RANGE: {
    what: 'The pull-up resistors on the I2C (2-wire bus) look too strong or too weak for this bus.',
    todo: 'Change the pull-up value as the technical detail says, or lower the bus speed.',
  },
  I2C_ADDRESS_UNKNOWN: {
    what: 'We do not know the I2C address of one of the modules, so we cannot rule out two devices using the same address.',
    todo: 'Run an I2C scanner sketch once wired, and check that every device shows a different address.',
  },
  I2C_ADDRESS_SDA_STRAP_TIMING: {
    what: 'The I2C address of a module is set by a pin that is read at power-up, and the bus can disturb it.',
    todo: 'Power the module before the board, or tie the address pin firmly to its level.',
  },
  LONG_WIRE_BUS: {
    what: 'Long wires make a bus unreliable.',
    todo: 'Keep the wires short (under about 30 cm), or lower the speed in your code.',
  },
  LEVEL_SHIFTER_UNKNOWN: {
    what: 'The module and the board may use different signal voltages (3.3 V and 5 V), and we do not know if the module converts them.',
    todo: 'If the module runs at 5 V, put a level shifter between its signal pins and the board. A 5 V signal can damage a 3.3 V pin.',
  },
  LEVEL_SHIFTER_CONFLICT_RELIED: {
    what: 'Sources disagree about whether this module converts signal voltages.',
    todo: 'Check the module yourself. When in doubt, add a level shifter.',
  },
  LOGIC_LEVEL_UNKNOWN: {
    what: 'We could not confirm which signal voltage this module uses (3.3 V or 5 V).',
    todo: 'Check the module datasheet. If it outputs 5 V, add a level shifter before the board pin.',
  },
  R2_LOGIC_LEVEL_MISMATCH: {
    what: 'The module signals at a voltage the board cannot read reliably.',
    todo: 'Add a level shifter between the module and the board.',
  },
  R1_ABS_MAX_EXCEEDED: {
    what: 'The module can output more voltage than this pin can take. That can damage the board.',
    todo: 'Do not connect it directly. Use a level shifter or a voltage divider.',
  },
  MODULE_REGULATOR_UNKNOWN: {
    what: 'We do not know if the module has its own voltage regulator, so we do not know which supply voltage is safe.',
    todo: 'Read the label or datasheet of the module and power it only from the voltage it allows.',
  },
  RAIL_BUDGET_UNKNOWN: {
    what: 'We do not know how much current the board can supply on one of its power pins.',
    todo: 'Keep the total load small, or power big loads (relays, motors, LED strips) from a separate supply with a shared GND.',
  },
  RAIL_BUDGET_EXCEEDED: {
    what: 'The modules need more current than this power pin can give.',
    todo: 'Power the biggest loads from a separate supply and connect its GND to the board GND.',
  },
  MISO_SHARE_UNPROVEN: {
    what: 'Several modules share the SPI data-out wire (MISO), and we could not prove that they let go of it when not selected.',
    todo: 'Test with one module at a time, or give each module its own chip-select pin and check the datasheets.',
  },
  DATASHEET_REQUIRED: {
    what: 'The catalog has no verified data for this part, so the pin choice is a best guess.',
    todo: 'Read the datasheet of the part and compare it with the wiring before you power it up.',
  },
  BUDGET_EXHAUSTED: {
    what: 'The search stopped early, so this may not be the best answer.',
    todo: 'Try again with fewer modules or fewer locked pins.',
  },
  NO_INTERFACE: {
    what: 'No way was found to connect one of the modules to this board.',
    todo: 'Pick another module version or another board.',
  },
  BREAKOUT_PIN_UNMAPPED: {
    what: 'One pin on a module is not matched to any signal.',
    todo: 'Check the pin names printed on the module against the list below.',
  },
  LOCK_UNMATCHED: {
    what: 'A pin you locked does not match any signal of the module.',
    todo: 'Remove or change the lock on the Your rules screen.',
  },
  UNKNOWN_BOARD: {
    what: 'The board is not in the catalog.',
    todo: 'Choose a board from the list.',
  },
  UNKNOWN_MODULE: {
    what: 'A module is not in the catalog.',
    todo: 'Choose a module from the list.',
  },
  UNKNOWN_BREAKOUT: {
    what: 'A module is not in the catalog.',
    todo: 'Choose a module from the list.',
  },
  UNKNOWN_CHIP: {
    what: 'The chip of a board or module is not in the catalog.',
    todo: 'Choose another board or module.',
  },
};

/** Three groups the user sees. Levels are never merged away: each warning stays in its own group. */
export type WarningGroupId = 'fix' | 'check' | 'know';

export interface WarningGroupMeta {
  id: WarningGroupId;
  title: string;
  icon: string;
  hint: string;
  levels: readonly WarningLevel[];
}

export const WARNING_GROUPS: readonly WarningGroupMeta[] = [
  {
    id: 'fix',
    title: 'Fix before you wire',
    icon: '⛔',
    hint: 'These can damage a part or stop the board starting.',
    levels: ['critical'],
  },
  {
    id: 'check',
    title: 'Check this',
    icon: '▲',
    hint: 'These are likely to cause trouble unless you act on them.',
    levels: ['warning'],
  },
  {
    id: 'know',
    title: 'Good to know',
    icon: 'ℹ',
    hint: 'Facts we could not confirm, or small things to be aware of.',
    levels: ['caution', 'info'],
  },
];

export function groupOf(level: WarningLevel): WarningGroupId {
  return WARNING_GROUPS.find((g) => g.levels.includes(level))?.id ?? 'fix';
}

/** Plain text for a warning, or null when the code is unknown (the screen then shows the engine text). */
export function plainWarning(w: Warning): PlainWarning | null {
  return PLAIN_WARNINGS[w.code] ?? null;
}

/** Interface names a beginner can read. */
export const PLAIN_INTERFACE: Record<string, string> = {
  i2c: 'I2C (2-wire bus)',
  spi: 'SPI (4-wire bus)',
  uart: 'UART (serial)',
  onewire: '1-Wire (single data wire)',
  analog: 'Analog (reads a voltage)',
  digital: 'Digital (on/off)',
};

/** Signal roles with a short explanation, for the wiring lists. */
export const PLAIN_ROLES: Record<string, string> = {
  SDA: 'data',
  SCL: 'clock',
  SCK: 'clock',
  MOSI: 'data out',
  MISO: 'data in',
  CS: 'chip select',
  SS: 'chip select',
  TX: 'transmit',
  RX: 'receive',
  DATA: 'data',
  DQ: 'data',
  OUT: 'signal',
  IN: 'control input',
  SW: 'switch',
};

/** "Module pin -> Board pin" line. */
export function wireLine(modulePin: string, boardPin: string, where: string): string {
  return `${modulePin} -> ${boardPin} (${where})`;
}
