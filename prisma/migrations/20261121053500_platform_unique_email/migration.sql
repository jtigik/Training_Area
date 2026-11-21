-- E-mail único na plataforma (MVP: uma pessoa, uma instituição).
-- users.email já é UNIQUE; aqui: e-mails sempre minúsculos e no máximo um
-- convite pendente por e-mail em TODAS as instituições.

UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));
UPDATE "invitations" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- Convites pendentes duplicados (mesmo e-mail em instituições diferentes): fica o mais recente.
DELETE FROM "invitations" i
USING "invitations" newer
WHERE i."accepted_at" IS NULL AND newer."accepted_at" IS NULL
  AND i."email" = newer."email" AND i."id" <> newer."id"
  AND (i."created_at", i."id") < (newer."created_at", newer."id");

-- DropIndex
DROP INDEX "invitations_email_idx";

-- DropIndex
DROP INDEX "invitations_tenant_id_email_key";

-- CreateIndex
CREATE INDEX "invitations_tenant_id_email_idx" ON "invitations"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_pending_email_key" ON "invitations"("email") WHERE ("accepted_at" IS NULL);


ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_lowercase" CHECK ("email" = lower("email"));
