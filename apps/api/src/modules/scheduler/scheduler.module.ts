import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { WordPressModule } from '../wordpress/wordpress.module.js';
import { SchedulerController } from './scheduler.controller.js';
import { SchedulerService } from './scheduler.service.js';

@Module({
  imports: [PrismaModule, WordPressModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SchedulerModule {}
