CREATE TABLE "PromptTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "platform" "SocialPlatform" NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'IMAGE_GENERATION',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "template" TEXT NOT NULL,
  "negativePrompt" TEXT,
  "styleNotes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromptTemplate_organizationId_platform_purpose_active_key"
  ON "PromptTemplate"("organizationId", "platform", "purpose", "active");

CREATE INDEX "PromptTemplate_platform_purpose_idx" ON "PromptTemplate"("platform", "purpose");
CREATE INDEX "PromptTemplate_updatedAt_idx" ON "PromptTemplate"("updatedAt");

ALTER TABLE "PromptTemplate"
  ADD CONSTRAINT "PromptTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromptTemplate"
  ADD CONSTRAINT "PromptTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromptTemplate"
  ADD CONSTRAINT "PromptTemplate_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
