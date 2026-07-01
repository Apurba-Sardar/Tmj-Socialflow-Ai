import { JwtService } from '@nestjs/jwt';
import { Role, type RefreshToken, type User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AuthEmailService } from './email.service.js';

const now = new Date('2026-06-30T12:00:00.000Z');

const user: User = {
  id: 'user_1',
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

  it('registers a user, queues verification, and creates a session', async () => {
    const repository = createRepositoryMock({
      findUserByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockResolvedValue({ ...user, passwordHash: 'hashed' }),
    });
    const emailService = createEmailServiceMock();
    const service = new AuthService(repository, new JwtService(), emailService);

    const session = await service.register({
      email: ' USER@example.com ',
      password: 'very-secure-password',
    });

    expect(repository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
    expect(emailService.sendEmailVerification).toHaveBeenCalledOnce();
    expect(session.user.email).toBe('user@example.com');
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
    const service = new AuthService(repository, new JwtService(), createEmailServiceMock());

    await expect(service.refresh('stolen-token')).rejects.toThrow('Refresh token reuse detected.');
    expect(repository.revokeRefreshTokenFamily).toHaveBeenCalledWith('family_1');
  });

  it('uses a generic response for unknown password reset emails', async () => {
    const repository = createRepositoryMock({
      findUserByEmail: vi.fn().mockResolvedValue(null),
    });
    const emailService = createEmailServiceMock();
    const service = new AuthService(repository, new JwtService(), emailService);

    await expect(service.requestPasswordReset({ email: 'missing@example.com' })).resolves.toBeUndefined();
    expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
  });
});

function createRepositoryMock(overrides: Partial<Record<keyof AuthRepository, unknown>> = {}) {
  return {
    createUser: vi.fn(),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    markEmailVerified: vi.fn(),
    updatePassword: vi.fn(),
    createRefreshToken: vi.fn().mockResolvedValue({}),
    findRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeRefreshTokenFamily: vi.fn(),
    revokeUserRefreshTokens: vi.fn(),
    createAuthToken: vi.fn().mockResolvedValue({}),
    findAuthToken: vi.fn(),
    markAuthTokenUsed: vi.fn(),
    ...overrides,
  } as unknown as AuthRepository;
}

function createEmailServiceMock() {
  return {
    sendEmailVerification: vi.fn(),
    sendPasswordReset: vi.fn(),
  } as unknown as AuthEmailService;
}
