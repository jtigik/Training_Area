import type { TenantId } from "@/server/domain";

import type {
  FeedbackReviewRecord,
  FeedbackReviewRepository,
  FeedbackTemplateRepository,
  ReviewFilter,
  ReviewKey,
} from "./review";
import type { FeedbackTemplateRecord } from "./templates";

export class InMemoryFeedbackReviewRepository implements FeedbackReviewRepository {
  readonly items = new Map<string, FeedbackReviewRecord>();

  async create(tenantId: TenantId, record: FeedbackReviewRecord) {
    if (record.tenantId !== tenantId) throw new Error("tenant mismatch");
    this.items.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async findById(tenantId: TenantId, id: string) {
    const r = this.items.get(id);
    return r && r.tenantId === tenantId ? structuredClone(r) : null;
  }

  async findByKey(tenantId: TenantId, k: ReviewKey) {
    for (const r of this.items.values()) {
      if (
        r.tenantId === tenantId &&
        r.studentId === k.studentId &&
        r.setId === k.setId &&
        r.level === k.level &&
        r.levelCycle === k.levelCycle
      ) {
        return structuredClone(r);
      }
    }
    return null;
  }

  async update(tenantId: TenantId, expectedVersion: number, next: FeedbackReviewRecord) {
    const cur = this.items.get(next.id);
    if (!cur || cur.tenantId !== tenantId || cur.version !== expectedVersion) return null;
    this.items.set(next.id, structuredClone(next));
    return structuredClone(next);
  }

  async list(tenantId: TenantId, f: ReviewFilter) {
    const statuses =
      f.status === undefined ? null : Array.isArray(f.status) ? f.status : [f.status];
    return [...this.items.values()]
      .filter(
        (r) =>
          r.tenantId === tenantId &&
          (statuses === null || statuses.includes(r.status)) &&
          (f.setId === undefined || r.setId === f.setId) &&
          (f.level === undefined || r.level === f.level) &&
          (f.studentId === undefined || r.studentId === f.studentId),
      )
      .map((r) => structuredClone(r));
  }
}

export class InMemoryFeedbackTemplateRepository implements FeedbackTemplateRepository {
  constructor(readonly items: FeedbackTemplateRecord[] = []) {}
  async listForSet(tenantId: TenantId, setId: string) {
    return this.items
      .filter((t) => t.tenantId === tenantId && (t.setId === null || t.setId === setId))
      .map((t) => structuredClone(t));
  }
}
