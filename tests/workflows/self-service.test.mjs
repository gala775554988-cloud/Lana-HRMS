import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
const lifecycle = await load('lib/self-service/lifecycle.ts', { zod: await import('zod') });
test('only the owner can change a request and final approval disables edit/cancel', () => {
  assert.throws(() => lifecycle.requireOwner('someone', 'actor'), /غير متاح/);
  for (const action of ['EDIT', 'CANCEL', 'RESUBMIT']) assert.throws(() => lifecycle.requireAction('COMPLETED', action));
  assert.doesNotThrow(() => lifecycle.requireAction('COMPLETED', 'REVOKE'));
  assert.throws(() => lifecycle.requireAction('RETURNED', 'EDIT'));
  assert.doesNotThrow(() => lifecycle.requireAction('RETURNED', 'RESUBMIT'));
});
test('edits reject mass assignment, reversed/invalid dates and invalid money; leave duration is server-calculated', () => {
  assert.throws(() => lifecycle.parseRequestEdit('LETTER', { purpose: 'x', employeeId: 'other' }));
  assert.throws(() => lifecycle.parseRequestEdit('LEAVE', { startDate: '2026-02-30', endDate: '2026-03-03', reason: '' }));
  assert.throws(() => lifecycle.parseRequestEdit('LEAVE', { startDate: '2026-11-08', endDate: '2026-11-05', reason: '' }));
  assert.equal(lifecycle.parseRequestEdit('LEAVE', { startDate: '2026-11-05', endDate: '2026-11-08', reason: '' }).days, 4);
  assert.throws(() => lifecycle.parseRequestEdit('EXPENSE', { amount: -10, category: 'x', description: '' }));
  const loan = lifecycle.parseRequestEdit('LOAN', { principalAmount: 1200, notes: '' });
  assert.equal(loan.outstandingAmount, 1200); assert.equal(loan.installmentAmount, 100);
});
function cancellation({ type = 'LEAVE', status = 'APPROVED', code = 'ANNUAL', payroll = false } = {}) {
  let used = 5; let changed = false;
  const model = { findUnique: async () => ({ id: 'r', employeeId: 'e', status, includedInPayrollAt: payroll ? new Date() : null }), updateMany: async () => { if (changed) return { count: 0 }; changed = true; status = 'CANCELLED'; return { count: 1 }; } };
  const tx = { leaveRequest: { ...model, findUniqueOrThrow: async () => ({ days: 3, leaveType: { code } }) }, overtimeRequest: model, loan: model, employeeLeaveBalance: { updateMany: async () => { used -= 3; } } };
  return { cancel: () => lifecycle.cancelEntity(tx, { id: 'w', type, entityId: 'r', employeeId: 'e' }, true), used: () => used };
}
test('approved revocation credits annual balance once; sick leave does not credit annual balance', async () => {
  const annual = cancellation(); await annual.cancel(); assert.equal(annual.used(), 2); await assert.rejects(annual.cancel()); assert.equal(annual.used(), 2);
  const sick = cancellation({ code: 'SICK' }); await sick.cancel(); assert.equal(sick.used(), 5);
});
test('financially settled overtime and active loans cannot be silently reversed', async () => {
  await assert.rejects(cancellation({ type: 'OVERTIME', payroll: true }).cancel(), /الرواتب/);
  await assert.rejects(cancellation({ type: 'LOAN', status: 'ACTIVE' }).cancel(), /تسوية/);
});
