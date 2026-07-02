CREATE TYPE "WordPressSyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "SocialPlatform" AS ENUM ('PINTEREST', 'INSTAGRAM', 'LINKEDIN', 'X', 'FACEBOOK');
CREATE TYPE "SocialDraftStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'REJECTED');

CREATE TABLE "WordPressArticle" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wordpressId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "contentHtml" TEXT,
    "contentText" TEXT,
    "url" TEXT NOT NULL,
    "authorId" INTEGER,
    "authorName" TEXT,
    "authorSlug" TEXT,
    "featuredImageId" INTEGER,
    "featuredImageUrl" TEXT,
    "featuredImageAlt" TEXT,
    "categoryNames" TEXT[],
    "categorySlugs" TEXT[],
    "publishedAt" TIMESTAMP(3),
    "modifiedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repurposedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordPressArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordPressSyncRun" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "WordPressSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "scannedPosts" INTEGER NOT NULL DEFAULT 0,
    "upsertedPosts" INTEGER NOT NULL DEFAULT 0,
    "failedPosts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "WordPressSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentRepurposeJob" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "platforms" "SocialPlatform"[],
    "prompt" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRepurposeJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialDraft" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "repurposeJobId" TEXT,
    "platform" "SocialPlatform" NOT NULL,
    "status" "SocialDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "callToAction" TEXT,
    "mediaUrl" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WordPressArticle_connectionId_wordpressId_key" ON "WordPressArticle"("connectionId", "wordpressId");
CREATE INDEX "WordPressArticle_modifiedAt_idx" ON "WordPressArticle"("modifiedAt");
CREATE INDEX "WordPressArticle_repurposedAt_idx" ON "WordPressArticle"("repurposedAt");
CREATE INDEX "WordPressArticle_categorySlugs_idx" ON "WordPressArticle" USING GIN ("categorySlugs");
CREATE INDEX "WordPressSyncRun_connectionId_startedAt_idx" ON "WordPressSyncRun"("connectionId", "startedAt");
CREATE INDEX "WordPressSyncRun_status_idx" ON "WordPressSyncRun"("status");
CREATE INDEX "ContentRepurposeJob_articleId_idx" ON "ContentRepurposeJob"("articleId");
CREATE INDEX "ContentRepurposeJob_createdAt_idx" ON "ContentRepurposeJob"("createdAt");
CREATE INDEX "SocialDraft_platform_status_idx" ON "SocialDraft"("platform", "status");
CREATE INDEX "SocialDraft_scheduledFor_idx" ON "SocialDraft"("scheduledFor");
CREATE INDEX "SocialDraft_articleId_idx" ON "SocialDraft"("articleId");

ALTER TABLE "WordPressArticle" ADD CONSTRAINT "WordPressArticle_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressSyncRun" ADD CONSTRAINT "WordPressSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentRepurposeJob" ADD CONSTRAINT "ContentRepurposeJob_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "WordPressArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_repurposeJobId_fkey" FOREIGN KEY ("repurposeJobId") REFERENCES "ContentRepurposeJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
