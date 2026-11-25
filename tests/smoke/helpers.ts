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
  // /login redirects to /#sign-in before credentials are submitted.
  // Landing on "/" is not proof of authentication.
  await page.goto("/login",{waitUntil:"domcontentloaded",timeout:30_000});
  const form=page.locator("form").filter({has:page.locator("#identifier")});
  await form.locator("#identifier").fill(account.identifier,{timeout:15_000});
  await form.locator("#password").fill(account.password,{timeout:15_000});
  await Promise.all([
    page.waitForURL(url=>url.pathname!=="/"&&!url.pathname.startsWith("/login"),{waitUntil:"domcontentloaded",timeout:30_000}),
    form.locator('button[type="submit"]').click({timeout:15_000}),
  ]);
}
