// Stub entry point for `pnpm catalog:validate` / `pnpm catalog:compile` (implemented in tasks 1.3/1.4).
const args = process.argv.slice(2);
console.error(`pinout catalog: not implemented (argv: ${JSON.stringify(args)})`);
process.exitCode = 1;
