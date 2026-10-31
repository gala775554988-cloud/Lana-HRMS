import type { Page } from "@playwright/test";

export type SmokeAccount = { identifier: string; password: string };

/** Reads SMOKE_<ROLE>_ID / SMOKE_<ROLE>_PASSWORD from env. Returns null if either is unset. */
export function getAccount(role: string): SmokeAccount | null {
  const identifier = process.env[`SMOKE_${role}_ID`];
  const password = process.env[`SMOKE_${role}_PASSWORD`];
  if (!identifier || !password) return null;
  return { identifier, password };
}

export async function login(page: Page, account: SmokeAccount) {
  await page.goto("/login");
  await page.locator("#identifier").fill(account.identifier);
  await page.locator("#password").fill(account.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}
