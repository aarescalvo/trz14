-- AlterTable: numeroTicket Int → String (Varchar)
-- 1. Agregar columna temporal String
ALTER TABLE "PesajeCamion" ADD COLUMN "numeroTicket_new" VARCHAR(191);
-- 2. Migrar datos Int → String
UPDATE "PesajeCamion" SET "numeroTicket_new" = CAST("numeroTicket" AS VARCHAR);
-- 3. Eliminar columna vieja
ALTER TABLE "PesajeCamion" DROP COLUMN "numeroTicket";
-- 4. Renombrar columna nueva
ALTER TABLE "PesajeCamion" RENAME COLUMN "numeroTicket_new" TO "numeroTicket";
