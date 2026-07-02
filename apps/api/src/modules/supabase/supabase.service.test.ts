import { beforeEach, describe, expect, it, vi } from 'vitest';

const listUsers = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers,
      },
    },
  })),
}));

describe('SupabaseService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://socialflow:socialflow@localhost:5432/socialflow_ai';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.JWT_EMAIL_VERIFICATION_SECRET = 'c'.repeat(32);
    process.env.JWT_PASSWORD_RESET_SECRET = 'd'.repeat(32);
    process.env.PINTEREST_TOKEN_ENCRYPTION_KEY = 'e'.repeat(32);
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('reports unconfigured Supabase state', async () => {
    const { SupabaseService } = await import('./supabase.service.js');
    const service = new SupabaseService();

    await expect(service.health()).resolves.toMatchObject({
      configured: false,
      connected: false,
    });
  });

  it('checks Supabase service role connectivity', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'service-role-key';
    listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null });

    const { SupabaseService } = await import('./supabase.service.js');
    const service = new SupabaseService();

    await expect(service.health()).resolves.toMatchObject({
      configured: true,
      connected: true,
    });
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1 });
  });
});
