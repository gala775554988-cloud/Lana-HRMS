import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { load } from '../workflows/helpers.mjs';

async function fixture({ binding = 'source', identity = '123' } = {}) {
  const assets = new Map(), settings = new Map();
  const setting = {
    findUnique: async () => binding ? { value: binding } : null,
    upsert: async ({ where, create, update }) => settings.set(where.key, settings.has(where.key) ? update : create),
  };
  const tx = { appSetting: setting, asset: {
    findUnique: async ({ where }) => assets.get(where.assetTag) ?? null,
    upsert: async ({ where, create, update }) => {
      const asset = assets.has(where.assetTag) ? { ...assets.get(where.assetTag), ...update } : { id: `local-${assets.size}`, ...create };
      assets.set(where.assetTag, asset); return asset;
    },
  } };
  const rows = [
    { id: 4, name: 'Custody 0004', description: 'Phone', employee_id: [864, 'Employee'], state: 'assigned', date_of_asset_delivery: '2025-11-19', asset_request_deliveryDate: '2027-11-02' },
    { id: 5, name: 'Pending', description: 'Laptop', employee_id: [864, 'Employee'], state: 'approve' },
    { id: 6, name: 'Unmatched', description: 'Tablet', employee_id: [999, 'Other employee'], state: 'assigned' },
    { id: 7, name: 'Returned', description: 'Monitor', employee_id: [864, 'Employee'], state: 'clearance', date_of_disclaimer: '2026-11-01' },
  ];
  const queried = [];
  const client = {
    execute: async (model, method) => {
      assert.equal(method, 'fields_get');
      if (model === 'hr.employee') return { identification_id: { type: 'char' } };
      assert.equal(model, 'asset.account.request');
      return Object.fromEntries(['name', 'description', 'state', 'date_of_asset_delivery', 'asset_request_deliveryDate', 'date_of_disclaimer'].map(key => [key, { type: 'char' }]).concat([['employee_id', { type: 'many2one', relation: 'hr.employee' }]]));
    },
    searchRead: async (model, domain, _fields, options) => {
      queried.push({ model, domain, options });
      return model === 'hr.employee' ? [{ id: 864, identification_id: identity }] : rows;
    },
  };
  const { importOdooCustodies } = await load('lib/integrations/odoo/custodies.ts', {
    'node:crypto': { createHash }, '@/lib/prisma': { prisma: { appSetting: setting,
      employee: { findMany: async () => [{ id: 'employee', odooId: 864, nationalId: '123', email: null }] },
      $transaction: async callback => callback(tx),
    } },
  });
  return { run: () => importOdooCustodies(client, 'source'), assets, settings, queried, rows };
}

test('custody import uses real model, skips pending requests, continues unmatched records and preserves source dates', async () => {
  const f = await fixture();
  const result = await f.run();
  assert.equal(result.createdCount, 2); assert.equal(result.pendingCount, 1); assert.equal(result.skippedCount, 1);
  assert.equal(result.errors[0].code, 'EMPLOYEE_NOT_MATCHED');
  const phone = [...f.assets.values()].find(asset => asset.name === 'Phone');
  assert.equal(phone.status, 'ASSIGNED'); assert.equal(phone.assignedEmployeeId, 'employee');
  assert.equal(phone.assignedAt.toISOString(), '2025-11-19T00:00:00.000Z');
  const returned = [...f.assets.values()].find(asset => asset.name === 'Monitor');
  assert.equal(returned.status, 'AVAILABLE'); assert.equal(returned.assignedEmployeeId, null);
  assert.equal(returned.returnedAt.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(JSON.parse(f.settings.get(`odoo.custody.record.${phone.id}`).create?.value ?? f.settings.get(`odoo.custody.record.${phone.id}`).value).dueAt, '2027-11-02T00:00:00.000Z');
  const retried = await f.run(); assert.equal(retried.updatedCount, 2); assert.equal(retried.createdCount, 0); assert.equal(f.assets.size, 2);
  assert.equal(f.queried[0].options.context.active_test, false); assert.equal(f.queried[0].options.order, 'id asc');
});

test('legacy employee imports require matching identity and never link by name alone', async () => {
  const verified = await fixture({ binding: null }); assert.equal((await verified.run()).createdCount, 2);
  const wrong = await fixture({ binding: null, identity: 'DIFFERENT' });
  const result = await wrong.run(); assert.equal(result.createdCount, 0); assert.equal(wrong.assets.size, 0);
  assert.equal(result.errors[0].code, 'EMPLOYEE_SOURCE_UNVERIFIED');
  const differentSource = await fixture({ binding: 'different-source' });
  await assert.rejects(differentSource.run(), /يختلف عن مصدر الموظفين/);
});

test('repeated remote cursor fails safely rather than looping', async () => {
  const f = await fixture(); f.rows[1].id = 4;
  await assert.rejects(f.run(), /تسلسل/); assert.equal(f.assets.size, 0);
});
