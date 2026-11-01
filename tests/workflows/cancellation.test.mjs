import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
class NextResponse { constructor(data, options = {}) { this.data = data;this.status = options.status || 200; }static json(data, options) { return new NextResponse(data, options); } }
async function setup({ status = 'PENDING', code = 'ANNUAL', conflict = false, owner = 'employee' } = {}) {
  let state = { status, workflowStatus: status === 'APPROVED' ? 'COMPLETED' : 'PENDING', used: 5, audit: 0, stepsCancelled: false };
  const prisma = {
    employee: { findFirst: async () => ({ id: 'employee' }) },
    $transaction: async run => {
      const draft = structuredClone(state);
      const tx = {
        leaveRequest: { findUnique: async () => ({ id: 'r', employeeId: owner, status: draft.status, startDate: new Date(Date.now() + 864000000), days: 3, leaveType: { code } }), updateMany: async ({ where, data }) => { if (conflict || where.status !== draft.status) return { count: 0 };draft.status = data.status;return { count: 1 }; } },
        workflowInstance: { findMany: async () => [{ id: 'w', status: draft.workflowStatus }], updateMany: async ({ where, data }) => { if (where.status !== draft.workflowStatus) return { count: 0 };draft.workflowStatus = data.status;return { count: 1 }; } },
        workflowStep: { updateMany: async () => { draft.stepsCancelled = true;return { count: 2 }; } },
        employeeLeaveBalance: { updateMany: async () => { draft.used -= 3;return { count: 1 }; } },
        auditLog: { create: async () => { draft.audit++; } },
      };
      const result = await run(tx);state = draft;return result;
    },
  };
  const route = await load('app/api/hr/my-requests/leave/[id]/cancel/route.ts', { 'next/server': { NextResponse }, '@/auth': { auth: async () => ({ user: { id: 'actor' } }) }, '@/lib/prisma': { prisma } });
  return { cancel: () => route.POST({}, { params: Promise.resolve({ id: 'r' }) }), state: () => state };
}
test('cancellation withdraws the workflow and its pending steps atomically', async () => {
  const s = await setup();assert.equal((await s.cancel()).status, 200);assert.equal(s.state().workflowStatus, 'CANCELLED');assert.equal(s.state().stepsCancelled, true);assert.equal(s.state().used, 5);assert.equal(s.state().audit, 1);
});
test('approved annual leave is credited once, with no duplicate cancellation', async () => {
  const s = await setup({ status: 'APPROVED' });assert.equal((await s.cancel()).status, 200);assert.equal(s.state().used, 2);assert.equal((await s.cancel()).status, 409);assert.equal(s.state().used, 2);
});
test('cancelling special or sick leave does not credit annual leave', async () => {
  const s = await setup({ status: 'APPROVED', code: 'SICK' });assert.equal((await s.cancel()).status, 200);assert.equal(s.state().used, 5);
});
test('a concurrent state change rolls back every cancellation side effect', async () => {
  const s = await setup({ conflict: true });assert.equal((await s.cancel()).status, 409);assert.equal(s.state().workflowStatus, 'PENDING');assert.equal(s.state().status, 'PENDING');assert.equal(s.state().audit, 0);
});
test('employees cannot cancel another employee’s request', async () => {
  const s = await setup({ owner: 'another-employee' });assert.equal((await s.cancel()).status, 404);assert.equal(s.state().status, 'PENDING');
});
