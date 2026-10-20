-- AlterTable
ALTER TABLE "Publication" ALTER COLUMN "modelText" SET DEFAULT 'manual';

-- Backfill: antes de la generación persistida, todos los borradores eran manuales.
UPDATE "Publication" SET "modelText" = 'manual' WHERE "modelText" = 'gemini-1.5-flash';
