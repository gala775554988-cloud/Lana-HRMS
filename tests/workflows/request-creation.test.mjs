import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
const config = await load('config/request-routing.ts');
class ApprovalRoutingError extends Error { statusCode = 422; }
class NextResponse {
  constructor(data, options = {}) { this.data = data;this.status = options.status || 200; }
  static json(data, options) { return new NextResponse(data, options); }
  static redirect() { return new NextResponse({}, { status: 303 }); }
}
async function setup({ routingFailure = false, persistenceFailure = false, leaveTypeExists = true } = {}) {
  let records = [];let notifications = 0;let transactions = 0;
  const prisma = {
    employee: { findFirst: async () => ({ id: 'session-employee', userId: 'actor', gender: 'male' }) },
    auditLog: { create: async () => ({}) },
    $transaction: async callback => {
      transactions++;const draft = [...records];
      const tx = {
        letterRequest: { create: async ({ data }) => { const row = { id: 'r', ...data };draft.push(row);return row; } },
        loan: { create: async ({ data }) => { const row = { id: 'r', ...data };draft.push(row);return row; } },
        leaveType: { findFirst: async () => leaveTypeExists ? { id: 'lt', code: 'SICK' } : null },
      };
      const result = await callback(tx);records = draft;return result;
    },
  };
  const route = await load('app/api/hr/my-requests/route.ts', {
    'next/server': { NextResponse }, '@/auth': { auth: async () => ({ user: { id: 'actor' } }) }, '@/lib/prisma': { prisma },
    '@/config/request-routing': config, '@/lib/enterprise/request-routing-policy': { ApprovalRoutingError },
    '@/lib/enterprise/approval-engine': { resolveApprovalChain: async () => { if (routingFailure) throw new ApprovalRoutingError('No active approver');return [{ userId: 'hr', isMandatory: true }]; } },
    '@/lib/enterprise/workflow': {
      persistEnterpriseWorkflow: async (_tx, employeeId) => { assert.equal(employeeId, 'session-employee');if (persistenceFailure) throw new Error('Workflow insert failed');return { id: 'w' }; },
      notifyWorkflowSubmission: async () => { notifications++; },
    },
    '@/lib/errors': { formatApiError: error => ({ success: false, message: error.message }) },
    '@/lib/enterprise/leave-engine': { detectLeaveConflict: async () => null },
  });
  return { create: body => route.POST({ headers: new Map([['content-type', 'application/json']]), json: async () => body }), records: () => records, notifications: () => notifications, transactions: () => transactions };
}
test('failed workflow persistence rolls back the request and sends no notification', async () => {
  const s = await setup({ persistenceFailure: true });assert.equal((await s.create({ type: 'letter' })).status, 500);assert.equal(s.records().length, 0);assert.equal(s.notifications(), 0);
});
test('no approver blocks submission before any request is inserted', async () => {
  const s = await setup({ routingFailure: true });assert.equal((await s.create({ type: 'letter' })).status, 422);assert.equal(s.transactions(), 0);assert.equal(s.records().length, 0);
});
test('employee ids come from the session and document aliases use the same routing type', async () => {
  const s = await setup();assert.equal((await s.create({ type: 'documents', employeeId: 'another-employee' })).status, 200);assert.equal(s.records()[0].employeeId, 'session-employee');assert.equal(s.notifications(), 1);
});
test('unknown leave types are not silently converted to a different entitlement', async () => {
  const s = await setup({ leaveTypeExists: false });assert.equal((await s.create({ type: 'leave', leaveType: 'UNKNOWN', startDate: '2026-11-10', endDate: '2026-11-11' })).status, 400);assert.equal(s.records().length, 0);assert.equal(s.notifications(), 0);
});
test('loan submissions stay pending until final workflow approval', async () => {
  const s = await setup();assert.equal((await s.create({ type: 'loan', amount: 200 })).status, 200);assert.equal(s.records()[0].status, 'PENDING');
});
