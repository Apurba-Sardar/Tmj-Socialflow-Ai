import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import { createLogger } from '@socialflow/logger';

import type {
  PaginatedWordPressPosts,
  WordPressAuthor,
  WordPressCategory,
  WordPressConnectionConfig,
  WordPressConnectionRecord,
  WordPressFeaturedImage,
  WordPressHttpResponse,
  WordPressPost,
  WordPressRawAuthor,
  WordPressRawCategory,
  WordPressRawMedia,
  WordPressRawPost,
  WordPressSyncResult,
} from '../domain/wordpress.types.js';
import { WordPressRepository } from '../infrastructure/wordpress.repository.js';
import { WordPressRestClient } from '../infrastructure/wordpress-rest.client.js';
import { SocialContentGeneratorService } from './social-content-generator.service.js';
import type {
  BulkRepurposeDto,
  ConnectWordPressDto,
  DraftsQueryDto,
  RepurposeArticleDto,
  ScheduleDraftDto,
  SyncWordPressDto,
  WordPressLibraryQueryDto,
} from './wordpress.dto.js';

@Injectable()
export class WordPressService {
  private readonly logger = createLogger('wordpress');

  constructor(
    private readonly repository: WordPressRepository,
    private readonly client: WordPressRestClient,
    private readonly generator: SocialContentGeneratorService,
  ) {}

  async connect(dto: ConnectWordPressDto) {
    const config: WordPressConnectionConfig = {
      siteUrl: this.normalizeSiteUrl(dto.siteUrl),
      username: dto.username.trim(),
      applicationPassword: dto.applicationPassword.trim(),
    };

    await this.withLogging('GET', `${config.siteUrl}/wp-json/wp/v2/users/me`, () =>
      this.client.validateConnection(config),
    );

    const connection = await this.repository.saveConnection(config);
    return {
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      connected: true,
    };
  }

  async getPosts(params: { page: number; perPage: number }): Promise<PaginatedWordPressPosts> {
    const connection = await this.requireConnection();
    const postsResponse = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/posts`,
      () => this.client.fetchPosts(connection, params),
    );
    const posts = await Promise.all(
      postsResponse.data.map((post) => this.mapPost(connection, post)),
    );

    return {
      data: posts,
      pagination: {
        page: params.page,
        perPage: params.perPage,
        total: this.readPaginationHeader(postsResponse.headers, 'x-wp-total'),
        totalPages: this.readPaginationHeader(postsResponse.headers, 'x-wp-totalpages'),
      },
    };
  }

  async getPost(id: number): Promise<WordPressPost> {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('WordPress post id must be a positive integer.');
    }

    const connection = await this.requireConnection();

    try {
      const response = await this.withLogging(
        'GET',
        `${connection.siteUrl}/wp-json/wp/v2/posts/${String(id)}`,
        () => this.client.fetchPost(connection, id),
      );
      return await this.mapPost(connection, response.data, true);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new NotFoundException('WordPress article was not found.');
    }
  }

  async getCategories(): Promise<WordPressCategory[]> {
    const connection = await this.requireConnection();
    const response = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/categories`,
      () => this.client.fetchCategories(connection),
    );

    return response.data.map(mapCategory);
  }

  async sync(dto: SyncWordPressDto): Promise<WordPressSyncResult> {
    const connection = await this.requireConnection();
    const perPage = dto.perPage ?? 100;
    const maxPages = dto.maxPages ?? 100;
    const syncRun = await this.repository.createSyncRun(connection.id);
    let scannedPosts = 0;
    let upsertedPosts = 0;
    let failedPosts = 0;
    let totalPages = 1;

    try {
      for (let page = 1; page <= Math.min(totalPages, maxPages); page += 1) {
        const response = await this.withLogging(
          'GET',
          `${connection.siteUrl}/wp-json/wp/v2/posts`,
          () => this.client.fetchPosts(connection, { page, perPage }),
        );
        totalPages = this.readPaginationHeader(response.headers, 'x-wp-totalpages') || totalPages;

        const posts = await Promise.all(
          response.data.map((post) => this.mapPost(connection, post, true)),
        );
        scannedPosts += posts.length;

        for (const post of posts) {
          try {
            await this.repository.upsertArticle(connection.id, post);
            upsertedPosts += 1;
          } catch (error) {
            failedPosts += 1;
            this.logger.warn(
              {
                error: error instanceof Error ? error.message : 'Unknown article upsert error.',
                postId: post.id,
              },
              'WordPress article upsert failed',
            );
          }
        }

        if (!response.data.length) {
          break;
        }
      }

      await this.repository.completeSyncRun(syncRun.id, {
        scannedPosts,
        upsertedPosts,
        failedPosts,
      });

      return {
        syncRunId: syncRun.id,
        status: 'COMPLETED',
        scannedPosts,
        upsertedPosts,
        failedPosts,
        totalPages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync failure.';
      await this.repository.failSyncRun(syncRun.id, message);

      return {
        syncRunId: syncRun.id,
        status: 'FAILED',
        scannedPosts,
        upsertedPosts,
        failedPosts,
        totalPages,
      };
    }
  }

  async listLibrary(query: WordPressLibraryQueryDto) {
    return this.repository.listArticles({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      search: query.search,
      category: query.category,
      status: query.status,
      repurposed: query.repurposed === undefined ? undefined : query.repurposed === 'true',
    });
  }

  async getLibraryArticle(id: string) {
    const article = await this.repository.findArticle(id);

    if (!article) {
      throw new NotFoundException('WordPress library article was not found.');
    }

    return article;
  }

  async repurposeArticle(id: string, dto: RepurposeArticleDto) {
    const article = await this.repository.findArticle(id);

    if (!article) {
      throw new NotFoundException('WordPress library article was not found.');
    }

    const platforms = this.platforms(dto.platforms);
    const job = await this.repository.createRepurposeJob(article.id, platforms, dto.prompt);
    const drafts = await this.repository.createDrafts(
      this.generator.generate(article, platforms, job.id),
    );
    await this.repository.markArticleRepurposed(article.id);

    return {
      job,
      drafts,
    };
  }

  async bulkRepurpose(dto: BulkRepurposeDto) {
    const articles = await this.repository.listArticlesForRepurpose(dto.limit ?? 10);
    const results = [];

    for (const article of articles) {
      results.push(await this.repurposeArticle(article.id, dto));
    }

    return {
      processed: results.length,
      results,
    };
  }

  async listDrafts(query: DraftsQueryDto) {
    return this.repository.listDrafts({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      platform: query.platform,
      status: query.status,
    });
  }

  async approveDraft(id: string) {
    return this.repository.approveDraft(id);
  }

  async scheduleDraft(id: string, dto: ScheduleDraftDto) {
    const scheduledFor = new Date(dto.scheduledFor);

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BadRequestException('scheduledFor must be a valid ISO date.');
    }

    return this.repository.scheduleDraft(id, scheduledFor);
  }

  private async mapPost(
    connection: WordPressConnectionConfig,
    post: WordPressRawPost,
    includeContent = false,
  ): Promise<WordPressPost> {
    const embeddedAuthor = post._embedded?.author?.[0];
    const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
    const embeddedCategories = post._embedded?.['wp:term']?.flat() ?? [];

    const [author, featuredImage, categories] = await Promise.all([
      embeddedAuthor
        ? Promise.resolve(mapAuthor(embeddedAuthor))
        : this.fetchAuthorIfPresent(connection, post.author),
      embeddedMedia
        ? Promise.resolve(mapFeaturedImage(embeddedMedia))
        : this.fetchFeaturedImageIfPresent(connection, post.featured_media),
      embeddedCategories.length
        ? Promise.resolve(embeddedCategories.map(mapCategory))
        : this.fetchCategoriesIfPresent(connection, post.categories),
    ]);

    return {
      id: post.id,
      slug: post.slug,
      status: post.status,
      link: post.link,
      title: stripHtml(post.title.rendered),
      excerpt: stripHtml(post.excerpt.rendered),
      content: includeContent && post.content ? post.content.rendered : undefined,
      publishedAt: post.date_gmt,
      modifiedAt: post.modified_gmt,
      author,
      featuredImage,
      categories,
    };
  }

  private async fetchAuthorIfPresent(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressAuthor | undefined> {
    if (!id) {
      return undefined;
    }

    const response = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/users/${String(id)}`,
      () => this.client.fetchAuthor(connection, id),
    );
    return mapAuthor(response.data);
  }

  private async fetchFeaturedImageIfPresent(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressFeaturedImage | undefined> {
    if (!id) {
      return undefined;
    }

    const response = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/media/${String(id)}`,
      () => this.client.fetchFeaturedImage(connection, id),
    );
    return mapFeaturedImage(response.data);
  }

  private async fetchCategoriesIfPresent(
    connection: WordPressConnectionConfig,
    ids: number[],
  ): Promise<WordPressCategory[]> {
    if (!ids.length) {
      return [];
    }

    const response = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/categories`,
      () => this.client.fetchCategories(connection, ids),
    );
    return response.data.map(mapCategory);
  }

  private async requireConnection(): Promise<WordPressConnectionRecord> {
    const connection = await this.repository.findActiveConnection();

    if (!connection) {
      throw new BadRequestException('Connect a WordPress site before fetching posts.');
    }

    return connection;
  }

  private platforms(platforms?: SocialPlatform[]): SocialPlatform[] {
    return platforms?.length
      ? platforms
      : [
          SocialPlatform.PINTEREST,
          SocialPlatform.INSTAGRAM,
          SocialPlatform.LINKEDIN,
          SocialPlatform.X,
          SocialPlatform.FACEBOOK,
        ];
  }

  private async withLogging<T>(
    method: string,
    url: string,
    request: () => Promise<WordPressHttpResponse<T>>,
  ): Promise<WordPressHttpResponse<T>> {
    const startedAt = Date.now();

    try {
      const response = await request();
      await this.repository.logRequest({
        method,
        url,
        statusCode: response.statusCode,
        attempts: response.attempts,
        durationMs: Date.now() - startedAt,
        success: true,
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WordPress error.';
      await this.repository.logRequest({
        method,
        url,
        attempts: 3,
        durationMs: Date.now() - startedAt,
        success: false,
        error: message,
      });
      this.logger.warn({ error: message, url }, 'WordPress request failed');
      throw error;
    }
  }

  private normalizeSiteUrl(siteUrl: string): string {
    return siteUrl.trim().replace(/\/+$/, '');
  }

  private readPaginationHeader(headers: Headers, name: string): number {
    const value = headers.get(name);
    return value ? Number.parseInt(value, 10) : 0;
  }
}

function mapAuthor(author: WordPressRawAuthor): WordPressAuthor {
  return {
    id: author.id,
    name: author.name,
    slug: author.slug,
    url: author.url,
    avatarUrl: author.avatar_urls?.['96'] ?? author.avatar_urls?.['48'],
  };
}

function mapCategory(category: WordPressRawCategory): WordPressCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    count: category.count,
    parent: category.parent,
  };
}

function mapFeaturedImage(media: WordPressRawMedia): WordPressFeaturedImage {
  return {
    id: media.id,
    sourceUrl: media.source_url,
    altText: media.alt_text,
    mediaType: media.media_type,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
