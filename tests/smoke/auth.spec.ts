import { test, expect } from "@playwright/test";
import { getAccount, login } from "./helpers";

test.describe("auth", () => {
  test("employee login starts with only national ID and four suffix digits", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("رقم الهوية", { exact: true })).toBeVisible();
    await expect(page.getByLabel("آخر ٤ أرقام من رقم الهوية", { exact: true })).toHaveAttribute("maxlength", "4");
    await expect(page.locator("#activationCode")).toHaveCount(0);
    await expect(page.locator("form input:not([type=checkbox])")).toHaveCount(2);
    await page.getByRole("button", { name: "دخول المسؤول أو بكلمة مرور مخصصة" }).click();
    await expect(page.getByLabel("اسم المستخدم أو رقم الهوية", { exact: true })).toBeVisible();
    await expect(page.locator("#password")).not.toHaveAttribute("maxlength", "4");
    await page.getByRole("button", { name: "دخول الموظفين برقم الهوية" }).click();
    await expect(page.getByLabel("آخر ٤ أرقام من رقم الهوية", { exact: true })).toBeVisible();
  });

  test("successful identity check moves verification out of the credentials screen", async ({ page }) => {
    await page.goto("/login");
    await page.route("**/login", async route => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        contentType: "text/x-component",
        body: '0:{"a":"$@1","f":"","b":"test"}\n1:{"success":false,"requiresActivation":true,"message":"أكد هويتك"}\n',
      });
    });
    await page.locator("#identifier").fill("1234567890");
    await page.locator("#password").fill("7890");
    await expect(page.getByRole("heading", { name: "تأكيد هويتك" })).toBeVisible();
    await expect(page.locator("#identifier")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    await expect(page.locator("#activationCode")).toBeVisible();
    await page.getByRole("button", { name: "العودة لتعديل رقم الهوية" }).click();
    await expect(page.locator("#identifier")).toBeVisible();
    await expect(page.locator("#activationCode")).toHaveCount(0);
  });

  test("invalid credentials show an error and stay on /login", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "دخول المسؤول أو بكلمة مرور مخصصة" }).click();
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
