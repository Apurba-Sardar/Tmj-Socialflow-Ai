import { JwtService } from '@nestjs/jwt';
import { Role, type RefreshToken, type User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';

const now = new Date('2026-06-30T12:00:00.000Z');

const user: User = {
  id: 'user_1',
  defaultOrganizationId: 'org_1',
  email: 'user@example.com',
  passwordHash: '',
  displayName: null,
  role: Role.USER,
  emailVerifiedAt: null,
  disabledAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('AuthService', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://socialflow:socialflow@localhost:5432/socialflow_ai';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.JWT_EMAIL_VERIFICATION_SECRET = 'c'.repeat(32);
    process.env.JWT_PASSWORD_RESET_SECRET = 'd'.repeat(32);
  });

  it('rejects public registration', async () => {
    const repository = createRepositoryMock({
      upsertHardcodedSuperAdmin: vi.fn(),
    });
    const service = new AuthService(repository, new JwtService());

    await expect(service.register({
      email: ' USER@example.com ',
      password: 'very-secure-password',
    })).rejects.toThrow('Signup is disabled.');
    expect(repository.upsertHardcodedSuperAdmin).not.toHaveBeenCalled();
  });

  it('logs in only the hardcoded Super Admin and creates a session', async () => {
    const repository = createRepositoryMock({
      upsertHardcodedSuperAdmin: vi.fn().mockResolvedValue({
        ...user,
        email: 'superadmin@tmjsocialflow.local',
        role: Role.SUPER_ADMIN,
        emailVerifiedAt: now,
      }),
    });
    const service = new AuthService(repository, new JwtService());

    const session = await service.login({
      email: 'superadmin',
      password: 'TMJ@500',
    });

    expect(repository.upsertHardcodedSuperAdmin).toHaveBeenCalledOnce();
    expect(session.user.email).toBe('superadmin@tmjsocialflow.local');
    expect(session.user.role).toBe(Role.SUPER_ADMIN);
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
  });

  it('rejects refresh token reuse and revokes the token family', async () => {
    const repository = createRepositoryMock({
      findRefreshToken: vi.fn().mockResolvedValue({
        id: 'refresh_1',
        userId: user.id,
        tokenHash: 'hash',
        familyId: 'family_1',
        expiresAt: new Date('2026-07-30T12:00:00.000Z'),
        revokedAt: now,
        replacedBy: null,
        createdAt: now,
      } satisfies RefreshToken),
    });
    const service = new AuthService(repository, new JwtService());

    await expect(service.refresh('stolen-token')).rejects.toThrow('Refresh token reuse detected.');
    expect(repository.revokeRefreshTokenFamily).toHaveBeenCalledWith('family_1');
  });

  it('rejects password reset requests', async () => {
    const repository = createRepositoryMock();
    const service = new AuthService(repository, new JwtService());

    await expect(service.requestPasswordReset({ email: 'missing@example.com' })).rejects.toThrow('Password reset is disabled.');
  });
});

function createRepositoryMock(overrides: Partial<Record<keyof AuthRepository, unknown>> = {}) {
  return {
    createUser: vi.fn(),
    createUserWithDefaultOrganization: vi.fn(),
    upsertHardcodedSuperAdmin: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    markEmailVerified: vi.fn(),
    updatePassword: vi.fn(),
    createRefreshToken: vi.fn().mockResolvedValue({}),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeRefreshTokenFamily: vi.fn(),
    revokeUserRefreshTokens: vi.fn(),
    createUserSession: vi.fn().mockResolvedValue({}),
    revokeSessionByRefreshToken: vi.fn(),
    createAuthToken: vi.fn().mockResolvedValue({}),
    findAuthToken: vi.fn(),
    markAuthTokenUsed: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}
