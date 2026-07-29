import { test, expect, type Page } from "@playwright/test";
import { getAccount, login } from "./helpers";

const BENIGN_NETWORK_NOISE =
  /ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|Failed to fetch\b/i;

function trackPageHealth(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  return errors;
}

async function expectHealthyPage(page: Page, errors: string[], path: string) {
  await expect(
    page.getByText("اعتراف النظام بالخطأ التقني المباشر")
  ).toHaveCount(0);
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);

  const actionableErrors = errors.filter(
    (error) => !BENIGN_NETWORK_NOISE.test(error)
  );
  expect(
    actionableErrors,
    `Unexpected console/page errors on ${path}:\n${actionableErrors.join("\n")}`
  ).toEqual([]);
}

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
}

test.describe("Employee portal end-to-end flow", () => {
  test.setTimeout(180_000);

  test("employee signs in, views personal portal, attendance, requests, and cannot enter admin HRMS", async ({ page }) => {
    const account = getAccount("EMPLOYEE");
    test.skip(
      !account,
      "Set SMOKE_EMPLOYEE_ID and SMOKE_EMPLOYEE_PASSWORD in tests/smoke/.env.smoke"
    );

    const errors = trackPageHealth(page);

    await test.step("Employee login lands in the employee portal", async () => {
      await login(page, account!);
      await page.waitForURL(/\/employee(?:\/|$)/, { timeout: 20_000 });
      await visit(page, "/employee/dashboard");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
        timeout: 20_000,
      });
      await expectHealthyPage(page, errors, "/employee/dashboard");
    });

    await test.step("Employee can view only their own attendance", async () => {
      await visit(page, "/employee/attendance");
      await expect(
        page.getByRole("heading", { name: "الحضور والانصراف" })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("table")).toBeVisible({ timeout: 20_000 });
      await expectHealthyPage(page, errors, "/employee/attendance");
    });

    await test.step("Employee can open, but does not submit, a leave request", async () => {
      await visit(page, "/employee/leave/new");
      await expect(
        page.getByRole("heading", { name: "طلب إجازة جديد" })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('select[name="leaveType"]')).toBeVisible();
      await expect(page.locator('input[name="startDate"]')).toBeVisible();
      await expect(page.locator('input[name="endDate"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "تقديم الطلب" })).toBeVisible();
      await expectHealthyPage(page, errors, "/employee/leave/new");
    });

    await test.step("Employee is kept out of the admin employee directory", async () => {
      await visit(page, "/employees");
      await page.waitForURL(/\/employee(?:\/|$)/, { timeout: 20_000 });
      await expectHealthyPage(page, errors, "admin access guard");
    });
  });
});
