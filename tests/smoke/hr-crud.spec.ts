import { test, expect } from "@playwright/test";
import { getAccount, login } from "./helpers";

// Uses the "announcements" module (not "departments") because the generic
// module table intentionally hides the delete action for departments to
// protect org-structure integrity — announcements is a simple, self-contained
// module where a full create -> edit -> delete cycle is safe to exercise
// end-to-end against the real database.
test("HR module CRUD cycle (create, edit, delete an announcement)", async ({ page }) => {
  const account = getAccount("HR_MANAGER");
  test.skip(!account, "Set SMOKE_HR_MANAGER_ID / SMOKE_HR_MANAGER_PASSWORD to run this test");

  const marker = `SMOKE_TEST_${Date.now()}`;

  await login(page, account!);
  await page.goto("/announcements");

  await page.locator("#title").fill(marker);
  await page.locator("#body").fill("Created by automated smoke test — safe to ignore/delete.");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/created|success/i)).toBeVisible({ timeout: 10_000 });

  await page.locator('input[type="search"], input[placeholder*="search" i]').first().fill(marker);
  await page.keyboard.press("Enter");
  const row = page.locator("tr", { hasText: marker });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole("link", { name: /open/i }).click();
  await page.waitForURL(/\/announcements\/.+/);
  await page.locator("#body").fill("Updated by automated smoke test.");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/updated|saved|success/i)).toBeVisible({ timeout: 10_000 });

  await page.goto("/announcements");
  await page.locator('input[type="search"], input[placeholder*="search" i]').first().fill(marker);
  await page.keyboard.press("Enter");
  const rowAgain = page.locator("tr", { hasText: marker });
  await rowAgain.getByRole("button", { name: /delete/i }).click();
  await expect(page.locator("tr", { hasText: marker })).toHaveCount(0, { timeout: 10_000 });
});
