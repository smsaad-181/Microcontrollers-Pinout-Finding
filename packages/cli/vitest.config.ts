import { defineProject } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const conditions = ['@pinout/source', 'module', 'node', 'development|production'];

export default defineProject({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  // The real catalog (100+ files) is validated and compiled in several tests; 5 s is too tight under parallel load.
  test: { name: 'cli', testTimeout: 30_000 },
});
