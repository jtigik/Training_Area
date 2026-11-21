import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ prisma: {} }));

const { invitationConflict } = await import("./invitations");
const { invitationInputSchema } = await import("@/lib/validation/invitation");

const now = new Date("2026-11-21T12:00:00Z");
const future = new Date("2026-11-30T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");

describe("invitationConflict (e-mail único na plataforma)", () => {
  it("recusa e-mail com conta em qualquer instituição", () => {
    expect(invitationConflict({ tenantId: "t2" }, null, "t1", now)).toBe("EMAIL_IN_USE");
    expect(invitationConflict({ tenantId: null }, null, "t1", now)).toBe("EMAIL_IN_USE");
  });

  it("recusa convite pendente válido em outra instituição", () => {
    expect(invitationConflict(null, { tenantId: "t2", expiresAt: future }, "t1", now)).toBe(
      "PENDING_INVITATION",
    );
  });

  it("conta desativada: USER_INACTIVE só na mesma instituição", () => {
    expect(invitationConflict({ tenantId: "t1", active: false }, null, "t1", now)).toBe(
      "USER_INACTIVE",
    );
    expect(invitationConflict({ tenantId: "t2", active: false }, null, "t1", now)).toBe(
      "EMAIL_IN_USE",
    );
    expect(invitationConflict({ tenantId: "t1", active: true }, null, "t1", now)).toBe(
      "EMAIL_IN_USE",
    );
  });

  it("permite renovar na mesma instituição ou substituir convite expirado", () => {
    expect(invitationConflict(null, { tenantId: "t1", expiresAt: future }, "t1", now)).toBeNull();
    expect(invitationConflict(null, { tenantId: "t2", expiresAt: past }, "t1", now)).toBeNull();
    expect(invitationConflict(null, null, "t1", now)).toBeNull();
  });
});

describe("invitationInputSchema", () => {
  it("normaliza e-mail e recusa SUPER_ADMIN", () => {
    expect(
      invitationInputSchema.parse({ email: "  Fulano@Escola.EDU.br ", role: "ALUNO" }),
    ).toEqual({
      email: "fulano@escola.edu.br",
      role: "ALUNO",
      expiresInDays: 7,
    });
    expect(invitationInputSchema.safeParse({ email: "a@b.com", role: "SUPER_ADMIN" }).success).toBe(
      false,
    );
  });
});
