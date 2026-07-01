import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController integration', () => {
  it('returns a healthy service status', () => {
    const controller = new HealthController();

    expect(controller.check()).toMatchObject({
      status: 'ok',
      service: 'socialflow-api',
    });
  });
});
