import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SocialPlatform, WordPressCampaignStatus } from '@prisma/client';

export class CampaignsQueryDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(WordPressCampaignStatus)
  status?: WordPressCampaignStatus;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @IsOptional()
  @IsString()
  sortBy?: 'updatedAt' | 'createdAt' | 'name' | 'status';

  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc';
}

export class UpdateCampaignStatusDto {
  @IsEnum(WordPressCampaignStatus)
  status!: WordPressCampaignStatus;
}

export class ScheduleCampaignDto {
  @IsDateString()
  scheduledFor!: string;

  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;
}

export class UpdateCampaignGenerationDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}

export class BulkCampaignActionDto {
  @IsArray()
  @IsString({ each: true })
  campaignIds!: string[];

  @IsString()
  action!: 'archive' | 'schedule' | 'mark-published';

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
