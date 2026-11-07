import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

test("annual leave reservation reduces available days once across approval and cancellation", async () => {
  let used = 4;
  let pending = 3;
  const tx = {
    employeeLeaveBalance: { findUnique: async () => ({ accrued: 20, used }) },
    leaveRequest: { aggregate: async ({ where }) => {
      assert.equal(where.employeeId, "employee");
      assert.equal(where.status, "PENDING");
      assert.equal(where.leaveType.code.startsWith, "ANNUAL");
      return { _sum: { days: pending } };
    } },
  };
  const { getAvailableLeaveBalance } = await load("lib/employee/leave-balance.ts", {
    "@/lib/prisma": { prisma: { $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, "RepeatableRead");
      return callback(tx);
    } } },
  });
  assert.equal((await getAvailableLeaveBalance("employee")).available, 13);
  pending = 0;
  used = 7;
  assert.equal((await getAvailableLeaveBalance("employee")).available, 13);
  used = 4;
  assert.equal((await getAvailableLeaveBalance("employee")).available, 16);
});
