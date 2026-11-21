/**
 * Regras puras de escopo por tenant usadas pela extensão Prisma
 * (src/server/tenant-db.ts). Separado para ser testável sem banco.
 *
 * Classes de modelo:
 *  - TENANT: tenantId obrigatório. Leitura/escrita só do próprio tenant;
 *    create injeta tenantId.
 *  - TENANT_OR_GLOBAL (Exercise, ContentSection): leitura do tenant + globais
 *    (tenantId nulo); escrita SÓ do próprio tenant (globais só pelo cliente base,
 *    pelo SUPER_ADMIN). create injeta tenantId e isGlobal = false.
 *  - TENANT_SELF (Tenant): só o próprio registro, somente leitura.
 *  - Modelos de autenticação (Session, Account, Verification): bloqueados.
 *
 * Acesso "platform" (SUPER_ADMIN dentro de uma instituição — decisão do PO):
 * NUNCA lê registros individuais (alunos, tentativas, feedbacks, PII), nem por
 * count/aggregate. Só o que está em PLATFORM_ALLOWED; números agregados vêm de
 * src/server/platform/metrics.ts.
 */
export type ScopeKind = "tenant" | "tenant-or-global" | "tenant-self" | "blocked";

export const MODEL_SCOPES = {
  Tenant: "tenant-self",
  User: "tenant",
  Session: "blocked",
  Account: "blocked",
  Verification: "blocked",
  Invitation: "tenant",
  Classroom: "tenant",
  ClassroomMember: "tenant",
  ContentSection: "tenant-or-global",
  Exercise: "tenant-or-global",
  ExerciseSet: "tenant",
  Level: "tenant",
  ExerciseQuota: "tenant",
  LevelAttempt: "tenant",
  TenantGradingConfig: "tenant",
  ConceptOverride: "tenant",
  ExerciseAttempt: "tenant",
  Feedback: "tenant",
  SetExercise: "tenant",
  LevelAttemptExercise: "tenant",
  ExerciseImport: "tenant",
  AuditLog: "tenant",
  PlatformGradingDefaults: "blocked",
} as const satisfies Record<string, ScopeKind>;

export type ScopedModel = keyof typeof MODEL_SCOPES;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

export type TenantAccess = "member" | "platform";

/** O que o SUPER_ADMIN pode fazer no escopo de uma instituição (o resto: TenantScopeError). */
export const PLATFORM_ALLOWED: Readonly<Partial<Record<ScopedModel, readonly string[] | "all">>> = {
  Tenant: ["findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow"],
  TenantGradingConfig: "all", // configuração da instituição, sem dados pessoais
  Invitation: ["create"], // convidar o primeiro INSTITUTION_ADMIN
};

const READ_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);
const WHERE_WRITE_OPS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Args = Record<string, unknown> & { where?: Record<string, unknown> };

function andWhere(where: unknown, scope: Record<string, unknown>): Record<string, unknown> {
  const base = (where ?? {}) as Record<string, unknown>;
  const existingAnd = base.AND === undefined ? [] : Array.isArray(base.AND) ? base.AND : [base.AND];
  // Mantém os campos únicos no nível de cima (findUnique/update/delete exigem).
  return { ...base, AND: [...existingAnd, scope] };
}

function stampData(model: ScopedModel, data: unknown, tenantId: string): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TenantScopeError(`Dados inválidos para ${model}`);
  }
  const record = data as Record<string, unknown>;
  if ("tenant" in record) {
    throw new TenantScopeError(
      `Use tenantId (não a relação tenant) em ${model}; o escopo injeta o tenant`,
    );
  }
  if (record.tenantId !== undefined && record.tenantId !== tenantId) {
    throw new TenantScopeError(`Tentativa de gravar ${model} em outro tenant`);
  }
  const stamped: Record<string, unknown> = { ...record, tenantId };
  if (MODEL_SCOPES[model] === "tenant-or-global") {
    if (record.isGlobal === true)
      throw new TenantScopeError(`Registros globais de ${model} só pelo cliente base`);
    stamped.isGlobal = false;
  }
  return stamped;
}

function checkUpdateData(model: ScopedModel, data: unknown, tenantId: string): void {
  if (!data || typeof data !== "object") return;
  const record = data as Record<string, unknown>;
  if ("tenant" in record) throw new TenantScopeError(`Não é permitido trocar o tenant de ${model}`);
  if (record.tenantId !== undefined && record.tenantId !== tenantId) {
    throw new TenantScopeError(`Não é permitido mover ${model} para outro tenant`);
  }
  if (
    MODEL_SCOPES[model] === "tenant-or-global" &&
    record.isGlobal !== undefined &&
    record.isGlobal !== false
  ) {
    throw new TenantScopeError(`Não é permitido tornar ${model} global pelo escopo de tenant`);
  }
}

/** Reescreve os argumentos de uma operação Prisma para o tenant informado. */
export function scopeArgs(
  model: string,
  operation: string,
  args: Args | undefined,
  tenantId: string,
  access: TenantAccess = "member",
): Args {
  if (!tenantId) throw new TenantScopeError("tenantId obrigatório");
  if (access === "platform") {
    const allowed = PLATFORM_ALLOWED[model as ScopedModel];
    if (!allowed || (allowed !== "all" && !allowed.includes(operation))) {
      throw new TenantScopeError(
        `SUPER_ADMIN não acessa registros individuais da instituição (${model}.${operation}); use as métricas agregadas`,
      );
    }
  }
  const kind = (MODEL_SCOPES as Record<string, ScopeKind | undefined>)[model];
  if (!kind) throw new TenantScopeError(`Modelo sem regra de escopo: ${model}`);
  if (kind === "blocked")
    throw new TenantScopeError(`${model} não é acessível pelo cliente com escopo de tenant`);

  const a: Args = { ...(args ?? {}) };

  if (kind === "tenant-self") {
    if (!READ_OPS.has(operation))
      throw new TenantScopeError(`${model} é somente leitura no escopo de tenant`);
    a.where = andWhere(a.where, { id: tenantId });
    return a;
  }

  const readScope =
    kind === "tenant-or-global" ? { OR: [{ tenantId }, { tenantId: null }] } : { tenantId };
  const writeScope = { tenantId };

  if (READ_OPS.has(operation)) {
    a.where = andWhere(a.where, readScope);
    return a;
  }
  if (WHERE_WRITE_OPS.has(operation)) {
    a.where = andWhere(a.where, writeScope);
    if (operation.startsWith("update")) checkUpdateData(model as ScopedModel, a.data, tenantId);
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = Array.isArray(a.data)
      ? a.data.map((d) => stampData(model as ScopedModel, d, tenantId))
      : stampData(model as ScopedModel, a.data, tenantId);
    return a;
  }
  if (operation === "upsert") {
    a.where = andWhere(a.where, writeScope);
    a.create = stampData(model as ScopedModel, a.create, tenantId);
    checkUpdateData(model as ScopedModel, a.update, tenantId);
    return a;
  }
  throw new TenantScopeError(`Operação não suportada no escopo de tenant: ${model}.${operation}`);
}
