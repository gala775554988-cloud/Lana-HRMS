import { test, expect, type Page } from "@playwright/test";
import { getAccount, type SmokeAccount } from "./helpers";

/**
 * Full end-to-end flow: login -> main dashboard -> automated navigation
 * across the primary sidebar sections -> verification that each page's
 * core UI (tables/lists) renders with no errors.
 */
const ADMIN_ROLES = ["SUPER_ADMIN", "HR_MANAGER"] as const;

function getAnyAdminAccount(): {
  role: string;
  account: SmokeAccount;
} | null {
  for (const role of ADMIN_ROLES) {
    const account = getAccount(role);

    if (account) {
      return { role, account };
    }
  }

  return null;
}

/**
 * Attaches console/page-error listeners and returns the running list of
 * messages captured so far. Call expectNoRenderErrors() after each
 * navigation to assert against it.
 */
function trackPageHealth(page: Page): string[] {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  return errors;
}

const BENIGN_NETWORK_NOISE =
  /ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|Failed to fetch\b/i;

async function expectNoRenderErrors(
  page: Page,
  errors: string[],
  context: string
) {
  await expect(
    page.getByText("اعتراف النظام بالخطأ التقني المباشر")
  ).toHaveCount(0);

  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);

  const realErrors = errors.filter(
    (error) => !BENIGN_NETWORK_NOISE.test(error)
  );

  expect(
    realErrors,
    `Unexpected console/page errors on ${context}:\n${realErrors.join("\n")}`
  ).toEqual([]);
}

async function gotoWithRetry(
  page: Page,
  path: string,
  attempt = 1
): Promise<void> {
  try {
    await page.goto(path, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => {});
  } catch (error) {
    if (attempt >= 2) {
      throw error;
    }

    await gotoWithRetry(page, path, attempt + 1);
  }
}

test.describe("HRMS end-to-end flow", () => {
  test.setTimeout(240_000);

  test(
    "login, land on the dashboard, navigate the main sections, tables render clean",
    async ({ page }) => {
      const found = getAnyAdminAccount();

      test.skip(
        !found,
        "Set SMOKE_SUPER_ADMIN_ID/PASSWORD or SMOKE_HR_MANAGER_ID/PASSWORD in tests/smoke/.env.smoke to run this test"
      );

      const { account } = found!;
      const errors = trackPageHealth(page);

      await test.step("Go to /login and submit credentials", async () => {
        await page.goto("/login");

        await expect(page.locator("#identifier")).toBeVisible({
          timeout: 15_000,
        });

        await page.locator("#identifier").fill(account.identifier);
        await page.locator("#password").fill(account.password);
        await page.locator('button[type="submit"]').click();
      });

      await test.step(
        "Verify redirect away from /login, then land on /dashboard",
        async () => {
          await page.waitForURL(
            (url) => !url.pathname.startsWith("/login"),
            { timeout: 20_000 }
          );

          await gotoWithRetry(page, "/dashboard");

          await expect(
            page.getByRole("heading", { level: 1 })
          ).toBeVisible({
            timeout: 20_000,
          });

          await expectNoRenderErrors(page, errors, "/dashboard");
        }
      );

      const sections: Array<{ path: string; label: string }> = [
        { path: "/employees", label: "قسم الموظفين" },
        { path: "/attendance", label: "سجلات الحضور" },
        { path: "/request-center", label: "إدارة الطلبات" },
      ];

      for (const section of sections) {
        await test.step(
          `Navigate to ${section.label} (${section.path}) and verify its UI renders`,
          async () => {
            await gotoWithRetry(page, section.path);

            await expect
              .poll(
                async () =>
                  page
                    .locator(
                      "table, [role='table'], [role='grid'], [class*='card' i]"
                    )
                    .count(),
                {
                  message: `Expected at least one table/grid/card to render on ${section.path}`,
                  timeout: 20_000,
                }
              )
              .toBeGreaterThan(0);

            await expectNoRenderErrors(page, errors, section.path);
          }
        );
      }
    }
  );
});
