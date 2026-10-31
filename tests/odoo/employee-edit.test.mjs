import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';

async function load(file, imports) {
  const context = vm.createContext({});
  const text = await fs.readFile(new URL('../../' + file, import.meta.url), 'utf8');
  const mod = new vm.SourceTextModule(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, { context });
  await mod.link(async name => {
    const exports = imports[name];
    if (!exports) throw new Error('Missing adapter ' + name);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await mod.evaluate();
  return mod.namespace;
}
async function setup({ phoneAccess = 'EDIT', permissions = ['edit:employees', 'read:employees'], existingManagerId = null } = {}) {
  const record = { id: 'employee', employeeNumber: '1', nationalId: '1234567890', firstName: 'Existing', lastName: 'Employee', hireDate: '2020-01-01', status: 'ACTIVE', phone: '123', managerId: existingManagerId };
  const writes = []; const cleared = [];
  const prisma = {
    user: { findUnique: async () => ({ username: 'actor' }) },
    employee: { findUnique: async () => record, update: async ({ data }) => { writes.push(data); return { ...record, ...data }; } },
    appSetting: { findUnique: async () => ({ value: { users: { actor: { phone: phoneAccess } } } }) },
  };
  const config = await load('config/hrms.ts', {});
  const validations = await load('lib/validations/hrms.ts', { zod: { z } });
  const access = await load('lib/enterprise/employee-field-access.ts', { '@/lib/prisma': { prisma }, '@/lib/audit': { writeAuditLog: async () => {} } });
  const actions = await load('lib/hrms/actions.ts', {
    'next/cache': { revalidatePath: () => {} },
    '@/lib/cache/memory-cache': { clearMemoryCache: key => cleared.push(key) },
    '@/auth': { auth: async () => ({ user: { id: 'actor', roles: ['EMPLOYEE'], permissions } }) },
    '@/config/hrms': { getHrmsModule: config.getHrmsModule },
    '@/lib/prisma': { prisma },
    '@/lib/rbac': { hasPermission: (perms, { action, resource }) => perms.includes(`${action}:${resource}`) },
    '@/lib/enterprise/hierarchy': { applyScopedWhere: () => ({}), canAccessEmployeeId: async () => true, getAccessProfile: async () => ({}), getHierarchyStore: async () => ({}) },
    '@/lib/audit': { writeAuditLog: async () => {} },
    '@/lib/validations/hrms': { buildModuleSchema: validations.buildModuleSchema },
    '@/lib/password': { generateTemporaryPassword: () => '', hashPassword: async () => '' },
    '@/lib/enterprise/notifications': { notifyRole: async () => {} },
    '@/lib/employee/salary-profile': { extractSalaryProfile: () => ({}) },
    '@/lib/employee/salary-profile-store': { saveEmployeeSalaryProfile: async () => {} },
    '@/lib/enterprise/social-insurance': { syncSocialInsuranceFromPayroll: async () => {} },
    '@/lib/auth/password-change-policy': { requirePasswordChange: () => {} },
    '@/lib/enterprise/resource-access': { isEnterpriseResourceAllowed: () => true },
    '@/lib/enterprise/hospitals': { getEmployeeIdsByHospital: async () => [] },
    '@/lib/perf/query-timer': { withQueryTiming: (_key, run) => run() },
    '@/lib/enterprise/employee-field-access': { getEmployeeFieldAccess: access.getEmployeeFieldAccess, filterEditableFields: access.filterEditableFields },
  });
  return { update: values => actions.updateModuleRecord({ resourceKey: 'employees', id: 'employee', values }), writes, cleared };
}

test('employee edits save changed fields and explicitly clear optional values', async () => {
  const s = await setup();
  assert.equal((await s.update({ firstName: 'Updated', phone: '', managerId: '' })).success, true);
  assert.equal(s.writes[0].firstName, 'Updated');
  assert.equal(s.writes[0].phone, null);
  assert.equal(s.writes[0].managerId, null);
  assert.ok(s.cleared.includes('emp-master:'));
});
test('view-only sensitive fields remain protected during a profile save', async () => {
  const s = await setup({ phoneAccess: 'VIEW' });
  assert.equal((await s.update({ firstName: 'Updated', phone: 'new-value' })).success, true);
  assert.equal(s.writes[0].firstName, 'Updated');
  assert.equal(Object.hasOwn(s.writes[0], 'phone'), false);
});
test('employees cannot be their own managers', async () => {
  const s = await setup();
  assert.equal((await s.update({ managerId: 'employee' })).success, false);
  assert.equal(s.writes.length, 0);
});
test('read-only users cannot mutate employee profiles', async () => {
  const s = await setup({ permissions: ['read:employees'] });
  await assert.rejects(s.update({ phone: 'new' }), /Forbidden/);
  assert.equal(s.writes.length, 0);
});

test('an unchanged legacy manager chain does not block unrelated employee edits', async () => {
  const s = await setup({ existingManagerId: 'legacy-cycle' });
  assert.equal((await s.update({ phone: 'new-value', managerId: 'legacy-cycle' })).success, true);
  assert.equal(s.writes[0].phone, 'new-value');
});
