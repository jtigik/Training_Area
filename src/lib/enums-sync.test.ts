import { describe, expect, it } from "vitest";

import * as prismaEnums from "@/generated/prisma/enums";

import {
  DIFFICULTIES,
  FEEDBACK_STATUSES,
  GRADE_CONCEPTS,
  KNOWLEDGE_LEVELS,
  LEVEL_ATTEMPT_STATUSES,
  PUBLICATION_STATUSES,
} from "./domain";
import { ROLES } from "./roles";

describe("enums puros espelham o schema Prisma", () => {
  it.each([
    ["Role", ROLES],
    ["KnowledgeLevel", KNOWLEDGE_LEVELS],
    ["Difficulty", DIFFICULTIES],
    ["PublicationStatus", PUBLICATION_STATUSES],
    ["GradeConcept", GRADE_CONCEPTS],
    ["LevelAttemptStatus", LEVEL_ATTEMPT_STATUSES],
    ["FeedbackStatus", FEEDBACK_STATUSES],
  ] as const)("%s", (name, values) => {
    expect(Object.values(prismaEnums[name])).toEqual([...values]);
  });
});
