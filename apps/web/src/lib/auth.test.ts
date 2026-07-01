import { describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_COOKIE } from './auth-constants';

describe('auth constants', () => {
  it('uses the API access-token cookie name', () => {
    expect(ACCESS_TOKEN_COOKIE).toBe('sf_access_token');
  });
});
