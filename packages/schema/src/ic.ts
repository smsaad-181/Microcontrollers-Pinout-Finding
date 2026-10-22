import { z } from 'zod';
import { ClaimIdSchema, EntityIdSchema, ExprSchema, fact } from './primitives.js';

const range = () => z.tuple([z.number(), z.number()]);
const currentRange = () =>
  z.strictObject({ typ: z.number().exactOptional(), max: z.number().exactOptional() });

export const SignalSchema = z
  .strictObject({
    role: z.string().describe("Signal role, e.g. 'SDA', 'SCK', 'CS'."),
    dir: z.enum(['in', 'out', 'io']).describe('Direction seen from the IC.'),
    drive: z.enum(['push-pull', 'open-drain', 'open-collector']).describe('Output drive type.'),
    shareable: z.boolean().describe('True for bus lines that can be shared.'),
    acts_on_level: z
      .boolean()
      .exactOptional()
      .describe('True for relay/LED/MOSFET-gate/buzzer inputs (a "load").'),
    resting_level: z
      .enum(['high', 'low', 'float'])
      .exactOptional()
      .describe('Level at rest/reset.'),
  })
  .describe('One signal of an interface.');
export type Signal = z.infer<typeof SignalSchema>;

export const InterfaceKindSchema = z
  .enum(['i2c', 'spi', 'uart', 'onewire', 'analog', 'digital'])
  .describe('Interface kind.');

export const InterfaceSchema = z
  .strictObject({
    kind: InterfaceKindSchema,
    signals: z.array(SignalSchema).describe('Signals of this interface.'),
    limits: z
      .strictObject({
        max_hz: fact(z.number()).exactOptional().describe('Maximum clock.'),
        spi_modes: z.array(z.number()).exactOptional().describe('Supported SPI modes.'),
        i2c_modes: z
          .array(z.enum(['sm', 'fm', 'fmp', 'hs']))
          .exactOptional()
          .describe('Supported I2C modes.'),
        addresses: z
          .array(
            z.strictObject({
              value: z.number().describe('7-bit I2C address (decimal in YAML).'),
              strap: z.string().describe('Strap setting that selects it.'),
            }),
          )
          .exactOptional()
          .describe('I2C address options.'),
        miso_tristate_when_deselected: fact(z.boolean())
          .exactOptional()
          .describe('MISO released when CS high.'),
        tscyc_min_s: fact(z.number()).exactOptional().describe('Minimum SPI clock period (s).'),
        analog_range_v: fact(range()).exactOptional().describe('Analog output range (V).'),
      })
      .describe('Interface limits.'),
  })
  .describe('One interface an IC supports.');
export type Interface = z.infer<typeof InterfaceSchema>;

export const ICSchema = z
  .strictObject({
    id: EntityIdSchema,
    vendor: z.string().describe('IC vendor.'),
    part: z.string().describe('Part number.'),
    interfaces: z.array(InterfaceSchema).describe('Supported interfaces.'),
    select_strap: z
      .strictObject({
        pins: z.array(z.string()).describe('Strap pins.'),
        table: z
          .array(
            z.strictObject({
              value: z.record(z.string(), z.literal([0, 1])).describe('Pin levels.'),
              selects: InterfaceKindSchema,
            }),
          )
          .describe('Strap levels to interface.'),
        evidence: z.array(ClaimIdSchema).describe('Claim ids.'),
      })
      .exactOptional()
      .describe('Interface-select strap (omit when none; never null).'),
    vdd_range: fact(range()).describe('Supply range (V).'),
    vio_range: fact(range()).describe('I/O supply range (V).'),
    input_abs_max: fact(ExprSchema).describe('Absolute maximum input voltage.'),
    logic_levels: z
      .strictObject({
        vih_min: fact(ExprSchema),
        vil_max: fact(ExprSchema),
        voh_min: fact(ExprSchema).exactOptional(),
        vol_max: fact(ExprSchema).exactOptional(),
      })
      .exactOptional()
      .describe('Logic thresholds.'),
    supply_current: fact(currentRange()).describe('Supply current (typ/max).'),
  })
  .describe(
    'A sensor/peripheral IC: interfaces, timing, addresses, voltage limits (catalog/ics/).',
  );
export type IC = z.infer<typeof ICSchema>;

export const BreakoutSchema = z
  .strictObject({
    id: EntityIdSchema,
    ic: z.string().describe('IC id on the breakout.'),
    vendor: z.string().describe('Breakout vendor.'),
    variant_names: z.array(z.string()).describe('Names the breakout is sold under.'),
    pins: z
      .array(
        z.strictObject({
          label: z.string().describe('Pin label.'),
          maps_to: z.string().describe("Signal role, or 'VCC' | 'GND' | 'NC'."),
        }),
      )
      .describe('Breakout pins.'),
    regulator: fact(
      z.strictObject({ present: z.boolean(), vin_range: range().exactOptional() }),
    ).describe('Onboard regulator.'),
    level_shifter: fact(z.boolean()).describe('Onboard level shifter.'),
    pullups: z
      .array(z.strictObject({ line: z.string().describe('Line.'), value_ohm: fact(z.number()) }))
      .describe('Onboard pull-ups.'),
    hardwired: z
      .array(
        z.strictObject({
          strap: z.string().describe('Strap.'),
          value: z.union([z.string(), z.number()]).describe('Hardwired value.'),
        }),
      )
      .describe('Hardwired straps.'),
    interfaces_exposed: z.array(InterfaceKindSchema).describe('Interfaces reachable on the pins.'),
    supply_current: fact(currentRange()).describe('Supply current (typ/max).'),
    notes: z.string().exactOptional().describe('Free-text notes.'),
  })
  .describe('A breakout module wrapping an IC (catalog/breakouts/).');
export type Breakout = z.infer<typeof BreakoutSchema>;
