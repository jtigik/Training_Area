-- Cota por nível E dificuldade (decisão do PO). Cotas antigas do nível inteiro
-- (difficulty nula) são repartidas entre as dificuldades do conjunto do nível:
-- quantidade / n, o resto vai para as primeiras (ordem do enum). Ex.: 10 em
-- {VERY_EASY,EASY,MEDIUM} → 4/3/3. Se já existir cota específica para a
-- mesma dificuldade e escopo, a específica vence (a repartida é descartada).
WITH expanded AS (
  SELECT q.id, q.tenant_id, q.level_id, q.classroom_id, q.student_id, q.quantity,
         d.difficulty, d.ord, count(*) OVER (PARTITION BY q.id) AS n
  FROM "exercise_quotas" q
  JOIN "levels" l ON l.id = q.level_id
  JOIN "exercise_sets" s ON s.id = l.set_id
  CROSS JOIN LATERAL unnest(s.difficulties) WITH ORDINALITY AS d(difficulty, ord)
  WHERE q.difficulty IS NULL
),
shares AS (
  SELECT *, (quantity / n) + CASE WHEN row_number() OVER (PARTITION BY id ORDER BY difficulty) <= quantity % n THEN 1 ELSE 0 END AS share
  FROM expanded
)
INSERT INTO "exercise_quotas" (id, tenant_id, level_id, difficulty, classroom_id, student_id, scope_key, quantity, created_at, updated_at)
SELECT id || '-' || lower(difficulty::text), tenant_id, level_id, difficulty, classroom_id, student_id,
       COALESCE('student:' || student_id, 'classroom:' || classroom_id, 'default') || '|' || difficulty::text,
       share, now(), now()
FROM shares
WHERE share > 0
ON CONFLICT (level_id, scope_key) DO NOTHING;

DELETE FROM "exercise_quotas" WHERE "difficulty" IS NULL;

ALTER TABLE "exercise_quotas" ALTER COLUMN "difficulty" SET NOT NULL;

-- AlterTable
-- Originais da IA: renomeados (preserva dados) para ai_strengths / ai_to_review.
ALTER TABLE "feedbacks" RENAME COLUMN "strengths" TO "ai_strengths";
ALTER TABLE "feedbacks" RENAME COLUMN "to_review" TO "ai_to_review";
ALTER TABLE "feedbacks" ADD COLUMN     "edited_at" TIMESTAMP(3),
ADD COLUMN     "edited_by_id" TEXT,
ADD COLUMN     "edited_strengths" JSONB,
ADD COLUMN     "edited_to_review" JSONB;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Edições das listas: arrays JSON de strings (ou nulo = sem edição).
ALTER TABLE "feedbacks"
  ADD CONSTRAINT "feedbacks_edited_strengths_array" CHECK ("edited_strengths" IS NULL OR jsonb_typeof("edited_strengths") = 'array'),
  ADD CONSTRAINT "feedbacks_edited_to_review_array" CHECK ("edited_to_review" IS NULL OR jsonb_typeof("edited_to_review") = 'array');

-- Originais da IA imutáveis depois de GENERATED (auditoria). Regenerar = novo
-- Feedback ou voltar o generation_status para PENDING na mesma instrução.
CREATE FUNCTION "feedbacks_ai_original_immutable"() RETURNS trigger AS $$
BEGIN
  IF OLD."generation_status" = 'GENERATED' AND NEW."generation_status" = 'GENERATED' AND (
       NEW."ai_text" IS DISTINCT FROM OLD."ai_text"
    OR NEW."ai_strengths" IS DISTINCT FROM OLD."ai_strengths"
    OR NEW."ai_to_review" IS DISTINCT FROM OLD."ai_to_review"
  ) THEN
    RAISE EXCEPTION 'feedbacks: original da IA (ai_text, ai_strengths, ai_to_review) é imutável após GENERATED'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "feedbacks_ai_original_immutable"
  BEFORE UPDATE ON "feedbacks"
  FOR EACH ROW EXECUTE FUNCTION "feedbacks_ai_original_immutable"();

-- Auditoria é append-only (só o ON DELETE SET NULL do ator é permitido).
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  IF NEW."actor_id" IS NULL AND OLD."actor_id" IS NOT NULL
     AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs é append-only' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

-- Faixas padrão da plataforma (linha única) — só para instituições NOVAS.
CREATE TABLE "platform_grading_defaults" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "ed_min_percent" INTEGER NOT NULL DEFAULT 50,
    "d_min_percent" INTEGER NOT NULL DEFAULT 70,
    "pd_min_percent" INTEGER NOT NULL DEFAULT 90,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_grading_defaults_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "platform_grading_defaults"
  ADD CONSTRAINT "platform_grading_defaults_singleton" CHECK ("id" = 'platform'),
  ADD CONSTRAINT "platform_grading_defaults_bands_valid" CHECK (
    0 < "ed_min_percent" AND "ed_min_percent" < "d_min_percent"
    AND "d_min_percent" < "pd_min_percent" AND "pd_min_percent" <= 100
  );

INSERT INTO "platform_grading_defaults" ("id", "updated_at") VALUES ('platform', now());

-- Instituições existentes ficam congeladas nas faixas que já usam: quem não tinha
-- configuração própria (usava o padrão 50/70/90 do código) ganha uma cópia explícita,
-- para que mudanças futuras no padrão da plataforma não as afetem.
INSERT INTO "tenant_grading_configs" ("tenant_id", "ed_min_percent", "d_min_percent", "pd_min_percent", "created_at", "updated_at")
SELECT t."id", 50, 70, 90, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (SELECT 1 FROM "tenant_grading_configs" c WHERE c."tenant_id" = t."id");
