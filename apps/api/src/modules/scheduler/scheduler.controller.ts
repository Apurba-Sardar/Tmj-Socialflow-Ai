import { Body, Controller, Get, Post, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { PublishJobStatus, SocialDraftStatus } from '@prisma/client';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePublishJobDto } from './scheduler.dto.js';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('posts')
  async posts(@CurrentUser() user: AuthenticatedUser) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        members: {
          some: { userId: user.id },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!organization) {
      throw new UnprocessableEntityException('User is not assigned to an organization.');
    }

    const [posts, drafts] = await Promise.all([
      this.prisma.publishJob.findMany({
        where: { organizationId: organization.id },
        orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      }),
      this.prisma.socialDraft.findMany({
        where: {
          article: {
            connection: {
              organizationId: organization.id,
            },
          },
          scheduledFor: { not: null },
          status: { in: [SocialDraftStatus.SCHEDULED, SocialDraftStatus.PUBLISHED] },
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
          status: draft.status === SocialDraftStatus.PUBLISHED ? PublishJobStatus.PUBLISHED : PublishJobStatus.SCHEDULED,
          tags: draft.hashtags.length ? draft.hashtags : draft.article.categoryNames,
          createdAt: draft.createdAt,
        })),
      ].sort((a, b) => new Date(a.scheduledFor ?? a.createdAt).getTime() - new Date(b.scheduledFor ?? b.createdAt).getTime()),
    };
  }

  @Post('posts')
  async createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePublishJobDto) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        members: {
          some: { userId: user.id },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!organization) {
      throw new UnprocessableEntityException('User is not assigned to an organization.');
    }

    const post = await this.prisma.publishJob.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        platform: dto.platform,
        title: dto.title,
        caption: dto.caption,
        scheduledFor: new Date(dto.scheduledFor),
        status: PublishJobStatus.SCHEDULED,
      },
    });

    return { post };
  }

  private platformLabel(platform: string): string {
    return platform
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }
}
