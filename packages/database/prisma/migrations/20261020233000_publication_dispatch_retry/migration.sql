-- AlterTable
ALTER TABLE "Publication" ADD COLUMN "dispatchAttemptId" TEXT;

-- AlterTable
ALTER TABLE "PublicationTarget" ADD COLUMN "failure" JSONB;
ALTER TABLE "PublicationTarget" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
