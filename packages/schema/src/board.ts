import { z } from 'zod';
import { ClaimIdSchema, EntityIdSchema, PadIdSchema, fact } from './primitives.js';

export const ModuleSchema = z
  .strictObject({
    id: EntityIdSchema,
    chip: z.string().describe('Chip id this module carries.'),
    bonded_pads: z.array(PadIdSchema).describe('Chip pads bonded out by the module.'),
    consumed: z
      .record(PadIdSchema, fact(z.enum(['flash', 'psram', 'usb', 'crystal', 'internal'])))
      .describe('Pads used inside the module and what uses them.'),
    flash_voltage: fact(z.number()).describe('Flash supply voltage.'),
    psram: fact(z.string()).exactOptional().describe('PSRAM fitted, if any.'),
  })
  .describe('A module (e.g. ESP32-WROOM-32E): bonded and consumed pads (catalog/modules/).');
export type Module = z.infer<typeof ModuleSchema>;

export const BoardStatusSchema = z
  .enum(['fully-verified', 'partially-verified', 'datasheet-required', 'unsupported'])
  .describe('Board status, computed by the CLI from fact statuses; validate rejects a mismatch.');
export type BoardStatus = z.infer<typeof BoardStatusSchema>;

export const ConnectorPinSchema = z
  .strictObject({
    position: z
      .number()
      .int()
      .positive()
      .describe('Physical position on the connector (numbering 3 of 3).'),
    label: z.string().describe('Silkscreen label (numbering 2 of 3).'),
    kind: z.enum(['power', 'ground', 'gpio', 'reset', 'nc', 'analog-ref']).describe('Pin kind.'),
    pad: PadIdSchema.exactOptional().describe(
      'Chip pad (gives the GPIO number); required for gpio pins.',
    ),
    rail: z.string().exactOptional().describe('Power rail name for power pins.'),
  })
  .describe('One connector/header pin.');
export type ConnectorPin = z.infer<typeof ConnectorPinSchema>;

export const BoardSchema = z
  .strictObject({
    id: EntityIdSchema.describe('Board id without revision; referenced as `<id>@<revision>`.'),
    vendor: z.string().describe('Board vendor.'),
    name: z.string().describe('Board name.'),
    revision: z.string().describe('Board revision.'),
    variants: z
      .array(
        z.strictObject({
          id: z.string().describe('Variant id.'),
          module: z.string().describe('Module id.'),
        }),
      )
      .describe('Module variants of this board revision.'),
    logic_voltage: fact(z.number()).describe('Logic voltage of the headers.'),
    rails: z
      .array(
        z.strictObject({
          name: z.string().describe('Rail name.'),
          voltage: fact(z.number()).describe('Rail voltage.'),
          max_current: fact(z.number()).describe('Rail current capacity.'),
          source: z.string().describe('What supplies the rail.'),
        }),
      )
      .describe('Power rails.'),
    connectors: z
      .array(
        z.strictObject({
          id: z.string().describe("Connector id, e.g. 'J1'."),
          side: z.enum(['left', 'right', 'top', 'bottom']).exactOptional().describe('Board side.'),
          pins: z.array(ConnectorPinSchema).describe('Pins in position order.'),
        }),
      )
      .describe('Headers and connectors.'),
    onboard: z
      .array(
        z.strictObject({
          part: z.string().describe('Onboard part.'),
          uses_pad: z.array(PadIdSchema).describe('Pads the part is wired to.'),
          effect: z.string().describe('Effect on those pads.'),
          evidence: z.array(ClaimIdSchema).describe('Claim ids (a plain list, not a fact).'),
        }),
      )
      .describe('Onboard hardware attached to pads (LEDs, USB bridge, buttons, dividers…).'),
    numbering: z
      .strictObject({
        primary: z.enum(['gpio', 'label', 'physical']).describe('Primary numbering shown.'),
      })
      .describe('Which numbering system the board documentation uses first.'),
    os_overlays: z
      .array(
        z.strictObject({
          name: z.string().describe('Overlay name.'),
          pads: z.record(z.string(), PadIdSchema).describe('Overlay role to pad.'),
          evidence: z.array(ClaimIdSchema).describe('Claim ids.'),
        }),
      )
      .exactOptional()
      .describe('OS device-tree overlays (Raspberry Pi).'),
    status: BoardStatusSchema,
  })
  .describe(
    'A board revision: connectors, labels, rails, onboard parts (catalog/boards/<id>@<rev>.yaml).',
  );
export type Board = z.infer<typeof BoardSchema>;
