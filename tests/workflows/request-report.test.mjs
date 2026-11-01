import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';
class NextResponse { static json(data, options = {}) { return { data, status: options.status ?? 200 }; } }
async function setup(loggedIn = true) {
  const rows = ['APPROVED', 'REJECTED', 'PENDING', 'CANCELLED'].map((status, i) => ({ id: String(i), entityId: 'leave'+i, type: 'LEAVE', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date(), currentStep: 1, employee: { id: 'employee', userId: 'actor', firstName: 'Test', lastName: 'Employee', employeeNumber: '001' }, steps: [{ step: 1, status: 'PENDING', approverUserId: 'actor', comments: null }] }));
  let visibility;
  const prisma = { workflowStep: { findMany: async () => [] }, workflowInstance: { findMany: async args => { visibility = args.where; return rows.map(row => structuredClone(row)); } }, leaveRequest: { findMany: async () => ['APPROVED', 'REJECTED', 'PENDING', 'CANCELLED'].map((status,i) => ({id:'leave'+i,status,days:3,leaveType:{name:'Annual'}})) }, user: {findMany: async () => []}, employee: { findMany: async () => [] } };
  const route = await load('app/api/enterprise/requests/route.ts', { 'next/server': { NextResponse }, '@/auth': { auth: async () => loggedIn ? {user:{id:'actor',roles:[],permissions:[]}} : null }, '@/config/request-routing': { canManageApprovalRouting: () => false }, '@/lib/prisma': {prisma}, '@/lib/enterprise/hierarchy': {getAccessProfile: async () => ({roles:[]}),applyScopedWhere: async () => ({id:'employee'})}, '@/lib/enterprise/workflow-step-metadata': {parseWorkflowStepMetadata: () => ({})} });
  return { get: query => route.GET({nextUrl: {searchParams: new URLSearchParams(query)}}), visibility: () => visibility };
}
test('leave bins follow final entity status instead of stale workflow labels', async () => {
  const s = await setup();
  for (const [scope, id] of [['completed','leave0'],['rejected','leave1'],['pending','leave2'],['cancelled','leave3']]) { const r = await s.get({scope,type:'LEAVE'}); assert.equal(r.data.total,1);assert.equal(r.data.requests[0].entityId,id);assert.equal(r.data.stats.completed,1); }
});
test('report includes all matches and preserves employee/assigned visibility', async () => {
  const s = await setup();const r = await s.get({report:'1'});assert.equal(r.data.requests.length,4);assert.equal(s.visibility().OR[0].employee.id,'employee');assert.equal(s.visibility().OR[1].steps.some.approverUserId,'actor');
});
test('anonymous reports and invalid date ranges are rejected', async () => {
  assert.equal((await (await setup(false)).get({report:'1'})).status,401);
  assert.equal((await (await setup()).get({from:'2026-11-05',to:'2026-11-01'})).status,400);
});
