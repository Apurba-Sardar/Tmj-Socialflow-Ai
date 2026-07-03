-- CreateEnum
CREATE TYPE "WordPressCampaignStatus" AS ENUM ('NOT_GENERATED', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WordPressPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "WordPressArticle"
  ADD COLUMN "tagNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tagSlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "WordPressCampaign" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "WordPressCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "promptVersion" TEXT NOT NULL,
  "aiModel" TEXT NOT NULL,
  "createdByRole" "Role" NOT NULL DEFAULT 'ADMIN',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WordPressCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPressCampaignGeneration" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "repurposeJobId" TEXT,
  "socialDraftId" TEXT,
  "platform" "SocialPlatform" NOT NULL,
  "caption" TEXT NOT NULL,
  "hashtags" TEXT[],
  "imageUrl" TEXT,
  "prompt" TEXT,
  "promptVersion" TEXT NOT NULL,
  "aiModel" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordPressCampaignGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPressPublishingHistory" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "platformAccount" TEXT NOT NULL,
  "status" "WordPressPublishStatus" NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "postUrl" TEXT,
  "errorLog" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordPressPublishingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPressRegenerationHistory" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "prompt" TEXT,
  "promptVersion" TEXT NOT NULL,
  "aiModel" TEXT NOT NULL,
  "reason" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "WordPressRegenerationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordPressCampaignAnalytics" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "platform" "SocialPlatform",
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "saves" INTEGER NOT NULL DEFAULT 0,
  "comments" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordPressCampaignAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordPressArticle_tagSlugs_idx" ON "WordPressArticle"("tagSlugs");
CREATE INDEX "WordPressCampaign_articleId_status_idx" ON "WordPressCampaign"("articleId", "status");
CREATE INDEX "WordPressCampaign_createdAt_idx" ON "WordPressCampaign"("createdAt");
CREATE UNIQUE INDEX "WordPressCampaignGeneration_socialDraftId_key" ON "WordPressCampaignGeneration"("socialDraftId");
CREATE INDEX "WordPressCampaignGeneration_campaignId_platform_idx" ON "WordPressCampaignGeneration"("campaignId", "platform");
CREATE INDEX "WordPressCampaignGeneration_articleId_generatedAt_idx" ON "WordPressCampaignGeneration"("articleId", "generatedAt");
CREATE INDEX "WordPressPublishingHistory_campaignId_platform_idx" ON "WordPressPublishingHistory"("campaignId", "platform");
CREATE INDEX "WordPressPublishingHistory_articleId_createdAt_idx" ON "WordPressPublishingHistory"("articleId", "createdAt");
CREATE INDEX "WordPressPublishingHistory_status_idx" ON "WordPressPublishingHistory"("status");
CREATE INDEX "WordPressRegenerationHistory_campaignId_version_idx" ON "WordPressRegenerationHistory"("campaignId", "version");
CREATE INDEX "WordPressRegenerationHistory_articleId_generatedAt_idx" ON "WordPressRegenerationHistory"("articleId", "generatedAt");
CREATE INDEX "WordPressCampaignAnalytics_campaignId_capturedAt_idx" ON "WordPressCampaignAnalytics"("campaignId", "capturedAt");
CREATE INDEX "WordPressCampaignAnalytics_articleId_idx" ON "WordPressCampaignAnalytics"("articleId");

-- AddForeignKey
ALTER TABLE "WordPressCampaign" ADD CONSTRAINT "WordPressCampaign_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignGeneration" ADD CONSTRAINT "WordPressCampaignGeneration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WordPressCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignGeneration" ADD CONSTRAINT "WordPressCampaignGeneration_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignGeneration" ADD CONSTRAINT "WordPressCampaignGeneration_repurposeJobId_fkey" FOREIGN KEY ("repurposeJobId") REFERENCES "ContentRepurposeJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignGeneration" ADD CONSTRAINT "WordPressCampaignGeneration_socialDraftId_fkey" FOREIGN KEY ("socialDraftId") REFERENCES "SocialDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WordPressPublishingHistory" ADD CONSTRAINT "WordPressPublishingHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WordPressCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressPublishingHistory" ADD CONSTRAINT "WordPressPublishingHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressRegenerationHistory" ADD CONSTRAINT "WordPressRegenerationHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WordPressCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressRegenerationHistory" ADD CONSTRAINT "WordPressRegenerationHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignAnalytics" ADD CONSTRAINT "WordPressCampaignAnalytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WordPressCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCampaignAnalytics" ADD CONSTRAINT "WordPressCampaignAnalytics_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
