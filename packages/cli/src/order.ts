// One definition of "sorted" for the whole CLI: UTF-16 code-unit order, never locale-dependent.
import type { Diagnostic } from './types.js';

/** Compare two strings by UTF-16 code unit (locale independent, so the same on every machine). */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Diagnostic order: file, then path, then code (all by code unit). */
export const compareDiagnostics = (a: Diagnostic, b: Diagnostic): number =>
  byCodeUnit(a.file, b.file) || byCodeUnit(a.path, b.path) || byCodeUnit(a.code, b.code);
