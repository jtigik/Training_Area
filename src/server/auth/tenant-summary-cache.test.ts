import { describe, expect, it, vi } from "vitest";

import { createTenantSummaryCache } from "./tenant-summary-cache";

const demo = { id: "t1", name: "Escola Demo", slug: "escola-demo" };

describe("createTenantSummaryCache", () => {
  it("null sem consultar para tenantId nulo (SUPER_ADMIN)", async () => {
    const loader = vi.fn();
    const cache = createTenantSummaryCache(loader);
    expect(await cache.get(null)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
  });

  it("reaproveita dentro do TTL e recarrega depois/invalidado", async () => {
    let clock = 0;
    const loader = vi.fn().mockResolvedValue(demo);
    const cache = createTenantSummaryCache(loader, 1000, () => clock);
    expect(await cache.get("t1")).toEqual(demo);
    clock = 999;
    await cache.get("t1");
    expect(loader).toHaveBeenCalledTimes(1);
    clock = 1001;
    await cache.get("t1");
    expect(loader).toHaveBeenCalledTimes(2);
    cache.invalidate("t1");
    await cache.get("t1");
    expect(loader).toHaveBeenCalledTimes(3);
  });
});
