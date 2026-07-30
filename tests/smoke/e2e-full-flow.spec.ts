import { test, expect, type Page } from "@playwright/test";
import { getAccount, type SmokeAccount } from "./helpers";

/**
 * Full end-to-end flow: login -> main dashboard -> automated navigation
 * across the primary sidebar sections -> verification that each page's
 * core UI (tables/lists) renders with no errors.
 *
 * This app authenticates with a username/national-ID + password (see
 * app/login/login-form.tsx), not an email address -- SMOKE_*_ID below is
 * that identifier, kept under the existing tests/smoke/.env.smoke naming
 * used by the rest of this suite (see helpers.ts).
 *
 * Every wait here is an explicit condition (URL, element visibility, or a
 * polled assertion) with a generous timeout and, where a transient
 * hiccup is plausible (a cold dev/staging server's first compile+render
 * of a route), a bounded retry -- never a fixed sleep -- since this suite
 * runs against the real app on top of the real database and page timing
 * varies run to run.
 */

const ADMIN_ROLES = ["SUPER_ADMIN", "HR_MANAGER"] as const;

function getAnyAdminAccount(): { role: string; account: SmokeAccount } | null {
  for (const role of ADMIN_ROLES) {
    const account = getAccount(role);
    if (account) return { role, account };
  }
  return null;
}

/** Attaches console/page-error listeners and returns the running list of
 * messages captured so far -- call expectNoRenderErrors() after each
 * navigation to assert against it. */
function trackPageHealth(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

// Transient network-layer noise that a real dynamic app's background
// requests (session refresh, notification polling, analytics beacons) can
// legitimately hit without anything actually being broken on the page --
// e.g. a dropped keep-alive connection or a proxy resetting an in-flight
// request. Asserting on these makes the suite flaky for reasons that have
// nothing to do with app correctness, so they're filtered out before the
// "no errors" assertion below. A genuine render/logic error (TypeError,
// React error boundary, hydration crash, etc.) is never matched by this
// and still fails the test.
const BENIGN_NETWORK_NOISE = /ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|Failed to fetch\b/i;

/** Fails if the app's own error boundary (app/(hrms)/error.tsx), a generic
 * Next.js error page, or any captured console/page error (other than known
 * -benign transient network noise, see above) is present. */
async function expectNoRenderErrors(page: Page, errors: string[], context: string) {
  await expect(page.getByText("اعتراف النظام بالخطأ التقني المباشر")).toHaveCount(0);
  await expect(page.getByText("Application error")).toHaveCount(0);
  await expect(page.getByText("Internal Server Error")).toHaveCount(0);

  const realErrors = errors.filter((e) => !BENIGN_NETWORK_NOISE.test(e));
  expect(realErrors, `Unexpected console/page errors on ${context}:\n${realErrors.join("\n")}`).toEqual([]);
}

/** Navigates to `path` and waits for it to settle. Retries once on a
 * timeout so a one-off slow first compile on a dev server doesn't fail the
 * whole run -- a real, repeated failure still surfaces on the 2nd attempt. */
async function gotoWithRetry(page: Page, path: string, attempt = 1): Promise<void> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Best-effort settle for client-side data fetching; some HRMS pages
    // keep a long-lived connection open (notifications polling, SSE), so
    // this must never itself fail the test -- the caller's own
    // element/table visibility wait below is the real assertion.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  } catch (err) {
    if (attempt >= 2) throw err;
    await gotoWithRetry(page, path, attempt + 1);
  }
}

test.describe("HRMS end-to-end flow", () => {
  // Real DB-backed pages across multiple navigations need more headroom
  // than the suite's 30s default (tests/smoke/playwright.config.ts) --
  // especially against a dev server, where each route's first visit pays
  // its own on-demand compile on top of the page's own data fetching.
  test.setTimeout(240_000);

  test("login, land on the dashboard, navigate the main sections, tables render clean", async ({ page }) => {
    const found = getAnyAdminAccount();
    test.skip(!found, "Set SMOKE_SUPER_ADMIN_ID/PASSWORD or SMOKE_HR_MANAGER_ID/PASSWORD in tests/smoke/.env.smoke to run this test");
    const { account } = found!;

    const errors = trackPageHealth(page);

    // 1. Login page: enter credentials (identifier + password)
    await test.step("Go to /login and submit credentials", async () => {
      await page.goto("/login");
      await expect(page.locator("#identifier")).toBeVisible({ timeout: 15_000 });
      await page.locator("#identifier").fill(account.identifier);
      await page.locator("#password").fill(account.password);
      await page.locator('button[type="submit"]').click();
    });

    // 2. Verify successful transition to the main dashboard
    await test.step("Verify redirect away from /login, then land on /dashboard", async () => {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

      // Different roles land on different first pages after login (see
      // dashboards.spec.ts) -- the sidebar's home item always resolves to
      // /dashboard, so navigate there explicitly rather than assume the
      // post-login redirect target is the central dashboard itself.
      await gotoWithRetry(page, "/dashboard");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
      await expectNoRenderErrors(page, errors, "/dashboard");
    });

    // 3. Automated navigation across the main sidebar sections, verifying
    //    4. that each one's data table/list renders correctly with no errors
    const sections: Array<{ path: string; label: string }> = [
      { path: "/employees", label: "قسم الموظفين" },
      { path: "/attendance", label: "سجلات الحضور" },
      { path: "/request-center", label: "إدارة الطلبات" },
    ];

    for (const section of sections) {
      await test.step(`Navigate to ${section.label} (${section.path}) and verify its UI renders`, async () => {
        await gotoWithRetry(page, section.path);

        // Poll instead of a single fixed wait: the first Prisma-backed
        // render of a data table can be slower than the rest on a cold
        // server, so give it repeated chances within the timeout budget
        // rather than one brittle snapshot check.
        await expect
          .poll(
            async () => page.locator("table, [role='table'], [role='grid'], [class*='card' i]").count(),
            {
              message: `Expected at least one table/grid/card to render on ${section.path}`,
              timeout: 20_000,
            }
          )
          .toBeGreaterThan(0);

        await expectNoRenderErrors(page, errors, section.path);
      });
    }
  });
});
