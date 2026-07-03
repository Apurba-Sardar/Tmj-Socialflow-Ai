import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  QueueJobStatus,
  Role,
  SocialDraftStatus,
  SocialPlatform,
  WordPressCampaignStatus,
  WordPressPublishStatus,
  type Prisma,
} from '@prisma/client';

import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialContentGeneratorService } from '../wordpress/application/social-content-generator.service.js';
import type {
  AiPipelineQueryDto,
  GenerateAiContentDto,
  RegenerateCampaignDto,
  UpdateDraftStatusDto,
} from './ai-pipeline.dto.js';

const QUEUE_NAME = 'ai-content-pipeline';
const DEFAULT_PLATFORMS = [
  SocialPlatform.PINTEREST,
  SocialPlatform.INSTAGRAM,
  SocialPlatform.LINKEDIN,
  SocialPlatform.X,
];

@Injectable()
export class AiPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: SocialContentGeneratorService,
  ) {}

  async overview(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);
    const articleScope = this.articleScope(organizationId);

    const [
      sourceArticles,
      notGenerated,
      jobsByStatus,
      draftsByStatus,
      recentJobs,
      recentDrafts,
      campaignCount,
    ] = await Promise.all([
      this.prisma.wordPressArticle.count({ where: articleScope }),
      this.prisma.wordPressArticle.count({ where: { ...articleScope, campaigns: { none: {} } } }),
      this.prisma.queueJob.groupBy({
        by: ['status'],
        where: { organizationId, queueName: QUEUE_NAME },
        _count: { _all: true },
      }),
      this.prisma.socialDraft.groupBy({
        by: ['status'],
        where: { article: articleScope },
        _count: { _all: true },
      }),
      this.prisma.queueJob.findMany({
        where: { organizationId, queueName: QUEUE_NAME },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.socialDraft.findMany({
        where: { article: articleScope },
        include: { article: { select: { title: true, featuredImageUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.wordPressCampaign.count({ where: { article: articleScope } }),
    ]);

    return {
      totals: {
        sourceArticles,
        notGenerated,
        campaigns: campaignCount,
        drafts: draftsByStatus.reduce((sum, row) => sum + row._count._all, 0),
        jobs: jobsByStatus.reduce((sum, row) => sum + row._count._all, 0),
      },
      jobsByStatus: Object.values(QueueJobStatus).map((status) => ({
        status,
        count: jobsByStatus.find((row) => row.status === status)?._count._all ?? 0,
      })),
      draftsByStatus: Object.values(SocialDraftStatus).map((status) => ({
        status,
        count: draftsByStatus.find((row) => row.status === status)?._count._all ?? 0,
      })),
      recentJobs,
      recentDrafts,
    };
  }

  async sources(user: AuthenticatedUser, query: AiPipelineQueryDto) {
    const organizationId = await this.requireOrganizationId(user.id);
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 25;
    const where: Prisma.WordPressArticleWhereInput = {
      ...this.articleScope(organizationId),
      campaigns: { none: {} },
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { excerpt: { contains: query.search, mode: 'insensitive' } },
              { contentText: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.wordPressArticle.findMany({
        where,
        include: {
          connection: { select: { id: true, siteUrl: true } },
          _count: { select: { campaigns: true, socialDrafts: true } },
        },
        orderBy: [{ modifiedAt: 'desc' }, { lastSyncedAt: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.wordPressArticle.count({ where }),
    ]);

    return {
      data: items,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async jobs(user: AuthenticatedUser) {
    const organizationId = await this.requireOrganizationId(user.id);
    const jobs = await this.prisma.queueJob.findMany({
      where: { organizationId, queueName: QUEUE_NAME },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: jobs };
  }

  async drafts(user: AuthenticatedUser, status?: SocialDraftStatus) {
    const organizationId = await this.requireOrganizationId(user.id);
    const drafts = await this.prisma.socialDraft.findMany({
      where: {
        article: this.articleScope(organizationId),
        ...(status ? { status } : {}),
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            url: true,
            featuredImageUrl: true,
            connection: { select: { siteUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { data: drafts };
  }

  async generate(user: AuthenticatedUser, dto: GenerateAiContentDto) {
    this.assertCanGenerate(user);

    if (!dto.articleIds.length) {
      throw new BadRequestException('Select at least one source article.');
    }

    if (dto.articleIds.length > 25) {
      throw new BadRequestException('Generate a maximum of 25 articles at a time.');
    }

    const organizationId = await this.requireOrganizationId(user.id);
    const platforms = dto.platforms?.length ? dto.platforms : DEFAULT_PLATFORMS;
    const results = [];

    for (const articleId of dto.articleIds) {
      const queueJob = await this.prisma.queueJob.create({
        data: {
          organizationId,
          userId: user.id,
          queueName: QUEUE_NAME,
          jobName: 'generate-social-campaign',
          status: QueueJobStatus.ACTIVE,
          attempts: 1,
          processedAt: new Date(),
          payload: {
            articleId,
            platforms,
            prompt: dto.prompt,
            promptVersion: dto.promptVersion ?? 'ai-pipeline-v1',
          },
        },
      });

      try {
        const result = await this.generateForArticle({
          organizationId,
          articleId,
          platforms,
          prompt: dto.prompt,
          promptVersion: dto.promptVersion ?? 'ai-pipeline-v1',
          reason: 'AI pipeline generation',
        });

        await this.prisma.queueJob.update({
          where: { id: queueJob.id },
          data: {
            status: QueueJobStatus.COMPLETED,
            finishedAt: new Date(),
            result: {
              campaignId: result.campaign.id,
              drafts: result.drafts.length,
              generations: result.campaign.generations.length,
            },
          },
        });

        results.push({ articleId, status: 'COMPLETED', campaign: result.campaign });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI generation failed.';
        await this.prisma.queueJob.update({
          where: { id: queueJob.id },
          data: {
            status: QueueJobStatus.FAILED,
            failedReason: message,
            finishedAt: new Date(),
          },
        });
        results.push({ articleId, status: 'FAILED', error: message });
      }
    }

    return {
      processed: results.length,
      completed: results.filter((item) => item.status === 'COMPLETED').length,
      failed: results.filter((item) => item.status === 'FAILED').length,
      results,
    };
  }

  async regenerateCampaign(user: AuthenticatedUser, campaignId: string, dto: RegenerateCampaignDto) {
    this.assertCanGenerate(user);
    const organizationId = await this.requireOrganizationId(user.id);
    const campaign = await this.prisma.wordPressCampaign.findFirst({
      where: { id: campaignId, article: this.articleScope(organizationId) },
      include: { generations: { select: { platform: true } } },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign was not found.');
    }

    const platforms = dto.platforms?.length
      ? dto.platforms
      : Array.from(new Set(campaign.generations.map((generation) => generation.platform)));

    const result = await this.generateForArticle({
      organizationId,
      articleId: campaign.articleId,
      platforms: platforms.length ? platforms : DEFAULT_PLATFORMS,
      prompt: dto.prompt,
      promptVersion: 'ai-pipeline-v1',
      campaignId,
      reason: dto.reason ?? 'AI pipeline regeneration',
    });

    return result;
  }

  async updateDraftStatus(user: AuthenticatedUser, id: string, dto: UpdateDraftStatusDto) {
    this.assertCanGenerate(user);
    const organizationId = await this.requireOrganizationId(user.id);
    const draft = await this.prisma.socialDraft.findFirst({
      where: { id, article: this.articleScope(organizationId) },
    });

    if (!draft) {
      throw new NotFoundException('Draft was not found.');
    }

    return this.prisma.socialDraft.update({
      where: { id },
      data: {
        status: dto.status,
        approvedAt: dto.status === SocialDraftStatus.APPROVED ? new Date() : draft.approvedAt,
      },
    });
  }

  private async generateForArticle(input: {
    organizationId: string;
    articleId: string;
    platforms: SocialPlatform[];
    prompt?: string;
    promptVersion: string;
    campaignId?: string;
    reason: string;
  }) {
    const article = await this.prisma.wordPressArticle.findFirst({
      where: { id: input.articleId, ...this.articleScope(input.organizationId) },
    });

    if (!article) {
      throw new NotFoundException('Source article was not found.');
    }

    const repurposeJob = await this.prisma.contentRepurposeJob.create({
      data: {
        articleId: article.id,
        status: 'PROCESSING',
        platforms: input.platforms,
        prompt: input.prompt,
      },
    });

    try {
      const generatedDrafts = await this.generator.generate(article, input.platforms, repurposeJob.id);
      await this.prisma.socialDraft.createMany({ data: generatedDrafts });
      const drafts = await this.prisma.socialDraft.findMany({
        where: { repurposeJobId: repurposeJob.id },
        orderBy: { createdAt: 'asc' },
      });
      const campaign = await this.createOrAppendCampaign({
        articleId: article.id,
        campaignId: input.campaignId,
        repurposeJobId: repurposeJob.id,
        prompt: input.prompt,
        promptVersion: input.promptVersion,
        reason: input.reason,
        drafts,
      });

      await this.prisma.contentRepurposeJob.update({
        where: { id: repurposeJob.id },
        data: { status: 'COMPLETED' },
      });
      await this.prisma.wordPressArticle.update({
        where: { id: article.id },
        data: { repurposedAt: new Date() },
      });

      return { repurposeJob, drafts, campaign };
    } catch (error) {
      await this.prisma.contentRepurposeJob.update({
        where: { id: repurposeJob.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'AI generation failed.',
        },
      });
      throw error;
    }
  }

  private async createOrAppendCampaign(input: {
    articleId: string;
    campaignId?: string;
    repurposeJobId: string;
    prompt?: string;
    promptVersion: string;
    reason: string;
    drafts: {
      id: string;
      platform: SocialPlatform;
      title: string;
      body: string;
      hashtags: string[];
      mediaUrl: string | null;
    }[];
  }) {
    const aiModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const version = await this.nextCampaignVersion(input.articleId);

    return this.prisma.$transaction(async (tx) => {
      const campaign = input.campaignId
        ? await tx.wordPressCampaign.update({
            where: { id: input.campaignId },
            data: {
              status: WordPressCampaignStatus.DRAFT,
              promptVersion: input.promptVersion,
              aiModel,
              archivedAt: null,
            },
          })
        : await tx.wordPressCampaign.create({
            data: {
              articleId: input.articleId,
              name: `AI Campaign - ${input.drafts[0]?.title ?? 'WordPress Article'}`,
              status: WordPressCampaignStatus.DRAFT,
              promptVersion: input.promptVersion,
              aiModel,
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
          prompt: input.prompt,
          promptVersion: input.promptVersion,
          aiModel,
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
        })),
      });

      await tx.wordPressRegenerationHistory.create({
        data: {
          campaignId: campaign.id,
          articleId: input.articleId,
          version,
          prompt: input.prompt,
          promptVersion: input.promptVersion,
          aiModel,
          reason: input.reason,
          snapshot: input.drafts.map((draft) => ({
            platform: draft.platform,
            title: draft.title,
            caption: draft.body,
            hashtags: draft.hashtags,
            imageUrl: draft.mediaUrl,
          })),
        },
      });

      return tx.wordPressCampaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: {
          generations: { orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }] },
          publishingHistory: { orderBy: { createdAt: 'desc' } },
          regenerationHistory: { orderBy: [{ version: 'desc' }, { generatedAt: 'desc' }] },
        },
      });
    });
  }

  private async nextCampaignVersion(articleId: string) {
    const latest = await this.prisma.wordPressRegenerationHistory.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  private assertCanGenerate(user: AuthenticatedUser) {
    if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CONTENT_WRITER', 'PUBLISHER'].includes(user.role)) {
      throw new ForbiddenException('You do not have permission to run the AI pipeline.');
    }
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

  private articleScope(organizationId: string): Prisma.WordPressArticleWhereInput {
    return { connection: { organizationId } };
  }
}

function titleCasePlatform(platform: SocialPlatform): string {
  return platform
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
