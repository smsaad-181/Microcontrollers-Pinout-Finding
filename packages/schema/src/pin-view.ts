// ADDITION — not part of the normative `catalog-schema` reference. PHASE-1 task 1.2 lists a "Pin view"
// but neither the reference nor skill `pin-allocation-engine` defines its shape. This is a minimal,
// provisional output shape for the Phase 2b composer (Chip → Module → Board stacking); it is never
// stored in the catalog and may be revised in task 2b.2.
import { z } from 'zod';
import { PadFunctionSchema } from './chip.js';
import { ConnectorPinSchema } from './board.js';
import { ClaimIdSchema, PadIdSchema } from './primitives.js';

export const PinFlagSchema = z
  .enum([
    'input-only',
    'strap',
    'consumed',
    'onboard',
    'jtag',
    'power-up-glitch',
    'adc-radio-conflict',
    'unverified',
  ])
  .describe('Computed caution flag on a composed pin.');
export type PinFlag = z.infer<typeof PinFlagSchema>;

export const PinViewSchema = z
  .strictObject({
    connector: z.string().describe('Connector id (numbering 3 of 3, with position).'),
    position: ConnectorPinSchema.shape.position,
    label: z.string().describe('Silkscreen label (numbering 2 of 3).'),
    kind: ConnectorPinSchema.shape.kind,
    pad: PadIdSchema.exactOptional().describe('Chip pad, for gpio pins.'),
    gpio: z
      .number()
      .int()
      .nonnegative()
      .exactOptional()
      .describe('Chip GPIO number (numbering 1 of 3).'),
    functions: z
      .array(PadFunctionSchema)
      .describe('Effective functions after stacking chip, module and board.'),
    flags: z.array(PinFlagSchema).describe('Computed caution flags.'),
    evidence: z.array(ClaimIdSchema).describe('Claim ids behind the composed view.'),
  })
  .describe(
    'PROVISIONAL (addition, not in the reference): one board pin with its effective, computed capabilities.',
  );
export type PinView = z.infer<typeof PinViewSchema>;
