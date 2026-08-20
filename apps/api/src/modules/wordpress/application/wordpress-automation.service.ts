import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, SocialChannelStatus, SocialPlatform } from '@prisma/client';

import type { AuthenticatedUser } from '../../auth/types.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SocialChannelsService } from '../../social-channels/social-channels.service.js';
import type { UpdateWordPressAutomationDto } from './wordpress-automation.dto.js';
import { WordPressService } from './wordpress.service.js';

const SETTING_KEY = 'wordpress.daily-automation';
const DEFAULT_PLATFORMS = [SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM];
// Poll frequently so newly published WordPress posts are shared without a
// browser refresh. The processed article list keeps each post idempotent.
const POLL_INTERVAL_MS = 60 * 1000;

interface DailyAutomationConfig {
  enabled: boolean;
  connectionId: string;
  categorySlug: string;
  platforms: SocialPlatform[];
  dailyLimit: number;
  publishHour: number;
  timezone: string;
  activatedAt: string;
  lastRunAt: string | null;
  lastError: string | null;
  lastPublishedTitle: string | null;
  processedArticleIds: string[];
}

@Injectable()
export class WordPressAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WordPressAutomationService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordpressService: WordPressService,
    private readonly socialChannelsService: SocialChannelsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runDueAutomations(), POLL_INTERVAL_MS);
    void this.runDueAutomations();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async get(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);
    const setting = await this.prisma.organizationSetting.findUnique({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
    });
    const config = this.parseConfig(setting?.value);
    const connections = await this.prisma.wordPressConnection.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, siteUrl: true, username: true },
      orderBy: { siteUrl: 'asc' },
    });
    return { ...config, connections };
  }

  async update(user: AuthenticatedUser, dto: UpdateWordPressAutomationDto) {
    const organizationId = await this.requireOrganizationId(user.id);
    const connection = await this.prisma.wordPressConnection.findFirst({
      where: { id: dto.connectionId, organizationId, isActive: true },
      select: { id: true },
    });
    if (!connection) throw new Error('Select an active WordPress connection.');

    const currentSetting = await this.prisma.organizationSetting.findUnique({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
    });
    const current = this.parseConfig(currentSetting?.value);
    const config: DailyAutomationConfig = {
      ...current,
      enabled: dto.enabled,
      connectionId: dto.connectionId,
      categorySlug: dto.categorySlug?.trim().toLowerCase() ?? current.categorySlug,
      platforms: dto.platforms.length ? [...new Set(dto.platforms)] : DEFAULT_PLATFORMS,
      dailyLimit: dto.dailyLimit ?? current.dailyLimit,
      publishHour: dto.publishHour ?? current.publishHour,
      timezone: dto.timezone ?? current.timezone,
      activatedAt:
        dto.enabled && (!current.enabled || current.connectionId !== dto.connectionId)
          ? new Date().toISOString()
          : current.activatedAt,
      lastRunAt:
        dto.enabled && (!current.enabled || current.connectionId !== dto.connectionId)
          ? null
          : current.lastRunAt,
      lastError: null,
    };

    await this.save(organizationId, config);
    return { ...config, connections: [connection] };
  }

  async runNow(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);
    const setting = await this.prisma.organizationSetting.findUnique({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
    });
    const config = this.parseConfig(setting?.value);
    if (!config.enabled) throw new Error('Enable daily automation before running it.');
    return this.run(organizationId, config, true);
  }

  private async runDueAutomations() {
    try {
      const settings = await this.prisma.organizationSetting.findMany({
        where: { key: SETTING_KEY },
      });
      for (const setting of settings) {
        const config = this.parseConfig(setting.value);
        if (!config.enabled) continue;
        await this.run(setting.organizationId, config, false);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Daily automation check failed.');
    }
  }

  private async run(organizationId: string, config: DailyAutomationConfig, force: boolean) {
    const startedAt = new Date();
    const runningConfig: DailyAutomationConfig = {
      ...config,
      lastRunAt: startedAt.toISOString(),
      lastError: null,
    };
    await this.save(organizationId, runningConfig);

    try {
      const owner = await this.prisma.user.findFirst({
        where: { defaultOrganizationId: organizationId, disabledAt: null },
        select: { id: true, email: true, role: true, emailVerifiedAt: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!owner) throw new Error('No active organization user is available for automation.');

      const actor: AuthenticatedUser = {
        id: owner.id,
        email: owner.email,
        role: owner.role,
        emailVerified: Boolean(owner.emailVerifiedAt),
      };
      await this.wordpressService.sync(
        { connectionId: config.connectionId, status: 'publish', perPage: 50, maxPages: 2 },
        actor,
      );

      const channels = await this.prisma.socialChannelAccount.findMany({
        where: {
          organizationId,
          platform: { in: config.platforms },
          status: SocialChannelStatus.CONNECTED,
          accessTokenCiphertext: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
      });
      const channelByPlatform = new Map<SocialPlatform, (typeof channels)[number]>();
      for (const channel of channels) {
        if (!channelByPlatform.has(channel.platform))
          channelByPlatform.set(channel.platform, channel);
      }
      const missing = config.platforms.filter((platform) => !channelByPlatform.has(platform));
      if (missing.length) throw new Error(`Connect these channels first: ${missing.join(', ')}.`);

      const articles = await this.prisma.wordPressArticle.findMany({
        where: {
          connectionId: config.connectionId,
          status: 'publish',
          publishedAt: { gte: new Date(config.activatedAt), lte: new Date() },
          // Daily automation publishes the original WordPress featured image
          // only. Posts without one are left for manual review.
          featuredImageUrl: { not: null },
          ...(config.categorySlug ? { categorySlugs: { has: config.categorySlug } } : {}),
          id: { notIn: config.processedArticleIds },
        },
        orderBy: { publishedAt: 'asc' },
        take: config.dailyLimit,
      });

      let published = 0;
      let lastTitle = config.lastPublishedTitle;
      for (const article of articles) {
        const generation = await this.wordpressService.generateCampaign(
          article.id,
          {
            platforms: config.platforms,
            campaignName: `${article.title} Daily Auto Post`,
            prompt:
              'Create a publish-ready social post and image for automatic daily publishing. Keep it accurate, concise, and platform-native.',
            promptVersion: 'wordpress-daily-automation-v1',
          },
          actor,
          { useFeaturedImage: true },
        );
        const drafts = new Map(generation.drafts.map((draft) => [draft.platform, draft]));
        for (const platform of config.platforms) {
          const draft = drafts.get(platform);
          const channel = channelByPlatform.get(platform);
          if (!draft || !channel) throw new Error(`Could not generate a ${platform} draft.`);
          const result = await this.socialChannelsService.publish(
            channel.id,
            {
              draftId: draft.id,
              title: draft.title,
              caption: draft.body,
              hashtags: draft.hashtags,
              mediaUrl: draft.mediaUrl ?? undefined,
              sourceUrl: draft.sourceUrl,
            },
            actor,
          );
          if (!result.published) throw new Error(result.error ?? `${platform} publish failed.`);
        }
        published += 1;
        lastTitle = article.title;
        runningConfig.processedArticleIds = [
          ...runningConfig.processedArticleIds,
          article.id,
        ].slice(-200);
      }

      runningConfig.lastPublishedTitle = lastTitle;
      runningConfig.lastError = articles.length || force ? null : 'No new WordPress posts found.';
      await this.save(organizationId, runningConfig);
      return { published, checked: articles.length, message: runningConfig.lastError };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Daily automation failed.';
      await this.save(organizationId, { ...runningConfig, lastError: message });
      this.logger.error(message);
      if (force) throw new BadRequestException(message);
      return { published: 0, checked: 0, message };
    }
  }

  private parseConfig(value: unknown): DailyAutomationConfig {
    const source =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return {
      enabled: source.enabled === true,
      connectionId: typeof source.connectionId === 'string' ? source.connectionId : '',
      categorySlug:
        typeof source.categorySlug === 'string' ? source.categorySlug.trim().toLowerCase() : '',
      platforms: Array.isArray(source.platforms)
        ? source.platforms.filter((item): item is SocialPlatform =>
            Object.values(SocialPlatform).includes(item as SocialPlatform),
          )
        : DEFAULT_PLATFORMS,
      dailyLimit:
        typeof source.dailyLimit === 'number' ? Math.min(Math.max(source.dailyLimit, 1), 10) : 1,
      publishHour:
        typeof source.publishHour === 'number' ? Math.min(Math.max(source.publishHour, 0), 23) : 9,
      timezone: typeof source.timezone === 'string' ? source.timezone : 'UTC',
      activatedAt:
        typeof source.activatedAt === 'string' ? source.activatedAt : new Date().toISOString(),
      lastRunAt: typeof source.lastRunAt === 'string' ? source.lastRunAt : null,
      lastError: typeof source.lastError === 'string' ? source.lastError : null,
      lastPublishedTitle:
        typeof source.lastPublishedTitle === 'string' ? source.lastPublishedTitle : null,
      processedArticleIds: Array.isArray(source.processedArticleIds)
        ? source.processedArticleIds.filter((item): item is string => typeof item === 'string')
        : [],
    };
  }

  private async save(organizationId: string, config: DailyAutomationConfig) {
    await this.prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key: SETTING_KEY } },
      create: {
        organizationId,
        key: SETTING_KEY,
        value: config as unknown as Prisma.InputJsonValue,
      },
      update: { value: config as unknown as Prisma.InputJsonValue },
    });
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
    if (!membership) throw new Error('User is not assigned to an organization.');
    return membership.organizationId;
  }
}
