import { SocialChannelAuthType, SocialChannelStatus, SocialPlatform } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSocialChannelDto {
  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  handle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountType?: string;

  @IsOptional()
  @IsEnum(SocialChannelAuthType)
  authType?: SocialChannelAuthType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;
}

export class UpdateSocialChannelDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  handle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  externalAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  accountType?: string;

  @IsOptional()
  @IsEnum(SocialChannelStatus)
  status?: SocialChannelStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;
}

export class OAuthCallbackDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  state!: string;
}

export class PublishToChannelDto {
  @IsOptional()
  @IsString()
  draftId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  caption!: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];
}
