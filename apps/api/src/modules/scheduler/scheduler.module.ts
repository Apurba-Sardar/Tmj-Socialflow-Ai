import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SchedulerController } from './scheduler.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [SchedulerController],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SchedulerModule {}
