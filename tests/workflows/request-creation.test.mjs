import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  const receipts = new Map();
  const prisma = {
    appSetting: { findUnique: async ({ where }) => receipts.get(where.key) },
    employee: { findFirst: async () => ({ id: 'session-employee', userId: 'actor', gender: 'male' }) },
    auditLog: { create: async () => ({}) },
    $transaction: async callback => {
      transactions++;const draft = [...records];
      const stagedReceipts = new Map();
      const tx = {
        appSetting: { create: async ({ data }) => { stagedReceipts.set(data.key, { value: data.value }); } },
        letterRequest: { create: async ({ data }) => { const row = { id: 'r', ...data };draft.push(row);return row; } },
        loan: { create: async ({ data }) => { const row = { id: 'r', ...data };draft.push(row);return row; } },
        leaveType: { findFirst: async () => leaveTypeExists ? { id: 'lt', code: 'SICK' } : null },
      };
      const result = await callback(tx);
      for (const key of stagedReceipts.keys()) {
        if (receipts.has(key)) throw Object.assign(new Error("Duplicate key"), { code: "P2002" });
      }
      for (const [key, value] of stagedReceipts) receipts.set(key, value);
      records = draft;
      return result;
    },
  };
  const route = await load('app/api/hr/my-requests/route.ts', {
    'node:crypto': { createHash }, 'next/server': { NextResponse }, '@/auth': { auth: async () => ({ user: { id: 'actor' } }) }, '@/lib/prisma': { prisma },
    '@/config/request-routing': config, '@/lib/enterprise/request-routing-policy': { ApprovalRoutingError },
    '@/lib/enterprise/approval-engine': { resolveApprovalChain: async () => { if (routingFailure) throw new ApprovalRoutingError('No active approver');return [{ userId: 'hr', isMandatory: true }]; } },
    '@/lib/enterprise/workflow': {
      persistEnterpriseWorkflow: async (_tx, employeeId) => { assert.equal(employeeId, 'session-employee');if (persistenceFailure) throw new Error('Workflow insert failed');return { id: 'w' }; },
      notifyWorkflowSubmission: async () => { notifications++; },
    },
    '@/lib/errors': { formatApiError: error => ({ success: false, message: error.message }) },
    '@/lib/enterprise/leave-engine': { detectLeaveConflict: async () => null },
  });
  return { create: (body, key) => route.POST({ headers: new Map([['content-type', 'application/json'], ['idempotency-key', key]]), json: async () => body }), records: () => records, notifications: () => notifications, transactions: () => transactions };
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

test('retrying a completed submission returns success without a new request or notification', async () => {
  const s = await setup();
  const key = "b36bc5fb-c3de-4a59-ad48-72420d8437de";
  assert.equal((await s.create({ type: 'letter' }, key)).status, 200);
  assert.equal((await s.create({ type: 'letter' }, key)).status, 200);
  assert.equal((await s.create({ type: "letter", purpose: "different" }, key)).status, 409);
  assert.equal(s.transactions(), 1);
  assert.equal(s.records().length, 1);
  assert.equal(s.notifications(), 1);
  assert.equal((await s.create({ type: 'letter' }, "invalid")).status, 400);
});

test("simultaneous retries commit only one request and send one notification", async () => {
  const s = await setup();
  const key = "f95c50f6-9568-4203-9500-e651cc1ddc5c";
  const responses = await Promise.all([
    s.create({ type: "letter" }, key),
    s.create({ type: "letter" }, key),
  ]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.equal(s.transactions(), 2);
  assert.equal(s.records().length, 1);
  assert.equal(s.notifications(), 1);
});
