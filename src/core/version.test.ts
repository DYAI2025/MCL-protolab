import { describe, expect, it } from 'vitest';
import { RUNTIME_FOUNDATION_VERSION } from './version.ts';

describe('runtime foundation', () => {
  it('exposes a version marker so the unit gate has something real to run', () => {
    expect(RUNTIME_FOUNDATION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
