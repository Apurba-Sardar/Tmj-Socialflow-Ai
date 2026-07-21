-- Add category-specific prompt templates so each platform can use different
-- image instructions for articles, quotes, news, and future content types.
ALTER TABLE "PromptTemplate"
ADD COLUMN "contentCategory" TEXT NOT NULL DEFAULT 'ARTICLE';

DROP INDEX "PromptTemplate_organizationId_platform_purpose_active_key";

CREATE UNIQUE INDEX "PromptTemplate_organizationId_platform_purpose_contentCategory_active_key"
ON "PromptTemplate"("organizationId", "platform", "purpose", "contentCategory", "active");

DROP INDEX "PromptTemplate_platform_purpose_idx";

CREATE INDEX "PromptTemplate_platform_purpose_contentCategory_idx"
ON "PromptTemplate"("platform", "purpose", "contentCategory");
