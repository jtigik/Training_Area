/**
 * PATCH de usuário pelo ADMIN e reenvio de convite (QA). Postgres real: npm run test:db.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_DB_TESTS === "1";
const T = "tenant-escola-demo";
const OTHER = "it-tenant-outra";

describe.skipIf(!enabled)("usuários e convites (admin da instituição)", () => {
  let prisma: (typeof import("@/server/db"))["prisma"];
  let forTenant: (typeof import("@/server/tenant-db"))["forTenant"];
  let update: typeof import("@/server/users/update");
  let invitations: typeof import("@/server/users/invitations");
  let adminCtx: Parameters<(typeof import("@/server/users/update"))["updateTenantUser"]>[0];
  let adminId: string;
  let targetId: string;
  let otherUserId: string;
  const emails = [
    "it-alvo@escola-demo.local",
    "it-outra@outra.local",
    "it-convite@escola-demo.local",
  ];

  beforeAll(async () => {
    ({ prisma } = await import("@/server/db"));
    ({ forTenant } = await import("@/server/tenant-db"));
    update = await import("@/server/users/update");
    invitations = await import("@/server/users/invitations");
    await cleanup();
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: "admin@escola-demo.local" } }))
      .id;
    adminCtx = { db: forTenant(T), tenantId: T, user: { id: adminId } } as typeof adminCtx;
    targetId = (
      await prisma.user.create({
        data: { email: emails[0]!, name: "Alvo IT", role: "ALUNO", tenantId: T },
      })
    ).id;
    await prisma.tenant.create({ data: { id: OTHER, name: "Outra IT", slug: OTHER } });
    otherUserId = (
      await prisma.user.create({
        data: { email: emails[1]!, name: "Outra", role: "ALUNO", tenantId: OTHER },
      })
    ).id;
  });

  async function cleanup() {
    await prisma.invitation.deleteMany({ where: { email: { in: emails } } });
    await prisma.user.deleteMany({
      where: { email: { in: [...emails, "it-novo@escola-demo.local"] } },
    });
    await prisma.tenant.deleteMany({ where: { id: OTHER } });
  }
  afterAll(cleanup);

  it("edita nome e e-mail (minúsculo) e audita before/after", async () => {
    const r = await update.updateTenantUser(adminCtx, targetId, {
      name: "Alvo Editado",
      email: "it-novo@escola-demo.local",
    });
    expect(r.user).toMatchObject({ name: "Alvo Editado", email: "it-novo@escola-demo.local" });
    expect(r.changed.sort()).toEqual(["email", "name"]);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: "user.updated", entityId: targetId },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toMatchObject({ tenantId: T, actorId: adminId });
    expect(log.data).toMatchObject({
      changes: { name: { from: "Alvo IT", to: "Alvo Editado" } },
    });
    await prisma.user.update({ where: { id: targetId }, data: { email: emails[0]! } });
  });

  it("e-mail de outra conta (qualquer instituição) → 409 EMAIL_TAKEN", async () => {
    await expect(
      update.updateTenantUser(adminCtx, targetId, { email: emails[1]! }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_TAKEN" });
  });

  it("usuário de outra instituição → 404; desativar a si mesmo → 422", async () => {
    await expect(
      update.updateTenantUser(adminCtx, otherUserId, { name: "x" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(
      update.updateTenantUser(adminCtx, adminId, { active: false }),
    ).rejects.toMatchObject({ status: 422, code: "CANNOT_DEACTIVATE_SELF" });
  });

  it("desativar não exclui e revoga as sessões", async () => {
    await prisma.session.create({
      data: {
        userId: targetId,
        token: "it-token-alvo",
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const r = await update.updateTenantUser(adminCtx, targetId, { active: false });
    expect(r.user.active).toBe(false);
    expect(await prisma.user.count({ where: { id: targetId } })).toBe(1);
    expect(await prisma.session.count({ where: { userId: targetId } })).toBe(0);
  });

  it("convite: reenvio pendente substitui (renewed) com auditoria; inativo → USER_INACTIVE", async () => {
    const ctx = { ...adminCtx } as Parameters<typeof invitations.createInvitation>[0];
    const first = await invitations.createInvitation(ctx, {
      email: emails[2]!,
      role: "ALUNO",
      expiresInDays: 1,
    });
    expect(first.renewed).toBe(false);
    const second = await invitations.createInvitation(ctx, {
      email: emails[2]!,
      role: "PROFESSOR",
      expiresInDays: 7,
    });
    expect(second.renewed).toBe(true);
    expect(second.invitation.id).not.toBe(first.invitation.id);
    expect(second.invitation.expiresAt.getTime()).toBeGreaterThan(
      first.invitation.expiresAt.getTime(),
    );
    expect(await prisma.invitation.count({ where: { id: first.invitation.id } })).toBe(0);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: "invitation.renewed", entityId: second.invitation.id },
    });
    expect(log.data).toMatchObject({
      replacedInvitationId: first.invitation.id,
      role: "PROFESSOR",
    });

    await expect(
      invitations.createInvitation(ctx, { email: emails[0]!, role: "ALUNO", expiresInDays: 7 }),
    ).rejects.toMatchObject({ status: 409, code: "USER_INACTIVE" });
    await expect(
      invitations.createInvitation(ctx, {
        email: "admin@escola-demo.local",
        role: "ALUNO",
        expiresInDays: 7,
      }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
  });
});
