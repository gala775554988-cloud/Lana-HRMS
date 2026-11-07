import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";

test("assets sync rejects anonymous, unprivileged and ambiguous connections before importing", async () => {
  let user = null;
  let calls = 0;
  let connections = [];
  const { POST } = await load("app/api/enterprise/assets/sync/route.ts", {
    "@/lib/integrations/access": { canManageIntegration: user => user.roles.includes("SUPER_ADMIN") },
    "next/server": { NextResponse: { json: (_body, options) => options?.status ?? 200 } },
    "@/auth": { auth: async () => user ? { user } : null },
    "@/lib/prisma": { prisma: {
      integrationConnection: { findMany: async () => connections },
      integrationMapping: { findMany: async () => [{ id: "asset-mapping" }] },
    } },
    "@/lib/integrations/service": { syncMapping: async (connection, mapping, direction) => {
      assert.equal(connection, "odoo-connection");
      assert.equal(mapping, "asset-mapping");
      assert.equal(direction, "ODOO_TO_HRMS");
      calls++;
      return { createdCount: 1, updatedCount: 2, pulled: 3 };
    } },
  });
  assert.equal(await POST(), 401);
  user = { id: "employee", roles: ["EMPLOYEE"] };
  assert.equal(await POST(), 403);
  user = { id: "admin", roles: ["SUPER_ADMIN"] };
  assert.equal(await POST(), 409);
  connections = [{ id: "one" }, { id: "two" }];
  assert.equal(await POST(), 409);
  assert.equal(calls, 0);
  connections = [{ id: "odoo-connection", providerId: "provider" }];
  assert.equal(await POST(), 200);
  assert.equal(calls, 1);
});
