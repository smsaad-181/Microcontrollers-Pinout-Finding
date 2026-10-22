import { describe, expect, it } from 'vitest';
import { DEPENDS_ON, PACKAGE_NAME } from '../src/index.js';

describe('@pinout/cli placeholder', () => {
  it('exports its package name and resolves @pinout/schema from source', () => {
    expect(PACKAGE_NAME).toBe('@pinout/cli');
    expect(DEPENDS_ON).toEqual(['@pinout/schema']);
  });
});
