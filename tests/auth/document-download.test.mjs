import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";

async function run(session, employeeId, attachmentId) {
  const lookups = [];
  const { GET } = await load("app/api/employee/[id]/documents/download/[attachmentId]/route.ts", {
    "next/server": { NextResponse: { json: (_body, options) => options } },
    "@/auth": { auth: async () => session },
    "@/lib/enterprise/hierarchy": {
      getAccessProfile: async () => ({ employee: { id: "own" } }),
      canAccessEmployeeId: async () => false,
    },
    "@/lib/enterprise/resource-access": { isEnterpriseResourceAllowed: () => true },
    "@/lib/rbac": { hasPermission: () => false },
    "@/lib/prisma": { prisma: { employeeDocument: { findFirst: async args => { lookups.push(args); return null; } } } },
    "@/lib/integrations/odoo/client": { OdooClient: { fromEnv: () => assert.fail("Unlinked attachment must never reach Odoo") } },
  });
  const result = await GET({}, { params: Promise.resolve({ id: employeeId, attachmentId }) });
  return { status: result.status, lookups };
}

test("document downloads reject unauthenticated and out-of-scope requests before lookup", async () => {
  assert.deepEqual(await run(null, "own", "12"), { status: 401, lookups: [] });
  assert.deepEqual(await run({ user: { id: "reader", permissions: ["manage:documents"] } }, "other", "12"), { status: 404, lookups: [] });
});

test("attachment lookup always binds the employee and never fetches unlinked IDs", async () => {
  for (const id of ["12", "12other"]) {
    const { status, lookups } = await run({ user: { id: "reader" } }, "own", id);
    assert.equal(status, 404);
    assert.equal(lookups[0].where.employeeId, "own");
    assert.equal(lookups[0].where.OR[0].id, id);
    assert.equal(lookups[0].where.OR[1]?.odooAttachmentId, id === "12" ? 12 : undefined);
  }
});
