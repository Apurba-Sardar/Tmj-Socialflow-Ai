import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SocialDraftStatus } from '@prisma/client';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import {
  AiPipelineQueryDto,
  GenerateAiContentDto,
  RegenerateCampaignDto,
  UpdateDraftStatusDto,
} from './ai-pipeline.dto.js';
import { AiPipelineService } from './ai-pipeline.service.js';

@Controller('ai-pipeline')
@UseGuards(JwtAuthGuard)
export class AiPipelineController {
  constructor(private readonly aiPipelineService: AiPipelineService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.aiPipelineService.overview(user);
  }

  @Get('sources')
  sources(@CurrentUser() user: AuthenticatedUser, @Query() query: AiPipelineQueryDto) {
    return this.aiPipelineService.sources(user, query);
  }

  @Get('jobs')
  jobs(@CurrentUser() user: AuthenticatedUser) {
    return this.aiPipelineService.jobs(user);
  }

  @Get('drafts')
  drafts(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: SocialDraftStatus) {
    return this.aiPipelineService.drafts(user, status);
  }

  @Post('generate')
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateAiContentDto) {
    return this.aiPipelineService.generate(user, dto);
  }

  @Post('campaigns/:id/regenerate')
  regenerateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RegenerateCampaignDto,
  ) {
    return this.aiPipelineService.regenerateCampaign(user, id, dto);
  }

  @Patch('drafts/:id/status')
  updateDraftStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftStatusDto,
  ) {
    return this.aiPipelineService.updateDraftStatus(user, id, dto);
  }
}
