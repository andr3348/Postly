-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PublicationStatus" ADD VALUE 'PENDING_APPROVAL';

-- DropForeignKey
ALTER TABLE "ConnectedAccount" DROP CONSTRAINT "ConnectedAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "Publication" DROP CONSTRAINT "Publication_approvedBy_fkey";

-- DropIndex
DROP INDEX "ConnectedAccount_userId_platform_key";

-- AlterTable
ALTER TABLE "ConnectedAccount" DROP COLUMN "userId",
ADD COLUMN     "accountName" TEXT NOT NULL,
ADD COLUMN     "brandId" TEXT NOT NULL,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'CONNECTED',
ALTER COLUMN "accessToken" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Publication" DROP COLUMN "approvedBy",
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "brandId" TEXT NOT NULL,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ALTER COLUMN "modelText" SET DEFAULT 'gemini-1.5-flash';

-- AlterTable
ALTER TABLE "PublicationTarget" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TargetMetric" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "aiTone" TEXT NOT NULL DEFAULT 'Profesional y persuasivo',
    "aiBrandVoice" TEXT,
    "aiTargetAudience" TEXT,
    "defaultHashtags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectedAccount_brandId_status_idx" ON "ConnectedAccount"("brandId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_brandId_platform_key" ON "ConnectedAccount"("brandId", "platform");

-- CreateIndex
CREATE INDEX "Publication_brandId_status_idx" ON "Publication"("brandId", "status");

-- CreateIndex
CREATE INDEX "Publication_scheduledAt_idx" ON "Publication"("scheduledAt");

-- CreateIndex
CREATE INDEX "PublicationTarget_platform_status_idx" ON "PublicationTarget"("platform", "status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

