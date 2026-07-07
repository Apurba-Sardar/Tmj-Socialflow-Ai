import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { GoogleAnalyticsService } from './google-analytics.service.js';

@Controller('google-analytics')
@UseGuards(JwtAuthGuard)
export class GoogleAnalyticsController {
  constructor(private readonly googleAnalyticsService: GoogleAnalyticsService) {}

  @Get('status')
  status() {
    return this.googleAnalyticsService.status();
  }

  @Get('wordpress-posts')
  wordpressPosts(@Query('articleIds') articleIds?: string, @Query('days') days?: string) {
    return this.googleAnalyticsService.wordpressPostMetrics(parseIds(articleIds), Number(days ?? 30));
  }

  @Get('wordpress-posts/:id')
  wordpressPost(@Param('id') id: string, @Query('days') days?: string) {
    return this.googleAnalyticsService.wordpressPostMetrics([id], Number(days ?? 30));
  }
}

function parseIds(value?: string): string[] {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
