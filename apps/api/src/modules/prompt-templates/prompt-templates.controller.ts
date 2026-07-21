import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PreviewPromptTemplateDto, UpsertPromptTemplateDto } from './prompt-templates.dto.js';
import { PromptTemplatesService } from './prompt-templates.service.js';

@Controller('prompt-templates')
@UseGuards(JwtAuthGuard)
export class PromptTemplatesController {
  constructor(private readonly promptTemplatesService: PromptTemplatesService) {}

  @Get('defaults')
  defaults() {
    return this.promptTemplatesService.defaults();
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.promptTemplatesService.list(user);
  }

  @Put()
  upsert(@Body() dto: UpsertPromptTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.promptTemplatesService.upsert(dto, user);
  }

  @Post('preview')
  preview(@Body() dto: PreviewPromptTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.promptTemplatesService.preview(dto, user);
  }

  @Post(':platform/reset')
  reset(
    @Param('platform') platform: string,
    @Query('contentCategory') contentCategory: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promptTemplatesService.reset(platform, user, contentCategory);
  }
}
