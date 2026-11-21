-- Remove o nível DASHBOARD do enum KnowledgeLevel (Dashboard foi para a v1.1).
-- Postgres não remove valor de enum: recria o tipo.
--
-- Dados existentes:
--   * content_sections.level = DASHBOARD vira NULL (conteúdo transversal);
--   * exercises/levels com DASHBOARD abortam a migração com erro explícito
--     (decida manualmente: reclassificar ou apagar), para não perder tentativas.
-- Para reintroduzir na v1.1: ALTER TYPE "KnowledgeLevel" ADD VALUE 'DASHBOARD';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "exercises" WHERE "level" = 'DASHBOARD')
     OR EXISTS (SELECT 1 FROM "levels" WHERE "knowledge_level" = 'DASHBOARD') THEN
    RAISE EXCEPTION 'Há exercícios ou níveis DASHBOARD; reclassifique-os antes de aplicar esta migração';
  END IF;
END $$;

UPDATE "content_sections" SET "level" = NULL WHERE "level" = 'DASHBOARD';

CREATE TYPE "KnowledgeLevel_new" AS ENUM ('FUNDAMENTAL', 'PROFESSIONAL', 'ADVANCED');
ALTER TABLE "content_sections" ALTER COLUMN "level" TYPE "KnowledgeLevel_new" USING ("level"::text::"KnowledgeLevel_new");
ALTER TABLE "exercises" ALTER COLUMN "level" TYPE "KnowledgeLevel_new" USING ("level"::text::"KnowledgeLevel_new");
ALTER TABLE "levels" ALTER COLUMN "knowledge_level" TYPE "KnowledgeLevel_new" USING ("knowledge_level"::text::"KnowledgeLevel_new");
ALTER TYPE "KnowledgeLevel" RENAME TO "KnowledgeLevel_old";
ALTER TYPE "KnowledgeLevel_new" RENAME TO "KnowledgeLevel";
DROP TYPE "KnowledgeLevel_old";
