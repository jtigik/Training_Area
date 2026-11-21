import { randomId, type IdGenerator, type TenantId } from "@/server/domain";

import type {
  AttemptFilter,
  AttemptRecord,
  AttemptRepository,
  ExerciseFilter,
  ExerciseRecord,
  ExerciseRepository,
  ExerciseSetRecord,
  ExerciseSetRepository,
} from "./types";

/** In-memory repositories (tests / local mocks). Always scoped by tenantId. */

export class InMemoryExerciseSetRepository implements ExerciseSetRepository {
  constructor(private readonly items: ExerciseSetRecord[] = []) {}
  add(set: ExerciseSetRecord): void {
    this.items.push(set);
  }
  async findById(tenantId: TenantId, id: string) {
    return this.items.find((s) => s.tenantId === tenantId && s.id === id) ?? null;
  }
}

export class InMemoryExerciseRepository implements ExerciseRepository {
  private readonly items = new Map<string, ExerciseRecord>();
  constructor(
    private readonly newId: IdGenerator = randomId,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    tenantId: TenantId,
    data: Omit<ExerciseRecord, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ) {
    const at = this.now();
    const rec: ExerciseRecord = structuredClone({
      ...data,
      id: this.newId(),
      tenantId,
      createdAt: at,
      updatedAt: at,
    });
    this.items.set(rec.id, rec);
    return structuredClone(rec);
  }

  async update(
    tenantId: TenantId,
    id: string,
    patch: Partial<Omit<ExerciseRecord, "id" | "tenantId" | "createdAt">>,
  ) {
    const cur = this.items.get(id);
    if (!cur || cur.tenantId !== tenantId) return null;
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next: ExerciseRecord = structuredClone({
      ...cur,
      ...defined,
      updatedAt: patch.updatedAt ?? this.now(),
    });
    this.items.set(id, next);
    return structuredClone(next);
  }

  async findById(tenantId: TenantId, id: string) {
    const cur = this.items.get(id);
    return cur && cur.tenantId === tenantId ? structuredClone(cur) : null;
  }

  async list(tenantId: TenantId, f: ExerciseFilter) {
    return [...this.items.values()]
      .filter(
        (e) =>
          e.tenantId === tenantId &&
          (f.setId === undefined || e.setId === f.setId) &&
          (f.level === undefined || e.level === f.level) &&
          (f.difficulty === undefined || e.difficulty === f.difficulty) &&
          (f.status === undefined || e.status === f.status),
      )
      .map((e) => structuredClone(e));
  }
}

function matchAttempt(a: AttemptRecord, tenantId: TenantId, f: AttemptFilter): boolean {
  return (
    a.tenantId === tenantId &&
    (f.setId === undefined || a.setId === f.setId) &&
    (f.studentId === undefined || a.studentId === f.studentId) &&
    (f.studentIds === undefined || f.studentIds.includes(a.studentId)) &&
    (f.exerciseId === undefined || a.exerciseId === f.exerciseId) &&
    (f.level === undefined || a.level === f.level) &&
    (f.difficulty === undefined || a.difficulty === f.difficulty) &&
    (f.levelCycle === undefined || a.levelCycle === f.levelCycle) &&
    (f.from === undefined || a.createdAt >= f.from) &&
    (f.to === undefined || a.createdAt < f.to)
  );
}

export class InMemoryAttemptRepository implements AttemptRepository {
  readonly items: AttemptRecord[] = [];
  constructor(private readonly newId: IdGenerator = randomId) {}

  async create(tenantId: TenantId, data: Omit<AttemptRecord, "id" | "tenantId">) {
    const rec: AttemptRecord = structuredClone({ ...data, id: this.newId(), tenantId });
    this.items.push(rec);
    return structuredClone(rec);
  }

  async list(tenantId: TenantId, f: AttemptFilter) {
    return this.items.filter((a) => matchAttempt(a, tenantId, f)).map((a) => structuredClone(a));
  }

  async count(tenantId: TenantId, f: AttemptFilter) {
    return this.items.filter((a) => matchAttempt(a, tenantId, f)).length;
  }
}
