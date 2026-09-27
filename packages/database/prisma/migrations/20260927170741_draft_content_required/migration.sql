-- DRAFT = ya generado por IA y editable: copy/mediaUrl vuelven a obligatorios.
-- Seguro en dev: todas las filas existentes tienen valores.
ALTER TABLE "Publication" ALTER COLUMN "copy" SET NOT NULL;
ALTER TABLE "Publication" ALTER COLUMN "mediaUrl" SET NOT NULL;
