import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, PACKAGE_NAME } from '../src/index.js';

describe('@pinout/codegen placeholder', () => {
  it('exports its package name and resolves @pinout/schema from source', () => {
    expect(PACKAGE_NAME).toBe('@pinout/codegen');
    expect(DEPENDS_ON).toEqual(['@pinout/schema']);
  });
});
