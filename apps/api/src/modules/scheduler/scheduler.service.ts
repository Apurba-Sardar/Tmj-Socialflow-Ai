import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  PublishJobStatus,
  PublishLogLevel,
  SocialChannelStatus,
  SocialPlatform,
} from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WordPressService } from '../wordpress/application/wordpress.service.js';
import type { AutoScheduleDailyDto, CreatePublishJobDto } from './scheduler.dto.js';

const DAILY_SLOT_HOURS = [8, 10, 12, 14, 16, 18, 20, 21];

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wordpressService: WordPressService,
  ) {}

  async posts(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);

    const [posts, drafts] = await Promise.all([
      this.prisma.publishJob.findMany({
        where: { organizationId },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 6 } },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      }),
      this.prisma.socialDraft.findMany({
        where: {
          article: {
            connection: {
              organizationId,
            },
          },
          scheduledFor: { not: null },
          status: { in: ['SCHEDULED', 'PUBLISHED'] },
        },
        include: {
          article: {
            select: {
              title: true,
              categoryNames: true,
            },
          },
        },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);

    return {
      data: [
        ...posts.map((post) => ({
          id: post.id,
          source: 'publish-job',
          title: post.title,
          caption: post.caption,
          platform: post.platform,
          channel: this.platformLabel(post.platform),
          platformAccount: post.platformAccount,
          scheduledFor: post.scheduledFor,
          publishedAt: post.publishedAt,
          status: post.status,
          tags: post.hashtags,
          metadata: post.metadata,
          logs: post.logs,
          createdAt: post.createdAt,
        })),
        ...drafts.map((draft) => ({
          id: draft.id,
          source: 'draft',
          title: draft.title || draft.article.title,
          caption: draft.body,
          platform: draft.platform,
          channel: this.platformLabel(draft.platform),
          platformAccount: null,
          scheduledFor: draft.scheduledFor,
          publishedAt: null,
          status:
            draft.status === 'PUBLISHED' ? PublishJobStatus.PUBLISHED : PublishJobStatus.SCHEDULED,
          tags: draft.hashtags.length ? draft.hashtags : draft.article.categoryNames,
          metadata: null,
          logs: [],
          createdAt: draft.createdAt,
        })),
      ].sort(
        (a, b) =>
          new Date(a.scheduledFor ?? a.createdAt).getTime() -
          new Date(b.scheduledFor ?? b.createdAt).getTime(),
      ),
    };
  }

  async createPost(user: AuthenticatedUser, dto: CreatePublishJobDto) {
    const organizationId = await this.requireOrganizationId(user.id);

    const post = await this.prisma.publishJob.create({
      data: {
        organizationId,
        userId: user.id,
        platform: dto.platform,
        title: dto.title,
        caption: dto.caption,
        scheduledFor: new Date(dto.scheduledFor),
        status: PublishJobStatus.SCHEDULED,
        logs: {
          create: {
            level: PublishLogLevel.INFO,
            message: 'Manual post scheduled.',
            metadata: { scheduledFor: dto.scheduledFor },
          },
        },
      },
      include: { logs: { orderBy: { createdAt: 'desc' } } },
    });

    return { post };
  }

  async autoPlanDaily(user: AuthenticatedUser, dto: AutoScheduleDailyDto) {
    const organizationId = await this.requireOrganizationId(user.id);
    const date = this.parsePlanningDate(dto.date);
    const count = dto.count ?? 5;
    const connectedChannels = await this.connectedChannels(organizationId);

    if (!connectedChannels.length) {
      throw new BadRequestException(
        'Connect at least one publishing channel before auto-scheduling.',
      );
    }

    const existing = await this.prisma.publishJob.findMany({
      where: {
        organizationId,
        scheduledFor: {
          gte: startOfDay(date),
          lt: addDays(startOfDay(date), 1),
        },
      },
      select: { scheduledFor: true, metadata: true },
    });
    const excludedArticleIds = new Set(
      existing
        .map((item) => metadataString(item.metadata, 'articleId'))
        .filter((value): value is string => Boolean(value)),
    );
    const usedTimes = new Set(
      existing
        .map((item) => item.scheduledFor?.toISOString())
        .filter((value): value is string => Boolean(value)),
    );

    const candidates = await this.prisma.wordPressArticle.findMany({
      where: {
        connection: { organizationId },
        id: { notIn: Array.from(excludedArticleIds) },
      },
      orderBy: [{ modifiedAt: 'desc' }, { publishedAt: 'desc' }],
      take: 120,
    });
    const selectedArticles = shuffle(candidates).slice(0, count);

    if (!selectedArticles.length) {
      throw new BadRequestException(
        'No eligible WordPress posts are available for auto-scheduling.',
      );
    }

    const slots = this.randomSlots(date, Math.max(count, selectedArticles.length), usedTimes);
    const planned = [];
    const failures = [];
    const plannedArticleIds = new Set<string>();
    const reusableDrafts = await this.prisma.socialDraft.findMany({
      where: {
        article: {
          connection: { organizationId },
          id: { notIn: Array.from(excludedArticleIds) },
        },
        platform: { in: connectedChannels.map((channel) => channel.platform) },
        scheduledFor: null,
        status: { in: ['DRAFT', 'APPROVED'] },
      },
      include: {
        article: true,
        campaignGeneration: { select: { campaignId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: count * 8,
    });

    for (const draft of shuffle(reusableDrafts)) {
      if (planned.length >= count) {
        break;
      }

      if (plannedArticleIds.has(draft.articleId)) {
        continue;
      }

      const channel = connectedChannels.find((item) => item.platform === draft.platform);
      if (!channel) {
        continue;
      }

      const scheduledFor =
        slots[planned.length] ?? this.fallbackSlot(date, planned.length, usedTimes);
      const job = await this.createApprovalJobFromDraft({
        organizationId,
        userId: user.id,
        channel,
        draft,
        scheduledFor,
        campaignId: draft.campaignGeneration?.campaignId,
        logMessage: 'Existing generated draft selected for automatic daily planning.',
      });

      planned.push(job);
      plannedArticleIds.add(draft.articleId);
      excludedArticleIds.add(draft.articleId);
    }

    for (const [index, article] of selectedArticles.entries()) {
      if (planned.length >= count) {
        break;
      }

      if (excludedArticleIds.has(article.id) || plannedArticleIds.has(article.id)) {
        continue;
      }

      const channel = connectedChannels[index % connectedChannels.length];
      if (!channel) {
        throw new BadRequestException('No connected channel was available for scheduling.');
      }
      const scheduledFor =
        slots[planned.length] ?? this.fallbackSlot(date, planned.length, usedTimes);

      try {
        const generation = await this.wordpressService.generateCampaign(
          article.id,
          {
            platforms: [channel.platform],
            campaignName: `${article.title} Auto Schedule`,
            prompt:
              'Generate a publish-ready social post and a premium image asset for automatic daily scheduling. Keep it accurate, unique, and suitable for final human approval.',
            promptVersion: 'auto-scheduler-v1',
          },
          user,
        );
        const draft =
          generation.drafts.find((item) => item.platform === channel.platform) ??
          generation.drafts[0];

        if (!draft) {
          throw new BadRequestException(
            `AI generation did not return a draft for ${article.title}.`,
          );
        }

        const job = await this.createApprovalJobFromDraft({
          organizationId,
          userId: user.id,
          channel,
          draft: {
            ...draft,
            article: {
              wordpressId: article.wordpressId,
            },
          },
          scheduledFor,
          campaignId: generation.campaign.id,
          logMessage: 'AI generated campaign draft for automatic daily planning.',
        });

        planned.push(job);
        plannedArticleIds.add(article.id);
      } catch (error) {
        failures.push({
          articleId: article.id,
          title: article.title,
          error: error instanceof Error ? error.message : 'AI generation failed.',
        });
      }
    }

    if (!planned.length) {
      throw new BadRequestException(
        failures[0]?.error ?? 'No posts could be generated or scheduled for approval.',
      );
    }

    return {
      date: toDateInputValue(date),
      requested: count,
      planned: planned.length,
      failed: failures.length,
      failures,
      posts: planned,
    };
  }

  async approvePost(user: AuthenticatedUser, id: string) {
    const organizationId = await this.requireOrganizationId(user.id);
    const post = await this.prisma.publishJob.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });

    if (!post) {
      throw new NotFoundException('Scheduled post was not found.');
    }

    if (
      post.status !== PublishJobStatus.PENDING_APPROVAL &&
      post.status !== PublishJobStatus.DRAFT
    ) {
      throw new BadRequestException('Only draft or approval-pending posts can be approved.');
    }

    const updated = await this.prisma.publishJob.update({
      where: { id },
      data: {
        status: PublishJobStatus.SCHEDULED,
        logs: {
          create: {
            level: PublishLogLevel.INFO,
            message: 'Final approval granted. Post is ready for publishing.',
            metadata: { approvedBy: user.id },
          },
        },
      },
      include: { logs: { orderBy: { createdAt: 'desc' } } },
    });

    return { post: updated };
  }

  async approvePosts(user: AuthenticatedUser, ids: string[]) {
    if (!ids.length) {
      throw new BadRequestException('Select at least one post to approve.');
    }

    const approved = [];
    for (const id of ids) {
      approved.push((await this.approvePost(user, id)).post);
    }

    return { approved: approved.length, posts: approved };
  }

  private async connectedChannels(organizationId: string) {
    const accounts = await this.prisma.socialChannelAccount.findMany({
      where: {
        organizationId,
        status: SocialChannelStatus.CONNECTED,
        accessTokenCiphertext: { not: null },
      },
      orderBy: [{ platform: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        platform: true,
        displayName: true,
        externalAccountId: true,
      },
    });

    const unique = new Map<SocialPlatform, (typeof accounts)[number]>();
    for (const account of accounts) {
      if (!unique.has(account.platform)) {
        unique.set(account.platform, account);
      }
    }

    return Array.from(unique.values());
  }

  private async createApprovalJobFromDraft(input: {
    organizationId: string;
    userId: string;
    channel: {
      id: string;
      platform: SocialPlatform;
      displayName: string;
      externalAccountId: string | null;
    };
    draft: {
      id: string;
      articleId: string;
      platform: SocialPlatform;
      title: string;
      body: string;
      hashtags: string[];
      sourceUrl: string;
      mediaUrl: string | null;
      article: {
        wordpressId: number;
      };
    };
    scheduledFor: Date;
    campaignId?: string;
    logMessage: string;
  }) {
    const job = await this.prisma.publishJob.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        campaignId: input.campaignId,
        platform: input.draft.platform,
        platformAccount: input.channel.displayName,
        title: input.draft.title,
        caption: input.draft.body,
        hashtags: input.draft.hashtags,
        scheduledFor: input.scheduledFor,
        status: PublishJobStatus.PENDING_APPROVAL,
        metadata: {
          automation: 'daily-ai-auto-scheduler',
          articleId: input.draft.articleId,
          wordpressId: input.draft.article.wordpressId,
          sourceUrl: input.draft.sourceUrl,
          draftId: input.draft.id,
          mediaUrl: input.draft.mediaUrl,
          channelAccountId: input.channel.id,
          requiresFinalApproval: true,
        },
        logs: {
          create: [
            {
              level: PublishLogLevel.INFO,
              message: input.logMessage,
              metadata: {
                articleId: input.draft.articleId,
                wordpressId: input.draft.article.wordpressId,
                platform: input.draft.platform,
              },
            },
            {
              level: PublishLogLevel.INFO,
              message: 'Queued for final approval before publishing.',
              metadata: {
                scheduledFor: input.scheduledFor.toISOString(),
                channel: input.channel.displayName,
              },
            },
          ],
        },
      },
      include: { logs: { orderBy: { createdAt: 'desc' } } },
    });

    await this.prisma.socialDraft.update({
      where: { id: input.draft.id },
      data: { scheduledFor: input.scheduledFor },
    });

    return job;
  }

  private randomSlots(date: Date, count: number, usedTimes: Set<string>) {
    const slots = shuffle(DAILY_SLOT_HOURS).map((hour, index) => {
      const minute = [0, 15, 30, 45][index % 4] ?? 0;
      const slot = new Date(date);
      slot.setHours(hour, minute, 0, 0);
      return slot;
    });

    return slots.filter((slot) => !usedTimes.has(slot.toISOString())).slice(0, count);
  }

  private fallbackSlot(date: Date, index: number, usedTimes: Set<string>) {
    const slot = new Date(date);
    slot.setHours(9 + index * 2, 0, 0, 0);

    while (usedTimes.has(slot.toISOString())) {
      slot.setMinutes(slot.getMinutes() + 17);
    }
    usedTimes.add(slot.toISOString());

    return slot;
  }

  private parsePlanningDate(value: string) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date must be a valid ISO date.');
    }
    return date;
  }

  private async requireOrganizationId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { defaultOrganizationId: true },
    });
    if (user?.defaultOrganizationId) return user.defaultOrganizationId;

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

  private platformLabel(platform: string): string {
    return platform
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }
}

function shuffle<T>(items: T[]): T[] {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInputValue(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}
