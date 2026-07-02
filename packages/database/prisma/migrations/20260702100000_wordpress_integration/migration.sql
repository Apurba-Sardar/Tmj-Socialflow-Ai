CREATE TABLE "WordPressConnection" (
    "id" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "applicationPasswordIv" TEXT NOT NULL,
    "applicationPasswordTag" TEXT NOT NULL,
    "applicationPasswordCiphertext" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordPressConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordPressRequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "attempts" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordPressRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WordPressConnection_siteUrl_username_key" ON "WordPressConnection"("siteUrl", "username");
CREATE INDEX "WordPressConnection_isActive_idx" ON "WordPressConnection"("isActive");
CREATE INDEX "WordPressRequestLog_success_idx" ON "WordPressRequestLog"("success");
CREATE INDEX "WordPressRequestLog_createdAt_idx" ON "WordPressRequestLog"("createdAt");
