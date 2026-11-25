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

test("mixed-role admin users never fall into an unlinked employee portal", () => {
  const cases = [
    [["SUPER_ADMIN", "EMPLOYEE"], "/dashboard"],
    [["EMPLOYEE", "HR_MANAGER"], "/hr/dashboard"],
    [["EMPLOYEE", "HR"], "/hr/dashboard"],
    [["EMPLOYEE", "RECRUITER"], "/hr/dashboard"],
    [["EMPLOYEE", "MANAGER"], "/manager/dashboard"],
    [["EMPLOYEE", "DEPARTMENT_MANAGER"], "/manager/dashboard"],
    [["EMPLOYEE", "BRANCH_MANAGER"], "/manager/dashboard"],
    [["EMPLOYEE", "SUPERVISOR"], "/manager/dashboard"],
    [["EMPLOYEE", "PROJECT_MANAGER"], "/manager/dashboard"],
    [["EMPLOYEE", "PAYROLL_MANAGER"], "/payroll"],
    [["EMPLOYEE", "PAYROLL_OFFICER"], "/payroll"],
    [["employee", "super_admin"], "/dashboard"],
  ];
  for (const [roles, expected] of cases) {
    assert.equal(resolveRoleDashboard(roles), expected, roles.join(","));
  }
});

test("unlinked accounts are routed only from authoritative roles or grants", () => {
  assert.equal(resolveRoleDashboard(["SUPER_ADMIN"]), "/dashboard");
  assert.equal(resolveRoleDashboard(["HR_MANAGER"]), "/hr/dashboard");
  assert.equal(resolveRoleDashboard(["EMPLOYEE"]), "/employee/dashboard");
  assert.equal(resolveRoleDashboard(["EMPLOYEE"], true), "/dashboard");
  assert.equal(resolveRoleDashboard(["CUSTOM_UNKNOWN_ROLE"]), "/employee/dashboard");
  assert.equal(resolveRoleDashboard([]), "/employee/dashboard");
  assert.equal(resolveRoleDashboard(null, true), "/employee/dashboard");
});
