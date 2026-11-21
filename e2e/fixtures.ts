/**
 * Fixtures da suíte: page objects + navegação autenticada por papel.
 *
 * Uso em um spec:
 *   import { test, expect, asRole } from "../fixtures";
 *   test.describe("...", () => { asRole("aluno"); test("...", async ({ trail }) => {...}) });
 */
import { test as base } from "@playwright/test";

import tcIndex from "./data/tc-index.json";

import { AdminSettingsPage, AdminUsersPage, SuperAdminInstitutionsPage } from "./pages/admin-pages";
import { AppShell } from "./pages/app-shell";
import { LoginPage } from "./pages/login-page";
import {
  ExercisePage,
  LevelFeedbackPage,
  StudentContentPage,
  StudentTrailPage,
} from "./pages/student-pages";
import {
  ExerciseBankPage,
  FeedbackReviewPage,
  TeacherExerciseEditorPage,
  TeacherResultsPage,
  TeacherSectionsPage,
  TeacherSetPage,
} from "./pages/teacher-pages";
import { authFile, type SessionKey } from "./support/users";

type Pages = {
  loginPage: LoginPage;
  shell: AppShell;
  trail: StudentTrailPage;
  exercise: ExercisePage;
  levelFeedback: LevelFeedbackPage;
  studentContent: StudentContentPage;
  teacherSet: TeacherSetPage;
  exerciseEditor: TeacherExerciseEditorPage;
  teacherSections: TeacherSectionsPage;
  teacherResults: TeacherResultsPage;
  adminUsers: AdminUsersPage;
  adminSettings: AdminSettingsPage;
  institutions: SuperAdminInstitutionsPage;
  feedbackReview: FeedbackReviewPage;
  exerciseBank: ExerciseBankPage;
};

const TC_INDEX = tcIndex.index as Record<string, string[]>;

/** IDs TC do plano de testes (qa/test_cases.json) para os "[TA-xxx ACn]" do título. */
export function tcIdsFor(title: string): string[] {
  const ids = new Set<string>();
  for (const tag of title.matchAll(/\[([^\]]+)\]/g)) {
    for (const m of tag[1].matchAll(/(TA-\d{3})((?:\s*AC\d)(?:\+AC\d)*)?/g)) {
      const acs = m[2]?.match(/AC\d/g) ?? [];
      for (const ac of acs) (TC_INDEX[`${m[1]} ${ac}`] ?? []).forEach((id) => ids.add(id));
    }
  }
  return [...ids];
}

export const test = base.extend<Pages & { tcAnnotations: void }>({
  // Anota cada teste com os IDs TC correspondentes (aparecem no relatório HTML/JSON).
  tcAnnotations: [
    async ({}, provide, testInfo) => {
      const ids = tcIdsFor(testInfo.title);
      if (ids.length) testInfo.annotations.push({ type: "TC", description: ids.join(", ") });
      await provide();
    },
    { auto: true },
  ],
  loginPage: async ({ page }, provide) => provide(new LoginPage(page)),
  shell: async ({ page }, provide) => provide(new AppShell(page)),
  trail: async ({ page }, provide) => provide(new StudentTrailPage(page)),
  exercise: async ({ page }, provide) => provide(new ExercisePage(page)),
  levelFeedback: async ({ page }, provide) => provide(new LevelFeedbackPage(page)),
  studentContent: async ({ page }, provide) => provide(new StudentContentPage(page)),
  teacherSet: async ({ page }, provide) => provide(new TeacherSetPage(page)),
  exerciseEditor: async ({ page }, provide) => provide(new TeacherExerciseEditorPage(page)),
  teacherSections: async ({ page }, provide) => provide(new TeacherSectionsPage(page)),
  teacherResults: async ({ page }, provide) => provide(new TeacherResultsPage(page)),
  adminUsers: async ({ page }, provide) => provide(new AdminUsersPage(page)),
  adminSettings: async ({ page }, provide) => provide(new AdminSettingsPage(page)),
  institutions: async ({ page }, provide) => provide(new SuperAdminInstitutionsPage(page)),
  feedbackReview: async ({ page }, provide) => provide(new FeedbackReviewPage(page)),
  exerciseBank: async ({ page }, provide) => provide(new ExerciseBankPage(page)),
});

export { expect } from "@playwright/test";

/** Usa a sessão salva (papel/instituição) em todos os testes do describe atual. */
export function asRole(role: SessionKey) {
  test.use({ storageState: authFile(role) });
}

/** Sessão anônima explícita (sem cookies). */
export function asAnonymous() {
  test.use({ storageState: { cookies: [], origins: [] } });
}
