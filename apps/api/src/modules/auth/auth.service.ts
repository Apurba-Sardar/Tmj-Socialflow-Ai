import { randomBytes, createHash, randomUUID } from 'node:crypto';

import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import { AuthTokenType } from '@prisma/client';
import { compare, hash } from 'bcryptjs';

import { loadEnvironment } from '@socialflow/config';

import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto.js';
import { AuthEmailService } from './email.service.js';
import { AuthRepository } from './auth.repository.js';
import type { AuthenticatedUser, JwtAccessPayload } from './types.js';

interface AuthSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly env = loadEnvironment();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly emailService: AuthEmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.authRepository.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await hash(dto.password, this.env.BCRYPT_SALT_ROUNDS);
    const user = await this.authRepository.createUser({
      email,
      passwordHash,
      displayName: dto.displayName?.trim() || null,
    });

    const verificationToken = await this.createSingleUseToken(
      user.id,
      AuthTokenType.EMAIL_VERIFICATION,
      this.env.EMAIL_VERIFICATION_TTL_SECONDS,
    );
    await this.emailService.sendEmailVerification(user.email, verificationToken);

    return this.createSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.authRepository.findUserByEmail(dto.email.trim().toLowerCase());

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const validPassword = await compare(dto.password, user.passwordHash);

    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return this.createSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
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

    const session = await this.createSession(user, persistedToken.familyId);
    await this.authRepository.revokeRefreshToken(
      persistedToken.id,
      this.hashToken(session.refreshToken),
    );

    return session;
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const persistedToken = await this.authRepository.findRefreshToken(this.hashToken(rawRefreshToken));

    if (persistedToken && !persistedToken.revokedAt) {
      await this.authRepository.revokeRefreshToken(persistedToken.id);
    }
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.authRepository.findUserByEmail(dto.email.trim().toLowerCase());

    if (!user || user.disabledAt) {
      return;
    }

    const token = await this.createSingleUseToken(
      user.id,
      AuthTokenType.PASSWORD_RESET,
      this.env.PASSWORD_RESET_TTL_SECONDS,
    );
    await this.emailService.sendPasswordReset(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const token = await this.consumeSingleUseToken(dto.token, AuthTokenType.PASSWORD_RESET);
    const passwordHash = await hash(dto.password, this.env.BCRYPT_SALT_ROUNDS);

    await this.authRepository.updatePassword(token.userId, passwordHash);
    await this.authRepository.revokeUserRefreshTokens(token.userId);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthenticatedUser> {
    const token = await this.consumeSingleUseToken(dto.token, AuthTokenType.EMAIL_VERIFICATION);
    const user = await this.authRepository.markEmailVerified(token.userId);

    return this.toAuthenticatedUser(user);
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserById(userId);

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('User is not active.');
    }

    return this.toAuthenticatedUser(user);
  }

  private async createSession(user: User, existingFamilyId?: string): Promise<AuthSession> {
    const refreshToken = this.createOpaqueToken();
    const refreshTokenExpiresAt = this.secondsFromNow(this.env.JWT_REFRESH_TTL_SECONDS);
    const accessTokenExpiresAt = this.secondsFromNow(this.env.JWT_ACCESS_TTL_SECONDS);
    const familyId = existingFamilyId ?? randomUUID();

    await this.authRepository.createRefreshToken({
      user: { connect: { id: user.id } },
      tokenHash: this.hashToken(refreshToken),
      familyId,
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

  private async createSingleUseToken(
    userId: string,
    type: AuthTokenType,
    ttlSeconds: number,
  ): Promise<string> {
    const token = this.createOpaqueToken();
    await this.authRepository.createAuthToken(
      userId,
      type,
      this.hashToken(token),
      this.secondsFromNow(ttlSeconds),
    );
    return token;
  }

  private async consumeSingleUseToken(token: string, type: AuthTokenType) {
    const persistedToken = await this.authRepository.findAuthToken(this.hashToken(token));

    if (
      !persistedToken ||
      persistedToken.type !== type ||
      persistedToken.usedAt ||
      persistedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    await this.authRepository.markAuthTokenUsed(persistedToken.id);
    return persistedToken;
  }

  private toAuthenticatedUser(user: Pick<User, 'id' | 'email' | 'role' | 'emailVerifiedAt'>) {
    return {
      id: user.id,
      email: user.email,
      role: user.role as Role,
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
