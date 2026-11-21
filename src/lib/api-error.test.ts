import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError, apiError, isApiErrorBody, validationError } from "./api-error";
import { handleApiError } from "@/server/api-response";
import { TenantScopeError } from "@/server/tenant-scope";

describe("formato de erro { error: { code, message, details? } }", () => {
  it("ApiError/apiError", async () => {
    const res = apiError(409, "LAST_ADMIN", "Último admin");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: "LAST_ADMIN", message: "Último admin" } });
    expect(new ApiError(404, "NOT_FOUND", "x", { id: "1" }).toBody()).toEqual({
      error: { code: "NOT_FOUND", message: "x", details: { id: "1" } },
    });
  });

  it("validationError com details por campo", async () => {
    const parsed = z
      .object({ email: z.email({ error: "E-mail inválido" }) })
      .safeParse({ email: "x" });
    expect(parsed.success).toBe(false);
    const res = validationError(parsed.error!.issues);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([
      expect.objectContaining({ path: "email", message: "E-mail inválido" }),
    ]);
    expect(isApiErrorBody(body)).toBe(true);
    expect(isApiErrorBody({ error: "texto" })).toBe(false);
  });

  it("handleApiError: ApiError, TenantScopeError → 403 SCOPE_DENIED, outros relançados", async () => {
    expect(handleApiError(new ApiError(401, "UNAUTHENTICATED", "Não autenticado")).status).toBe(
      401,
    );
    const scope = handleApiError(new TenantScopeError("x"));
    expect(scope.status).toBe(403);
    expect((await scope.json()).error.code).toBe("SCOPE_DENIED");
    expect(() => handleApiError(new Error("boom"))).toThrow("boom");
  });
});
