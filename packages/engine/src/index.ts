// @pinout/engine: deterministic pin-allocation engine. Pure: no DOM, fetch, fs or clock; the catalog is
// passed in as an in-memory object.
import { PACKAGE_NAME as SCHEMA_PACKAGE } from '@pinout/schema';

export const PACKAGE_NAME = '@pinout/engine';
export const DEPENDS_ON: readonly string[] = [SCHEMA_PACKAGE];

export * from './catalog.js';
export * from './compose.js';
export * from './wiring.js';
export * from './interfaces.js';
export * from './signals.js';
