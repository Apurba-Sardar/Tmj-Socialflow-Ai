CREATE TYPE "SocialChannelStatus" AS ENUM ('CONNECTED', 'ACTION_REQUIRED', 'DISCONNECTED', 'EXPIRED');

CREATE TYPE "SocialChannelAuthType" AS ENUM ('OAUTH', 'MANUAL', 'APPLICATION_PASSWORD');

CREATE TABLE "SocialChannelAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "connectedById" TEXT,
  "platform" "SocialPlatform" NOT NULL,
  "displayName" TEXT NOT NULL,
  "handle" TEXT,
  "externalAccountId" TEXT,
  "accountType" TEXT,
  "status" "SocialChannelStatus" NOT NULL DEFAULT 'CONNECTED',
  "authType" "SocialChannelAuthType" NOT NULL DEFAULT 'MANUAL',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessTokenCiphertext" TEXT,
  "refreshTokenCiphertext" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "lastHealthCheckAt" TIMESTAMP(3),
  "lastError" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialChannelAccount_organizationId_platform_status_idx" ON "SocialChannelAccount"("organizationId", "platform", "status");
CREATE INDEX "SocialChannelAccount_connectedById_idx" ON "SocialChannelAccount"("connectedById");
CREATE INDEX "SocialChannelAccount_platform_idx" ON "SocialChannelAccount"("platform");

ALTER TABLE "SocialChannelAccount"
  ADD CONSTRAINT "SocialChannelAccount_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialChannelAccount"
  ADD CONSTRAINT "SocialChannelAccount_connectedById_fkey"
  FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
