import { Injectable } from '@nestjs/common';
import {
  PublishJobStatus,
  QueueJobStatus,
  SocialDraftStatus,
  SocialPlatform,
  WordPressCampaignStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const today = dayRange(new Date());

    const [
      todayScheduledDrafts,
      todayScheduledPublishJobs,
      publishedDrafts,
      publishedPublishJobs,
      failedPublishJobs,
      pendingDrafts,
      pendingPublishJobs,
      campaignBacklog,
      queueJobs,
      recentAudits,
      notifications,
      platformRows,
      wordpressConnections,
      wordpressRequestLogs,
      topAnalytics,
      upcomingDrafts,
      upcomingPublishJobs,
    ] = await Promise.all([
      this.prisma.socialDraft.count({
        where: {
          scheduledFor: { gte: today.start, lt: today.end },
          status: { in: [SocialDraftStatus.SCHEDULED, SocialDraftStatus.APPROVED] },
        },
      }),
      this.prisma.publishJob.count({
        where: {
          scheduledFor: { gte: today.start, lt: today.end },
          status: { in: [PublishJobStatus.SCHEDULED, PublishJobStatus.APPROVED] },
        },
      }),
      this.prisma.socialDraft.count({ where: { status: SocialDraftStatus.PUBLISHED } }),
      this.prisma.publishJob.count({ where: { status: PublishJobStatus.PUBLISHED } }),
      this.prisma.publishJob.count({ where: { status: PublishJobStatus.FAILED } }),
      this.prisma.socialDraft.count({ where: { status: SocialDraftStatus.DRAFT } }),
      this.prisma.publishJob.count({ where: { status: PublishJobStatus.PENDING_APPROVAL } }),
      this.prisma.wordPressCampaign.count({ where: { status: WordPressCampaignStatus.DRAFT } }),
      this.prisma.queueJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.notification.findMany({
        where: { readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.socialDraft.groupBy({
        by: ['platform', 'status'],
        _count: { _all: true },
      }),
      this.prisma.wordPressConnection.findMany({
        select: {
          id: true,
          siteUrl: true,
          isActive: true,
          lastConnectedAt: true,
          _count: { select: { articles: true, syncRuns: true } },
        },
        orderBy: { lastConnectedAt: 'desc' },
      }),
      this.prisma.wordPressRequestLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.analyticsMetric.findMany({
        orderBy: { value: 'desc' },
        take: 10,
      }),
      this.prisma.socialDraft.findMany({
        where: { scheduledFor: { gte: today.start } },
        orderBy: { scheduledFor: 'asc' },
        take: 10,
        include: {
          article: {
            select: { title: true, url: true },
          },
        },
      }),
      this.prisma.publishJob.findMany({
        where: { scheduledFor: { gte: today.start } },
        orderBy: { scheduledFor: 'asc' },
        take: 10,
      }),
    ]);

    const queued = queueCount(queueJobs, QueueJobStatus.WAITING);
    const processing = queueCount(queueJobs, QueueJobStatus.ACTIVE);
    const failedQueued = queueCount(queueJobs, QueueJobStatus.FAILED);
    const pending = pendingDrafts + pendingPublishJobs + campaignBacklog;
    const published = publishedDrafts + publishedPublishJobs;
    const failed = failedPublishJobs + failedQueued;

    return {
      metrics: [
        {
          label: 'Today\'s Posts',
          value: todayScheduledDrafts + todayScheduledPublishJobs,
          detail: 'Scheduled from PostgreSQL',
          tone: 'blue',
        },
        {
          label: 'Pending',
          value: pending,
          detail: 'Drafts, approvals, and campaigns',
          tone: pending ? 'amber' : 'green',
        },
        {
          label: 'Published',
          value: published,
          detail: 'Published jobs and drafts',
          tone: 'green',
        },
        {
          label: 'Failed',
          value: failed,
          detail: failed ? 'Needs review' : 'No failed jobs',
          tone: failed ? 'rose' : 'green',
        },
      ],
      queue: [
        { label: 'Queued', value: queued, detail: 'Waiting queue jobs', tone: 'bg-blue-500' },
        { label: 'Processing', value: processing, detail: 'Active queue jobs', tone: 'bg-violet-500' },
        { label: 'Needs approval', value: pendingPublishJobs + pendingDrafts, detail: 'Database approvals', tone: 'bg-amber-400' },
        { label: 'Failed', value: failedQueued, detail: 'Failed queue jobs', tone: 'bg-rose-500' },
      ],
      schedule: [
        ...upcomingDrafts.map((draft) => ({
          id: draft.id,
          time: draft.scheduledFor?.toISOString() ?? draft.createdAt.toISOString(),
          platform: platformLabel(draft.platform),
          title: draft.title,
          state: draft.status,
        })),
        ...upcomingPublishJobs.map((job) => ({
          id: job.id,
          time: job.scheduledFor?.toISOString() ?? job.createdAt.toISOString(),
          platform: platformLabel(job.platform),
          title: job.title,
          state: job.status,
        })),
      ].sort((a, b) => a.time.localeCompare(b.time)),
      approvals: [],
      activity: recentAudits.map((item) => ({
        id: item.id,
        title: item.action,
        detail: item.result,
        time: item.createdAt,
        tone: item.result === 'SUCCESS' ? 'success' : 'warning',
      })),
      notifications: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
      })),
      platformKpis: this.platformKpis(platformRows),
      platformHealth: wordpressConnections.map((connection) => {
        const latestError = wordpressRequestLogs.find((log) => !log.success);
        return {
          id: connection.id,
          platform: connection.siteUrl,
          posts: connection._count.articles,
          health: connection.isActive && !latestError ? 100 : 0,
          status: connection.isActive ? 'ACTIVE' : 'INACTIVE',
          lastConnectedAt: connection.lastConnectedAt,
        };
      }),
      topPosts: topAnalytics.map((metric) => ({
        id: metric.id,
        title: metric.entityId ?? metric.entityType,
        platform: metric.platform ? platformLabel(metric.platform) : 'All platforms',
        metric: metric.metric,
        value: metric.value,
        capturedAt: metric.capturedAt,
      })),
    };
  }

  private platformKpis(
    rows: { platform: SocialPlatform; status: SocialDraftStatus; _count: { _all: number } }[],
  ) {
    return Object.values(SocialPlatform).map((platform) => {
      const platformRows = rows.filter((row) => row.platform === platform);
      const posts = platformRows.reduce((sum, row) => sum + row._count._all, 0);
      const published = platformRows
        .filter((row) => row.status === SocialDraftStatus.PUBLISHED)
        .reduce((sum, row) => sum + row._count._all, 0);

      return {
        platform: platformLabel(platform),
        posts,
        published,
        health: posts ? Math.round((published / posts) * 100) : 100,
      };
    });
  }
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function queueCount(rows: { status: QueueJobStatus; _count: { _all: number } }[], status: QueueJobStatus) {
  return rows.find((row) => row.status === status)?._count._all ?? 0;
}

function platformLabel(platform: SocialPlatform): string {
  return platform
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
