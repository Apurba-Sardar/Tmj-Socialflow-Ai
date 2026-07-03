import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CampaignsModule {}
