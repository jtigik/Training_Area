import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("seed", () => {
  it("não cria conteúdo DASHBOARD no MVP", () => {
    const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
    expect(seed).not.toMatch(/DASHBOARD/);
  });
});
