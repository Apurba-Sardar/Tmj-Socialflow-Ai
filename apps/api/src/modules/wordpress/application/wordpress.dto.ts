import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform, WordPressCampaignStatus } from '@prisma/client';

export class ConnectWordPressDto {
  @IsUrl({ require_tld: false })
  siteUrl!: string;

  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(8)
  applicationPassword!: string;
}

export class WordPressPostsQueryDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  perPage?: number;
}

export class SyncWordPressDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postTypes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxPages?: number;
}

export class WordPressLibraryQueryDto extends WordPressPostsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  repurposed?: 'true' | 'false';
}

export class RepurposeArticleDto {
  @IsOptional()
  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms?: SocialPlatform[];

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class BulkRepurposeDto extends RepurposeArticleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class DraftsQueryDto extends WordPressPostsQueryDto {
  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;
}

export class ScheduleDraftDto {
  @IsDateString()
  scheduledFor!: string;
}

export class WordPressHubPostsQueryDto extends WordPressLibraryQueryDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsEnum(WordPressCampaignStatus)
  campaignStatus?: WordPressCampaignStatus;

  @IsOptional()
  @IsString()
  sortBy?: 'title' | 'modifiedAt' | 'publishedAt' | 'campaignStatus';

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';
}

export class GenerateCampaignDto extends RepurposeArticleDto {
  @IsOptional()
  @IsString()
  campaignName?: string;

  @IsOptional()
  @IsString()
  promptVersion?: string;
}

export class BulkWordPressActionDto {
  @IsArray()
  @IsString({ each: true })
  articleIds!: string[];

  @IsString()
  action!: 'archive' | 'generate' | 'remove';
}
