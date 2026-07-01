CREATE TYPE "PinterestPublishStatus" AS ENUM ('QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TYPE "PinterestLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "PinterestAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinterestUserId" TEXT NOT NULL,
    "username" TEXT,
    "accessTokenCiphertext" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinterestAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PinterestOAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinterestOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PinterestPublishJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "boardName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT NOT NULL,
    "link" TEXT,
    "altText" TEXT,
    "status" "PinterestPublishStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "pinterestPinId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PinterestPublishJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PinterestPublishLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" "PinterestLogLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinterestPublishLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PinterestPinAnalytics" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "outboundClicks" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinterestPinAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PinterestAccount_userId_pinterestUserId_key" ON "PinterestAccount"("userId", "pinterestUserId");
CREATE INDEX "PinterestAccount_userId_idx" ON "PinterestAccount"("userId");
CREATE UNIQUE INDEX "PinterestOAuthState_stateHash_key" ON "PinterestOAuthState"("stateHash");
CREATE INDEX "PinterestOAuthState_userId_idx" ON "PinterestOAuthState"("userId");
CREATE INDEX "PinterestOAuthState_expiresAt_idx" ON "PinterestOAuthState"("expiresAt");
CREATE INDEX "PinterestPublishJob_userId_status_idx" ON "PinterestPublishJob"("userId", "status");
CREATE INDEX "PinterestPublishJob_accountId_idx" ON "PinterestPublishJob"("accountId");
CREATE INDEX "PinterestPublishJob_scheduledFor_idx" ON "PinterestPublishJob"("scheduledFor");
CREATE INDEX "PinterestPublishLog_jobId_idx" ON "PinterestPublishLog"("jobId");
CREATE INDEX "PinterestPublishLog_level_idx" ON "PinterestPublishLog"("level");
CREATE UNIQUE INDEX "PinterestPinAnalytics_jobId_key" ON "PinterestPinAnalytics"("jobId");

ALTER TABLE "PinterestAccount" ADD CONSTRAINT "PinterestAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinterestOAuthState" ADD CONSTRAINT "PinterestOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinterestPublishJob" ADD CONSTRAINT "PinterestPublishJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinterestPublishJob" ADD CONSTRAINT "PinterestPublishJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PinterestAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinterestPublishLog" ADD CONSTRAINT "PinterestPublishLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PinterestPublishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PinterestPinAnalytics" ADD CONSTRAINT "PinterestPinAnalytics_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PinterestPublishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
