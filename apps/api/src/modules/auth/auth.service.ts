import { randomBytes, createHash, randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { hash } from 'bcryptjs';

import { loadEnvironment } from '@socialflow/config';

import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthenticatedUser, JwtAccessPayload } from './types.js';

const SUPERADMIN_USER_ID = 'superadmin';
const SUPERADMIN_EMAIL = 'superadmin@tmjsocialflow.local';
const SUPERADMIN_PASSWORD = 'TMJ@500';

interface AuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  rememberMe?: boolean;
}

@Injectable()
export class AuthService {
  private readonly env = loadEnvironment();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  register(dto: RegisterDto, metadata: SessionMetadata = {}): Promise<AuthSession> {
    void dto;
    void metadata;
    throw new ForbiddenException('Signup is disabled. Use the Super Admin login.');
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}): Promise<AuthSession> {
    const identifier = dto.email.trim().toLowerCase();

    if (![SUPERADMIN_USER_ID, SUPERADMIN_EMAIL].includes(identifier) || dto.password !== SUPERADMIN_PASSWORD) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordHash = await hash(SUPERADMIN_PASSWORD, this.env.BCRYPT_SALT_ROUNDS);
    const user = await this.authRepository.upsertHardcodedSuperAdmin({
      email: SUPERADMIN_EMAIL,
      passwordHash,
      displayName: 'TMJ Super Admin',
      organization: {
        name: 'TMJ SocialFlow AI',
        slug: 'tmj-socialflow-ai',
      },
    });

    return this.createSession(user, undefined, { ...metadata, rememberMe: dto.rememberMe ?? false });
  }

  async refresh(rawRefreshToken: string, metadata: SessionMetadata = {}): Promise<AuthSession> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const persistedToken = await this.authRepository.findRefreshToken(tokenHash);

    if (!persistedToken) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (persistedToken.revokedAt) {
      await this.authRepository.revokeRefreshTokenFamily(persistedToken.familyId);
      throw new UnauthorizedException('Refresh token reuse detected.');
    }

    if (persistedToken.expiresAt <= new Date()) {
      await this.authRepository.revokeRefreshToken(persistedToken.id);
      throw new UnauthorizedException('Refresh token expired.');
    }

    const user = await this.authRepository.findUserById(persistedToken.userId);

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('User is not active.');
    }

    const session = await this.createSession(user, persistedToken.familyId, metadata);
    await this.authRepository.revokeRefreshToken(
      persistedToken.id,
      this.hashToken(session.refreshToken),
    );
    await this.authRepository.revokeSessionByRefreshToken(persistedToken.id);

    return session;
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const persistedToken = await this.authRepository.findRefreshToken(this.hashToken(rawRefreshToken));

    if (persistedToken && !persistedToken.revokedAt) {
      await this.authRepository.revokeRefreshToken(persistedToken.id);
      await this.authRepository.revokeSessionByRefreshToken(persistedToken.id);
    }
  }

  requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    void dto;
    throw new ForbiddenException('Password reset is disabled for the hardcoded Super Admin login.');
  }

  resetPassword(dto: ResetPasswordDto): Promise<void> {
    void dto;
    throw new ForbiddenException('Password reset is disabled for the hardcoded Super Admin login.');
  }

  verifyEmail(dto: VerifyEmailDto): Promise<AuthenticatedUser> {
    void dto;
    throw new ForbiddenException('Email verification is disabled for the hardcoded Super Admin login.');
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserById(userId);

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('User is not active.');
    }

    return this.toAuthenticatedUser(user);
  }

  private async createSession(
    user: User,
    existingFamilyId?: string,
    metadata: SessionMetadata = {},
  ): Promise<AuthSession> {
    const refreshToken = this.createOpaqueToken();
    const refreshTokenExpiresAt = this.secondsFromNow(this.env.JWT_REFRESH_TTL_SECONDS);
    const accessTokenExpiresAt = this.secondsFromNow(this.env.JWT_ACCESS_TTL_SECONDS);
    const familyId = existingFamilyId ?? randomUUID();

    const persistedRefreshToken = await this.authRepository.createRefreshToken({
      user: { connect: { id: user.id } },
      tokenHash: this.hashToken(refreshToken),
      familyId,
      expiresAt: refreshTokenExpiresAt,
    });

    await this.authRepository.createUserSession({
      user: { connect: { id: user.id } },
      refreshTokenId: persistedRefreshToken.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      browser: metadata.browser,
      rememberMe: metadata.rememberMe ?? false,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      user: this.toAuthenticatedUser(user),
      accessToken: await this.createAccessToken(user),
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  private async createAccessToken(user: User): Promise<string> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    });
  }

  private toAuthenticatedUser(user: Pick<User, 'id' | 'email' | 'role' | 'emailVerifiedAt'>) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private createOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private secondsFromNow(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }

}
