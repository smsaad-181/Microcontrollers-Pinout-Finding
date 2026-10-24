// Virtual module provided by the single-file build plugin (src/singleFile.ts).
declare module 'virtual:inline-catalog' {
  /** Exact text of `catalog-manifest.json` at build time. */
  export const manifestText: string;
  /** File name of the catalog the manifest names (`<version>.json`). */
  export const catalogFile: string;
  /** Exact text of that catalog file (its SHA-256 matches the manifest). */
  export const catalogText: string;
}
