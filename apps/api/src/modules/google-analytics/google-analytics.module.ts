import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { GoogleAnalyticsController } from './google-analytics.controller.js';
import { GoogleAnalyticsService } from './google-analytics.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [GoogleAnalyticsController],
  providers: [GoogleAnalyticsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class GoogleAnalyticsModule {}
