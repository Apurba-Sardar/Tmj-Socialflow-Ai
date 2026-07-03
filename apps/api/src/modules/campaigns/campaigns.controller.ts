import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import {
  BulkCampaignActionDto,
  CampaignsQueryDto,
  ScheduleCampaignDto,
  UpdateCampaignGenerationDto,
  UpdateCampaignStatusDto,
} from './campaigns.dto.js';
import { CampaignsService } from './campaigns.service.js';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.summary(user);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CampaignsQueryDto) {
    return this.campaignsService.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaignsService.get(user, id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ) {
    return this.campaignsService.updateStatus(user, id, dto);
  }

  @Post(':id/schedule')
  schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ScheduleCampaignDto,
  ) {
    return this.campaignsService.schedule(user, id, dto);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaignsService.archive(user, id);
  }

  @Patch(':id/generations/:generationId')
  updateGeneration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('generationId') generationId: string,
    @Body() dto: UpdateCampaignGenerationDto,
  ) {
    return this.campaignsService.updateGeneration(user, id, generationId, dto);
  }

  @Post('bulk')
  bulk(@CurrentUser() user: AuthenticatedUser, @Body() dto: BulkCampaignActionDto) {
    return this.campaignsService.bulk(user, dto);
  }
}
