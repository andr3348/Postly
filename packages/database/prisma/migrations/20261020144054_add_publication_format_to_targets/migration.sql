-- CreateEnum
CREATE TYPE "PublicationFormat" AS ENUM ('FEED', 'REEL');

-- AlterTable
ALTER TABLE "PublicationTarget" ADD COLUMN     "format" "PublicationFormat" NOT NULL DEFAULT 'FEED';
