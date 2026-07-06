import { SocialPlatform } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertPromptTemplateDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  purpose?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsString()
  @MinLength(80)
  @MaxLength(8000)
  template!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  negativePrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  styleNotes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class PreviewPromptTemplateDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  categories?: string;
}
