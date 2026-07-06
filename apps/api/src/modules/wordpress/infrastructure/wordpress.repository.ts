import { Injectable } from '@nestjs/common';
import {
  Role,
  SocialDraftStatus,
  SocialPlatform,
  WordPressCampaignStatus,
  WordPressPublishStatus,
  WordPressSyncStatus,
  type Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  WordPressArticleLibraryItem,
  WordPressConnectionConfig,
  WordPressConnectionRecord,
  WordPressPost,
  WordPressRequestLogInput,
} from '../domain/wordpress.types.js';
import { WordPressSecretService } from './wordpress-secret.service.js';

export interface LibraryQuery {
  page: number;
  perPage: number;
  search?: string;
  category?: string;
  status?: string;
  repurposed?: boolean;
}

export interface HubPostsQuery extends LibraryQuery {
  connectionId?: string;
  tag?: string;
  campaignStatus?: WordPressCampaignStatus;
  sortBy?: 'title' | 'modifiedAt' | 'publishedAt' | 'campaignStatus';
  sortDir?: 'asc' | 'desc';
}

export interface DraftQuery {
  page: number;
  perPage: number;
  platform?: SocialPlatform;
  status?: string;
}

export interface SocialDraftInput {
  articleId: string;
  repurposeJobId?: string;
  platform: SocialPlatform;
  title: string;
  body: string;
  hashtags: string[];
  callToAction?: string;
  mediaUrl?: string;
  prompt?: string;
  promptVersion?: string;
  sourceUrl: string;
}

export interface CampaignGenerationInput {
  articleId: string;
  campaignName: string;
  prompt?: string;
  promptVersion: string;
  aiModel: string;
  repurposeJobId: string;
  drafts: {
    id?: string;
    platform: SocialPlatform;
    title: string;
    body: string;
    hashtags: string[];
    mediaUrl?: string | null;
    prompt?: string | null;
    promptVersion?: string | null;
  }[];
}

@Injectable()
export class WordPressRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: WordPressSecretService,
  ) {}

  async saveConnection(
    config: WordPressConnectionConfig,
    organizationId?: string | null,
  ): Promise<WordPressConnectionRecord> {
    const encrypted = this.secrets.encrypt(config.applicationPassword);
    const connection = await this.prisma.wordPressConnection.upsert({
      where: {
        siteUrl_username: {
          siteUrl: config.siteUrl,
          username: config.username,
        },
      },
      create: {
        organizationId,
        siteUrl: config.siteUrl,
        username: config.username,
        applicationPasswordIv: encrypted.iv,
        applicationPasswordTag: encrypted.tag,
        applicationPasswordCiphertext: encrypted.ciphertext,
        lastConnectedAt: new Date(),
      },
      update: {
        organizationId,
        applicationPasswordIv: encrypted.iv,
        applicationPasswordTag: encrypted.tag,
        applicationPasswordCiphertext: encrypted.ciphertext,
        isActive: true,
        lastConnectedAt: new Date(),
      },
    });

    return {
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      applicationPassword: config.applicationPassword,
    };
  }

  async findActiveConnection(input: {
    connectionId?: string;
    organizationId?: string | null;
  } = {}): Promise<WordPressConnectionRecord | null> {
    const connection = await this.prisma.wordPressConnection.findFirst({
      where: {
        isActive: true,
        ...(input.connectionId ? { id: input.connectionId } : {}),
        ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      },
      orderBy: { lastConnectedAt: 'desc' },
    });

    if (!connection) {
      return null;
    }

    return {
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      applicationPassword: this.secrets.decrypt({
        iv: connection.applicationPasswordIv,
        tag: connection.applicationPasswordTag,
        ciphertext: connection.applicationPasswordCiphertext,
      }),
    };
  }

  async listConnections(organizationId?: string | null) {
    return this.prisma.wordPressConnection.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        siteUrl: true,
        username: true,
        isActive: true,
        lastConnectedAt: true,
        createdAt: true,
        _count: {
          select: {
            articles: true,
            syncRuns: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { lastConnectedAt: 'desc' }],
    });
  }

  async resolveOrganizationId(userId: string): Promise<string | null> {
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

    return membership?.organizationId ?? null;
  }

  async listCategories(connectionId?: string, organizationId?: string | null) {
    return this.prisma.wordPressCategory.findMany({
      where: {
        ...(connectionId ? { connectionId } : {}),
        ...(organizationId ? { connection: { organizationId } } : {}),
      },
      orderBy: [{ count: 'desc' }, { name: 'asc' }],
    });
  }

  async listTags(connectionId?: string, organizationId?: string | null) {
    return this.prisma.wordPressTag.findMany({
      where: {
        ...(connectionId ? { connectionId } : {}),
        ...(organizationId ? { connection: { organizationId } } : {}),
      },
      orderBy: [{ count: 'desc' }, { name: 'asc' }],
    });
  }

  async listAuthors(connectionId?: string, organizationId?: string | null) {
    return this.prisma.wordPressAuthor.findMany({
      where: {
        ...(connectionId ? { connectionId } : {}),
        ...(organizationId ? { connection: { organizationId } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async listMedia(connectionId?: string, organizationId?: string | null) {
    return this.prisma.wordPressMedia.findMany({
      where: {
        ...(connectionId ? { connectionId } : {}),
        ...(organizationId ? { connection: { organizationId } } : {}),
      },
      orderBy: { lastSyncedAt: 'desc' },
      take: 100,
    });
  }

  async logRequest(input: WordPressRequestLogInput): Promise<void> {
    await this.prisma.wordPressRequestLog.create({
      data: {
        method: input.method,
        url: input.url,
        statusCode: input.statusCode,
        attempts: input.attempts,
        durationMs: input.durationMs,
        success: input.success,
        error: input.error,
      },
    });
  }

  async createSyncRun(connectionId: string) {
    return this.prisma.wordPressSyncRun.create({
      data: { connectionId },
    });
  }

  async completeSyncRun(
    id: string,
    input: { scannedPosts: number; upsertedPosts: number; failedPosts: number },
  ) {
    return this.prisma.wordPressSyncRun.update({
      where: { id },
      data: {
        status: WordPressSyncStatus.COMPLETED,
        completedAt: new Date(),
        scannedPosts: input.scannedPosts,
        upsertedPosts: input.upsertedPosts,
        failedPosts: input.failedPosts,
      },
    });
  }

  async failSyncRun(id: string, error: string) {
    return this.prisma.wordPressSyncRun.update({
      where: { id },
      data: {
        status: WordPressSyncStatus.FAILED,
        completedAt: new Date(),
        error,
      },
    });
  }

  async upsertArticle(connectionId: string, post: WordPressPost) {
    const db = this.prisma;

      if (post.author) {
        await db.wordPressAuthor.upsert({
          where: {
            connectionId_wordpressId: {
              connectionId,
              wordpressId: post.author.id,
            },
          },
          create: {
            connectionId,
            wordpressId: post.author.id,
            name: post.author.name,
            slug: post.author.slug,
            url: post.author.url,
            avatarUrl: post.author.avatarUrl,
          },
          update: {
            name: post.author.name,
            slug: post.author.slug,
            url: post.author.url,
            avatarUrl: post.author.avatarUrl,
            lastSyncedAt: new Date(),
          },
        });
      }

      if (post.featuredImage) {
        await db.wordPressMedia.upsert({
          where: {
            connectionId_wordpressId: {
              connectionId,
              wordpressId: post.featuredImage.id,
            },
          },
          create: {
            connectionId,
            wordpressId: post.featuredImage.id,
            sourceUrl: post.featuredImage.sourceUrl,
            altText: post.featuredImage.altText,
            mediaType: post.featuredImage.mediaType,
            mimeType: post.featuredImage.mimeType,
            width: post.featuredImage.width,
            height: post.featuredImage.height,
            metadata: post.featuredImage.metadata as Prisma.InputJsonValue | undefined,
          },
          update: {
            sourceUrl: post.featuredImage.sourceUrl,
            altText: post.featuredImage.altText,
            mediaType: post.featuredImage.mediaType,
            mimeType: post.featuredImage.mimeType,
            width: post.featuredImage.width,
            height: post.featuredImage.height,
            metadata: post.featuredImage.metadata as Prisma.InputJsonValue | undefined,
            lastSyncedAt: new Date(),
          },
        });
      }

      for (const category of post.categories) {
        await db.wordPressCategory.upsert({
          where: {
            connectionId_wordpressId: {
              connectionId,
              wordpressId: category.id,
            },
          },
          create: {
            connectionId,
            wordpressId: category.id,
            name: category.name,
            slug: category.slug,
            count: category.count,
            parentId: category.parent,
          },
          update: {
            name: category.name,
            slug: category.slug,
            count: category.count,
            parentId: category.parent,
            lastSyncedAt: new Date(),
          },
        });
      }

      for (const tag of post.tags) {
        await db.wordPressTag.upsert({
          where: {
            connectionId_wordpressId: {
              connectionId,
              wordpressId: tag.id,
            },
          },
          create: {
            connectionId,
            wordpressId: tag.id,
            name: tag.name,
            slug: tag.slug,
            count: tag.count,
          },
          update: {
            name: tag.name,
            slug: tag.slug,
            count: tag.count,
            lastSyncedAt: new Date(),
          },
        });
      }

      return db.wordPressArticle.upsert({
        where: {
          connectionId_wordpressId: {
            connectionId,
            wordpressId: post.id,
          },
        },
        create: this.articleData(connectionId, post),
        update: {
          ...this.articleData(connectionId, post),
          lastSyncedAt: new Date(),
        },
      });
  }

  async listArticles(query: LibraryQuery) {
    const where = this.articleWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.wordPressArticle.findMany({
        where,
        orderBy: [{ modifiedAt: 'desc' }, { lastSyncedAt: 'desc' }],
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.wordPressArticle.count({ where }),
    ]);

    return {
      data: items.map(mapArticle),
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  }

  async listHubArticles(query: HubPostsQuery) {
    const where = this.articleWhere(query);
    const orderBy = this.hubOrderBy(query);
    const [items, total] = await Promise.all([
      this.prisma.wordPressArticle.findMany({
        where,
        include: {
          connection: {
            select: {
              id: true,
              siteUrl: true,
              username: true,
            },
          },
          campaigns: {
            select: {
              id: true,
              name: true,
              status: true,
              updatedAt: true,
              _count: {
                select: {
                  generations: true,
                  publishingHistory: true,
                },
              },
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              campaigns: true,
              socialDrafts: true,
            },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.wordPressArticle.count({ where }),
    ]);

    return {
      data: items.map((article) => ({
        ...mapArticle(article),
        connection: article.connection,
        campaignStatus: article.campaigns[0]?.status ?? WordPressCampaignStatus.NOT_GENERATED,
        latestCampaign: article.campaigns[0] ?? null,
        campaignCount: article._count.campaigns,
        draftCount: article._count.socialDrafts,
      })),
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  }

  async findArticle(id: string) {
    return this.prisma.wordPressArticle.findUnique({ where: { id } });
  }

  async findHubArticle(id: string) {
    return this.prisma.wordPressArticle.findUnique({
      where: { id },
      include: {
        connection: {
          select: {
            id: true,
            siteUrl: true,
            username: true,
            lastConnectedAt: true,
          },
        },
        campaigns: {
          include: {
            generations: {
              orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
            },
            publishingHistory: {
              orderBy: { createdAt: 'desc' },
            },
            regenerationHistory: {
              orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }],
            },
            analytics: {
              orderBy: { capturedAt: 'desc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        socialDrafts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async listArticlesForRepurpose(limit: number) {
    return this.prisma.wordPressArticle.findMany({
      orderBy: [{ repurposedAt: 'asc' }, { modifiedAt: 'desc' }],
      take: limit,
    });
  }

  async createRepurposeJob(articleId: string, platforms: SocialPlatform[], prompt?: string) {
    return this.prisma.contentRepurposeJob.create({
      data: {
        articleId,
        platforms,
        prompt,
      },
    });
  }

  async createDrafts(drafts: SocialDraftInput[]) {
    if (!drafts.length) {
      return [];
    }

    await this.prisma.socialDraft.createMany({
      data: drafts.map((draft) => ({
        articleId: draft.articleId,
        repurposeJobId: draft.repurposeJobId,
        platform: draft.platform,
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        callToAction: draft.callToAction,
        mediaUrl: draft.mediaUrl,
        sourceUrl: draft.sourceUrl,
      })),
    });
    return this.prisma.socialDraft.findMany({
      where: {
        repurposeJobId: drafts[0]?.repurposeJobId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(input: CampaignGenerationInput) {
    const version = await this.nextCampaignVersion(input.articleId);
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.wordPressCampaign.create({
        data: {
          articleId: input.articleId,
          name: input.campaignName,
          status: WordPressCampaignStatus.DRAFT,
          promptVersion: input.promptVersion,
          aiModel: input.aiModel,
          createdByRole: Role.ADMIN,
        },
      });

      await tx.wordPressCampaignGeneration.createMany({
        data: input.drafts.map((draft) => ({
          campaignId: campaign.id,
          articleId: input.articleId,
          repurposeJobId: input.repurposeJobId,
          socialDraftId: draft.id,
          platform: draft.platform,
          caption: draft.body,
          hashtags: draft.hashtags,
          imageUrl: draft.mediaUrl,
          prompt: draft.prompt ?? input.prompt,
          promptVersion: draft.promptVersion ?? input.promptVersion,
          aiModel: input.aiModel,
          version,
        })),
      });

      await tx.wordPressPublishingHistory.createMany({
        data: input.drafts.map((draft) => ({
          campaignId: campaign.id,
          articleId: input.articleId,
          platform: draft.platform,
          platformAccount: titleCasePlatform(draft.platform),
          status: WordPressPublishStatus.DRAFT,
          postUrl: null,
          errorLog: null,
        })),
      });

      await tx.wordPressRegenerationHistory.create({
        data: {
          campaignId: campaign.id,
          articleId: input.articleId,
          version,
          prompt: input.prompt,
          promptVersion: input.promptVersion,
          aiModel: input.aiModel,
          reason: version === 1 ? 'Initial AI campaign generation' : 'Regenerated campaign',
          snapshot: input.drafts.map((draft) => ({
            platform: draft.platform,
            title: draft.title,
            caption: draft.body,
            hashtags: draft.hashtags,
            imageUrl: draft.mediaUrl,
            prompt: draft.prompt ?? input.prompt,
            promptVersion: draft.promptVersion ?? input.promptVersion,
          })),
        },
      });

      return tx.wordPressCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: {
          generations: true,
          publishingHistory: true,
          regenerationHistory: true,
        },
      });
    });
  }

  async markArticleRepurposed(articleId: string) {
    return this.prisma.wordPressArticle.update({
      where: { id: articleId },
      data: { repurposedAt: new Date() },
    });
  }

  async listDrafts(query: DraftQuery) {
    const where: Prisma.SocialDraftWhereInput = {
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.status ? { status: query.status as SocialDraftStatus } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.socialDraft.findMany({
        where,
        include: {
          article: {
            select: {
              id: true,
              wordpressId: true,
              title: true,
              url: true,
              categoryNames: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.socialDraft.count({ where }),
    ]);

    return {
      data: items,
      pagination: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  }

  async approveDraft(id: string) {
    return this.prisma.socialDraft.update({
      where: { id },
      data: {
        status: SocialDraftStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  async scheduleDraft(id: string, scheduledFor: Date) {
    return this.prisma.socialDraft.update({
      where: { id },
      data: {
        status: SocialDraftStatus.SCHEDULED,
        scheduledFor,
      },
    });
  }

  async archiveArticles(articleIds: string[]) {
    return this.prisma.wordPressCampaign.updateMany({
      where: { articleId: { in: articleIds } },
      data: {
        status: WordPressCampaignStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });
  }

  private articleData(connectionId: string, post: WordPressPost) {
    return {
      connectionId,
      wordpressId: post.id,
      slug: post.slug,
      status: post.status,
      title: post.title,
      excerpt: post.excerpt,
      contentHtml: post.content,
      contentText: post.content ? stripHtml(post.content) : post.excerpt,
      url: post.link,
      authorId: post.author?.id,
      authorName: post.author?.name,
      authorSlug: post.author?.slug,
      featuredImageId: post.featuredImage?.id,
      featuredImageUrl: post.featuredImage?.sourceUrl,
      featuredImageAlt: post.featuredImage?.altText,
      categoryNames: post.categories.map((category) => category.name),
      categorySlugs: post.categories.map((category) => category.slug),
      tagNames: post.tags.map((tag) => tag.name),
      tagSlugs: post.tags.map((tag) => tag.slug),
      metadata: post.metadata as Prisma.InputJsonValue | undefined,
      publishedAt: parseOptionalDate(post.publishedAt),
      modifiedAt: parseOptionalDate(post.modifiedAt),
    };
  }

  private articleWhere(query: LibraryQuery): Prisma.WordPressArticleWhereInput {
    const hubQuery = query as HubPostsQuery;

    return {
      ...(hubQuery.connectionId
        ? { connectionId: hubQuery.connectionId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { excerpt: { contains: query.search, mode: 'insensitive' } },
              { contentText: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category ? { categorySlugs: { has: query.category } } : {}),
      ...(hubQuery.tag ? { tagSlugs: { has: hubQuery.tag } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(hubQuery.campaignStatus
        ? hubQuery.campaignStatus === WordPressCampaignStatus.NOT_GENERATED
          ? { campaigns: { none: {} } }
          : { campaigns: { some: { status: hubQuery.campaignStatus } } }
        : {}),
      ...(query.repurposed === undefined
        ? {}
        : query.repurposed
          ? { repurposedAt: { not: null } }
          : { repurposedAt: null }),
    };
  }

  private hubOrderBy(query: HubPostsQuery): Prisma.WordPressArticleOrderByWithRelationInput[] {
    const sortDir = query.sortDir ?? 'desc';

    if (query.sortBy === 'title') {
      return [{ title: sortDir }];
    }

    if (query.sortBy === 'publishedAt') {
      return [{ publishedAt: sortDir }, { modifiedAt: 'desc' }];
    }

    return [{ modifiedAt: sortDir }, { lastSyncedAt: 'desc' }];
  }

  private async nextCampaignVersion(articleId: string): Promise<number> {
    const latest = await this.prisma.wordPressRegenerationHistory.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return (latest?.version ?? 0) + 1;
  }
}

function mapArticle(article: {
  id: string;
  wordpressId: number;
  title: string;
  excerpt: string;
  url: string;
  authorName: string | null;
  featuredImageUrl: string | null;
  categoryNames: string[];
  categorySlugs: string[];
  tagNames: string[];
  tagSlugs: string[];
  publishedAt: Date | null;
  modifiedAt: Date | null;
  repurposedAt: Date | null;
}): WordPressArticleLibraryItem {
  return {
    id: article.id,
    wordpressId: article.wordpressId,
    title: article.title,
    excerpt: article.excerpt,
    url: article.url,
    authorName: article.authorName,
    featuredImageUrl: article.featuredImageUrl,
    categoryNames: article.categoryNames,
    categorySlugs: article.categorySlugs,
    tagNames: article.tagNames,
    tagSlugs: article.tagSlugs,
    campaignStatus: 'NOT_GENERATED',
    publishedAt: article.publishedAt,
    modifiedAt: article.modifiedAt,
    repurposedAt: article.repurposedAt,
  };
}

function titleCasePlatform(platform: SocialPlatform): string {
  return platform
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function parseOptionalDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
