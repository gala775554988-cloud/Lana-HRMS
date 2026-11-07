import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../workflows/helpers.mjs';

test('verified saved Odoo connection takes priority over legacy environment without choosing between multiple sources', async () => {
  let tested = [{ id: 'verified' }], saved = [], calls = [];
  const { getDefaultOdooConnectionId } = await load('lib/integrations/odoo/connection-choice.ts', {
    '@/lib/prisma': { prisma: { integrationConnection: { findMany: async query => {
      calls.push(query); return query.where.status === 'CONNECTED' ? tested : saved;
    } } } },
  });
  assert.equal(await getDefaultOdooConnectionId(true), 'verified');
  assert.equal(calls[0].where.provider.type, 'ODOO'); assert.equal(calls[0].where.provider.isActive, true);
  tested = []; assert.equal(await getDefaultOdooConnectionId(true), undefined);
  saved = [{ id: 'only-saved' }]; assert.equal(await getDefaultOdooConnectionId(false), 'only-saved');
  saved.push({ id: 'other' }); await assert.rejects(() => getDefaultOdooConnectionId(false), /حدد اتصالاً واحداً/);
  tested = [{ id: 'one' }, { id: 'two' }];
  await assert.rejects(() => getDefaultOdooConnectionId(true), /عدة اتصالات/);
});
