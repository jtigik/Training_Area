-- CreateEnum
CREATE TYPE "FeedbackGenerationStatus" AS ENUM ('PENDING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExerciseImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "exercise_attempts" ADD COLUMN     "set_exercise_id" TEXT,
ALTER COLUMN "exercise_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "grading_rules" JSONB;

-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "generation_error" TEXT,
ADD COLUMN     "generation_status" "FeedbackGenerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "to_review" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "ai_text" DROP NOT NULL;

-- CreateTable
CREATE TABLE "set_exercises" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "source_exercise_id" TEXT,
    "position" INTEGER NOT NULL,
    "level" "KnowledgeLevel" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_attempt_exercises" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "level_attempt_id" TEXT NOT NULL,
    "exercise_id" TEXT,
    "set_exercise_id" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_attempt_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_imports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_by_id" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "status" "ExerciseImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "exercise_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "set_exercises_tenant_id_idx" ON "set_exercises"("tenant_id");

-- CreateIndex
CREATE INDEX "set_exercises_set_id_idx" ON "set_exercises"("set_id");

-- CreateIndex
CREATE INDEX "set_exercises_level_id_difficulty_idx" ON "set_exercises"("level_id", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "set_exercises_level_id_position_key" ON "set_exercises"("level_id", "position");

-- CreateIndex
CREATE INDEX "level_attempt_exercises_tenant_id_idx" ON "level_attempt_exercises"("tenant_id");

-- CreateIndex
CREATE INDEX "level_attempt_exercises_exercise_id_idx" ON "level_attempt_exercises"("exercise_id");

-- CreateIndex
CREATE INDEX "level_attempt_exercises_set_exercise_id_idx" ON "level_attempt_exercises"("set_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_attempt_exercises_level_attempt_id_position_key" ON "level_attempt_exercises"("level_attempt_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "level_attempt_exercises_level_attempt_id_exercise_id_key" ON "level_attempt_exercises"("level_attempt_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_attempt_exercises_level_attempt_id_set_exercise_id_key" ON "level_attempt_exercises"("level_attempt_id", "set_exercise_id");

-- CreateIndex
CREATE INDEX "exercise_imports_tenant_id_created_at_idx" ON "exercise_imports"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_imports_tenant_id_file_hash_key" ON "exercise_imports"("tenant_id", "file_hash");

-- CreateIndex
CREATE INDEX "exercise_attempts_set_exercise_id_idx" ON "exercise_attempts"("set_exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_attempts_level_attempt_id_set_exercise_id_attempt__key" ON "exercise_attempts"("level_attempt_id", "set_exercise_id", "attempt_number");

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_set_exercise_id_fkey" FOREIGN KEY ("set_exercise_id") REFERENCES "set_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "exercise_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_source_exercise_id_fkey" FOREIGN KEY ("source_exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_level_attempt_id_fkey" FOREIGN KEY ("level_attempt_id") REFERENCES "level_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_set_exercise_id_fkey" FOREIGN KEY ("set_exercise_id") REFERENCES "set_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_imports" ADD CONSTRAINT "exercise_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_imports" ADD CONSTRAINT "exercise_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Dados existentes e regras que o Prisma não expressa
-- ---------------------------------------------------------------------------

-- Feedbacks já existentes têm texto da IA: geração concluída.
UPDATE "feedbacks" SET "generation_status" = 'GENERATED' WHERE "ai_text" IS NOT NULL;

-- Exatamente uma referência de exercício (pool OU cópia congelada).
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_one_exercise_ref"
  CHECK (num_nonnulls("exercise_id", "set_exercise_id") = 1);
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_one_exercise_ref"
  CHECK (num_nonnulls("exercise_id", "set_exercise_id") = 1);
ALTER TABLE "level_attempt_exercises" ADD CONSTRAINT "level_attempt_exercises_position_nonneg"
  CHECK ("position" >= 0);
ALTER TABLE "set_exercises" ADD CONSTRAINT "set_exercises_position_nonneg"
  CHECK ("position" >= 0);

-- Geração x revisão do feedback.
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_generation_failed_has_error"
  CHECK ("generation_status" <> 'FAILED' OR "generation_error" IS NOT NULL);
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_generated_has_text"
  CHECK ("generation_status" <> 'GENERATED' OR "ai_text" IS NOT NULL);
-- Aprovado precisa de algum texto para o aluno (edição do professor ou IA).
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_approved_has_text"
  CHECK ("status" <> 'APPROVED' OR COALESCE(NULLIF(btrim("edited_text"), ''), "ai_text") IS NOT NULL);

-- Importações.
ALTER TABLE "exercise_imports" ADD CONSTRAINT "exercise_imports_file_hash_sha256"
  CHECK ("file_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "exercise_imports" ADD CONSTRAINT "exercise_imports_count_nonneg"
  CHECK ("count" >= 0);
