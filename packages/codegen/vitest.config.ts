import { defineProject } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const conditions = ['@pinout/source', 'module', 'node', 'development|production'];

export default defineProject({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: { name: 'codegen' },
});
