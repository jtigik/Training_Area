import { defineConfig, devices } from "@playwright/test";

import { E2E_BASE_URL, E2E_PORT, SKIP_DB, e2eDatabaseUrl } from "./e2e/support/env";

// Porta padrão 3100 (a 3000 costuma estar ocupada pelo `next dev` de outros worktrees).
const PORT = E2E_PORT;
const baseURL = E2E_BASE_URL;
const databaseUrl = SKIP_DB ? undefined : e2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    // Faz login uma vez por papel e salva o storage state em e2e/.auth/<papel>.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /specs\/.*\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  // Na CI usa o build standalone de produção (rode `npm run build` antes); localmente, o dev server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? `PORT=${PORT} npm run start` : `npm run dev -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // O app sobe apontando para o banco isolado da suíte, nunca o de dev.
        env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined,
      },
});
