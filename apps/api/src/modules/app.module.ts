import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AiPipelineModule } from './ai-pipeline/ai-pipeline.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { GoogleAnalyticsModule } from './google-analytics/google-analytics.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PromptTemplatesModule } from './prompt-templates/prompt-templates.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { SocialChannelsModule } from './social-channels/social-channels.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { WordPressModule } from './wordpress/wordpress.module.js';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AuditModule,
    HealthModule,
    AuthModule,
    AiPipelineModule,
    CampaignsModule,
    DashboardModule,
    GoogleAnalyticsModule,
    MediaModule,
    PromptTemplatesModule,
    SchedulerModule,
    SocialChannelsModule,
    WordPressModule,
    SupabaseModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
