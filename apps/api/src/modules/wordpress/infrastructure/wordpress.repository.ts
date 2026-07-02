import { Injectable } from '@nestjs/common';
import {
  SocialDraftStatus,
  SocialPlatform,
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
  sourceUrl: string;
}

@Injectable()
export class WordPressRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: WordPressSecretService,
  ) {}

  async saveConnection(config: WordPressConnectionConfig): Promise<WordPressConnectionRecord> {
    const encrypted = this.secrets.encrypt(config.applicationPassword);
    const connection = await this.prisma.wordPressConnection.upsert({
      where: {
        siteUrl_username: {
          siteUrl: config.siteUrl,
          username: config.username,
        },
      },
      create: {
        siteUrl: config.siteUrl,
        username: config.username,
        applicationPasswordIv: encrypted.iv,
        applicationPasswordTag: encrypted.tag,
        applicationPasswordCiphertext: encrypted.ciphertext,
        lastConnectedAt: new Date(),
      },
      update: {
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

  async findActiveConnection(): Promise<WordPressConnectionRecord | null> {
    const connection = await this.prisma.wordPressConnection.findFirst({
      where: { isActive: true },
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
    return this.prisma.wordPressArticle.upsert({
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

  async findArticle(id: string) {
    return this.prisma.wordPressArticle.findUnique({ where: { id } });
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

    await this.prisma.socialDraft.createMany({ data: drafts });
    return this.prisma.socialDraft.findMany({
      where: {
        repurposeJobId: drafts[0]?.repurposeJobId,
      },
      orderBy: { createdAt: 'desc' },
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
      publishedAt: parseOptionalDate(post.publishedAt),
      modifiedAt: parseOptionalDate(post.modifiedAt),
    };
  }

  private articleWhere(query: LibraryQuery): Prisma.WordPressArticleWhereInput {
    return {
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
      ...(query.status ? { status: query.status } : {}),
      ...(query.repurposed === undefined
        ? {}
        : query.repurposed
          ? { repurposedAt: { not: null } }
          : { repurposedAt: null }),
    };
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
    publishedAt: article.publishedAt,
    modifiedAt: article.modifiedAt,
    repurposedAt: article.repurposedAt,
  };
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
