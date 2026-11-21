import { expect, test } from "@playwright/test";

test.describe("headers de segurança (TA-033)", () => {
  for (const path of ["/", "/api/health"]) {
    test(`presentes em ${path}`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    });
  }

  test("a home hidrata sem violações de CSP nem erros no console", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(msg.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Training Area" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(problems).toEqual([]);
  });
});
