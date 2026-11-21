-- Conceito automático por faixas da instituição + ajuste do professor com justificativa.
-- Substitui level_attempts.graded_by_id (nunca usado) por overridden_* e
-- concept_overrides (auditoria).

-- DropForeignKey
ALTER TABLE "level_attempts" DROP CONSTRAINT "level_attempts_graded_by_id_fkey";

-- AlterTable
ALTER TABLE "level_attempts" DROP COLUMN "graded_by_id",
ADD COLUMN     "computed_concept" "GradeConcept",
ADD COLUMN     "grading_bands" JSONB,
ADD COLUMN     "overridden_at" TIMESTAMP(3),
ADD COLUMN     "overridden_by_id" TEXT,
ADD COLUMN     "override_reason" TEXT;

-- CreateTable
CREATE TABLE "tenant_grading_configs" (
    "tenant_id" TEXT NOT NULL,
    "ed_min_percent" INTEGER NOT NULL DEFAULT 50,
    "d_min_percent" INTEGER NOT NULL DEFAULT 70,
    "pd_min_percent" INTEGER NOT NULL DEFAULT 90,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_grading_configs_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "concept_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "level_attempt_id" TEXT NOT NULL,
    "from_concept" "GradeConcept" NOT NULL,
    "to_concept" "GradeConcept" NOT NULL,
    "reason" TEXT NOT NULL,
    "overridden_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concept_overrides_tenant_id_level_attempt_id_created_at_idx" ON "concept_overrides"("tenant_id", "level_attempt_id", "created_at");

-- AddForeignKey
ALTER TABLE "level_attempts" ADD CONSTRAINT "level_attempts_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_grading_configs" ADD CONSTRAINT "tenant_grading_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_overrides" ADD CONSTRAINT "concept_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_overrides" ADD CONSTRAINT "concept_overrides_level_attempt_id_fkey" FOREIGN KEY ("level_attempt_id") REFERENCES "level_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_overrides" ADD CONSTRAINT "concept_overrides_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Manual: dados e CHECKs
-- ---------------------------------------------------------------------------

-- Tentativas já concluídas: o conceito existente passa a ser também o calculado.
UPDATE "level_attempts" SET "computed_concept" = "concept", "graded_at" = COALESCE("graded_at", "completed_at")
WHERE "status" = 'COMPLETED' AND "computed_concept" IS NULL;

ALTER TABLE "tenant_grading_configs"
  ADD CONSTRAINT "tenant_grading_configs_bands_valid"
  CHECK (0 < "ed_min_percent" AND "ed_min_percent" < "d_min_percent" AND "d_min_percent" < "pd_min_percent" AND "pd_min_percent" <= 100);

-- Concluída tem conceito calculado; ajuste exige justificativa e data (o autor
-- pode virar NULL se o usuário for removido).
ALTER TABLE "level_attempts"
  ADD CONSTRAINT "level_attempts_completed_has_computed_concept"
    CHECK ("status" <> 'COMPLETED' OR "computed_concept" IS NOT NULL),
  ADD CONSTRAINT "level_attempts_override_consistent"
    CHECK (
      ("overridden_at" IS NULL AND "override_reason" IS NULL AND "overridden_by_id" IS NULL)
      OR ("overridden_at" IS NOT NULL AND char_length(btrim("override_reason")) >= 10)
    );

ALTER TABLE "concept_overrides"
  ADD CONSTRAINT "concept_overrides_reason_required" CHECK (char_length(btrim("reason")) >= 10),
  ADD CONSTRAINT "concept_overrides_changes_concept" CHECK ("from_concept" <> "to_concept");
