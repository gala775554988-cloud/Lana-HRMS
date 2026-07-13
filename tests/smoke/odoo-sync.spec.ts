import { test, expect } from "@playwright/test";

// Does not perform a real Odoo sync (no live Odoo instance in CI/local smoke
// runs). Instead verifies the route's auth boundary — the exact regression
// this suite exists to catch across the security-hardening phases.
test("Odoo departments sync route rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/integrations/odoo/sync/departments", { data: {} });
  expect([401, 403]).toContain(response.status());
});
