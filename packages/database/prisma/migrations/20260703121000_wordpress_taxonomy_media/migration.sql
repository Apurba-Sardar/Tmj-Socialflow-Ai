CREATE TABLE "WordPressAuthor" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wordpressId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT,
    "avatarUrl" TEXT,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordPressAuthor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordPressCategory" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wordpressId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "parentId" INTEGER,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordPressCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordPressTag" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wordpressId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordPressTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WordPressMedia" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "wordpressId" INTEGER NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "altText" TEXT,
    "mediaType" TEXT NOT NULL,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordPressMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WordPressAuthor_connectionId_wordpressId_key" ON "WordPressAuthor"("connectionId", "wordpressId");
CREATE INDEX "WordPressAuthor_connectionId_slug_idx" ON "WordPressAuthor"("connectionId", "slug");
CREATE UNIQUE INDEX "WordPressCategory_connectionId_wordpressId_key" ON "WordPressCategory"("connectionId", "wordpressId");
CREATE INDEX "WordPressCategory_connectionId_slug_idx" ON "WordPressCategory"("connectionId", "slug");
CREATE UNIQUE INDEX "WordPressTag_connectionId_wordpressId_key" ON "WordPressTag"("connectionId", "wordpressId");
CREATE INDEX "WordPressTag_connectionId_slug_idx" ON "WordPressTag"("connectionId", "slug");
CREATE UNIQUE INDEX "WordPressMedia_connectionId_wordpressId_key" ON "WordPressMedia"("connectionId", "wordpressId");
CREATE INDEX "WordPressMedia_connectionId_mediaType_idx" ON "WordPressMedia"("connectionId", "mediaType");

ALTER TABLE "WordPressAuthor" ADD CONSTRAINT "WordPressAuthor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressCategory" ADD CONSTRAINT "WordPressCategory_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressTag" ADD CONSTRAINT "WordPressTag_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordPressMedia" ADD CONSTRAINT "WordPressMedia_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WordPressConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
