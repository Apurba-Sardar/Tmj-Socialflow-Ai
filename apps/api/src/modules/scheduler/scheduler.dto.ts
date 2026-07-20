import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class CreatePublishJobDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsDateString()
  scheduledFor!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class AutoScheduleDailyDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  count?: number;
}
