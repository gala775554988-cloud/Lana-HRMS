import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";

test("legacy payslip download uses the employee's latest paid period and rejects empty IDs", async () => {
  const queries = [];
  const rules = await load("lib/payroll/employee-payslips.ts");
  const route = await load("app/api/employee/payslip/route.ts", {
    "next/server": { NextResponse: { json: (_body, options) => options } },
    "@/lib/employee/employee-cache": { getCurrentEmployeeCached: async () => ({ id: "own-employee" }) },
    "@/lib/payroll/employee-payslips": rules,
    "@/lib/prisma": { prisma: { payrollItem: { findFirst: async args => { queries.push(args); return null; } } } },
    "@/lib/pdf/branded-pdf": { buildBrandedPdf: async () => assert.fail("No matching payslip") },
  });
  const get = suffix => route.GET({ url: `https://example.test/api/employee/payslip${suffix}` });
  assert.equal((await get("?id=")).status, 400);
  assert.equal(queries.length, 0);
  assert.equal((await get("")).status, 404);
  assert.equal(queries[0].where.employeeId, "own-employee");
  assert.equal(queries[0].where.payrollRun.paidAt.not, null);
  assert.equal(Array.from(queries[0].where.payrollRun.status.in).join(","), "PAID,LOCKED,ARCHIVED");
  assert.equal(queries[0].orderBy[0].payrollRun.period, "desc");
  await get("?id=selected-slip");
  assert.equal(queries[1].where.id, "selected-slip");
  assert.equal(queries[1].where.employeeId, "own-employee");
});
