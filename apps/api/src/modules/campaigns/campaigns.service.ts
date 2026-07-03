import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  SocialDraftStatus,
  WordPressCampaignStatus,
  WordPressPublishStatus,
  type Prisma,
} from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  BulkCampaignActionDto,
  CampaignsQueryDto,
  ScheduleCampaignDto,
  UpdateCampaignGenerationDto,
  UpdateCampaignStatusDto,
} from './campaigns.dto.js';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);
    const where = this.organizationScopedWhere(organizationId);

    const [byStatus, scheduled, published, failed, generationCount, historyCount] =
      await Promise.all([
        this.prisma.wordPressCampaign.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        }),
        this.prisma.wordPressCampaign.count({
          where: { ...where, status: WordPressCampaignStatus.SCHEDULED },
        }),
        this.prisma.wordPressCampaign.count({
          where: { ...where, status: WordPressCampaignStatus.PUBLISHED },
        }),
        this.prisma.wordPressCampaign.count({
          where: { ...where, status: WordPressCampaignStatus.FAILED },
        }),
        this.prisma.wordPressCampaignGeneration.count({
          where: { campaign: where },
        }),
        this.prisma.wordPressPublishingHistory.count({
          where: { campaign: where },
        }),
      ]);

    return {
      totals: {
        campaigns: byStatus.reduce((sum, row) => sum + row._count._all, 0),
        scheduled,
        published,
        failed,
        generations: generationCount,
        publishingRecords: historyCount,
      },
      byStatus: Object.values(WordPressCampaignStatus).map((status) => ({
        status,
        count: byStatus.find((row) => row.status === status)?._count._all ?? 0,
      })),
    };
  }

  async list(user: AuthenticatedUser, query: CampaignsQueryDto) {
    const organizationId = await this.requireOrganizationId(user.id);
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 25;
    const where = this.campaignWhere(organizationId, query);

    const [items, total] = await Promise.all([
      this.prisma.wordPressCampaign.findMany({
        where,
        include: this.campaignListInclude(),
        orderBy: this.orderBy(query),
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.wordPressCampaign.count({ where }),
    ]);

    return {
      data: items.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        promptVersion: campaign.promptVersion,
        aiModel: campaign.aiModel,
        archivedAt: campaign.archivedAt,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
        article: campaign.article,
        generationCount: campaign._count.generations,
        publishingHistoryCount: campaign._count.publishingHistory,
        platforms: Array.from(new Set(campaign.generations.map((item) => item.platform))),
        nextPublishAt: nextPublishAt(campaign.publishingHistory),
        lastPublishedAt: lastPublishedAt(campaign.publishingHistory),
      })),
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async get(user: AuthenticatedUser, id: string) {
    const organizationId = await this.requireOrganizationId(user.id);
    const campaign = await this.prisma.wordPressCampaign.findFirst({
      where: {
        id,
        ...this.organizationScopedWhere(organizationId),
      },
      include: {
        article: {
          include: {
            connection: {
              select: { id: true, siteUrl: true, username: true },
            },
          },
        },
        generations: {
          orderBy: [{ platform: 'asc' }, { version: 'desc' }],
        },
        publishingHistory: {
          orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        },
        regenerationHistory: {
          orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
        },
        analytics: {
          orderBy: { capturedAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign was not found.');
    }

    return campaign;
  }

  async updateStatus(user: AuthenticatedUser, id: string, dto: UpdateCampaignStatusDto) {
    this.assertCanManage(user);
    await this.get(user, id);

    return this.prisma.wordPressCampaign.update({
      where: { id },
      data: {
        status: dto.status,
        archivedAt: dto.status === WordPressCampaignStatus.ARCHIVED ? new Date() : null,
      },
    });
  }

  async schedule(user: AuthenticatedUser, id: string, dto: ScheduleCampaignDto) {
    this.assertCanManage(user);
    const scheduledFor = new Date(dto.scheduledFor);

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('scheduledFor must be a valid ISO date.');
    }

    const campaign = await this.get(user, id);
    const historyWhere = {
      campaignId: id,
      ...(dto.platform ? { platform: dto.platform } : {}),
    };

    await this.prisma.$transaction([
      this.prisma.wordPressCampaign.update({
        where: { id },
        data: { status: WordPressCampaignStatus.SCHEDULED, archivedAt: null },
      }),
      this.prisma.wordPressPublishingHistory.updateMany({
        where: historyWhere,
        data: { status: WordPressPublishStatus.SCHEDULED, scheduledFor },
      }),
      this.prisma.socialDraft.updateMany({
        where: {
          articleId: campaign.articleId,
          ...(dto.platform ? { platform: dto.platform } : {}),
          status: { in: [SocialDraftStatus.DRAFT, SocialDraftStatus.APPROVED] },
        },
        data: { status: SocialDraftStatus.SCHEDULED, scheduledFor },
      }),
    ]);

    return this.get(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.updateStatus(user, id, { status: WordPressCampaignStatus.ARCHIVED });
  }

  async updateGeneration(
    user: AuthenticatedUser,
    campaignId: string,
    generationId: string,
    dto: UpdateCampaignGenerationDto,
  ) {
    this.assertCanManage(user);
    await this.get(user, campaignId);

    const generation = await this.prisma.wordPressCampaignGeneration.findFirst({
      where: { id: generationId, campaignId },
    });

    if (!generation) {
      throw new NotFoundException('Generated campaign content was not found.');
    }

    return this.prisma.wordPressCampaignGeneration.update({
      where: { id: generationId },
      data: {
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.hashtags !== undefined ? { hashtags: dto.hashtags } : {}),
      },
    });
  }

  async bulk(user: AuthenticatedUser, dto: BulkCampaignActionDto) {
    this.assertCanManage(user);

    if (!dto.campaignIds.length) {
      throw new BadRequestException('Select at least one campaign.');
    }

    const results = [];

    switch (dto.action) {
      case 'archive':
        for (const campaignId of dto.campaignIds) {
          results.push(await this.archive(user, campaignId));
        }
        break;
      case 'mark-published':
        for (const campaignId of dto.campaignIds) {
          results.push(
            await this.updateStatus(user, campaignId, { status: WordPressCampaignStatus.PUBLISHED }),
          );
        }
        break;
      case 'schedule':
        if (!dto.scheduledFor) {
          throw new BadRequestException('scheduledFor is required for bulk scheduling.');
        }
        for (const campaignId of dto.campaignIds) {
          results.push(await this.schedule(user, campaignId, { scheduledFor: dto.scheduledFor }));
        }
        break;
      default:
        throw new BadRequestException('Unsupported campaign bulk action.');
      }

    return {
      action: dto.action,
      processed: results.length,
    };
  }

  private assertCanManage(user: AuthenticatedUser) {
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'PUBLISHER'].includes(user.role)) {
      throw new ForbiddenException('You do not have permission to manage campaigns.');
    }
  }

  private async requireOrganizationId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });

    if (user?.defaultOrganizationId) {
      return user.defaultOrganizationId;
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new UnprocessableEntityException('User is not assigned to an organization.');
    }

    return membership.organizationId;
  }

  private organizationScopedWhere(organizationId: string): Prisma.WordPressCampaignWhereInput {
    return {
      article: {
        connection: {
          organizationId,
        },
      },
    };
  }

  private campaignWhere(
    organizationId: string,
    query: CampaignsQueryDto,
  ): Prisma.WordPressCampaignWhereInput {
    return {
      ...this.organizationScopedWhere(organizationId),
      ...(query.status ? { status: query.status } : {}),
      ...(query.platform ? { generations: { some: { platform: query.platform } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { article: { title: { contains: query.search, mode: 'insensitive' } } },
              { article: { excerpt: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private campaignListInclude() {
    return {
      article: {
        select: {
          id: true,
          title: true,
          url: true,
          featuredImageUrl: true,
          authorName: true,
          publishedAt: true,
          connection: {
            select: { id: true, siteUrl: true },
          },
        },
      },
      generations: {
        select: { platform: true },
      },
      publishingHistory: {
        select: { scheduledFor: true, publishedAt: true, status: true },
      },
      _count: {
        select: { generations: true, publishingHistory: true, regenerationHistory: true },
      },
    } satisfies Prisma.WordPressCampaignInclude;
  }

  private orderBy(query: CampaignsQueryDto): Prisma.WordPressCampaignOrderByWithRelationInput[] {
    const sortDir = query.sortDir ?? 'desc';

    if (query.sortBy === 'name') {
      return [{ name: sortDir }];
    }

    if (query.sortBy === 'status') {
      return [{ status: sortDir }, { updatedAt: 'desc' }];
    }

    if (query.sortBy === 'createdAt') {
      return [{ createdAt: sortDir }];
    }

    return [{ updatedAt: sortDir }];
  }
}

function nextPublishAt(
  items: { scheduledFor: Date | null; status: WordPressPublishStatus }[],
): Date | null {
  return (
    items
      .filter((item) => item.status === WordPressPublishStatus.SCHEDULED && item.scheduledFor)
      .sort((a, b) => Number(a.scheduledFor) - Number(b.scheduledFor))[0]?.scheduledFor ?? null
  );
}

function lastPublishedAt(
  items: { publishedAt: Date | null; status: WordPressPublishStatus }[],
): Date | null {
  return (
    items
      .filter((item) => item.status === WordPressPublishStatus.PUBLISHED && item.publishedAt)
      .sort((a, b) => Number(b.publishedAt) - Number(a.publishedAt))[0]?.publishedAt ?? null
  );
}
