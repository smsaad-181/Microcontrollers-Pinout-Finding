// @pinout/schema — Zod schemas for the evidence-backed pinout catalog (skill `catalog-schema`).
// Pure: no fs, no network.
export const PACKAGE_NAME = '@pinout/schema';

export * from './primitives.js';
export * from './evidence.js';
export * from './chip.js';
export * from './board.js';
export * from './ic.js';
export * from './project.js';
export * from './pin-view.js';
export * from './fact-rules.js';
export * from './json-schema.js';
