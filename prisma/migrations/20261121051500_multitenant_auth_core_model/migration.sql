-- CreateEnum
CREATE TYPE "KnowledgeLevel" AS ENUM ('FUNDAMENTAL', 'PROFESSIONAL', 'ADVANCED', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GradeConcept" AS ENUM ('ND', 'ED', 'D', 'PD');

-- CreateEnum
CREATE TYPE "LevelAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- AlterEnum (manual): Role STUDENT/TEACHER/ADMIN -> ALUNO/PROFESSOR/SUPER_ADMIN,
-- preservando dados. ADMIN vira SUPER_ADMIN porque ainda não tem tenant.
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'PROFESSOR', 'ALUNO');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'SUPER_ADMIN'
    WHEN 'TEACHER' THEN 'PROFESSOR'
    ELSE 'ALUNO'
  END
)::"Role_new";
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password_hash",
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "tenant_id" TEXT,
ALTER COLUMN "role" SET DEFAULT 'ALUNO';

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email_domains" TEXT[],
    "auto_join_by_domain" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "invited_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "teacher_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_members" (
    "tenant_id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classroom_members_pkey" PRIMARY KEY ("classroom_id","user_id")
);

-- CreateTable
CREATE TABLE "content_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" "KnowledgeLevel",
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "initial_sheet" JSONB NOT NULL,
    "expected_result" JSONB NOT NULL,
    "hint" TEXT,
    "level" "KnowledgeLevel" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_sets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "difficulties" "Difficulty"[],
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "author_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "set_id" TEXT NOT NULL,
    "knowledge_level" "KnowledgeLevel" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_quotas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "difficulty" "Difficulty",
    "classroom_id" TEXT,
    "student_id" TEXT,
    "scope_key" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercise_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "LevelAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "concept" "GradeConcept",
    "required_count" INTEGER,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "graded_at" TIMESTAMP(3),
    "graded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "level_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level_attempt_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "submission" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "client_is_correct" BOOLEAN,
    "error_type" TEXT,
    "attempt_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "level_attempt_id" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'DRAFT',
    "ai_text" TEXT NOT NULL,
    "edited_text" TEXT,
    "ai_model" TEXT,
    "prompt_version" TEXT,
    "metrics" JSONB NOT NULL,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_id_account_id_key" ON "accounts"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tenant_id_email_key" ON "invitations"("tenant_id", "email") WHERE ("accepted_at" IS NULL);

-- CreateIndex
CREATE INDEX "classrooms_tenant_id_teacher_id_idx" ON "classrooms"("tenant_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_tenant_id_code_key" ON "classrooms"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "classroom_members_tenant_id_user_id_idx" ON "classroom_members"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "content_sections_tenant_id_status_level_position_idx" ON "content_sections"("tenant_id", "status", "level", "position");

-- CreateIndex
CREATE UNIQUE INDEX "content_sections_tenant_id_slug_key" ON "content_sections"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_sections_global_slug_key" ON "content_sections"("slug") WHERE ("tenant_id" IS NULL);

-- CreateIndex
CREATE INDEX "exercises_tenant_id_status_level_difficulty_idx" ON "exercises"("tenant_id", "status", "level", "difficulty");

-- CreateIndex
CREATE INDEX "exercises_global_pool_idx" ON "exercises"("level", "difficulty") WHERE ("tenant_id" IS NULL);

-- CreateIndex
CREATE INDEX "exercise_sets_tenant_id_status_idx" ON "exercise_sets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "levels_tenant_id_idx" ON "levels"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "levels_set_id_knowledge_level_key" ON "levels"("set_id", "knowledge_level");

-- CreateIndex
CREATE INDEX "exercise_quotas_tenant_id_idx" ON "exercise_quotas"("tenant_id");

-- CreateIndex
CREATE INDEX "exercise_quotas_classroom_id_idx" ON "exercise_quotas"("classroom_id");

-- CreateIndex
CREATE INDEX "exercise_quotas_student_id_idx" ON "exercise_quotas"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_quotas_level_id_scope_key_key" ON "exercise_quotas"("level_id", "scope_key");

-- CreateIndex
CREATE INDEX "level_attempts_tenant_id_level_id_status_idx" ON "level_attempts"("tenant_id", "level_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "level_attempts_student_id_level_id_attempt_number_key" ON "level_attempts"("student_id", "level_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "level_attempts_one_in_progress_key" ON "level_attempts"("student_id", "level_id") WHERE ("status" = 'IN_PROGRESS');

-- CreateIndex
CREATE INDEX "exercise_attempts_tenant_id_student_id_created_at_idx" ON "exercise_attempts"("tenant_id", "student_id", "created_at");

-- CreateIndex
CREATE INDEX "exercise_attempts_exercise_id_idx" ON "exercise_attempts"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_attempts_level_attempt_id_exercise_id_attempt_numb_key" ON "exercise_attempts"("level_attempt_id", "exercise_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "feedbacks_level_attempt_id_key" ON "feedbacks"("level_attempt_id");

-- CreateIndex
CREATE INDEX "feedbacks_tenant_id_status_idx" ON "feedbacks"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "feedbacks_student_id_status_idx" ON "feedbacks"("student_id", "status");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_idx" ON "users"("tenant_id", "role");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sections" ADD CONSTRAINT "content_sections_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_sets" ADD CONSTRAINT "exercise_sets_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "exercise_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_quotas" ADD CONSTRAINT "exercise_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_quotas" ADD CONSTRAINT "exercise_quotas_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_quotas" ADD CONSTRAINT "exercise_quotas_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_quotas" ADD CONSTRAINT "exercise_quotas_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_graded_by_id_fkey" FOREIGN KEY ("graded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_level_attempt_id_fkey" FOREIGN KEY ("level_attempt_id") REFERENCES "level_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_level_attempt_id_fkey" FOREIGN KEY ("level_attempt_id") REFERENCES "level_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Manual: dados legados e restrições CHECK (o Prisma não modela CHECK)
-- ---------------------------------------------------------------------------

-- Usuários não SUPER_ADMIN pré-existentes (sem tenant) vão para uma instituição "legado".
INSERT INTO "tenants" ("id", "name", "slug", "email_domains", "updated_at")
SELECT 'legacy', 'Instituição legada', 'legado', '{}', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "users" WHERE "tenant_id" IS NULL AND "role" <> 'SUPER_ADMIN');
UPDATE "users" SET "tenant_id" = 'legacy' WHERE "tenant_id" IS NULL AND "role" <> 'SUPER_ADMIN';

-- Só SUPER_ADMIN fica sem tenant; SUPER_ADMIN nunca tem tenant.
ALTER TABLE "users"
  ADD CONSTRAINT "users_tenant_matches_role" CHECK (("role" = 'SUPER_ADMIN') = ("tenant_id" IS NULL));

-- Convite nunca concede SUPER_ADMIN.
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_role_not_super_admin" CHECK ("role" <> 'SUPER_ADMIN');

-- Globais: tenant_id nulo <=> is_global.
ALTER TABLE "content_sections"
  ADD CONSTRAINT "content_sections_global_matches_tenant" CHECK ("is_global" = ("tenant_id" IS NULL));
ALTER TABLE "exercises"
  ADD CONSTRAINT "exercises_global_matches_tenant" CHECK ("is_global" = ("tenant_id" IS NULL));

-- Cota: quantidade positiva (TA-015), escopo exclusivo e scope_key coerente.
ALTER TABLE "exercise_quotas"
  ADD CONSTRAINT "exercise_quotas_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "exercise_quotas_single_scope" CHECK (num_nonnulls("classroom_id", "student_id") <= 1),
  ADD CONSTRAINT "exercise_quotas_scope_key_consistent" CHECK (
    "scope_key" = COALESCE('student:' || "student_id", 'classroom:' || "classroom_id", 'default')
      || '|' || COALESCE("difficulty"::text, '*')
  );

-- Tentativas: números positivos; conceito obrigatório ao concluir.
ALTER TABLE "level_attempts"
  ADD CONSTRAINT "level_attempts_attempt_number_positive" CHECK ("attempt_number" > 0),
  ADD CONSTRAINT "level_attempts_counts_valid" CHECK ("completed_count" >= 0 AND "correct_count" BETWEEN 0 AND "completed_count"),
  ADD CONSTRAINT "level_attempts_completed_has_concept" CHECK ("status" <> 'COMPLETED' OR ("concept" IS NOT NULL AND "completed_at" IS NOT NULL));
ALTER TABLE "exercise_attempts"
  ADD CONSTRAINT "exercise_attempts_attempt_number_positive" CHECK ("attempt_number" > 0);

-- Feedback: data de revisão obrigatória quando aprovado/rejeitado
-- (reviewed_by_id pode virar NULL se o professor for removido).
ALTER TABLE "feedbacks"
  ADD CONSTRAINT "feedbacks_reviewed_when_decided" CHECK ("status" = 'DRAFT' OR "reviewed_at" IS NOT NULL);
