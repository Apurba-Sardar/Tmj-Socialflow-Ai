import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
