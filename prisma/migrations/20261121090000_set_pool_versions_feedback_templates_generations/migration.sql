-- DropIndex
DROP INDEX "set_exercises_level_id_difficulty_idx";

-- DropIndex
DROP INDEX "set_exercises_level_id_position_key";

-- DropIndex
DROP INDEX "set_exercises_set_id_idx";

-- AlterTable
ALTER TABLE "exercise_sets" ADD COLUMN     "published_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "generation_count" INTEGER NOT NULL DEFAULT 0;

-- Versionamento dos snapshots: o que existe vira a versão 1.
ALTER TABLE "set_exercises" ADD COLUMN     "version" INTEGER;
UPDATE "set_exercises" SET "version" = 1;
ALTER TABLE "set_exercises" ALTER COLUMN "version" SET NOT NULL;
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_version_positive" CHECK ("version" >= 1);
UPDATE "exercise_sets" s SET "published_version" = 1
  WHERE EXISTS (SELECT 1 FROM "set_exercises" se WHERE se."set_id" = s."id");
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_published_version_nonneg" CHECK ("published_version" >= 0);

-- CreateTable
CREATE TABLE "set_pool_exercises" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_pool_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "knowledge_level" "KnowledgeLevel",
    "concept" "GradeConcept",
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_generations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "FeedbackGenerationStatus" NOT NULL,
    "ai_text" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "to_review" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "ai_model" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "set_pool_exercises_tenant_id_idx" ON "set_pool_exercises"("tenant_id");

-- CreateIndex
CREATE INDEX "set_pool_exercises_exercise_id_idx" ON "set_pool_exercises"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "set_pool_exercises_set_id_exercise_id_key" ON "set_pool_exercises"("set_id", "exercise_id");

-- CreateIndex
CREATE INDEX "feedback_templates_tenant_id_active_idx" ON "feedback_templates"("tenant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_templates_tenant_id_name_key" ON "feedback_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "feedback_generations_tenant_id_idx" ON "feedback_generations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_generations_feedback_id_sequence_key" ON "feedback_generations"("feedback_id", "sequence");

-- CreateIndex
CREATE INDEX "set_exercises_level_id_version_difficulty_idx" ON "set_exercises"("level_id", "version", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "set_exercises_set_id_version_level_id_position_key" ON "set_exercises"("set_id", "version", "level_id", "position");

-- AddForeignKey
ALTER TABLE "set_pool_exercises" ADD CONSTRAINT "set_pool_exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_pool_exercises" ADD CONSTRAINT "set_pool_exercises_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "exercise_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_pool_exercises" ADD CONSTRAINT "set_pool_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_templates" ADD CONSTRAINT "feedback_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_templates" ADD CONSTRAINT "feedback_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_generations" ADD CONSTRAINT "feedback_generations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_generations" ADD CONSTRAINT "feedback_generations_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nome único também entre os modelos GLOBAIS (tenant_id nulo não colide no unique comum).
CREATE UNIQUE INDEX "feedback_templates_global_name_key" ON "feedback_templates"("name") WHERE "tenant_id" IS NULL;

ALTER TABLE "feedback_generations" ADD CONSTRAINT "feedback_generations_sequence_positive" CHECK ("sequence" >= 1);
ALTER TABLE "feedback_generations" ADD CONSTRAINT "feedback_generations_status_done"
  CHECK ("status" IN ('GENERATED', 'FAILED'));
ALTER TABLE "feedback_generations" ADD CONSTRAINT "feedback_generations_failed_has_error"
  CHECK ("status" <> 'FAILED' OR "error" IS NOT NULL);

-- Pool vinculado: preserva o comportamento atual.
--   conjunto já publicado: os exercícios de origem do snapshot;
--   conjunto sem snapshot: o pool vivo (tenant + globais PUBLICADOS, nível e dificuldade do conjunto).
INSERT INTO "set_pool_exercises" ("id", "tenant_id", "set_id", "exercise_id")
SELECT DISTINCT ON (se."set_id", se."source_exercise_id")
       'spx_' || md5(se."set_id" || ':' || se."source_exercise_id"), se."tenant_id", se."set_id", se."source_exercise_id"
FROM "set_exercises" se
WHERE se."source_exercise_id" IS NOT NULL;

INSERT INTO "set_pool_exercises" ("id", "tenant_id", "set_id", "exercise_id")
SELECT 'spx_' || md5(s."id" || ':' || e."id"), s."tenant_id", s."id", e."id"
FROM "exercise_sets" s
JOIN "levels" l ON l."set_id" = s."id" AND l."knowledge_level" <> 'DASHBOARD'
JOIN "exercises" e ON e."level" = l."knowledge_level"
  AND e."difficulty" = ANY (s."difficulties")
  AND e."status" = 'PUBLISHED'
  AND (e."tenant_id" = s."tenant_id" OR e."tenant_id" IS NULL)
WHERE NOT EXISTS (SELECT 1 FROM "set_exercises" se WHERE se."set_id" = s."id")
ON CONFLICT ("set_id", "exercise_id") DO NOTHING;

-- Histórico de gerações: a geração atual de cada feedback vira a sequência 1.
INSERT INTO "feedback_generations" ("id", "tenant_id", "feedback_id", "sequence", "status", "ai_text", "strengths", "to_review", "error", "ai_model", "prompt_version", "created_at")
SELECT 'fgn_' || md5(f."id" || ':1'), f."tenant_id", f."id", 1, f."generation_status", f."ai_text", f."ai_strengths", f."ai_to_review",
       CASE WHEN f."generation_status" = 'FAILED' THEN COALESCE(f."generation_error", 'falha') END,
       f."ai_model", f."prompt_version", f."updated_at"
FROM "feedbacks" f
WHERE f."generation_status" IN ('GENERATED', 'FAILED');
UPDATE "feedbacks" SET "generation_count" = 1 WHERE "generation_status" IN ('GENERATED', 'FAILED');
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_generation_count_nonneg" CHECK ("generation_count" >= 0);

-- Campos da IA no Feedback só mudam por uma NOVA geração (generation_count + 1)
-- e só enquanto a revisão está em DRAFT. Sem regeneração após APPROVED/REJECTED.
CREATE OR REPLACE FUNCTION "feedbacks_ai_original_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."generation_count" < OLD."generation_count" THEN
    RAISE EXCEPTION 'feedbacks: generation_count não pode diminuir' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."generation_count" <> OLD."generation_count" AND OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'feedbacks: só é possível (re)gerar enquanto o feedback está em DRAFT'
      USING ERRCODE = 'check_violation';
  END IF;
  IF (NEW."ai_text" IS DISTINCT FROM OLD."ai_text"
      OR NEW."ai_strengths" IS DISTINCT FROM OLD."ai_strengths"
      OR NEW."ai_to_review" IS DISTINCT FROM OLD."ai_to_review"
      OR NEW."generation_status" IS DISTINCT FROM OLD."generation_status")
     AND NOT (OLD."status" = 'DRAFT' AND NEW."generation_count" = OLD."generation_count" + 1) THEN
    RAISE EXCEPTION 'feedbacks: campos da IA só mudam por uma nova geração (generation_count + 1) em DRAFT'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Histórico de gerações é append-only.
CREATE FUNCTION "feedback_generations_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'feedback_generations é append-only' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "feedback_generations_append_only"
  BEFORE UPDATE ON "feedback_generations"
  FOR EACH ROW EXECUTE FUNCTION "feedback_generations_append_only"();
