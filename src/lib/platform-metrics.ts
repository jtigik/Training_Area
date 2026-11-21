import type { GradeConcept } from "@/lib/domain";
import type { TenantRole } from "@/lib/roles";

/**
 * Métricas AGREGADAS por instituição para o SUPER_ADMIN (decisão do PO: ele só
 * vê números, nunca registros individuais). Montagem pura, testável.
 */
export interface TenantMetrics {
  tenant: { id: string; name: string; slug: string; active: boolean };
  users: Record<TenantRole, number> & { total: number };
  levelAttempts: { total: number; inProgress: number; completed: number; abandoned: number };
  /** Distribuição do conceito FINAL das tentativas concluídas. */
  concepts: Record<GradeConcept, number>;
}

export interface PlatformMetrics {
  generatedAt: string;
  totals: Omit<TenantMetrics, "tenant"> & { tenants: number; activeTenants: number };
  tenants: TenantMetrics[];
}

type Row<K extends string> = { tenantId: string | null; _count: { _all: number } } & Record<
  K,
  string | null
>;

const emptyUsers = () => ({ INSTITUTION_ADMIN: 0, PROFESSOR: 0, ALUNO: 0, total: 0 });
const emptyAttempts = () => ({ total: 0, inProgress: 0, completed: 0, abandoned: 0 });
const emptyConcepts = () => ({ ND: 0, ED: 0, D: 0, PD: 0 });
const STATUS_KEY = {
  IN_PROGRESS: "inProgress",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;

export function buildPlatformMetrics(
  tenants: readonly TenantMetrics["tenant"][],
  usersByRole: readonly Row<"role">[],
  attemptsByStatus: readonly Row<"status">[],
  conceptsByTenant: readonly Row<"concept">[],
  now: Date = new Date(),
): PlatformMetrics {
  const byId = new Map<string, TenantMetrics>(
    tenants.map((tenant) => [
      tenant.id,
      { tenant, users: emptyUsers(), levelAttempts: emptyAttempts(), concepts: emptyConcepts() },
    ]),
  );
  for (const r of usersByRole) {
    const m = r.tenantId ? byId.get(r.tenantId) : undefined;
    if (!m || !r.role || !(r.role in m.users) || r.role === "total") continue;
    m.users[r.role as TenantRole] += r._count._all;
    m.users.total += r._count._all;
  }
  for (const r of attemptsByStatus) {
    const m = r.tenantId ? byId.get(r.tenantId) : undefined;
    const key = r.status ? STATUS_KEY[r.status as keyof typeof STATUS_KEY] : undefined;
    if (!m || !key) continue;
    m.levelAttempts[key] += r._count._all;
    m.levelAttempts.total += r._count._all;
  }
  for (const r of conceptsByTenant) {
    const m = r.tenantId ? byId.get(r.tenantId) : undefined;
    if (!m || !r.concept || !(r.concept in m.concepts)) continue;
    m.concepts[r.concept as GradeConcept] += r._count._all;
  }

  const list = [...byId.values()];
  const totals = {
    tenants: list.length,
    activeTenants: list.filter((m) => m.tenant.active).length,
    users: emptyUsers(),
    levelAttempts: emptyAttempts(),
    concepts: emptyConcepts(),
  };
  for (const m of list) {
    for (const k of Object.keys(totals.users) as (keyof typeof totals.users)[])
      totals.users[k] += m.users[k];
    for (const k of Object.keys(totals.levelAttempts) as (keyof typeof totals.levelAttempts)[])
      totals.levelAttempts[k] += m.levelAttempts[k];
    for (const k of Object.keys(totals.concepts) as GradeConcept[])
      totals.concepts[k] += m.concepts[k];
  }
  return { generatedAt: now.toISOString(), totals, tenants: list };
}
