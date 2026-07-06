import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { PromptTemplatesController } from './prompt-templates.controller.js';
import { PromptTemplatesService } from './prompt-templates.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PromptTemplatesController],
  providers: [PromptTemplatesService],
  exports: [PromptTemplatesService],
})
// NestJS module classes are declarative containers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PromptTemplatesModule {}
