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

  test("employee with direct HR grants enters the admin shell and retains personal portal access", async ({ page }) => {
    const account = getAccount("EMPLOYEE");
    test.skip(
      !account,
      "Set SMOKE_EMPLOYEE_ID and SMOKE_EMPLOYEE_PASSWORD in tests/smoke/.env.smoke"
    );

    const errors = trackPageHealth(page);

    await test.step("Direct HR grants route the employee into the admin shell", async () => {
      await login(page, account!);
      await page.waitForURL(/\/(?:dashboard|hr\/dashboard|manager\/dashboard)(?:\/|$)/, {
        timeout: 20_000,
      });
      await expect(page.getByRole("link", { name: "الموظفون" })).toBeVisible({
        timeout: 20_000,
      });
      await expectHealthyPage(page, errors, "direct-permission login redirect");
    });

    await test.step("Granted employee can open the permitted HR directory", async () => {
      await visit(page, "/employees");
      await expect(
        page.getByRole("textbox", { name: "بحث بالاسم أو الرقم الوظيفي..." })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: "الفلاتر" })).toBeVisible();
      await expectHealthyPage(page, errors, "/employees");
    });

    await test.step("Employee still retains access to their personal portal", async () => {
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

    await test.step("Granted employee can render the requests workspace", async () => {
      await visit(page, "/request-center");
      await expect(
        page.getByRole("tab", { name: "استقبال الطلبات" })
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("textbox", {
          name: "بحث سريع: الاسم، الرقم، الهوية، القسم، الفرع، المشروع، نوع الطلب",
        })
      ).toBeVisible();
      await expectHealthyPage(page, errors, "/request-center");
    });
  });
});
