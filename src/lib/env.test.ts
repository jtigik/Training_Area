import { afterEach, describe, expect, it, vi } from "vitest";

import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("retorna o valor quando definido", () => {
    vi.stubEnv("TA_TEST_VAR", "abc");
    expect(requireEnv("TA_TEST_VAR")).toBe("abc");
  });

  it("lança erro quando ausente", () => {
    vi.stubEnv("TA_TEST_VAR", "");
    expect(() => requireEnv("TA_TEST_VAR")).toThrow(/TA_TEST_VAR/);
  });
});
