import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SocialContentGeneratorService } from '../wordpress/application/social-content-generator.service.js';
import { AiPipelineController } from './ai-pipeline.controller.js';
import { AiPipelineService } from './ai-pipeline.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AiPipelineController],
  providers: [AiPipelineService, SocialContentGeneratorService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AiPipelineModule {}
