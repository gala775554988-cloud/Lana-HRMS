import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../workflows/helpers.mjs";

const { resolveRoleDashboard } = await load("config/auth.ts");
const rbac = await load("lib/rbac.ts", { "@/auth": { auth: async () => null } });
const payroll = await load("lib/enterprise/payroll-permissions.ts", { "@/lib/rbac": rbac });

test("finance roles land in payroll, while HR leadership retains its workspace", () => {
  for (const role of ["PAYROLL_MANAGER", "PAYROLL_OFFICER"]) {
    assert.equal(resolveRoleDashboard([role]), "/payroll");
    assert.equal(resolveRoleDashboard([role], true), "/payroll");
    assert.equal(resolveRoleDashboard([role, "HR_MANAGER"]), "/hr/dashboard");
  }
  assert.equal(resolveRoleDashboard(["EMPLOYEE"]), "/employee/dashboard");
  assert.equal(resolveRoleDashboard(["MANAGER"]), "/manager/dashboard");
  assert.equal(resolveRoleDashboard(["SUPER_ADMIN", "PAYROLL_MANAGER"]), "/dashboard");
});

test("finance operators can prepare payroll but cannot approve it", () => {
  for (const role of ["PAYROLL_MANAGER", "PAYROLL_OFFICER"]) {
    const session = { user: { roles: [role], permissions: ["read:payroll", "manage:payroll"] } };
    assert.equal(payroll.canViewPayroll(session), true);
    assert.equal(payroll.canManagePayroll(session), true);
    assert.equal(payroll.canApprovePayroll(session), false);
  }
  const readOnly = { user: { roles: ["EMPLOYEE"], permissions: ["read:payroll"] } };
  assert.equal(payroll.canViewPayroll(readOnly), true);
  assert.equal(payroll.canManagePayroll(readOnly), false);
});
