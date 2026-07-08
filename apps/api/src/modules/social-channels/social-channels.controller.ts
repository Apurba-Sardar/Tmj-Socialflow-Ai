import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import type { Response } from 'express';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { CreateSocialChannelDto, OAuthCallbackDto, PublishToChannelDto, UpdateSocialChannelDto } from './social-channels.dto.js';
import { SocialChannelsService } from './social-channels.service.js';

@Controller('social-channels')
export class SocialChannelsController {
  constructor(private readonly socialChannelsService: SocialChannelsService) {}

  @Get('supported')
  @UseGuards(JwtAuthGuard)
  supported() {
    return this.socialChannelsService.supported();
  }

  @Get('oauth/:platform/start')
  @UseGuards(JwtAuthGuard)
  oauthStart(@Param('platform') platform: SocialPlatform, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.oauthStart(platform, user);
  }

  @Get('oauth/:platform/callback')
  async oauthCallbackFromRedirect(
    @Param('platform') platform: SocialPlatform,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

    try {
      await this.socialChannelsService.oauthCallback(platform, { code, state });
      response.redirect(`${baseUrl}/admin/channels?connected=${encodeURIComponent(platform)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth connection failed.';
      response.redirect(`${baseUrl}/admin/channels?channel_error=${encodeURIComponent(message)}`);
    }
  }

  @Post('oauth/:platform/callback')
  oauthCallback(@Param('platform') platform: SocialPlatform, @Body() dto: OAuthCallbackDto) {
    return this.socialChannelsService.oauthCallback(platform, dto);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.summary(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.list(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSocialChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateSocialChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.update(id, dto, user);
  }

  @Post(':id/health-check')
  @UseGuards(JwtAuthGuard)
  healthCheck(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.healthCheck(id, user);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  publish(@Param('id') id: string, @Body() dto: PublishToChannelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.publish(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.socialChannelsService.remove(id, user);
  }
}
