import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types.js';
import {
  BulkRepurposeDto,
  BulkWordPressActionDto,
  ConnectWordPressDto,
  DraftsQueryDto,
  GenerateCampaignDto,
  RepurposeArticleDto,
  ScheduleDraftDto,
  SyncWordPressDto,
  WordPressHubPostsQueryDto,
  WordPressLibraryQueryDto,
  WordPressPostsQueryDto,
} from './application/wordpress.dto.js';
import { WordPressService } from './application/wordpress.service.js';

@Controller('wordpress')
@UseGuards(JwtAuthGuard)
export class WordPressController {
  constructor(private readonly wordpressService: WordPressService) {}

  @Post('connect')
  connect(@Body() dto: ConnectWordPressDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.connect(dto, user);
  }

  @Get('connections')
  connections(@CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.listConnections(user);
  }

  @Get('posts')
  getPosts(@Query() query: WordPressPostsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.getPosts({
      page: query.page ?? 1,
      perPage: query.perPage ?? 10,
      connectionId: query.connectionId,
      status: query.status,
      user,
    });
  }

  @Get('post/:id')
  getPost(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: WordPressPostsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wordpressService.getPost(id, { connectionId: query.connectionId, user });
  }

  @Get('categories')
  categories(@CurrentUser() user: AuthenticatedUser, @Query('connectionId') connectionId?: string) {
    return this.wordpressService.listCategories(user, connectionId);
  }

  @Get('tags')
  tags(@CurrentUser() user: AuthenticatedUser, @Query('connectionId') connectionId?: string) {
    return this.wordpressService.listTags(user, connectionId);
  }

  @Get('authors')
  authors(@CurrentUser() user: AuthenticatedUser, @Query('connectionId') connectionId?: string) {
    return this.wordpressService.listAuthors(user, connectionId);
  }

  @Get('media')
  media(@CurrentUser() user: AuthenticatedUser, @Query('connectionId') connectionId?: string) {
    return this.wordpressService.listMedia(user, connectionId);
  }

  @Post('sync')
  sync(@Body() dto: SyncWordPressDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.sync(dto, user);
  }

  @Get('library')
  library(@Query() query: WordPressLibraryQueryDto) {
    return this.wordpressService.listLibrary(query);
  }

  @Get('library/:id')
  libraryArticle(@Param('id') id: string) {
    return this.wordpressService.getLibraryArticle(id);
  }

  @Get('hub/posts')
  hubPosts(@Query() query: WordPressHubPostsQueryDto) {
    return this.wordpressService.listHubPosts(query);
  }

  @Get('hub/posts/:id')
  hubPost(@Param('id') id: string) {
    return this.wordpressService.getHubPost(id);
  }

  @Post('hub/posts/:id/generate-campaign')
  generateCampaign(@Param('id') id: string, @Body() dto: GenerateCampaignDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.generateCampaign(id, dto, user);
  }

  @Post('hub/bulk')
  bulkHubAction(@Body() dto: BulkWordPressActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.bulkHubAction(dto, user);
  }

  @Post('library/:id/repurpose')
  repurposeArticle(@Param('id') id: string, @Body() dto: RepurposeArticleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wordpressService.repurposeArticle(id, dto, user);
  }

  @Post('repurpose/bulk')
  bulkRepurpose(@Body() dto: BulkRepurposeDto) {
    return this.wordpressService.bulkRepurpose(dto);
  }

  @Get('drafts')
  drafts(@Query() query: DraftsQueryDto) {
    return this.wordpressService.listDrafts(query);
  }

  @Patch('drafts/:id/approve')
  approveDraft(@Param('id') id: string) {
    return this.wordpressService.approveDraft(id);
  }

  @Patch('drafts/:id/schedule')
  scheduleDraft(@Param('id') id: string, @Body() dto: ScheduleDraftDto) {
    return this.wordpressService.scheduleDraft(id, dto);
  }

  @Delete('drafts/:id')
  deleteDraft(@Param('id') id: string) {
    return this.wordpressService.deleteDraft(id);
  }
}
