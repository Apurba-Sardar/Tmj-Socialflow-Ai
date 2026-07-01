import { describe, expect, it } from 'vitest';

import { createRedisConnection } from './index.js';

describe('createRedisConnection', () => {
  it('creates a Redis connection without eager command retries', () => {
    const connection = createRedisConnection({ host: 'localhost', port: 6379 });

    expect(connection.options.maxRetriesPerRequest).toBeNull();
    connection.disconnect();
  });
});
