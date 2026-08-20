import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class UpdateWordPressAutomationDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  connectionId!: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsArray()
  @IsEnum(SocialPlatform, { each: true })
  platforms!: SocialPlatform[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  dailyLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  publishHour?: number;

  @IsOptional()
  @IsString()
  timezone?: string;
}
