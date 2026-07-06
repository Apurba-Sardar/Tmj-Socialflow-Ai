import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SocialChannelAuthType,
  SocialChannelStatus,
  SocialPlatform,
} from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSocialChannelDto, UpdateSocialChannelDto } from './social-channels.dto.js';

const supportedPlatforms = [
  {
    platform: SocialPlatform.FACEBOOK,
    label: 'Facebook Pages',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    setupHint: 'Connect a Meta app and select one or more Facebook Pages.',
  },
  {
    platform: SocialPlatform.INSTAGRAM,
    label: 'Instagram Business',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
    setupHint: 'Use an Instagram Business or Creator account connected to a Facebook Page.',
  },
  {
    platform: SocialPlatform.PINTEREST,
    label: 'Pinterest',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write', 'user_accounts:read'],
    setupHint: 'Connect a Pinterest developer app and choose the board used for publishing.',
  },
  {
    platform: SocialPlatform.LINKEDIN,
    label: 'LinkedIn',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['w_member_social', 'r_liteprofile'],
    setupHint: 'Connect a LinkedIn profile or organization page for publishing.',
  },
  {
    platform: SocialPlatform.X,
    label: 'X',
    authType: SocialChannelAuthType.OAUTH,
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    setupHint: 'Connect an X developer app with OAuth 2.0 user context.',
  },
] as const;

@Injectable()
export class SocialChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  supported() {
    return supportedPlatforms;
  }

  async summary(user: AuthenticatedUser) {
    const where = await this.visibleWhere(user);
    const [total, connected, actionRequired, expired, byPlatform] = await Promise.all([
      this.prisma.socialChannelAccount.count({ where }),
      this.prisma.socialChannelAccount.count({ where: { ...where, status: SocialChannelStatus.CONNECTED } }),
      this.prisma.socialChannelAccount.count({ where: { ...where, status: SocialChannelStatus.ACTION_REQUIRED } }),
      this.prisma.socialChannelAccount.count({ where: { ...where, status: SocialChannelStatus.EXPIRED } }),
      this.prisma.socialChannelAccount.groupBy({
        by: ['platform'],
        where,
        _count: { _all: true },
        orderBy: { platform: 'asc' },
      }),
    ]);

    return {
      total,
      connected,
      actionRequired,
      expired,
      byPlatform: byPlatform.map((item) => ({
        platform: item.platform,
        count: item._count._all,
      })),
    };
  }

  async list(user: AuthenticatedUser) {
    return this.prisma.socialChannelAccount.findMany({
      where: await this.visibleWhere(user),
      orderBy: [{ status: 'asc' }, { platform: 'asc' }, { updatedAt: 'desc' }],
      include: {
        connectedBy: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  async create(dto: CreateSocialChannelDto, user: AuthenticatedUser) {
    const organizationId = await this.defaultOrganizationId(user.id);
    const now = new Date();

    return this.prisma.socialChannelAccount.create({
      data: {
        organizationId,
        connectedById: user.id,
        platform: dto.platform,
        displayName: dto.displayName.trim(),
        handle: this.optionalTrim(dto.handle),
        externalAccountId: this.optionalTrim(dto.externalAccountId),
        accountType: this.optionalTrim(dto.accountType),
        authType: dto.authType ?? SocialChannelAuthType.MANUAL,
        scopes: dto.scopes ?? [],
        accessTokenCiphertext: this.encodeSecret(dto.accessToken),
        refreshTokenCiphertext: this.encodeSecret(dto.refreshToken),
        tokenExpiresAt: dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : undefined,
        status: this.resolveStatus(dto.accessToken, dto.tokenExpiresAt),
        lastHealthCheckAt: now,
        metadata: {
          setupSource: 'admin-panel',
          tokenConfigured: Boolean(dto.accessToken),
          refreshTokenConfigured: Boolean(dto.refreshToken),
        },
      },
    });
  }

  async update(id: string, dto: UpdateSocialChannelDto, user: AuthenticatedUser) {
    await this.ensureVisible(id, user);

    const data: Prisma.SocialChannelAccountUpdateInput = {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
      ...(dto.handle !== undefined ? { handle: this.optionalTrim(dto.handle) } : {}),
      ...(dto.externalAccountId !== undefined ? { externalAccountId: this.optionalTrim(dto.externalAccountId) } : {}),
      ...(dto.accountType !== undefined ? { accountType: this.optionalTrim(dto.accountType) } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.scopes !== undefined ? { scopes: dto.scopes } : {}),
      ...(dto.accessToken !== undefined ? { accessTokenCiphertext: this.encodeSecret(dto.accessToken) } : {}),
      ...(dto.refreshToken !== undefined ? { refreshTokenCiphertext: this.encodeSecret(dto.refreshToken) } : {}),
      ...(dto.tokenExpiresAt !== undefined ? { tokenExpiresAt: new Date(dto.tokenExpiresAt) } : {}),
    };

    return this.prisma.socialChannelAccount.update({
      where: { id },
      data,
    });
  }

  async healthCheck(id: string, user: AuthenticatedUser) {
    const account = await this.ensureVisible(id, user);
    const expired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() < Date.now() : false;
    const hasToken = Boolean(account.accessTokenCiphertext);

    return this.prisma.socialChannelAccount.update({
      where: { id },
      data: {
        lastHealthCheckAt: new Date(),
        status: expired
          ? SocialChannelStatus.EXPIRED
          : hasToken || account.authType === SocialChannelAuthType.OAUTH
            ? SocialChannelStatus.CONNECTED
            : SocialChannelStatus.ACTION_REQUIRED,
        lastError: expired ? 'Access token has expired. Reconnect this channel.' : null,
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.ensureVisible(id, user);
    await this.prisma.socialChannelAccount.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureVisible(id: string, user: AuthenticatedUser) {
    const account = await this.prisma.socialChannelAccount.findFirst({
      where: {
        id,
        ...(await this.visibleWhere(user)),
      },
    });

    if (!account) {
      throw new NotFoundException('Social channel account was not found.');
    }

    return account;
  }

  private async visibleWhere(user: AuthenticatedUser): Promise<Prisma.SocialChannelAccountWhereInput> {
    const organizationId = await this.defaultOrganizationId(user.id);
    return organizationId
      ? {
          OR: [{ organizationId }, { connectedById: user.id }],
        }
      : { connectedById: user.id };
  }

  private async defaultOrganizationId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });
    return user?.defaultOrganizationId ?? null;
  }

  private resolveStatus(accessToken?: string, tokenExpiresAt?: string): SocialChannelStatus {
    if (tokenExpiresAt && new Date(tokenExpiresAt).getTime() < Date.now()) {
      return SocialChannelStatus.EXPIRED;
    }

    return accessToken ? SocialChannelStatus.CONNECTED : SocialChannelStatus.ACTION_REQUIRED;
  }

  private encodeSecret(secret?: string): string | undefined {
    const clean = secret?.trim();
    return clean ? Buffer.from(clean, 'utf8').toString('base64') : undefined;
  }

  private optionalTrim(value?: string): string | undefined {
    const clean = value?.trim();
    if (!clean) {
      return undefined;
    }

    return clean;
  }
}
