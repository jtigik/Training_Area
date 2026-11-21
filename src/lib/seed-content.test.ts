import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("seed", () => {
  it("não cria conteúdo DASHBOARD no MVP", () => {
    const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
    expect(seed).not.toMatch(/DASHBOARD/);
  });

  it("instituição demo com autoJoinByDomain desligado (padrão do MVP)", () => {
    const seed = readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf8");
    expect(seed).toMatch(/autoJoinByDomain: false/);
    expect(seed).not.toMatch(/autoJoinByDomain: true/);
  });

  it("schema: autoJoinByDomain com default false", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/autoJoinByDomain\s+Boolean\s+@default\(false\)/);
  });
});
