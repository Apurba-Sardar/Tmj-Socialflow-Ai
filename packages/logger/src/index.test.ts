import { describe, expect, it } from 'vitest';

import { createLogger } from './index.js';

describe('createLogger', () => {
  it('creates a named logger with the requested level', () => {
    const logger = createLogger('test-logger', 'debug');

    expect(logger.level).toBe('debug');
    expect(logger.bindings().name).toBe('test-logger');
  });
});
