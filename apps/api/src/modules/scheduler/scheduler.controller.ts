import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { AutoScheduleDailyDto, CreatePublishJobDto } from './scheduler.dto.js';
import { SchedulerService } from './scheduler.service.js';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('posts')
  async posts(@CurrentUser() user: AuthenticatedUser) {
    return this.schedulerService.posts(user);
  }

  @Post('posts')
  async createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePublishJobDto) {
    return this.schedulerService.createPost(user, dto);
  }

  @Post('auto-plan')
  async autoPlan(@CurrentUser() user: AuthenticatedUser, @Body() dto: AutoScheduleDailyDto) {
    return this.schedulerService.autoPlanDaily(user, dto);
  }

  @Patch('posts/:id/approve')
  async approvePost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schedulerService.approvePost(user, id);
  }

  @Patch('posts/approve')
  async approvePosts(@CurrentUser() user: AuthenticatedUser, @Body() dto: { ids?: string[] }) {
    return this.schedulerService.approvePosts(user, dto.ids ?? []);
  }
}
