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
import type { AuthenticatedUser } from '../../auth/types.js';
import type {
  BulkRepurposeDto,
  BulkWordPressActionDto,
  ConnectWordPressDto,
  DraftsQueryDto,
  GenerateCampaignDto,
  RepurposeArticleDto,
  ScheduleDraftDto,
  SyncWordPressDto,
  WordPressHubPostsQueryDto,
  WordPressLibraryQueryDto,
} from './wordpress.dto.js';

const DEFAULT_WORDPRESS_POST_TYPES = ['posts'];

@Injectable()
export class WordPressService {
  private readonly logger = createLogger('wordpress');

  constructor(
    private readonly repository: WordPressRepository,
    private readonly client: WordPressRestClient,
    private readonly generator: SocialContentGeneratorService,
  ) {}

  async connect(dto: ConnectWordPressDto, user?: AuthenticatedUser) {
    const config: WordPressConnectionConfig = {
      siteUrl: this.normalizeSiteUrl(dto.siteUrl),
      username: dto.username.trim(),
      applicationPassword: dto.applicationPassword.trim(),
    };
    const organizationId = user ? await this.repository.resolveOrganizationId(user.id) : null;

    await this.withLogging('GET', `${config.siteUrl}/wp-json/wp/v2/users/me`, () =>
      this.client.validateConnection(config),
    );

    const connection = organizationId
      ? await this.repository.saveConnection(config, organizationId)
      : await this.repository.saveConnection(config);
    return {
      id: connection.id,
      siteUrl: connection.siteUrl,
      username: connection.username,
      connected: true,
    };
  }

  async getPosts(params: {
    page: number;
    perPage: number;
    connectionId?: string;
    status?: string;
    user?: AuthenticatedUser;
  }): Promise<PaginatedWordPressPosts> {
    const connection = await this.requireConnection(params);
    const postType = params.status === 'any' ? 'posts' : undefined;
    const postsResponse = await this.withLogging(
      'GET',
      `${connection.siteUrl}/wp-json/wp/v2/posts`,
      () => this.client.fetchPosts(connection, { ...params, postType }),
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

  async getPost(
    id: number,
    params: { connectionId?: string; user?: AuthenticatedUser },
  ): Promise<WordPressPost> {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('WordPress post id must be a positive integer.');
    }

    const connection = await this.requireConnection(params);

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

  async listCategories(user: AuthenticatedUser, connectionId?: string) {
    const organizationId = await this.repository.resolveOrganizationId(user.id);
    return this.repository.listCategories(connectionId, organizationId);
  }

  async listTags(user: AuthenticatedUser, connectionId?: string) {
    const organizationId = await this.repository.resolveOrganizationId(user.id);
    return this.repository.listTags(connectionId, organizationId);
  }

  async listAuthors(user: AuthenticatedUser, connectionId?: string) {
    const organizationId = await this.repository.resolveOrganizationId(user.id);
    return this.repository.listAuthors(connectionId, organizationId);
  }

  async listMedia(user: AuthenticatedUser, connectionId?: string) {
    const organizationId = await this.repository.resolveOrganizationId(user.id);
    return this.repository.listMedia(connectionId, organizationId);
  }

  async listConnections(user: AuthenticatedUser) {
    const organizationId = await this.repository.resolveOrganizationId(user.id);
    return this.repository.listConnections(organizationId);
  }

  async sync(dto: SyncWordPressDto, user: AuthenticatedUser): Promise<WordPressSyncResult> {
    const connection = await this.requireConnection({ connectionId: dto.connectionId, user });
    const perPage = dto.perPage ?? 100;
    const maxPages = dto.maxPages ?? 100;
    const status = dto.status?.trim() ?? undefined;
    const postTypes = this.syncPostTypes(dto.postTypes);
    const syncRun = await this.repository.createSyncRun(connection.id);
    let scannedPosts = 0;
    let upsertedPosts = 0;
    let failedPosts = 0;
    let totalPages = 0;

    try {
      for (const postType of postTypes) {
        let postTypeTotalPages = 1;

        for (let page = 1; page <= Math.min(postTypeTotalPages, maxPages); page += 1) {
          const response = await this.withLogging(
            'GET',
            `${connection.siteUrl}/wp-json/wp/v2/${postType}`,
            () => this.client.fetchPosts(connection, { page, perPage, status, postType }),
          );
          postTypeTotalPages =
            this.readPaginationHeader(response.headers, 'x-wp-totalpages') || postTypeTotalPages;
          totalPages += page === 1 ? postTypeTotalPages : 0;

          scannedPosts += response.data.length;

          for (const rawPost of response.data) {
            try {
              const post = await this.mapPost(connection, rawPost, true, postType);
              await this.repository.upsertArticle(connection.id, post);
              upsertedPosts += 1;
            } catch (error) {
              failedPosts += 1;
              this.logger.warn(
                {
                  error: error instanceof Error ? error.message : 'Unknown article upsert error.',
                  postId: rawPost.id,
                  postType,
                },
                'WordPress article sync failed',
              );
            }
          }

          if (!response.data.length) {
            break;
          }
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
        totalPages: Math.max(totalPages, 1),
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
        totalPages: Math.max(totalPages, 1),
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

  async listHubPosts(query: WordPressHubPostsQueryDto) {
    return this.repository.listHubArticles({
      page: query.page ?? 1,
      perPage: query.perPage ?? 25,
      search: query.search,
      category: query.category,
      status: query.status,
      repurposed: query.repurposed === undefined ? undefined : query.repurposed === 'true',
      connectionId: query.connectionId,
      tag: query.tag,
      campaignStatus: query.campaignStatus,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });
  }

  async getHubPost(id: string) {
    const article = await this.repository.findHubArticle(id);

    if (!article) {
      throw new NotFoundException('WordPress hub article was not found.');
    }

    return article;
  }

  async repurposeArticle(id: string, dto: RepurposeArticleDto, user?: { id: string }) {
    const article = await this.repository.findArticle(id);

    if (!article) {
      throw new NotFoundException('WordPress library article was not found.');
    }

    const platforms = this.platforms(dto.platforms);
    const job = await this.repository.createRepurposeJob(article.id, platforms, dto.prompt);
    const generatedDrafts = await this.generator.generate(article, platforms, job.id, user?.id);
    const drafts = await this.repository.createDrafts(generatedDrafts);
    await this.repository.markArticleRepurposed(article.id);

    return {
      job,
      drafts,
    };
  }

  async generateCampaign(id: string, dto: GenerateCampaignDto, user?: { id: string }) {
    const article = await this.repository.findArticle(id);

    if (!article) {
      throw new NotFoundException('WordPress hub article was not found.');
    }

    const platforms = this.platforms(dto.platforms);
    const job = await this.repository.createRepurposeJob(article.id, platforms, dto.prompt);
    const generatedDrafts = await this.generator.generate(article, platforms, job.id, user?.id);
    const drafts = await this.repository.createDrafts(generatedDrafts);
    const generatedByPlatform = new Map(generatedDrafts.map((draft) => [draft.platform, draft]));
    const draftsWithPromptMetadata = drafts.map((draft) => {
      const generated = generatedByPlatform.get(draft.platform);
      return {
        ...draft,
        prompt: generated?.prompt,
        promptVersion: generated?.promptVersion,
      };
    });
    const campaign = await this.repository.createCampaign({
      articleId: article.id,
      campaignName: dto.campaignName?.trim() ?? `Campaign: ${article.title}`,
      prompt: dto.prompt,
      promptVersion: dto.promptVersion?.trim() ?? generatedDrafts[0]?.promptVersion ?? 'wordpress-hub-v1',
      aiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      repurposeJobId: job.id,
      drafts: draftsWithPromptMetadata,
    });
    await this.repository.markArticleRepurposed(article.id);

    return {
      campaign,
      drafts,
    };
  }

  async bulkHubAction(dto: BulkWordPressActionDto, user?: { id: string }) {
    if (!dto.articleIds.length) {
      throw new BadRequestException('Select at least one WordPress article.');
    }

    switch (dto.action) {
      case 'archive': {
        const result = await this.repository.archiveArticles(dto.articleIds);
        return {
          action: dto.action,
          processed: result.count,
        };
      }

      case 'generate': {
        const results = [];

        for (const articleId of dto.articleIds) {
          results.push(await this.generateCampaign(articleId, {}, user));
        }

        return {
          action: dto.action,
          processed: results.length,
          results,
        };
      }

      default:
        throw new BadRequestException('Unsupported WordPress hub bulk action.');
    }
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

  async deleteDraft(id: string) {
    return this.repository.deleteDraft(id);
  }

  private async mapPost(
    connection: WordPressConnectionConfig,
    post: WordPressRawPost,
    includeContent = false,
    postType = 'posts',
  ): Promise<WordPressPost> {
    const embeddedAuthor = post._embedded?.author?.[0];
    const embeddedMedia = post._embedded?.['wp:featuredmedia']?.[0];
    const embeddedTerms = post._embedded?.['wp:term'] ?? [];
    const embeddedCategories = embeddedTerms[0] ?? [];
    const embeddedTags = embeddedTerms[1] ?? [];

    const [author, featuredImage, categories, tags] = await Promise.all([
      embeddedAuthor
        ? Promise.resolve(mapAuthor(embeddedAuthor))
        : this.fetchAuthorIfPresent(connection, post.author),
      embeddedMedia
        ? Promise.resolve(mapFeaturedImage(embeddedMedia))
        : this.fetchFeaturedImageIfPresent(connection, post.featured_media ?? 0),
      embeddedCategories.length
        ? Promise.resolve(embeddedCategories.map(mapCategory))
        : this.fetchCategoriesIfPresent(connection, post.categories ?? []),
      embeddedTags.length
        ? Promise.resolve(embeddedTags.map(mapCategory))
        : this.fetchTagsIfPresent(connection, post.tags ?? []),
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
      tags,
      metadata: {
        ...(post.social_zap4 ?? post.meta ?? {}),
        sourceType: postType,
      },
    };
  }

  private syncPostTypes(postTypes?: string[]): string[] {
    const normalized = postTypes
      ?.map((postType) => postType.trim())
      .filter(Boolean)
      .filter((postType, index, all) => all.indexOf(postType) === index);

    return normalized?.length ? normalized : DEFAULT_WORDPRESS_POST_TYPES;
  }

  private async fetchAuthorIfPresent(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressAuthor | undefined> {
    if (!id) {
      return undefined;
    }

    try {
      const response = await this.withLogging(
        'GET',
        `${connection.siteUrl}/wp-json/wp/v2/users/${String(id)}`,
        () => this.client.fetchAuthor(connection, id),
      );
      return mapAuthor(response.data);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown author fetch error.', authorId: id },
        'WordPress author fetch failed',
      );
      return undefined;
    }
  }

  private async fetchFeaturedImageIfPresent(
    connection: WordPressConnectionConfig,
    id: number,
  ): Promise<WordPressFeaturedImage | undefined> {
    if (!id) {
      return undefined;
    }

    try {
      const response = await this.withLogging(
        'GET',
        `${connection.siteUrl}/wp-json/wp/v2/media/${String(id)}`,
        () => this.client.fetchFeaturedImage(connection, id),
      );
      return mapFeaturedImage(response.data);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown media fetch error.', mediaId: id },
        'WordPress featured image fetch failed',
      );
      return undefined;
    }
  }

  private async fetchCategoriesIfPresent(
    connection: WordPressConnectionConfig,
    ids: number[],
  ): Promise<WordPressCategory[]> {
    if (!ids.length) {
      return [];
    }

    try {
      const response = await this.withLogging(
        'GET',
        `${connection.siteUrl}/wp-json/wp/v2/categories`,
        () => this.client.fetchCategories(connection, ids),
      );
      return response.data.map(mapCategory);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown category fetch error.', ids },
        'WordPress category fetch failed',
      );
      return [];
    }
  }

  private async fetchTagsIfPresent(
    connection: WordPressConnectionConfig,
    ids: number[],
  ): Promise<WordPressCategory[]> {
    if (!ids.length) {
      return [];
    }

    try {
      const response = await this.withLogging(
        'GET',
        `${connection.siteUrl}/wp-json/wp/v2/tags`,
        () => this.client.fetchTags(connection, ids),
      );
      return response.data.map(mapCategory);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown tag fetch error.', ids },
        'WordPress tag fetch failed',
      );
      return [];
    }
  }

  private async requireConnection(params: {
    connectionId?: string;
    user?: AuthenticatedUser;
  }): Promise<WordPressConnectionRecord> {
    const organizationId = params.user
      ? await this.repository.resolveOrganizationId(params.user.id)
      : null;
    const connection = await this.repository.findActiveConnection({
      connectionId: params.connectionId,
      organizationId,
    });

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
    mimeType: media.mime_type,
    width: media.media_details?.width,
    height: media.media_details?.height,
    metadata: media.media_details ? { mediaDetails: media.media_details } : undefined,
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
