import { describe, expect, it } from "vitest";

import { GLOBAL_EXERCISES } from "../../../prisma/seed-data";
import { exerciseInputSchema } from "./content";

describe("seed: exercícios globais no formato combinado", () => {
  it.each(GLOBAL_EXERCISES.map((e) => [e.id, e] as const))(
    "%s passa no exerciseInputSchema",
    (_id, e) => {
      const input: Partial<typeof e> = { ...e };
      delete input.id;
      const result = exerciseInputSchema.safeParse(input);
      expect(result.error?.issues ?? []).toEqual([]);
    },
  );
});
