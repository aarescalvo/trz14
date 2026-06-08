-- Corrección: eliminar unique constraint de numeroTicket (cualquier nombre)
-- Ejecutar: npx prisma db execute --file scripts/fix-unique-ticket.sql

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'u'
      AND conrelid = '"PesajeCamion"'::regclass
      AND conindid IN (
        SELECT indexrelid FROM pg_index
        WHERE indrelid = '"PesajeCamion"'::regclass
          AND indisunique = true
          AND indpred IS NULL
      )
  ) LOOP
    EXECUTE 'ALTER TABLE "PesajeCamion" DROP CONSTRAINT ' || r.conname;
    RAISE NOTICE 'Constraint eliminado: %', r.conname;
  END LOOP;
END $$;
