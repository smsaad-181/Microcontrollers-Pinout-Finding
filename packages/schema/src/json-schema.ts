import { z } from 'zod';
import { BoardSchema, ModuleSchema } from './board.js';
import { ChipSchema } from './chip.js';
import { EvidenceSchema } from './evidence.js';
import { BreakoutSchema, ICSchema } from './ic.js';
import { PinViewSchema } from './pin-view.js';
import { FixtureSchema, ProjectSchema, RecommendationSchema, WarningSchema } from './project.js';

/** Every top-level schema, keyed by the file stem used for `dist/<name>.schema.json`. */
export const ENTITY_SCHEMAS = {
  evidence: EvidenceSchema,
  chip: ChipSchema,
  module: ModuleSchema,
  board: BoardSchema,
  ic: ICSchema,
  breakout: BreakoutSchema,
  fixture: FixtureSchema,
  project: ProjectSchema,
  warning: WarningSchema,
  recommendation: RecommendationSchema,
  'pin-view': PinViewSchema,
} as const;

export type JsonSchemaName = keyof typeof ENTITY_SCHEMAS;
export const JSON_SCHEMA_NAMES = Object.keys(ENTITY_SCHEMAS) as JsonSchemaName[];

export type JsonSchemaDocument = z.core.JSONSchema.JSONSchema;

/** JSON Schema (draft 2020-12) for each entity, for editor autocomplete on catalog YAML. */
export function jsonSchemas(): Record<JsonSchemaName, JsonSchemaDocument> {
  const out = {} as Record<JsonSchemaName, JsonSchemaDocument>;
  for (const name of JSON_SCHEMA_NAMES) {
    out[name] = z.toJSONSchema(ENTITY_SCHEMAS[name], { target: 'draft-2020-12', io: 'input' });
  }
  return out;
}
