import { createSign } from 'node:crypto';

import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

interface GoogleAnalyticsRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

interface GoogleAnalyticsRunReportResponse {
  rows?: GoogleAnalyticsRow[];
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleAnalyticsPostMetric {
  articleId: string;
  wordpressId: number;
  title: string;
  url: string;
  path: string;
  pageViews: number;
  activeUsers: number;
  sessions: number;
  eventCount: number;
  averageSessionDuration: number;
}

@Injectable()
export class GoogleAnalyticsService {
  private accessToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  status() {
    const missing = this.missingConfig();

    return {
      connected: missing.length === 0,
      propertyId: this.propertyId() ? maskPropertyId(this.propertyId()) : null,
      missing,
    };
  }

  async wordpressPostMetrics(articleIds: string[], days = 30): Promise<GoogleAnalyticsPostMetric[]> {
    const articles = await this.prisma.wordPressArticle.findMany({
      where: articleIds.length ? { id: { in: articleIds } } : {},
      select: {
        id: true,
        wordpressId: true,
        title: true,
        url: true,
        slug: true,
      },
      take: articleIds.length ? undefined : 100,
    });

    if (!articles.length) {
      return [];
    }

    const missingConfig = this.missingConfig();

    if (missingConfig.length) {
      throw new InternalServerErrorException(`Google Analytics is not configured. Missing: ${missingConfig.join(', ')}`);
    }

    const rows = await this.runPageReport(days);
    const rowMetrics = rows.map((row) => {
      const path = normalizePath(row.dimensionValues?.[0]?.value ?? '');
      const metrics = row.metricValues ?? [];

      return {
        path,
        pageViews: toNumber(metrics[0]?.value),
        activeUsers: toNumber(metrics[1]?.value),
        sessions: toNumber(metrics[2]?.value),
        eventCount: toNumber(metrics[3]?.value),
        averageSessionDuration: toNumber(metrics[4]?.value),
      };
    });

    return articles.map((article) => {
      const articlePath = normalizePath(article.url);
      const articleSlug = normalizePath(article.slug);
      const matches = rowMetrics.filter((row) => {
        if (!row.path) {
          return false;
        }

        return row.path === articlePath || row.path === `/${articleSlug}` || row.path.endsWith(`/${articleSlug}`);
      });

      return matches.reduce<GoogleAnalyticsPostMetric>(
        (sum, row) => ({
          ...sum,
          pageViews: sum.pageViews + row.pageViews,
          activeUsers: sum.activeUsers + row.activeUsers,
          sessions: sum.sessions + row.sessions,
          eventCount: sum.eventCount + row.eventCount,
          averageSessionDuration: Math.max(sum.averageSessionDuration, row.averageSessionDuration),
        }),
        emptyMetric(article),
      );
    });
  }

  private async runPageReport(days: number): Promise<GoogleAnalyticsRow[]> {
    const propertyId = this.propertyId();

    if (!propertyId) {
      return [];
    }

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${String(clampDays(days))}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'eventCount' },
          { name: 'averageSessionDuration' },
        ],
        limit: 10000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new InternalServerErrorException(`Google Analytics report failed: ${detail}`);
    }

    const payload = (await response.json()) as GoogleAnalyticsRunReportResponse;
    return payload.rows ?? [];
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.token;
    }

    const serviceAccountEmail = process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
      throw new InternalServerErrorException('Google Analytics service account credentials are not configured.');
    }

    const now = Math.floor(Date.now() / 1000);
    const assertion = [
      base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
      base64Url(
        JSON.stringify({
          iss: serviceAccountEmail,
          scope: 'https://www.googleapis.com/auth/analytics.readonly',
          aud: 'https://oauth2.googleapis.com/token',
          iat: now,
          exp: now + 3600,
        }),
      ),
    ].join('.');
    const signature = createSign('RSA-SHA256').update(assertion).sign(privateKey);
    const jwt = `${assertion}.${base64Url(signature)}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const payload = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !payload.access_token) {
      throw new InternalServerErrorException(
        `Google Analytics authentication failed: ${payload.error_description ?? payload.error ?? 'unknown error'}`,
      );
    }

    this.accessToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };

    return payload.access_token;
  }

  private missingConfig(): string[] {
    const config: [string, string | undefined][] = [
      ['GOOGLE_ANALYTICS_PROPERTY_ID', process.env.GOOGLE_ANALYTICS_PROPERTY_ID],
      ['GOOGLE_ANALYTICS_CLIENT_EMAIL', process.env.GOOGLE_ANALYTICS_CLIENT_EMAIL],
      ['GOOGLE_ANALYTICS_PRIVATE_KEY', process.env.GOOGLE_ANALYTICS_PRIVATE_KEY],
    ];

    return config
      .filter(([, value]) => !value)
      .map(([name]) => name);
  }

  private propertyId() {
    return process.env.GOOGLE_ANALYTICS_PROPERTY_ID?.replace(/^properties\//, '').trim();
  }
}

function emptyMetric(article: { id: string; wordpressId: number; title: string; url: string }): GoogleAnalyticsPostMetric {
  return {
    articleId: article.id,
    wordpressId: article.wordpressId,
    title: article.title,
    url: article.url,
    path: normalizePath(article.url),
    pageViews: 0,
    activeUsers: 0,
    sessions: 0,
    eventCount: 0,
    averageSessionDuration: 0,
  };
}

function normalizePath(value: string): string {
  let path = value;

  try {
    path = new URL(value).pathname;
  } catch {
    path = value.startsWith('/') ? value : `/${value}`;
  }

  const normalized = path.split(/[?#]/)[0]?.replace(/\/+$/g, '').toLowerCase() ?? '/';
  return normalized.length ? normalized : '/';
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 365);
}

function toNumber(value?: string): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function maskPropertyId(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.length <= 4 ? value : `${'*'.repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
}
