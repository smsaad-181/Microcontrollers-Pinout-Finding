import { z } from 'zod';
import { EntityIdSchema, ExprSchema, PadIdSchema, fact } from './primitives.js';

export const RoutingSchema = z
  .enum(['iomux', 'matrix', 'fixed'])
  .describe(
    'How a function reaches a pad: dedicated IO_MUX, GPIO matrix, or fixed (analog/dedicated).',
  );
export type Routing = z.infer<typeof RoutingSchema>;

export const ResetStateSchema = z
  .enum(['input', 'pullup', 'pulldown', 'disabled', 'output-high', 'output-low'])
  .describe('Pad state during and right after reset.');
export type ResetState = z.infer<typeof ResetStateSchema>;

export const PadFunctionSchema = z
  .strictObject({
    fn: z
      .string()
      .describe("Function name, e.g. 'GPIO', 'SPI3.SCK', 'I2C.SDA', 'ADC1_CH4', 'UART0.TX'."),
    routing: RoutingSchema,
    max_hz: fact(z.number())
      .exactOptional()
      .describe('Maximum frequency for this function on this pad.'),
  })
  .describe('One function a pad can carry.');
export type PadFunction = z.infer<typeof PadFunctionSchema>;

export const StrapValueSchema = z
  .union([
    z.strictObject({
      role: z.string().describe('What the strap selects at reset.'),
      required_at_reset: z.enum(['low', 'high', 'any']).describe('Level required for normal boot.'),
      default_pull: z
        .enum(['up', 'down', 'none'])
        .exactOptional()
        .describe('Internal default pull; omitted when the sources do not state it.'),
    }),
    z.literal('none'),
  ])
  .describe("Strap role of a pad, or 'none'.");

export const PowerUpGlitchSchema = z
  .union([
    z.strictObject({
      level: z.enum(['high', 'low']).describe('Glitch level.'),
      duration_s: z.number().describe('Glitch duration in seconds.'),
    }),
    z.literal('none'),
  ])
  .describe("Documented power-up glitch, or 'none'.");

export const PadSchema = z
  .strictObject({
    gpio: z
      .number()
      .int()
      .nonnegative()
      .exactOptional()
      .describe(
        'Chip GPIO number (numbering system 1 of 3). Omit for a pad that is not a GPIO (e.g. the ESP8266 TOUT ADC input); such a pad is identified only by its record key, which is its stable name.',
      ),
    functions: z.array(PadFunctionSchema).describe('Functions with routing class.'),
    input_only: fact(z.boolean()).describe('True when the pad cannot drive an output.'),
    reset_state: fact(ResetStateSchema).describe('State at reset.'),
    strap: fact(StrapValueSchema).describe("Strap role and required level, or explicit 'none'."),
    adc: z
      .strictObject({
        unit: z.string().describe("ADC unit, e.g. 'ADC1'."),
        channel: z.number().int().nonnegative().describe('ADC channel number.'),
        radio_conflict: fact(z.boolean()).describe(
          'True when the channel is unusable while the radio is on.',
        ),
      })
      .exactOptional()
      .describe('ADC unit/channel on this pad.'),
    dac: z
      .strictObject({ channel: z.number().int().nonnegative().describe('DAC channel.') })
      .exactOptional()
      .describe('DAC channel on this pad.'),
    touch: z
      .strictObject({ channel: z.number().int().nonnegative().describe('Touch channel.') })
      .exactOptional()
      .describe('Touch channel on this pad.'),
    jtag: z.string().exactOptional().describe("JTAG signal on this pad, e.g. 'MTMS'."),
    power_up_glitch: fact(PowerUpGlitchSchema).describe("Power-up glitch, or explicit 'none'."),
    errata: z.array(z.string()).describe('Errata ids affecting this pad (empty when none found).'),
  })
  .describe('A chip pad and its facts.');
export type Pad = z.infer<typeof PadSchema>;

const PullRangeSchema = z.strictObject({
  min: z.number().exactOptional(),
  typ: z.number().exactOptional(),
  max: z.number().exactOptional(),
});

export const ElectricalSchema = z
  .strictObject({
    vih_min: fact(ExprSchema).describe('Minimum input-high voltage.'),
    vil_max: fact(ExprSchema).describe('Maximum input-low voltage.'),
    voh_min: fact(ExprSchema).describe('Minimum output-high voltage.'),
    vol_max: fact(ExprSchema).describe('Maximum output-low voltage.'),
    abs_max_vin: fact(ExprSchema).describe('Absolute maximum input voltage.'),
    pin_current_max: fact(z.number()).describe('Maximum current per pin (mA).'),
    port_current_max: fact(z.number()).exactOptional().describe('Maximum current per port (mA).'),
    vcc_pin_current_max: fact(z.number())
      .exactOptional()
      .describe('Maximum current per VCC pin (mA).'),
    cumulative_current_max: fact(z.number()).describe('Maximum total current of all pins (mA).'),
    internal_pull_ohm: fact(PullRangeSchema)
      .exactOptional()
      .describe('Internal pull resistance range.'),
  })
  .describe('Chip electrical limits.');

export const PeripheralSchema = z
  .strictObject({
    kind: z
      .enum(['spi', 'i2c', 'uart', 'adc', 'pwm', 'onewire-capable'])
      .describe('Peripheral class.'),
    iomux_pins: z
      .record(z.string(), PadIdSchema)
      .exactOptional()
      .describe('Dedicated IO_MUX pad per role.'),
    matrix_routable: z
      .boolean()
      .describe('True when the peripheral can be routed via the GPIO matrix.'),
    limits: z
      .strictObject({
        matrix_max_hz: fact(z.number()).exactOptional().describe('Max clock via the matrix.'),
        iomux_max_hz: fact(z.number()).exactOptional().describe('Max clock via IO_MUX.'),
      })
      .exactOptional()
      .describe('Clock limits per routing class.'),
    adc_effective_range_mv: fact(z.record(z.string(), z.tuple([z.number(), z.number()])))
      .exactOptional()
      .describe('Usable ADC input range in mV per attenuation.'),
  })
  .describe('A chip peripheral instance.');

export const ChipSchema = z
  .strictObject({
    id: EntityIdSchema,
    vendor: z.string().describe('Chip vendor.'),
    family: z.string().describe('Chip family.'),
    series: z.string().describe('Chip series.'),
    revisions: z.array(z.string()).describe('Silicon revisions covered.'),
    vdd_io: fact(z.number()).describe('I/O supply voltage.'),
    electrical: ElectricalSchema,
    pads: z.record(PadIdSchema, PadSchema).describe('Pads keyed by pad id.'),
    peripherals: z
      .record(z.string(), PeripheralSchema)
      .describe("Peripherals keyed by instance name, e.g. 'SPI3', 'I2C0', 'ADC1'."),
  })
  .describe('A chip (SoC/MCU): pads, straps, electrical limits and peripherals (catalog/chips/).');
export type Chip = z.infer<typeof ChipSchema>;
