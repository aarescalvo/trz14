-- Quitar constraint UNIQUE de numeroTicket en PesajeCamion
-- Motivo: un camión puede traer varias tropas y compartir el mismo ticket de balanza
ALTER TABLE "PesajeCamion" DROP CONSTRAINT IF EXISTS "PesajeCamion_numeroTicket_key";
