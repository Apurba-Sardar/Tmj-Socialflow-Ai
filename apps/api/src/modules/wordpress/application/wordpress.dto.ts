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
import { SocialPlatform } from '@prisma/client';

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

export class SyncWordPressDto {
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
  category?: string;

  @IsOptional()
  @IsString()
  status?: string;

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

  @IsOptional()
  @IsString()
  status?: string;
}

export class ScheduleDraftDto {
  @IsDateString()
  scheduledFor!: string;
}
