import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";

test("asset import uses the configured Odoo resolver and validates access before connecting", async () => {
  let user = null;
  const resolved = [];
  let imports = 0;
  const { POST } = await load("app/api/enterprise/assets/sync/route.ts", {
    "next/server": { NextResponse: { json: (_body, options) => options?.status ?? 200 } },
    "next/cache": { revalidatePath: () => {} },
    "@/auth": { auth: async () => user ? { user } : null },
    "@/lib/integrations/access": { canManageIntegration: user => user.roles.includes("SUPER_ADMIN") },
    "@/lib/prisma": { prisma: { auditLog: { create: async () => ({}) } } },
    "@/lib/payroll/connection": { getPayrollOdooClient: async id => {
      resolved.push(id);
      return { client: { getConfig: () => ({ url: "https://test.example", database: "fixture" }) } };
    } },
    "@/lib/payroll/odoo-payroll": { odooPayrollSource: () => "fixture-source" },
    "@/lib/integrations/odoo/custodies": { importOdooCustodies: async (_client, source) => {
      assert.equal(source, "fixture-source");
      imports++;
      return { createdCount: 1, updatedCount: 2 };
    } },
  });
  const post = body => POST({ json: async () => body });
  assert.equal(await post({}), 401);
  user = { id: "employee", roles: ["EMPLOYEE"] };
  assert.equal(await post({}), 403);
  assert.equal(resolved.length, 0);
  user = { id: "admin", roles: ["SUPER_ADMIN"] };
  assert.equal(await post({ connectionId: { invalid: true } }), 400);
  assert.equal(await post({}), 200);
  assert.equal(resolved[0], undefined);
  assert.equal(await post({ connectionId: "selected-connection" }), 200);
  assert.equal(resolved[1], "selected-connection");
  assert.equal(imports, 2);
});
