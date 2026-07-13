import { test, expect } from "@playwright/test";
import { getAccount, login } from "./helpers";

const roleLandingPage: Record<string, string> = {
  SUPER_ADMIN: "/employees",
  HR_MANAGER: "/employees",
  EMPLOYEE: "/employee/dashboard",
};

for (const [role, landingPath] of Object.entries(roleLandingPage)) {
  test(`${role} dashboard loads without error`, async ({ page }) => {
    const account = getAccount(role);
    test.skip(!account, `Set SMOKE_${role}_ID / SMOKE_${role}_PASSWORD to run this test`);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await login(page, account!);
    await page.waitForURL((url) => url.pathname.startsWith(landingPath), { timeout: 15_000 });

    // No unhandled server/render error surfaced to the page.
    await expect(page.locator("text=Application error")).toHaveCount(0);
    await expect(page.locator("text=500")).toHaveCount(0);
    expect(consoleErrors, `Console errors on ${landingPath}: ${consoleErrors.join("; ")}`).toEqual([]);
  });
}
