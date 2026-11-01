import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { load } from './helpers.mjs';
const config = await load('config/request-routing.ts');
async function setup({ hr = true, admin = true, path = null } = {}) {
  const employees = {
    e: { id: 'e', userId: 'requester', companyId: 'company', managerId: 'm1', status: 'ACTIVE', user: { id: 'requester', isActive: true }, hospitalId: 'hospital' },
    m1: { id: 'm1', managerId: 'm2', status: 'ACTIVE', user: { id: 'manager1', isActive: true } },
    m2: { id: 'm2', managerId: null, status: 'ACTIVE', user: { id: 'manager2', isActive: true } },
    hr: { id: 'hr', managerId: null, status: 'ACTIVE', user: { id: 'hr-user', isActive: true } },
    finance: { id: 'finance', managerId: null, status: 'ACTIVE', user: { id: 'finance-user', isActive: true } },
  };
  const queries = [];
  const prisma = {
    employee: { findUnique: async ({ where }) => employees[where.id] || null },
    user: { findFirst: async ({ where }) => {
      const role = where.roles.some.role.name;
      const id = role === 'HR_MANAGER' && hr ? 'hr-user' : role === 'SUPER_ADMIN' && admin ? 'admin-user' : null;
      return id && id !== where.id?.not ? { id } : null;
    } },
    company: { findUnique: async () => ({ id: 'company' }) },
    appSetting: { findUnique: async () => null },
    approvalPath: { findFirst: async query => { queries.push(query);return path; } },
  };
  const policy = await load('lib/enterprise/request-routing-policy.ts', { zod: { z }, '@/lib/prisma': { prisma }, '@/config/request-routing': config });
  const dynamic = await load('lib/enterprise/dynamic-approval-routing.ts', { '@/lib/prisma': { prisma }, '@/config/request-routing': config, './request-routing-policy': policy });
  const engine = await load('lib/enterprise/approval-engine.ts', { '@/lib/prisma': { prisma }, '@/config/request-routing': config, './request-routing-policy': policy, './dynamic-approval-routing': dynamic });
  const rule = config.defaultRoutingRule('LEAVE');
  return { employees, queries, policy, rule, resolve: patch => dynamic.resolveDynamicRouting(employees.e, { ...rule, ...patch }), engine };
}
test('manager then HR produces two sequential, mandatory approvers', async () => {
  const s = await setup();const result = await s.resolve();
  assert.deepEqual(Array.from(result.approvers, x => x.userId), ['manager1', 'hr-user']);
  assert.ok(result.approvers.every(x => x.isMandatory));
});
test('HR-direct skips the manager; custom stages retain the chosen order', async () => {
  const s = await setup();assert.deepEqual(Array.from((await s.resolve({ mode: 'HR_DIRECT' })).approvers, x => x.userId), ['hr-user']);
  assert.deepEqual(Array.from((await s.resolve({ mode: 'CUSTOM', stages: [{ kind: 'EMPLOYEE', employeeId: 'finance' }, { kind: 'DIRECT_MANAGER' }, { kind: 'HR' }] })).approvers, x => x.userId), ['finance-user', 'manager1', 'hr-user']);
});
test('hierarchy cycles terminate and reach HR without duplicate approvers', async () => {
  const s = await setup();s.employees.m2.managerId = 'm1';
  const result = await s.resolve({ mode: 'HIERARCHY_HR' });
  assert.deepEqual(Array.from(result.approvers, x => x.userId), ['manager1', 'manager2', 'hr-user']);assert.ok(result.warnings.length);
});
test('missing or inactive managers fall back to HR, never auto-approval', async () => {
  const s = await setup();s.employees.m1.user.isActive = false;
  assert.deepEqual(Array.from((await s.resolve()).approvers, x => x.userId), ['hr-user']);
  s.employees.e.managerId = null;assert.equal((await s.resolve()).approvers[0].userId, 'hr-user');
});
test('no active HR or administrator blocks submission rather than approving', async () => {
  const s = await setup({ hr: false, admin: false });await assert.rejects(s.resolve(), /لا يوجد مسؤول/);
});
test('self-approval is rejected and an HR requester is routed to an independent substitute', async () => {
  const s = await setup();await assert.rejects(s.resolve({ mode: 'CUSTOM', stages: [{ kind: 'EMPLOYEE', employeeId: 'e' }] }), /لا يمكن/);
  s.employees.e.userId = 'hr-user';s.employees.e.user.id = 'hr-user';
  const result = await s.resolve({ mode: 'HR_DIRECT', hrEmployeeId: 'hr' });
  assert.equal(result.approvers[0].userId, 'admin-user');
});
test('unconfigured paths use the safe company defaults', async () => {
  const s = await setup();const result = await s.engine.resolveApprovalChain('e', 'leave');
  assert.deepEqual(Array.from(result, x => x.userId), ['manager1', 'hr-user']);
});
test('organizational paths take precedence and inactive mandatory approvers are not skipped', async () => {
  const stage = { isMandatory: true, name: 'Specific HR', approverEmployee: { userId: 'specific', status: 'ACTIVE', user: { isActive: true } } };
  const s = await setup({ path: { stages: [stage] } });assert.equal((await s.engine.resolveApprovalChain('e', 'documents'))[0].userId, 'specific');
  assert.equal(s.queries[0].where.requestType, 'DOCUMENT');
  stage.approverEmployee.user.isActive = false;await assert.rejects(s.engine.resolveApprovalChain('e', 'leave'), /غير نشط/);
});
test('routing schema rejects empty custom routes, invalid limits, and duplicate company rules', async () => {
  const s = await setup();
  assert.equal(s.policy.routingRuleSchema.safeParse({ ...s.rule, mode: 'CUSTOM', stages: [] }).success, false);
  assert.equal(s.policy.routingRuleSchema.safeParse({ ...s.rule, maxManagerLevels: 0 }).success, false);
  assert.equal(s.policy.routingSettingsSchema.safeParse({ rules: [s.rule, s.rule], version: null }).success, false);
  assert.equal(config.canManageApprovalRouting(['EMPLOYEE'], ['manage:requests']), false);
  assert.equal(config.canManageApprovalRouting(['EMPLOYEE'], ['manage:permissions']), true);
});
