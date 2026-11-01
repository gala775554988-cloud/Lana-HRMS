import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
const metadata = await load('lib/enterprise/workflow-step-metadata.ts');
class ApprovalRoutingError extends Error {}
async function setup({ type = 'LETTER', leaveCode = 'ANNUAL', self = false, deferred = false } = {}) {
  let state = { instance: { id: 'w', employeeId: 'e', type, entityId: 'r', status: 'PENDING', currentStep: 1 }, steps: [
    { id: 's1', workflowInstanceId: 'w', step: 1, approverUserId: self ? 'requester' : 'manager', status: deferred ? 'DEFERRED' : 'PENDING', capabilities: ['APPROVE', 'REJECT'], comments: '{"stageName":"Manager","slaHours":24}' },
    { id: 's2', workflowInstanceId: 'w', step: 2, approverUserId: 'hr', status: 'WAITING', capabilities: ['APPROVE', 'REJECT'], comments: '{"stageName":"HR","slaHours":24}' },
  ], entityStatus: 'PENDING', used: 0, audits: [], created: 0 };
  let resolutionCalls = 0;let queue = Promise.resolve();
  const approvers = [{ userId: 'new-manager', isMandatory: true, capabilities: ['APPROVE', 'REJECT'], stageName: 'New manager' }];
  const build = get => ({
    employee: { findUnique: async () => ({ userId: 'requester', odooRawData: {} }) },
    workflowInstance: {
      findUnique: async () => structuredClone({ ...get().instance, steps: get().steps }),
      findUniqueOrThrow: async () => structuredClone(get().instance),
      create: async ({ data }) => { get().created++;get().instance = { id: 'w', ...data };return structuredClone(get().instance); },
      updateMany: async ({ where, data }) => { const s = get();if (s.instance.status !== where.status || s.instance.currentStep !== where.currentStep) return { count: 0 };Object.assign(s.instance, data);return { count: 1 }; },
    },
    workflowStep: {
      createMany: async ({ data }) => { get().steps = data.map((row, index) => ({ id: 's'+(index+1), ...row }));return { count: data.length }; },
      findFirst: async () => get().steps.find(x => x.status === 'PENDING') || null,
      updateMany: async ({ where, data }) => { const step = get().steps.find(x => x.id === where.id && where.status.in.includes(x.status) && x.approverUserId === where.approverUserId);if (!step) return { count: 0 };Object.assign(step, data);return { count: 1 }; },
      update: async ({ where, data }) => Object.assign(get().steps.find(x => x.id === where.id), data),
    },
    auditLog: { create: async ({ data }) => { get().audits.push(data);return data; } },
    letterRequest: { update: async ({ data }) => { get().entityStatus = data.status;return data; } },
    expenseRequest: { update: async ({ data }) => { get().entityStatus = data.status;return data; } },
    resumptionRequest: { update: async ({ data }) => { get().entityStatus = data.status;return data; } },
    overtimeRequest: { update: async ({ data }) => { get().entityStatus = data.status;return data; } },
    loan: { update: async ({ data }) => { get().entityStatus = data.status;return data; } },
    leaveRequest: { update: async ({ data }) => { get().entityStatus = data.status;return { ...data, days: 3, leaveType: { code: leaveCode } }; } },
    employeeLeaveBalance: { upsert: async () => { get().used += 3;return {}; } },
  });
  const prisma = { ...build(() => state), $transaction: callback => {
    const task = queue.then(async () => { const draft = structuredClone(state);const result = await callback(build(() => draft));state = draft;return result; });queue = task.catch(() => {});return task;
  } };
  const api = await load('lib/enterprise/workflow.ts', {
    '@/lib/prisma': { prisma }, './request-routing-policy': { ApprovalRoutingError }, './workflow-step-metadata': metadata,
    '@/lib/enterprise/hierarchy': { resolveApprovalChain: async () => { resolutionCalls++;return approvers; } },
    '@/lib/enterprise/notifications': { createEnterpriseNotification: async () => {}, notifyUsers: async () => {} },
  });
  return { api, prisma, state: () => state, calls: () => resolutionCalls, decide: (actorUserId, decision = 'APPROVE', comments) => api.decideWorkflowStep({ workflowInstanceId: 'w', actorUserId, decision, comments }) };
}
test('requests move strictly from the manager to HR and only then complete', async () => {
  const s = await setup();await assert.rejects(s.decide('hr'), /Forbidden/);
  await s.decide('manager');assert.equal(s.state().instance.status, 'PENDING');assert.equal(s.state().instance.currentStep, 2);assert.equal(s.state().entityStatus, 'PENDING');
  await s.decide('hr');assert.equal(s.state().instance.status, 'COMPLETED');assert.equal(s.state().entityStatus, 'APPROVED');assert.equal(s.calls(), 0);
  assert.equal(metadata.parseWorkflowStepMetadata(s.state().steps[0].comments).stageName, 'Manager');
});
test('self-approval and decisions without an assigned approver are blocked', async () => {
  const s = await setup({ self: true });await assert.rejects(s.decide('requester'), /بنفسك/);assert.equal(s.state().audits.length, 0);
});
test('rejection and return require a reason and stop progression', async () => {
  const s = await setup();await assert.rejects(s.decide('manager', 'REJECT'), /سبب الرفض/);
  await s.decide('manager', 'RETURN', 'Correct attachments');assert.equal(s.state().instance.status, 'RETURNED');assert.equal(s.state().steps[1].status, 'WAITING');
  await assert.rejects(s.decide('hr'), /معلق/);
});
test('deferred requests can be explicitly decided by their assigned approver', async () => {
  const s = await setup({ deferred: true });await s.decide('manager');assert.equal(s.state().instance.currentStep, 2);
});
test('concurrent double clicks cannot approve twice or debit leave twice', async () => {
  const s = await setup({ type: 'LEAVE' });await s.decide('manager');
  const decisions = await Promise.allSettled([s.decide('hr'), s.decide('hr')]);
  assert.equal(decisions.filter(x => x.status === 'fulfilled').length, 1);assert.equal(s.state().used, 3);assert.equal(s.state().audits.length, 2);
});
test('medical leave never reduces the annual leave aggregate', async () => {
  const s = await setup({ type: 'LEAVE', leaveCode: 'SICK' });await s.decide('manager');await s.decide('hr');assert.equal(s.state().used, 0);assert.equal(s.state().entityStatus, 'APPROVED');
});
test('loan requests only become active after the final approval', async () => {
  const s = await setup({ type: 'LOAN' });await s.decide('manager');assert.equal(s.state().entityStatus, 'PENDING');await s.decide('hr');assert.equal(s.state().entityStatus, 'ACTIVE');
});
test('an empty or view-only chain cannot create an auto-approved instance', async () => {
  const s = await setup();await assert.rejects(s.api.persistEnterpriseWorkflow(s.prisma, 'e', 'LETTER', 'r', []), /إلزامي/);
  await assert.rejects(s.api.persistEnterpriseWorkflow(s.prisma, 'e', 'LETTER', 'r', [{ userId: 'x', isMandatory: false }]), /إلزامي/);assert.equal(s.state().created, 0);
});
test('creation snapshots names and SLA while activating only the first mandatory stage', async () => {
  const s = await setup();const result = await s.api.createEnterpriseWorkflow('e', 'LETTER', 'r');
  assert.equal(result.status, 'PENDING');assert.equal(s.state().steps[0].status, 'PENDING');assert.equal(metadata.parseWorkflowStepMetadata(s.state().steps[0].comments).stageName, 'New manager');
});
