import type { TenantRole } from "@/lib/roles";

/**
 * Vínculo de um NOVO usuário (primeiro login Google/Microsoft) a uma
 * instituição. Ordem:
 *  1. convite pendente e não expirado para o e-mail (mais recente) → tenant + papel do convite;
 *  2. instituição ativa com autoJoinByDomain e domínio do e-mail → ALUNO;
 *  3. nenhum → cadastro recusado (não existe usuário "solto").
 * Função pura; a busca no banco fica em auth.ts.
 */
export interface PendingInvitation {
  id: string;
  tenantId: string;
  role: TenantRole;
  expiresAt: Date;
  createdAt: Date;
}

export interface DomainTenant {
  id: string;
  emailDomains: readonly string[];
}

export type ProvisioningDecision = {
  tenantId: string;
  role: TenantRole;
  invitationId: string | null;
} | null;

export function emailDomain(email: string): string {
  return email
    .slice(email.lastIndexOf("@") + 1)
    .trim()
    .toLowerCase();
}

export function decideProvisioning(
  email: string,
  invitations: readonly PendingInvitation[],
  domainTenants: readonly DomainTenant[],
  now: Date = new Date(),
): ProvisioningDecision {
  const invitation = invitations
    .filter((i) => i.expiresAt > now)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (invitation) {
    return { tenantId: invitation.tenantId, role: invitation.role, invitationId: invitation.id };
  }

  const domain = emailDomain(email);
  const matches = domainTenants.filter((t) =>
    t.emailDomains.some((d) => d.trim().toLowerCase() === domain),
  );
  // Domínio ambíguo (mais de uma instituição) exige convite.
  if (matches.length === 1) {
    return { tenantId: matches[0]!.id, role: "ALUNO", invitationId: null };
  }
  return null;
}
