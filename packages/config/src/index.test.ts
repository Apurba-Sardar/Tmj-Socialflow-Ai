import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './index.js';

describe('loadEnvironment', () => {
  it('validates and normalizes environment values', () => {
    const environment = loadEnvironment({
      DATABASE_URL: 'postgresql://socialflow:socialflow@localhost:5432/socialflow_ai',
      REDIS_URL: 'redis://localhost:6379',
      API_PORT: '4000',
      REDIS_PORT: '6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      JWT_EMAIL_VERIFICATION_SECRET: 'c'.repeat(32),
      JWT_PASSWORD_RESET_SECRET: 'd'.repeat(32),
      PINTEREST_TOKEN_ENCRYPTION_KEY: 'e'.repeat(32),
    });

    expect(environment.API_PORT).toBe(4000);
    expect(environment.REDIS_PORT).toBe(6379);
    expect(environment.NODE_ENV).toBe('development');
  });
});
