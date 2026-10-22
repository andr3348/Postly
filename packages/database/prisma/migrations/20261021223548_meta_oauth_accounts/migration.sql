-- CreateEnum
CREATE TYPE "AccountAuthType" AS ENUM ('MANUAL', 'META_OAUTH');

-- CreateEnum
CREATE TYPE "MetaOAuthSessionStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'COMPLETED');

-- AlterTable
ALTER TABLE "ConnectedAccount" ADD COLUMN     "authType" "AccountAuthType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "metaPageId" TEXT;

-- CreateTable
CREATE TABLE "MetaOAuthSession" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "status" "MetaOAuthSessionStatus" NOT NULL DEFAULT 'PENDING',
    "encryptedPayload" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "stateConsumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaOAuthSession_stateHash_key" ON "MetaOAuthSession"("stateHash");

-- CreateIndex
CREATE INDEX "MetaOAuthSession_brandId_userId_idx" ON "MetaOAuthSession"("brandId", "userId");

-- CreateIndex
CREATE INDEX "MetaOAuthSession_expiresAt_idx" ON "MetaOAuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "MetaOAuthSession" ADD CONSTRAINT "MetaOAuthSession_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
