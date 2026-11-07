import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

async function setup(userId = "user") {
  const queries = [];
  const config = await load("lib/employee/request-form-config.ts");
  const route = await load("app/api/self-service/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/auth": { auth: async () => userId ? { user: { id: userId } } : null },
    "@/lib/employee/request-form-config": config,
    "@/lib/prisma": { prisma: {
      employee: { findFirst: async ({ where }) => where.userId === userId ? { id: "own-employee" } : null },
      workflowInstance: {
        findMany: async args => { queries.push(args); return []; },
        count: async args => { queries.push(args); return 0; },
      },
      leaveType: { findMany: async () => [] },
    } },
  });
  return { queries, get: query => route.GET({ url: `https://test.example/api/self-service?${query}` }) };
}

test("list and count use identical session ownership and request filters", async () => {
  const { get, queries } = await setup();
  assert.equal((await get("status=RETURNED&type=LEAVE&page=2&employeeId=other")).status, 200);
  assert.equal(queries[0].where, queries[1].where);
  assert.equal(queries[0].where.employeeId, "own-employee");
  assert.equal(queries[0].where.status, "RETURNED");
  assert.equal(queries[0].where.type, "LEAVE");
  assert.equal(queries[0].skip, 20);
});

test("invalid filters and anonymous callers cannot query the workflow list", async () => {
  const authenticated = await setup();
  assert.equal((await authenticated.get("status=SUPERSEDED")).status, 400);
  assert.equal((await authenticated.get("type=unknown")).status, 400);
  assert.equal(authenticated.queries.length, 0);
  const anonymous = await setup(null);
  assert.equal((await anonymous.get("status=PENDING")).status, 401);
  assert.equal(anonymous.queries.length, 0);
});
