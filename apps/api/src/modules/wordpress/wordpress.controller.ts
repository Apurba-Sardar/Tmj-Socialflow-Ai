import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

import {
  BulkRepurposeDto,
  ConnectWordPressDto,
  DraftsQueryDto,
  RepurposeArticleDto,
  ScheduleDraftDto,
  SyncWordPressDto,
  WordPressLibraryQueryDto,
  WordPressPostsQueryDto,
} from './application/wordpress.dto.js';
import { WordPressService } from './application/wordpress.service.js';

@Controller('wordpress')
export class WordPressController {
  constructor(private readonly wordpressService: WordPressService) {}

  @Post('connect')
  connect(@Body() dto: ConnectWordPressDto) {
    return this.wordpressService.connect(dto);
  }

  @Get('posts')
  getPosts(@Query() query: WordPressPostsQueryDto) {
    return this.wordpressService.getPosts({
      page: query.page ?? 1,
      perPage: query.perPage ?? 10,
    });
  }

  @Get('post/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.wordpressService.getPost(id);
  }

  @Post('sync')
  sync(@Body() dto: SyncWordPressDto) {
    return this.wordpressService.sync(dto);
  }

  @Get('library')
  library(@Query() query: WordPressLibraryQueryDto) {
    return this.wordpressService.listLibrary(query);
  }

  @Get('library/:id')
  libraryArticle(@Param('id') id: string) {
    return this.wordpressService.getLibraryArticle(id);
  }

  @Post('library/:id/repurpose')
  repurposeArticle(@Param('id') id: string, @Body() dto: RepurposeArticleDto) {
    return this.wordpressService.repurposeArticle(id, dto);
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
}
