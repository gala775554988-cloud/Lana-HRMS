import { test, expect } from "@playwright/test";
import { getAccount, login } from "./helpers";

test.describe("auth", () => {
  test("invalid credentials show an error and stay on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#identifier").fill("does-not-exist");
    await page.locator("#password").fill("wrong-password");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("valid login redirects away from /login", async ({ page }) => {
    const account = getAccount("EMPLOYEE");
    test.skip(!account, "Set SMOKE_EMPLOYEE_ID / SMOKE_EMPLOYEE_PASSWORD to run this test");
    await login(page, account!);
    expect(page.url()).not.toContain("/login");
  });

  test("logout redirects back to /login", async ({ page }) => {
    const account = getAccount("EMPLOYEE");
    test.skip(!account, "Set SMOKE_EMPLOYEE_ID / SMOKE_EMPLOYEE_PASSWORD to run this test");
    await login(page, account!);
    await page.goto("/logout");
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 15_000 });
  });
});
