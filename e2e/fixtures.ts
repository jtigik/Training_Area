/**
 * Fixtures da suíte: page objects + navegação autenticada por papel.
 *
 * Uso em um spec:
 *   import { test, expect, asRole } from "../fixtures";
 *   test.describe("...", () => { asRole("aluno"); test("...", async ({ trail }) => {...}) });
 */
import { test as base } from "@playwright/test";

import { AdminSettingsPage, AdminUsersPage } from "./pages/admin-pages";
import { AppShell } from "./pages/app-shell";
import { LoginPage } from "./pages/login-page";
import {
  ExercisePage,
  LevelFeedbackPage,
  StudentContentPage,
  StudentTrailPage,
} from "./pages/student-pages";
import {
  TeacherExerciseEditorPage,
  TeacherResultsPage,
  TeacherSectionsPage,
  TeacherSetPage,
} from "./pages/teacher-pages";
import { authFile, type RoleKey } from "./support/users";

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
};

export const test = base.extend<Pages>({
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
});

export { expect } from "@playwright/test";

/** Usa a sessão salva do papel em todos os testes do describe atual. */
export function asRole(role: RoleKey) {
  test.use({ storageState: authFile(role) });
}

/** Sessão anônima explícita (sem cookies). */
export function asAnonymous() {
  test.use({ storageState: { cookies: [], origins: [] } });
}
