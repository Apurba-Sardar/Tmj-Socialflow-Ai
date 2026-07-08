import { Injectable } from '@nestjs/common';
import { Role, type AuthTokenType, type Prisma, type RefreshToken, type User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUserWithDefaultOrganization(
    data: Prisma.UserCreateInput,
    organization: { name: string; slug: string },
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      const createdOrganization = await tx.organization.create({
        data: {
          name: organization.name,
          slug: organization.slug,
          ownerUserId: user.id,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: createdOrganization.id,
          userId: user.id,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: { defaultOrganizationId: createdOrganization.id },
      });
    });
  }

  async upsertHardcodedSuperAdmin(data: {
    email: string;
    passwordHash: string;
    displayName: string;
    organization: { name: string; slug: string };
  }): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: data.email } });

      if (existing) {
        return tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: data.passwordHash,
            displayName: data.displayName,
            role: Role.SUPER_ADMIN,
            disabledAt: null,
            emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          },
        });
      }

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: data.displayName,
          role: Role.SUPER_ADMIN,
          emailVerifiedAt: new Date(),
        },
      });
      const organization = await tx.organization.upsert({
        where: { slug: data.organization.slug },
        update: {
          name: data.organization.name,
          ownerUserId: user.id,
        },
        create: {
          name: data.organization.name,
          slug: data.organization.slug,
          ownerUserId: user.id,
        },
      });

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: user.id,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: { defaultOrganizationId: organization.id },
      });
    });
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  createRefreshToken(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  revokeRefreshToken(id: string, replacedBy?: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy },
    });
  }

  revokeRefreshTokenFamily(familyId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeUserRefreshTokens(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  createUserSession(data: Prisma.UserSessionCreateInput) {
    return this.prisma.userSession.create({ data });
  }

  revokeSessionByRefreshToken(refreshTokenId: string) {
    return this.prisma.userSession.updateMany({
      where: { refreshTokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  createAuthToken(userId: string, type: AuthTokenType, tokenHash: string, expiresAt: Date) {
    return this.prisma.authToken.create({
      data: {
        user: { connect: { id: userId } },
        type,
        tokenHash,
        expiresAt,
      },
    });
  }

  findAuthToken(tokenHash: string) {
    return this.prisma.authToken.findUnique({ where: { tokenHash } });
  }

  markAuthTokenUsed(id: string) {
    return this.prisma.authToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
