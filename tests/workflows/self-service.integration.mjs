// Run only against a disposable local database with all migrations applied.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { load } from './helpers.mjs';
const url = new URL(process.env.SELF_SERVICE_TEST_DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('A disposable local *_test database is required');
const prisma = new PrismaClient({ datasourceUrl: url.href });
const lifecycle = await load('lib/self-service/lifecycle.ts', { zod: await import('zod') });
const metadata = await load('lib/enterprise/workflow-step-metadata.ts');
const suffix = randomUUID();
let employee; let leaveType; const users = [];
let actor;
try {
  for (let index = 0; index < 5; index++) users.push(await prisma.user.create({ data: { name: `Lifecycle ${index}`, username: `ss-${suffix}-${index}` } }));
  actor = users[0].id;
  employee = await prisma.employee.create({ data: { employeeNumber: `SS-${suffix}`, nationalId: `SS-${suffix}`, firstName: 'Self', lastName: 'Service', hireDate: new Date(), userId: actor } });
  leaveType = await prisma.leaveType.create({ data: { name: 'Annual integration', code: `ANNUAL-${suffix}` } });
  const approvers = users.slice(1).map((user, index) => ({ userId: user.id, isMandatory: true, capabilities: ['APPROVE', 'REJECT'], stageName: ['Direct manager', 'Department', 'HR', 'Final'][index] }));
  class ApprovalRoutingError extends Error {}
  const workflow = await load('lib/enterprise/workflow.ts', {
    '@/lib/prisma': { prisma }, '@/lib/self-service/lifecycle': lifecycle,
    './request-routing-policy': { ApprovalRoutingError }, './workflow-step-metadata': metadata,
    '@/lib/enterprise/hierarchy': { resolveApprovalChain: async () => approvers },
    '@/lib/enterprise/notifications': { createEnterpriseNotification: async () => {}, notifyUsers: async () => {} },
  });
  class NextResponse { static json(data, options = {}) { return { data, status: options.status ?? 200 }; } }
  const endpoint = await load('app/api/self-service/[id]/route.ts', {
    'next/server': { NextResponse }, '@/auth': { auth: async () => ({ user: { id: actor } }) }, '@/lib/prisma': { prisma },
    '@/lib/enterprise/approval-engine': { resolveApprovalChain: async () => approvers },
    '@/lib/enterprise/workflow': workflow, '@/lib/self-service/lifecycle': lifecycle,
  });
  const post = (id, body) => endpoint.POST({ json: async () => body }, { params: Promise.resolve({ id }) });
  await prisma.employeeLeaveBalance.create({ data: { employeeId: employee.id, accrued: 30, used: 0 } });
  const leave = await prisma.leaveRequest.create({ data: { employeeId: employee.id, leaveTypeId: leaveType.id, startDate: new Date('2027-01-01'), endDate: new Date('2027-01-02'), days: 2 } });
  let current = await workflow.createEnterpriseWorkflow(employee.id, 'LEAVE', leave.id);
  actor = users[1].id;
  assert.equal((await post(current.id, { action: 'CANCEL' })).status, 404);
  actor = users[0].id;
  const edit = await post(current.id, { action: 'EDIT', data: { startDate: '2027-01-01', endDate: '2027-01-03', reason: 'Revised' } });
  assert.equal(edit.status, 200); assert.equal((await prisma.workflowInstance.findUniqueOrThrow({ where: { id: current.id } })).status, 'SUPERSEDED');
  current = edit.data.workflow;
  await workflow.decideWorkflowStep({ workflowInstanceId: current.id, actorUserId: users[1].id, decision: 'RETURN', comments: 'Please clarify' });
  const resubmit = await post(current.id, { action: 'RESUBMIT', data: { startDate: '2027-01-01', endDate: '2027-01-03', reason: 'Clarified' } });
  assert.equal(resubmit.status, 200); current = resubmit.data.workflow;
  const parallel = await Promise.allSettled([1, 2].map(() => workflow.decideWorkflowStep({ workflowInstanceId: current.id, actorUserId: users[1].id, decision: 'APPROVE' })));
  assert.equal(parallel.filter(item => item.status === 'fulfilled').length, 1);
  for (const user of users.slice(2)) await workflow.decideWorkflowStep({ workflowInstanceId: current.id, actorUserId: user.id, decision: 'APPROVE' });
  assert.equal((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status, 'APPROVED');
  assert.equal(Number((await prisma.employeeLeaveBalance.findUniqueOrThrow({ where: { employeeId: employee.id } })).used), 3);
  assert.equal((await post(current.id, { action: 'CANCEL' })).status, 409);
  const revoke = await post(current.id, { action: 'REVOKE', reason: 'Plans changed' }); assert.equal(revoke.status, 200);
  assert.equal((await post(current.id, { action: 'REVOKE', reason: 'Duplicate' })).status, 409);
  for (const user of users.slice(1)) await workflow.decideWorkflowStep({ workflowInstanceId: revoke.data.workflow.id, actorUserId: user.id, decision: 'APPROVE' });
  assert.equal((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status, 'CANCELLED');
  assert.equal(Number((await prisma.employeeLeaveBalance.findUniqueOrThrow({ where: { employeeId: employee.id } })).used), 0);
  await assert.rejects(workflow.decideWorkflowStep({ workflowInstanceId: revoke.data.workflow.id, actorUserId: users[4].id, decision: 'APPROVE' }));
  console.log('PASS: ownership, edit, return/resubmit, four approvals, single debit, duplicate revocation guard, approved reversal and no double credit');
} finally {
  if (employee) {
    const instances = await prisma.workflowInstance.findMany({ where: { employeeId: employee.id }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { entity: 'workflowInstance', entityId: { in: instances.map(row => row.id) } } });
    await prisma.workflowInstance.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });
  }
  if (leaveType) await prisma.leaveType.delete({ where: { id: leaveType.id } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await prisma.$disconnect();
}
