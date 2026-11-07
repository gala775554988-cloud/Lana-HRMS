import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { load } from "../workflows/helpers.mjs";

async function setup() {
  const mutations = [];
  const tx = {
    employeeSalaryAdvance: {
      updateMany: async input => { mutations.push(input); return { count: 0 }; },
      deleteMany: async input => { mutations.push(input); return { count: 0 }; },
    },
  };
  const route = await load("app/api/employee/advances/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    zod: { z },
    "@/lib/employee/portal": { asNumber: Number, requireEmployee: async () => ({ employee: { id: "owner" }, session: { user: { id: "user" } } }) },
    "@/lib/prisma": { prisma: {
      employeeSalaryAdvance: { findFirst: async () => ({ amount: 100, installments: 2, updatedAt: new Date(0) }) },
      $transaction: async action => action(tx),
    } },
  });
  return { route, mutations };
}

test("employees cannot submit or edit approval fields", async () => {
  const { route, mutations } = await setup();
  const payload = { amount: "100.50", installments: "2", reason: "Test request", financeStatus: "APPROVED" };
  assert.equal((await route.POST({ json: async () => payload })).status, 400);
  assert.equal((await route.PUT({ json: async () => ({ id: "advance", ...payload }) })).status, 400);
  assert.equal(mutations.length, 0);
});

test("employee edits and deletes compare ownership and unreviewed state atomically", async () => {
  const { route, mutations } = await setup();
  assert.equal((await route.PUT({ json: async () => ({ id: "advance", installments: "4" }) })).status, 409);
  assert.equal((await route.DELETE({ nextUrl: new URL("http://test/?id=advance") })).status, 409);
  for (const { where } of mutations) {
    assert.equal(where.employeeId, "owner");
    assert.equal(where.status, "PENDING_MANAGER");
    for (const stage of ["managerStatus", "hrStatus", "financeStatus"]) assert.equal(where[stage], "PENDING");
  }
  assert.equal(mutations[0].where.updatedAt.getTime(), 0);
  assert.equal(mutations[0].data.monthlyDeduction, 25);
});
