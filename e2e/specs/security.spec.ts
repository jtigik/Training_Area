/**
 * E8 — Proteções básicas (TA-033 AC2): headers de segurança nas respostas.
 */
import { expect, test } from "@playwright/test";

import { API } from "../support/routes";

test.describe("Headers de segurança [TA-033]", () => {
  test("[TA-033 AC2] não expõe X-Powered-By", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  // Ainda não configurados no scaffold (next.config.ts sem `headers()`/proxy).
  test.fixme("[TA-033 AC2] página e API enviam headers de segurança básicos", async ({
    request,
  }) => {
    for (const path of ["/", API.health]) {
      const headers = (await request.get(path)).headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBeTruthy();
      expect(headers["x-frame-options"] ?? headers["content-security-policy"]).toBeTruthy();
    }
  });
});
