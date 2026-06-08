-- Fix: eliminar TODOS los unique constraints e indices sobre numeroTicket en PesajeCamion
-- Ejecutar: npx prisma db execute --file scripts/fix-unique-ticket2.sql --schema prisma/schema.prisma

-- 1) Eliminar unique constraint (cualquier nombre)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'u'
      AND c.conrelid = '"PesajeCamion"'::regclass
      AND a.attname = 'numeroTicket'
  ) LOOP
    EXECUTE 'ALTER TABLE "PesajeCamion" DROP CONSTRAINT ' || r.conname;
    RAISE NOTICE 'Unique constraint eliminado: %', r.conname;
  END LOOP;
END $$;

-- 2) Eliminar unique index (si existe y no es un constraint)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT i.indexname
    FROM pg_indexes i
    JOIN pg_attribute a ON a.attname = replace(split_part(i.indexdef, '(', 2), ')', '')
    WHERE i.tablename = 'PesajeCamion'
      AND i.schemaname = 'public'
      AND i.indexdef LIKE '%UNIQUE%'
      AND a.attrelid = '"PesajeCamion"'::regclass
      AND a.attname = 'numeroTicket'
  ) LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || r.indexname;
    RAISE NOTICE 'Unique index eliminado: %', r.indexname;
  END LOOP;
END $$;
