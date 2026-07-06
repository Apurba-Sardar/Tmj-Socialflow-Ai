import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreateSocialChannelDto, UpdateSocialChannelDto } from './social-channels.dto.js';
import { SocialChannelsService } from './social-channels.service.js';

@Controller('social-channels')
@UseGuards(JwtAuthGuard)
export class SocialChannelsController {
  constructor(private readonly socialChannelsService: SocialChannelsService) {}

  @Get('supported')
  supported() {
    return this.socialChannelsService.supported();
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.summary(user);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.list(user);
  }

  @Post()
  create(@Body() dto: CreateSocialChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSocialChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.update(id, dto, user);
  }

  @Post(':id/health-check')
  healthCheck(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.healthCheck(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.remove(id, user);
  }
}
