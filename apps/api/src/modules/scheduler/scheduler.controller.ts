import { Body, Controller, Get, Post, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { PublishJobStatus } from '@prisma/client';

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
  async posts() {
    const posts = await this.prisma.publishJob.findMany({
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return {
      data: posts.map((post) => ({
        id: post.id,
        title: post.title,
        channel: this.platformLabel(post.platform),
        scheduledFor: post.scheduledFor,
        status: post.status,
        tags: post.hashtags,
      })),
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
