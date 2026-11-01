import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { load } from './helpers.mjs';
const config = await load('config/request-routing.ts');
class NextResponse {
  constructor(data, options = {}) { this.data = data;this.status = options.status || 200; }
  static json(data, options) { return new NextResponse(data, options); }
}
async function setup({ roles = ['HR_MANAGER'], permissions = [], loggedIn = true, conflict = false } = {}) {
  let writes = 0;let audits = 0;
  const prisma = {
    employee: { count: async () => 0 }, company: { count: async () => 0 },
    appSetting: { findUnique: async () => null },
    $transaction: async callback => {
      const snapshot = writes;
      try { return await callback({ appSetting: { updateMany: async () => { if (conflict) return { count: 0 };writes++;return { count: 1 }; }, create: async () => { writes++;return {}; }, findUniqueOrThrow: async () => ({ updatedAt: new Date('2026-11-01T10:00:00.000Z') }) }, auditLog: { create: async () => { audits++; } } }); }
      catch (error) { writes = snapshot;throw error; }
    },
  };
  const policy = await load('lib/enterprise/request-routing-policy.ts', { zod: { z }, '@/lib/prisma': { prisma }, '@/config/request-routing': config });
  const route = await load('app/api/enterprise/request-routing/route.ts', {
    'next/server': { NextResponse }, '@/auth': { auth: async () => loggedIn ? { user: { id: 'actor', roles, permissions } } : null }, '@/lib/prisma': { prisma }, '@/config/request-routing': config,
    '@/lib/enterprise/request-routing-policy': policy, '@/lib/enterprise/approval-engine': { resolveApprovalChain: async () => [] },
  });
  return { put: body => route.PUT({ json: async () => body }), writes: () => writes, audits: () => audits };
}
test('anonymous users and ordinary request managers cannot change global routing', async () => {
  const anon = await setup({ loggedIn: false });assert.equal((await anon.put({})).status, 401);
  const manager = await setup({ roles: ['EMPLOYEE'], permissions: ['manage:requests'] });assert.equal((await manager.put({})).status, 403);assert.equal(manager.writes(), 0);
});
test('authorized changes persist with an audit trail', async () => {
  const s = await setup();const result = await s.put({ rules: [config.defaultRoutingRule('LEAVE')], version: null });assert.equal(result.status, 200);assert.equal(s.writes(), 1);assert.equal(s.audits(), 1);
});
test('a stale settings version never overwrites a newer routing configuration', async () => {
  const s = await setup({ conflict: true });const result = await s.put({ rules: [config.defaultRoutingRule('LEAVE')], version: '2026-11-01T09:00:00.000Z' });assert.equal(result.status, 409);assert.equal(s.writes(), 0);assert.equal(s.audits(), 0);
});
