import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
const lifecycle = await load('lib/self-service/lifecycle.ts', { zod: await import('zod'), '@/lib/employee/hr-approval-services': { isHRPaymentType: () => false } });
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
function cancellation({ type = 'LEAVE', status = 'APPROVED', code = 'ANNUAL', payroll = false, paidPeriod = false, finalPaid = false } = {}) {
  let used = 5; let changed = false; const checks=[];
  const model = { findUnique: async () => ({ id: 'r', employeeId: 'e', status, includedInPayrollAt: payroll ? new Date() : null }), updateMany: async () => { if (changed) return { count: 0 }; changed = true; status = 'CANCELLED'; return { count: 1 }; } };
  const tx = {
    leaveRequest: { ...model, findUniqueOrThrow: async () => ({ days: 3, startDate:new Date("2026-11-01"), endDate:new Date("2026-11-03"), leaveType: { code } }) },
    overtimeRequest: model, loan: model,
    payrollItem:{findFirst:async args=>{checks.push(args.where);return paidPeriod?{id:"paid-run"}:null;}},
    employeeFinalSettlement:{findFirst:async args=>{checks.push(args.where);return finalPaid?{id:"paid-settlement"}:null;}},
    employeeLeaveBalance: { updateMany: async ({where,data}) => {
      assert.equal(where.employeeId,"e");
      if(used<Number(where.used.gte))return {count:0};
      used-=data.used.decrement;return {count:1};
    } }
  };
  return { cancel: () => lifecycle.cancelEntity(tx, { id: 'w', type, entityId: 'r', employeeId: 'e' }, true), used: () => used, status:()=>status, checks };
}
test('approved revocation credits annual balance once; sick leave does not credit annual balance', async () => {
  const annual = cancellation(); await annual.cancel(); assert.equal(annual.used(), 2); await assert.rejects(annual.cancel()); assert.equal(annual.used(), 2);
  const sick = cancellation({ code: 'SICK' }); await sick.cancel(); assert.equal(sick.used(), 5);
});
test('financially settled overtime and active loans cannot be silently reversed', async () => {
  await assert.rejects(cancellation({ type: 'OVERTIME', payroll: true }).cancel(), /الرواتب/);
  await assert.rejects(cancellation({ type: 'LOAN', status: 'ACTIVE' }).cancel(), /تسوية/);
});

test("paid payroll periods and paid final settlements block revocation before changing leave or balance",async()=>{
  const paid=cancellation({paidPeriod:true}); await assert.rejects(paid.cancel(),/مسير مصروف/);assert.equal(paid.used(),5);assert.equal(paid.status(),"APPROVED");assert.equal(paid.checks[0].employeeId,"e");assert.equal(paid.checks[0].payrollRun.paidAt.not,null);assert.equal(paid.checks[0].payrollRun.periodStartDate.lte.toISOString(),"2026-11-03T00:00:00.000Z");
  const final=cancellation({finalPaid:true});await assert.rejects(final.cancel(),/مخالصة نهائية/);assert.equal(final.used(),5);assert.equal(final.status(),"APPROVED");assert.equal(final.checks[1].status,"PAID");
});
